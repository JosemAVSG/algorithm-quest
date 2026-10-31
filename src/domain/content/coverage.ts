/**
 * Curriculum invariants: world membership, play order, and concept coverage.
 *
 * The coverage rule is docs/03 §4 made executable:
 *     for each concept, missions teaching it (primary or secondary) >= 2
 *
 * It is scoped by world status on purpose. A world marked `in-progress` is
 * allowed to be incomplete — otherwise CI would be red for the entire build-out
 * of World 1 and the signal would be worthless. A world marked `complete` is
 * not allowed to under-deliver.
 */

import { type ContentIssue, error, warning } from './errors';
import type { Concept, Mission, World } from './schema';

/** Global play order: world position first, then position inside the world. */
export function buildSequence(worlds: readonly World[]): Map<string, number> {
  const sequence = new Map<string, number>();
  let counter = 0;
  for (const world of worlds) {
    for (const missionId of world.missionIds) {
      if (!sequence.has(missionId)) sequence.set(missionId, counter);
      counter += 1;
    }
  }
  return sequence;
}

export function checkWorlds(
  missions: readonly Mission[],
  worlds: readonly World[],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const membership = new Map<string, string>();

  for (const world of worlds) {
    for (const missionId of world.missionIds) {
      const previous = membership.get(missionId);
      if (previous !== undefined) {
        issues.push(
          error(
            'REF_WORLD',
            `mission "${missionId}" is listed more than once in content/worlds.json (first in "${previous}", again in "${world.id}")`,
            { missionId, path: 'worlds' },
          ),
        );
      } else {
        membership.set(missionId, world.id);
      }
    }

    if (world.status === 'complete') {
      const missing = world.missionIds.filter(
        (missionId) => !missions.some((mission) => mission.id === missionId),
      );
      if (missing.length > 0) {
        issues.push(
          error(
            'WORLD_INCOMPLETE',
            `world "${world.id}" is marked complete but these missions have no content file: ${missing.join(', ')}`,
            { path: 'worlds' },
          ),
        );
      }
      if (world.missionIds.length === 0) {
        issues.push(
          warning('WORLD_INCOMPLETE', `world "${world.id}" is marked complete but lists no missions`, {
            path: 'worlds',
          }),
        );
      }
    }
  }

  for (const mission of missions) {
    const worldId = membership.get(mission.id);
    if (worldId === undefined) {
      issues.push(
        error(
          'REF_WORLD',
          `mission "${mission.id}" is not listed in any world in content/worlds.json`,
          { missionId: mission.id, path: 'worlds' },
        ),
      );
      continue;
    }
    if (worldId !== mission.world) {
      issues.push(
        error(
          'REF_WORLD',
          `mission "${mission.id}" declares world "${mission.world}" but is listed under "${worldId}"`,
          { missionId: mission.id, path: 'world' },
        ),
      );
    }

    const world = worlds.find((candidate) => candidate.id === worldId);
    const position = world?.missionIds.indexOf(mission.id) ?? -1;
    if (position >= 0 && mission.order !== position + 1) {
      issues.push(
        error(
          'REF_WORLD_ORDER',
          `mission "${mission.id}" has order ${mission.order} but is at position ${position + 1} in "${worldId}"`,
          { missionId: mission.id, path: 'order' },
        ),
      );
    }
  }

  return issues;
}

/**
 * Concept coverage. Counts a mission once per concept it teaches, in either
 * role. Reinforcement variants are not counted: the doc's rule is about
 * authored missions, and a variant that is skipped cannot prove anything.
 */
export function checkCoverage(
  missions: readonly Mission[],
  worlds: readonly World[],
  concepts: readonly Concept[],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const completeWorlds = new Set(
    worlds.filter((world) => world.status === 'complete').map((world) => world.id),
  );

  for (const concept of concepts) {
    if (!completeWorlds.has(concept.world)) continue;

    const teaching = missions.filter(
      (mission) =>
        mission.concepts.primary === concept.id ||
        mission.concepts.secondary.includes(concept.id),
    );

    if (teaching.length < 2) {
      issues.push(
        error(
          'COVERAGE_INSUFFICIENT',
          `concept ${concept.id} (${concept.label}) is taught by ${teaching.length} mission(s); world "${concept.world}" is complete, so at least 2 are required`,
          { path: `concepts.${concept.id}` },
        ),
      );
    }
  }

  return issues;
}
