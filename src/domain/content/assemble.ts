/**
 * The pure content pipeline: raw records in, validated bundle plus issue list
 * out. docs/07-architecture.md §7.
 *
 * Order matters. Structural validation runs first because every later check
 * assumes a well-formed mission; running lints on a record that failed V1 would
 * produce noise instead of signal.
 */

import { type ContentIssue, error } from './errors';
import {
  ConceptRegistrySchema,
  ReinforcementRegistrySchema,
  WorkshopRegistrySchema,
  WorldsRegistrySchema,
  type Concept,
  type Mission,
  type World,
  type WorkshopSystem,
} from './schema';
import { validateMissionShape, validateReferences, findPrerequisiteCycles } from './validate';
import { lintMission, lintWorkshopTimeline } from './lint';
import { buildSequence, checkCoverage, checkWorlds } from './coverage';
import { lintVariants } from './variants';

export interface RawMissionRecord {
  /** Path relative to the project root, used in issue messages. */
  source: string;
  data: unknown;
}

export interface RawContent {
  missionRecords: readonly RawMissionRecord[];
  concepts: unknown;
  workshop: unknown;
  worlds: unknown;
  reinforcement: unknown;
}

export interface ContentBundle {
  missions: Mission[];
  concepts: Concept[];
  systems: WorkshopSystem[];
  worlds: World[];
  sequenceById: Map<string, number>;
}

export interface ContentReport {
  bundle: ContentBundle | null;
  issues: ContentIssue[];
}

function describeRegistryFailure(label: string, issues: readonly { path: (string | number)[]; message: string }[]): ContentIssue[] {
  return issues.map((issue) =>
    error('REF_REGISTRY', `${label}: ${issue.path.join('.') || '<root>'} — ${issue.message}`, {
      source: `content/${label}.json`,
      path: issue.path.join('.') || undefined,
    }),
  );
}

export function assembleContent(raw: RawContent): ContentReport {
  const issues: ContentIssue[] = [];

  // --- Registries ---------------------------------------------------------
  const conceptsParsed = ConceptRegistrySchema.safeParse(raw.concepts);
  const workshopParsed = WorkshopRegistrySchema.safeParse(raw.workshop);
  const worldsParsed = WorldsRegistrySchema.safeParse(raw.worlds);
  const reinforcementParsed = ReinforcementRegistrySchema.safeParse(raw.reinforcement);

  if (!conceptsParsed.success) {
    issues.push(...describeRegistryFailure('concepts', conceptsParsed.error.issues));
  }
  if (!workshopParsed.success) {
    issues.push(...describeRegistryFailure('workshop', workshopParsed.error.issues));
  }
  if (!worldsParsed.success) {
    issues.push(...describeRegistryFailure('worlds', worldsParsed.error.issues));
  }
  if (!reinforcementParsed.success) {
    issues.push(...describeRegistryFailure('reinforcement', reinforcementParsed.error.issues));
  }

  if (
    !conceptsParsed.success ||
    !workshopParsed.success ||
    !worldsParsed.success ||
    !reinforcementParsed.success
  ) {
    // Registries are the reference frame for every mission check. Without them
    // the only honest output is "fix the registries first".
    return { bundle: null, issues };
  }

  const concepts = conceptsParsed.data.concepts;
  const systems = workshopParsed.data.systems;
  const worlds = worldsParsed.data.worlds;
  const reinforcementIds = new Set(reinforcementParsed.data.variants.map((variant) => variant.id));

  // Duplicate concept ids would make coverage double-count silently.
  const conceptIds = new Set<string>();
  for (const concept of concepts) {
    if (conceptIds.has(concept.id)) {
      issues.push(
        error('REF_REGISTRY', `concept "${concept.id}" is declared twice`, {
          source: 'content/concepts.json',
        }),
      );
    }
    conceptIds.add(concept.id);
  }

  const systemMap = new Map<string, WorkshopSystem>();
  for (const system of systems) {
    if (systemMap.has(system.id)) {
      issues.push(
        error('REF_REGISTRY', `workshop system "${system.id}" is declared twice`, {
          source: 'content/workshop.json',
        }),
      );
    }
    systemMap.set(system.id, system);
  }

  // --- Missions: structural ----------------------------------------------
  const missions: Mission[] = [];
  const idToSource = new Map<string, string>();

  for (const record of raw.missionRecords) {
    const shape = validateMissionShape(record.data, record.source);
    issues.push(...shape.issues);
    if (shape.mission === null) continue;

    const mission = shape.mission;
    const previousSource = idToSource.get(mission.id);
    if (previousSource !== undefined) {
      issues.push(
        error(
          'REF_DUP_MISSION',
          `mission id "${mission.id}" appears in both ${previousSource} and ${record.source}`,
          { missionId: mission.id, source: record.source, path: 'id' },
        ),
      );
      continue;
    }
    idToSource.set(mission.id, record.source);
    missions.push(mission);
  }

  // --- Missions: referential and pedagogical -----------------------------
  const sequenceById = buildSequence(worlds);
  const referenceContext = {
    missions,
    conceptIds,
    systems: systemMap,
    sequenceById,
    reinforcementIds,
  };
  const lintContext = { missions, systems: systemMap, sequenceById };

  for (const mission of missions) {
    const source = idToSource.get(mission.id);
    issues.push(...validateReferences(mission, referenceContext, source));
    issues.push(...lintMission(mission, lintContext, source));
  }

  // --- Cross-mission ------------------------------------------------------
  for (const cycle of findPrerequisiteCycles(missions)) {
    issues.push(
      error(
        'REF_CYCLE',
        `prerequisite cycle: ${cycle.join(' → ')}`,
        { missionId: cycle[0], path: 'prerequisites.missions' },
      ),
    );
  }

  issues.push(...checkWorlds(missions, worlds));
  issues.push(...lintWorkshopTimeline(missions, systemMap, sequenceById));
  issues.push(...checkCoverage(missions, worlds, concepts));
  issues.push(...lintVariants(reinforcementParsed.data.variants, concepts, missions));

  return {
    bundle: { missions, concepts, systems, worlds, sequenceById },
    issues,
  };
}
