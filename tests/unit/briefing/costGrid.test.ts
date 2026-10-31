import { describe, expect, it } from 'vitest';

import {
  COST_CYCLE_TICKS,
  COST_SIZES,
  COST_TICK_MS,
  costCellState,
  costFrame,
  pairCount,
} from '../../../src/features/briefing/visuals/m09';

describe('cost grid model', () => {
  it('counts pairs the way the briefing counter does', () => {
    expect(pairCount(5)).toBe(10);
    expect(pairCount(10)).toBe(45);
    expect(pairCount(0)).toBe(0);
    expect(pairCount(1)).toBe(0);
  });

  it('starts empty with the small queue', () => {
    const frame = costFrame(0);
    expect(frame.size).toBe(COST_SIZES[0]);
    expect(frame.rowsDone).toBe(0);
    expect(frame.count).toBe(0);
    expect(frame.finished).toBe(false);
  });

  it('fills one row of pairs per tick and counts them', () => {
    expect(costFrame(1).count).toBe(4);
    expect(costFrame(2).count).toBe(7);
    expect(costFrame(3).count).toBe(9);
    expect(costFrame(4).count).toBe(10);
    expect(costFrame(4).finished).toBe(true);
  });

  it('holds the 5-order total, then doubles the queue', () => {
    const held = costFrame(6);
    expect(held.size).toBe(5);
    expect(held.count).toBe(10);
    const next = costFrame(4 + 1 + 3); // first frame of the 10-order run
    expect(next.size).toBe(10);
    expect(next.count).toBe(0);
    expect(next.doubled).toBe(true);
  });

  it('ends on 45 pairs and holds that frame before looping', () => {
    const lastFill = costFrame(8 + 9);
    expect(lastFill.count).toBe(45);
    expect(lastFill.finished).toBe(true);
    expect(costFrame(COST_CYCLE_TICKS - 1)).toEqual(lastFill);
    expect(costFrame(COST_CYCLE_TICKS)).toEqual(costFrame(0));
  });

  it('keeps changes below 3 Hz', () => {
    expect(1000 / COST_TICK_MS).toBeLessThan(3);
  });

  it('classifies cells inside the staircase only', () => {
    const frame = costFrame(2);
    expect(costCellState(0, 1, frame)).toBe('done');
    expect(costCellState(1, 2, frame)).toBe('active');
    expect(costCellState(2, 3, frame)).toBe('pending');
    expect(costCellState(2, 2, frame)).toBe('none');
    expect(costCellState(0, 5, frame)).toBe('none');
  });
});
