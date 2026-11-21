import { describe, expect, it } from 'vitest';

import { newlyUnlocked, nextSeen } from '../../../src/features/workshop-map/unlockDiff';

describe('newlyUnlocked', () => {
  it('reports nothing on the very first visit', () => {
    expect(newlyUnlocked(null, ['M01'])).toEqual([]);
  });

  it('reports ids that were not in the previous snapshot', () => {
    expect(newlyUnlocked(['M01'], ['M01', 'M02'])).toEqual(['M02']);
  });

  it('reports nothing when the snapshot already has everything', () => {
    expect(newlyUnlocked(['M01', 'M02'], ['M01', 'M02'])).toEqual([]);
  });
});

describe('nextSeen', () => {
  it('stores everything on the first visit', () => {
    expect(nextSeen(null, ['M01'], ['M01', 'world:w1'])).toEqual(['M01', 'world:w1']);
  });

  it('adds only what was on screen, keeping other levels pending', () => {
    expect(nextSeen(['M01'], ['M02'], ['M01', 'M02', 'world:w2'])).toEqual(['M01', 'M02']);
  });
});
