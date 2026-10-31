import { describe, expect, it } from 'vitest';

import { MissionSchema, type Mission, type World } from '../../../src/domain/content/schema';
import { missionNodes, worldNodes } from '../../../src/domain/progression/worlds';
import { validMission } from '../../support/fixtures';

function mission(id: string, order: number, prerequisites: string[] = []): Mission {
  return MissionSchema.parse({
    ...validMission(),
    id,
    order,
    prerequisites: { missions: prerequisites, concepts: [] },
  });
}

const W1: World = { id: 'w1', name: 'World 1', status: 'in-progress', missionIds: ['M01', 'M02'] };
const TRANSITION: World = {
  id: 'transition',
  name: 'Transition',
  status: 'in-progress',
  missionIds: ['M03'],
};
const W2: World = { id: 'w2', name: 'World 2', status: 'planned', missionIds: [] };
const WORLDS = [W1, TRANSITION, W2];

describe('world nodes', () => {
  it('marks the first world current and locks the rest with the reason', () => {
    const nodes = worldNodes(WORLDS, new Set());
    expect(nodes.map((node) => node.state)).toEqual(['current', 'locked', 'locked']);
    expect(nodes[1].blockedBy).toBe('World 1');
    expect(nodes[0].blockedBy).toBeNull();
  });

  it('keeps a partly finished world current', () => {
    const nodes = worldNodes(WORLDS, new Set(['M01']));
    expect(nodes[0].state).toBe('current');
    expect(nodes[1].state).toBe('locked');
  });

  it('completes a world only when every mission is done and opens the next', () => {
    const nodes = worldNodes(WORLDS, new Set(['M01', 'M02']));
    expect(nodes.map((node) => node.state)).toEqual(['completed', 'current', 'locked']);
  });

  it('keeps a planned world without missions locked even when the previous is done', () => {
    const nodes = worldNodes(WORLDS, new Set(['M01', 'M02', 'M03']));
    expect(nodes.map((node) => node.state)).toEqual(['completed', 'completed', 'locked']);
    expect(nodes[2].blockedBy).toBeNull();
  });

  it('never treats an empty world as completed', () => {
    expect(worldNodes([W2], new Set())[0].state).toBe('locked');
  });
});

describe('mission nodes of a world', () => {
  const missions = [mission('M01', 1), mission('M02', 2, ['M01'])];

  it('maps completed, available and locked states in world order', () => {
    const nodes = missionNodes(W1, missions, new Set(['M01']));
    expect(nodes.map((node) => [node.id, node.state])).toEqual([
      ['M01', 'completed'],
      ['M02', 'available'],
    ]);
    expect(nodes[0].mission?.id).toBe('M01');
  });

  it('locks a mission whose prerequisite is open', () => {
    expect(missionNodes(W1, missions, new Set())[1].state).toBe('locked');
  });

  it('renders ids without an authored mission as soon, without crashing', () => {
    const nodes = missionNodes(W1, [missions[0]], new Set(['M01']));
    expect(nodes[1]).toEqual({ id: 'M02', state: 'soon', mission: null });
  });
});
