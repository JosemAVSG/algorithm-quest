/**
 * Mission availability (docs/05-mastery.md §9, docs/10-testing-and-security.md PG1).
 *
 * Milestone 1 needs exactly one rule: a mission is available when every mission
 * in `prerequisites.missions` is completed. Concept-level gates (PG2, PG6) and
 * the world gate (PG4/PG5) belong to Milestone 4, where mastery exists to answer
 * "is this concept at the required level". Implementing them here would mean
 * inventing a level model before the model is specified.
 *
 * The function is intentionally total: every mission passed in gets a state, so
 * a caller can render the whole map without asking a second question.
 */

import type { MissionSummary } from '../content/summary';

export type MissionState = 'locked' | 'available' | 'completed';

export function missionStates(
  missions: readonly MissionSummary[],
  completedIds: ReadonlySet<string>,
): Map<string, MissionState> {
  const states = new Map<string, MissionState>();

  for (const mission of missions) {
    if (completedIds.has(mission.id)) {
      states.set(mission.id, 'completed');
      continue;
    }

    const blocked = mission.prerequisites.missions.some((id) => !completedIds.has(id));
    states.set(mission.id, blocked ? 'locked' : 'available');
  }

  return states;
}

/** Mission ids a mission is still waiting on, in declared order. */
export function missingPrerequisites(
  mission: MissionSummary,
  completedIds: ReadonlySet<string>,
): string[] {
  return mission.prerequisites.missions.filter((id) => !completedIds.has(id));
}

/**
 * The single mission the map highlights. Never a menu of choices
 * (docs/06-ux-flows.md §3, "the next mission is chosen by the engine").
 *
 * Ties are broken by `order`, then by id, so the result is deterministic even
 * for two missions that are both available.
 */
export function nextMission(
  missions: readonly MissionSummary[],
  completedIds: ReadonlySet<string>,
): MissionSummary | null {
  const states = missionStates(missions, completedIds);
  const available = missions
    .filter((mission) => states.get(mission.id) === 'available')
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return available[0] ?? null;
}
