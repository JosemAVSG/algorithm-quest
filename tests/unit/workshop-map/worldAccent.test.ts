import { describe, expect, it } from 'vitest';

import { WORLD_ACCENTS } from '../../../src/features/workshop-map/worldAccent';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Lightest surface the accents sit on (the main mission card), plus the page and high-contrast grounds.
const SURFACES = ['#212b36', '#1a2129', '#0f1419', '#000000'];

describe('world accents', () => {
  it('defines 8 distinct accents (7 worlds plus the transition arc)', () => {
    const values = Object.values(WORLD_ACCENTS);
    expect(values).toHaveLength(8);
    expect(new Set(values).size).toBe(8);
  });

  it.each(Object.entries(WORLD_ACCENTS))('%s (%s) reads at 4.5:1 as text on every surface', (_id, accent) => {
    for (const surface of SURFACES) expect(contrast(accent, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
