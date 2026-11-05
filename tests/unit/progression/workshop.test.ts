import { describe, expect, it } from 'vitest';

import type { World, WorkshopSystem } from '../../../src/domain/content/schema';
import type { MissionSummary } from '../../../src/domain/content/summary';
import {
  inPlayOrder,
  systemStates,
  worldSystems,
} from '../../../src/domain/progression/workshop';

function system(id: string): WorkshopSystem {
  return {
    id,
    name: id,
    initialState: 'broken',
    states: ['broken', 'working', 'reliable'],
    transitions: [
      { from: 'broken', to: 'working' },
      { from: 'working', to: 'reliable' },
    ],
  };
}

function mission(id: string, order: number, worldId: string, systemId: string, to: string): MissionSummary {
  return {
    id,
    world: worldId,
    order,
    title: id,
    subtitle: '',
    prerequisites: { missions: [] },
    workshop: { systemId, to },
    reward: { narrative: '' },
  } as unknown as MissionSummary;
}

const worlds: World[] = [
  { id: 'w1', name: 'W1', status: 'in-progress', missionIds: ['M07'] },
  { id: 'w2', name: 'W2', status: 'in-progress', missionIds: ['M13'] },
];
// M13 has order 1 (first of its world) and M07 has order 7: sorting by `order` would put M13 first.
const missions = [
  mission('M07', 7, 'w1', 'sys.dispatch', 'working'),
  mission('M13', 1, 'w2', 'sys.dispatch', 'reliable'),
];

describe('workshop state', () => {
  it('orders missions by play position, not by the order inside their world', () => {
    expect(inPlayOrder(missions, worlds).map((m) => m.id)).toEqual(['M07', 'M13']);
  });

  it('ends a system at the last repair even when a later world has a lower order', () => {
    const states = systemStates([system('sys.dispatch')], missions, worlds, new Set(['M07', 'M13']));
    expect(states.get('sys.dispatch')).toBe('reliable');
  });

  it('shows each world the systems its own missions touch', () => {
    const systems = [system('sys.dispatch'), system('sys.other')];
    expect(worldSystems('w2', systems, missions, worlds).map((s) => s.id)).toEqual(['sys.dispatch']);
    // sys.other is touched by nothing yet, so World 1 keeps showing it.
    expect(worldSystems('w1', systems, missions, worlds).map((s) => s.id)).toEqual([
      'sys.dispatch',
      'sys.other',
    ]);
  });
});
