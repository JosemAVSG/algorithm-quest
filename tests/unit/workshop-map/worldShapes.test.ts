import { describe, expect, it } from 'vitest';

import { worldShape } from '../../../src/features/workshop-map/worldShapes';

describe('worldShape', () => {
  it.each([
    ['w1', 'cog'],
    ['transition', 'drawers'],
    ['w2', 'crates'],
    ['w3', 'bars'],
    ['w4', 'tower'],
    ['w5', 'network'],
    ['w6', 'archive'],
    ['w7', 'forge'],
  ])('maps %s to %s', (id, kind) => {
    expect(worldShape(id).kind).toBe(kind);
  });

  it('falls back to a generic cube for unknown ids', () => {
    expect(worldShape('w99').kind).toBe('cube');
  });

  it('describes at least one part per shape with a positive primary size', () => {
    for (const id of ['w1', 'transition', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'nope']) {
      const { parts } = worldShape(id);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.size[0]).toBeGreaterThan(0);
      }
    }
  });

  it('builds w3 bars of strictly rising height', () => {
    const heights = worldShape('w3').parts.map((part) => part.size[1]);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
    expect(new Set(heights).size).toBe(heights.length);
  });
});
