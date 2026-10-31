import { describe, expect, it } from 'vitest';

import { MissionSchema, type Mission } from '../../../src/domain/content/schema';
import {
  missionStates,
  missingPrerequisites,
  nextMission,
} from '../../../src/domain/progression/unlock';
import { validMission } from '../../support/fixtures';

function mission(overrides: Record<string, unknown>): Mission {
  return MissionSchema.parse({ ...validMission(), ...overrides });
}

const M01 = mission({ id: 'M01', order: 1, prerequisites: { missions: [], concepts: [] } });
const M02 = mission({
  id: 'M02',
  order: 2,
  prerequisites: { missions: ['M01'], concepts: [] },
});
const M03 = mission({
  id: 'M03',
  order: 3,
  prerequisites: { missions: ['M02'], concepts: [] },
});

describe('mission availability', () => {
  it('opens M01 and locks what follows it', () => {
    const states = missionStates([M01, M02, M03], new Set());
    expect(states.get('M01')).toBe('available');
    expect(states.get('M02')).toBe('locked');
    expect(states.get('M03')).toBe('locked');
  });

  it('marks completed missions and opens their dependants', () => {
    const states = missionStates([M01, M02, M03], new Set(['M01']));
    expect(states.get('M01')).toBe('completed');
    expect(states.get('M02')).toBe('available');
    expect(states.get('M03')).toBe('locked');
  });

  it('names exactly what a mission is waiting for', () => {
    expect(missingPrerequisites(M02, new Set())).toEqual(['M01']);
    expect(missingPrerequisites(M03, new Set(['M01']))).toEqual(['M02']);
    expect(missingPrerequisites(M03, new Set(['M01', 'M02']))).toEqual([]);
  });

  it('highlights one mission, by order', () => {
    expect(nextMission([M02, M01, M03], new Set())?.id).toBe('M01');
    expect(nextMission([M03, M02, M01], new Set(['M01']))?.id).toBe('M02');
    expect(nextMission([M01, M02], new Set(['M01', 'M02']))).toBeNull();
  });

  it('does not treat a completed mission as the next one', () => {
    expect(nextMission([M01], new Set(['M01']))).toBeNull();
  });
});
