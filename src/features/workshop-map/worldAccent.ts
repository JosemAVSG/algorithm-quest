/**
 * Per-world identity colour. One muted accent per world, kept out of the
 * semantic hues (red = broken, amber = diagnosis, green = working) so a world
 * colour is never read as a verdict. Every value passes 4.5:1 as text on the
 * lightest surface used on the map (#212b36); tests/unit/workshop-map/worldAccent.test.ts
 * enforces it.
 */

import type { CSSProperties } from 'react';

export const WORLD_ACCENTS: Record<string, string> = {
  w1: '#58a6ff',
  transition: '#4cc2b4',
  w2: '#a99bf2',
  w3: '#e08ac4',
  w4: '#4fc0e8',
  w5: '#9aa8f5',
  w6: '#c9b48f',
  w7: '#d9a27c',
};

const FALLBACK_ACCENT = '#58a6ff';

export function worldAccent(worldId: string): string {
  return WORLD_ACCENTS[worldId] ?? FALLBACK_ACCENT;
}

/** Inline custom property so CSS can use `var(--world-accent)` under any element. */
export function worldAccentStyle(worldId: string): CSSProperties {
  return { '--world-accent': worldAccent(worldId) } as CSSProperties;
}
