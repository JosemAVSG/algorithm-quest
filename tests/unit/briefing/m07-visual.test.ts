import { describe, expect, it } from 'vitest';

import {
  BEST_SCAN_CYCLE_TICKS,
  BEST_SCAN_ORDERS,
  bestScanFrame,
  isStrictlyBetter,
} from '../../../src/features/briefing/visuals/m07';

describe('M07 best-so-far scan model', () => {
  it('a full tie is not strictly better', () => {
    const a = BEST_SCAN_ORDERS[1];
    const b = BEST_SCAN_ORDERS[3];
    expect(a && b && isStrictlyBetter(b, a)).toBe(false);
  });

  it('starts with the first order as candidate', () => {
    expect(bestScanFrame(0)).toMatchObject({ scanIndex: 0, candidateIndex: 0, outcome: 'first' });
  });

  it('replaces the candidate on a higher priority', () => {
    expect(bestScanFrame(1)).toMatchObject({ scanIndex: 1, candidateIndex: 1, outcome: 'replaced' });
  });

  it('keeps the candidate against a lower priority', () => {
    expect(bestScanFrame(2)).toMatchObject({ scanIndex: 2, candidateIndex: 1, outcome: 'kept' });
  });

  it('keeps the earlier order on a full tie', () => {
    expect(bestScanFrame(3)).toMatchObject({ scanIndex: 3, candidateIndex: 1, outcome: 'tie-kept' });
  });

  it('holds the final answer, then loops', () => {
    const done = bestScanFrame(5);
    expect(done).toMatchObject({ scanIndex: null, candidateIndex: 1, outcome: 'done' });
    for (let tick = 5; tick < BEST_SCAN_CYCLE_TICKS; tick += 1) expect(bestScanFrame(tick)).toEqual(done);
    expect(bestScanFrame(BEST_SCAN_CYCLE_TICKS)).toEqual(bestScanFrame(0));
  });
});
