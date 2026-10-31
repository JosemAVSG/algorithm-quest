import { describe, expect, it } from 'vitest';

import {
  PAIR_SCAN_CYCLE_TICKS,
  PAIR_SCAN_IDS,
  PAIR_SCAN_TOTAL_PAIRS,
  pairScanFrame,
  pairsInOrder,
  visitedPairs,
} from '../../../src/features/briefing/visuals/m08';

describe('M08 pair comparison model', () => {
  it('visits pairs with the second index always after the first', () => {
    const pairs = pairsInOrder(5);
    expect(pairs).toHaveLength(10);
    expect(pairs.every(([i, j]) => j > i)).toBe(true);
    expect(pairs[0]).toEqual([0, 1]);
  });

  it('stops at the first matching pair', () => {
    const visited = visitedPairs(PAIR_SCAN_IDS);
    expect(visited[visited.length - 1]).toEqual([2, 4]);
    expect(visited.length).toBeLessThan(PAIR_SCAN_TOTAL_PAIRS);
  });

  it('adds one comparison per tick', () => {
    expect(pairScanFrame(0).compared).toHaveLength(1);
    expect(pairScanFrame(4).compared).toHaveLength(5);
    expect(pairScanFrame(4).found).toBe(false);
  });

  it('finds the pair, stops growing and holds', () => {
    const last = visitedPairs(PAIR_SCAN_IDS).length - 1;
    const frame = pairScanFrame(last);
    expect(frame.found).toBe(true);
    expect(frame.current).toEqual([2, 4]);
    for (let tick = last; tick < PAIR_SCAN_CYCLE_TICKS; tick += 1) expect(pairScanFrame(tick)).toEqual(frame);
  });

  it('loops', () => {
    expect(pairScanFrame(PAIR_SCAN_CYCLE_TICKS)).toEqual(pairScanFrame(0));
  });
});
