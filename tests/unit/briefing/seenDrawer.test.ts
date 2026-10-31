import { describe, expect, it } from 'vitest';

import {
  DRAWER_CYCLE_TICKS,
  DRAWER_IDS,
  DRAWER_TICK_MS,
  MATCH_INDEX,
  REPEAT_INDEX,
  drawerFrame,
} from '../../../src/features/briefing/visuals/m10';

describe('seen drawer model', () => {
  it('has its first repeat at the position the ids say', () => {
    expect(DRAWER_IDS[REPEAT_INDEX]).toBe(DRAWER_IDS[MATCH_INDEX]);
    expect(DRAWER_IDS.indexOf(DRAWER_IDS[REPEAT_INDEX])).toBe(MATCH_INDEX);
  });

  it('starts at the first id with an empty drawer', () => {
    const frame = drawerFrame(0);
    expect(frame.current).toBe(0);
    expect(frame.scanLooks).toBe(0);
    expect(frame.drawerLooks).toBe(1);
    expect(frame.found).toBe(false);
  });

  it('re-scanning pays more per id while the drawer pays one look', () => {
    const frame = drawerFrame(3);
    expect(frame.scanLooks).toBe(6);
    expect(frame.drawerLooks).toBe(4);
    expect(frame.found).toBe(false);
  });

  it('catches the first repeat and stops there', () => {
    const frame = drawerFrame(REPEAT_INDEX);
    expect(frame.found).toBe(true);
    expect(frame.scanLooks).toBe(21);
    expect(frame.drawerLooks).toBe(7);
    expect(drawerFrame(REPEAT_INDEX + 3)).toEqual(frame);
  });

  it('loops after a hold on the final frame', () => {
    expect(DRAWER_CYCLE_TICKS).toBeGreaterThan(REPEAT_INDEX + 2);
    expect(drawerFrame(DRAWER_CYCLE_TICKS - 1).found).toBe(true);
    expect(drawerFrame(DRAWER_CYCLE_TICKS)).toEqual(drawerFrame(0));
  });

  it('keeps changes below 3 Hz', () => {
    expect(1000 / DRAWER_TICK_MS).toBeLessThan(3);
  });
});
