/**
 * Mission summaries: the slice of a mission the map, unlock rules and progress
 * screens read (docs/07-architecture.md §7, "Content loading").
 *
 * The full mission (tests, hints, debrief) is large and only needed once a
 * mission is opened, so the browser ships this index instead and fetches the
 * rest on demand. The schema is derived from `MissionSchema`, so a rename there
 * breaks the build instead of silently drifting.
 */

import { z } from 'zod';

import { MissionSchema, type Mission } from './schema';

export const MissionSummarySchema = MissionSchema.pick({
  id: true,
  world: true,
  order: true,
  title: true,
  subtitle: true,
}).extend({
  prerequisites: MissionSchema.shape.prerequisites.pick({ missions: true }),
  workshop: MissionSchema.shape.workshop.pick({ systemId: true, to: true }),
  reward: MissionSchema.shape.reward.pick({ narrative: true }),
});

export type MissionSummary = z.infer<typeof MissionSummarySchema>;

export const MissionIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    missions: z.array(MissionSummarySchema),
  })
  .strict();

export type MissionIndex = z.infer<typeof MissionIndexSchema>;

export function summarizeMission(mission: Mission): MissionSummary {
  return {
    id: mission.id,
    world: mission.world,
    order: mission.order,
    title: mission.title,
    subtitle: mission.subtitle,
    prerequisites: { missions: [...mission.prerequisites.missions] },
    workshop: { systemId: mission.workshop.systemId, to: mission.workshop.to },
    reward: { narrative: mission.reward.narrative },
  };
}

/** Deterministic: sorted by id, so regenerating never produces a spurious diff. */
export function buildMissionIndex(missions: readonly Mission[]): MissionIndex {
  return {
    schemaVersion: 1,
    missions: missions
      .map(summarizeMission)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}
