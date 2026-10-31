import { describe, expect, it } from 'vitest';

import {
  BAD_READING_CYCLE_TICKS,
  badReadingFrame,
} from '../../../src/features/briefing/visuals/m06';

describe('M06 bad-reading average model', () => {
  it('starts with an untouched belt', () => {
    const frame = badReadingFrame(0);
    expect(frame.phase).toBe('readings');
    expect(frame.processed).toBe(0);
    expect(frame.intern.value).toBe('—');
  });

  it('agrees on the first reading', () => {
    const frame = badReadingFrame(1);
    expect(frame.intern.value).toBe('20');
    expect(frame.fixed.value).toBe('20');
    expect(frame.intern.wrong).toBe(false);
  });

  it('counts the disconnected sensor as 0 and as a reading for the intern only', () => {
    const frame = badReadingFrame(2);
    expect(frame.intern.formula).toBe('(20 + 0) ÷ 2');
    expect(frame.intern.value).toBe('10');
    expect(frame.intern.wrong).toBe(true);
    expect(frame.fixed.formula).toBe('20 ÷ 1');
    expect(frame.fixed.value).toBe('20');
  });

  it('ends the belt at 16,7 versus 25 and holds that frame', () => {
    const frame = badReadingFrame(3);
    expect(frame.intern.value).toBe('16,7');
    expect(frame.fixed.value).toBe('25');
    for (const tick of [4, 5, 6]) expect(badReadingFrame(tick)).toEqual(frame);
  });

  it('shows the empty belt: NaN for the intern, null for the fix', () => {
    const frame = badReadingFrame(7);
    expect(frame.phase).toBe('empty');
    expect(frame.intern.value).toBe('NaN');
    expect(frame.fixed.value).toBe('null');
    expect(badReadingFrame(BAD_READING_CYCLE_TICKS - 1)).toEqual(frame);
  });

  it('loops back to the start', () => {
    expect(badReadingFrame(BAD_READING_CYCLE_TICKS)).toEqual(badReadingFrame(0));
  });
});
