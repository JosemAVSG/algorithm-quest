/**
 * The lightweight content the app needs before any mission is opened:
 * registries plus the mission index. Full-mission rules (lints, coverage,
 * references) run in CI through `assembleContent`; here only the shapes the UI
 * depends on are checked, so a hand-edited registry still fails loudly.
 */

import { type ContentIssue, error } from './errors';
import {
  ConceptRegistrySchema,
  ReinforcementRegistrySchema,
  WorkshopRegistrySchema,
  WorldsRegistrySchema,
  type Concept,
  type ReinforcementVariant,
  type World,
  type WorkshopSystem,
} from './schema';
import { MissionIndexSchema, type MissionSummary } from './summary';

export interface ContentCatalog {
  missions: MissionSummary[];
  concepts: Concept[];
  systems: WorkshopSystem[];
  worlds: World[];
  /** Short review exercises, offered when a concept is weak (docs/05 §8). */
  variants: ReinforcementVariant[];
}

export interface CatalogReport {
  catalog: ContentCatalog | null;
  issues: ContentIssue[];
}

export interface RawCatalog {
  index: unknown;
  concepts: unknown;
  workshop: unknown;
  worlds: unknown;
  reinforcement: unknown;
}

function failures(
  source: string,
  issues: readonly { path: (string | number)[]; message: string }[],
): ContentIssue[] {
  return issues.map((issue) =>
    error('REF_REGISTRY', `${source}: ${issue.path.join('.') || '<root>'} — ${issue.message}`, {
      source: `content/${source}.json`,
    }),
  );
}

export function assembleCatalog(raw: RawCatalog): CatalogReport {
  const index = MissionIndexSchema.safeParse(raw.index);
  const concepts = ConceptRegistrySchema.safeParse(raw.concepts);
  const workshop = WorkshopRegistrySchema.safeParse(raw.workshop);
  const worlds = WorldsRegistrySchema.safeParse(raw.worlds);
  const reinforcement = ReinforcementRegistrySchema.safeParse(raw.reinforcement);

  if (
    !index.success ||
    !concepts.success ||
    !workshop.success ||
    !worlds.success ||
    !reinforcement.success
  ) {
    return {
      catalog: null,
      issues: [
        ...(index.success ? [] : failures('index', index.error.issues)),
        ...(concepts.success ? [] : failures('concepts', concepts.error.issues)),
        ...(workshop.success ? [] : failures('workshop', workshop.error.issues)),
        ...(worlds.success ? [] : failures('worlds', worlds.error.issues)),
        ...(reinforcement.success ? [] : failures('reinforcement', reinforcement.error.issues)),
      ],
    };
  }

  return {
    catalog: {
      missions: index.data.missions,
      concepts: concepts.data.concepts,
      systems: workshop.data.systems,
      worlds: worlds.data.worlds,
      variants: reinforcement.data.variants,
    },
    issues: [],
  };
}
