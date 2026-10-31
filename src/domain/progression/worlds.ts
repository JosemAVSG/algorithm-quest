/**
 * World path (docs/06-ux-flows.md §3).
 *
 * The map is two levels deep: worlds, then the missions inside a world. Worlds
 * open in registry order — a world is reachable once the previous one is
 * finished — so "current" is simply the first world that is not completed yet.
 * Pure on purpose: the screen renders what this returns and decides nothing.
 */

import type { Mission, World } from '../content/schema';
import { missionStates } from './unlock';

export type WorldState = 'completed' | 'current' | 'locked';

export interface WorldNode {
  world: World;
  state: WorldState;
  /** Name of the world that must be finished first; null when open or merely planned. */
  blockedBy: string | null;
}

/** `soon` is a mission listed in the registry that has not been authored yet. */
export type MissionNodeState = 'completed' | 'available' | 'locked' | 'soon';

export interface MissionNode {
  id: string;
  state: MissionNodeState;
  mission: Mission | null;
}

function isCompleted(world: World, completedIds: ReadonlySet<string>): boolean {
  return world.missionIds.length > 0 && world.missionIds.every((id) => completedIds.has(id));
}

export function worldNodes(
  worlds: readonly World[],
  completedIds: ReadonlySet<string>,
): WorldNode[] {
  let previous: World | null = null;
  let currentTaken = false;

  return worlds.map((world) => {
    const previousDone = previous === null || isCompleted(previous, completedIds);
    let node: WorldNode;

    if (isCompleted(world, completedIds)) {
      node = { world, state: 'completed', blockedBy: null };
    } else if (world.missionIds.length === 0) {
      node = { world, state: 'locked', blockedBy: null };
    } else if (previousDone && !currentTaken) {
      currentTaken = true;
      node = { world, state: 'current', blockedBy: null };
    } else {
      node = { world, state: 'locked', blockedBy: previous?.name ?? null };
    }

    previous = world;
    return node;
  });
}

export function missionNodes(
  world: World,
  missions: readonly Mission[],
  completedIds: ReadonlySet<string>,
): MissionNode[] {
  const states = missionStates(missions, completedIds);
  const byId = new Map(missions.map((mission) => [mission.id, mission]));

  return world.missionIds.map((id) => {
    const mission = byId.get(id) ?? null;
    const state = states.get(id);
    return { id, state: mission === null || state === undefined ? 'soon' : state, mission };
  });
}
