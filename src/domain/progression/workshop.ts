/**
 * What the workshop looks like after a set of completed missions.
 *
 * Pure on purpose, like `worlds.ts`: the map renders what this returns. Both
 * functions order missions by their position in the worlds registry. A
 * mission's own `order` is its position *inside* its world, so M01 and M13 both
 * have `order: 1`; sorting by it would replay M13's `working → reliable` before
 * M07's `broken → working` and leave the Dispatch board half repaired.
 */

import type { SystemState, World, WorkshopSystem } from '../content/schema';
import type { MissionSummary } from '../content/summary';

function playPosition(worlds: readonly World[]): Map<string, number> {
  const position = new Map<string, number>();
  let counter = 0;
  for (const world of worlds) {
    for (const missionId of world.missionIds) {
      if (!position.has(missionId)) position.set(missionId, counter);
      counter += 1;
    }
  }
  return position;
}

/** Missions in the order the player meets them. Unlisted missions go last. */
export function inPlayOrder(
  missions: readonly MissionSummary[],
  worlds: readonly World[],
): MissionSummary[] {
  const position = playPosition(worlds);
  const at = (id: string) => position.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...missions].sort((a, b) => at(a.id) - at(b.id) || a.id.localeCompare(b.id));
}

/** Current state of every system: its initial state, then each completed repair in play order. */
export function systemStates(
  systems: readonly WorkshopSystem[],
  missions: readonly MissionSummary[],
  worlds: readonly World[],
  completedIds: ReadonlySet<string>,
): Map<string, SystemState> {
  const states = new Map<string, SystemState>(
    systems.map((system) => [system.id, system.initialState as SystemState]),
  );
  for (const mission of inPlayOrder(missions, worlds)) {
    if (completedIds.has(mission.id)) states.set(mission.workshop.systemId, mission.workshop.to);
  }
  return states;
}

/**
 * The systems a world's map shows: the ones its own missions touch. World 1 also
 * keeps the Transition Arc's systems and any system no mission touches yet, so
 * the workshop overview it has always shown stays complete.
 */
export function worldSystems(
  worldId: string,
  systems: readonly WorkshopSystem[],
  missions: readonly MissionSummary[],
  worlds: readonly World[],
): WorkshopSystem[] {
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  const touchedBy = (worldIds: readonly string[]): Set<string> => {
    const ids = new Set<string>();
    for (const world of worlds) {
      if (!worldIds.includes(world.id)) continue;
      for (const missionId of world.missionIds) {
        const mission = byId.get(missionId);
        if (mission !== undefined) ids.add(mission.workshop.systemId);
      }
    }
    return ids;
  };

  if (worldId === 'w1') {
    const own = touchedBy(['w1', 'transition']);
    const usedAnywhere = touchedBy(worlds.map((world) => world.id));
    return systems.filter((system) => own.has(system.id) || !usedAnywhere.has(system.id));
  }
  const own = touchedBy([worldId]);
  return systems.filter((system) => own.has(system.id));
}
