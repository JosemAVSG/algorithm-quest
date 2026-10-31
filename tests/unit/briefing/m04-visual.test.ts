import { describe, expect, it } from 'vitest';

import {
  TOTAL_CYCLE_TICKS,
  TOTAL_LINES,
  totalFrame,
} from '../../../src/features/briefing/visuals/m04-model';

describe('M04 running-total model', () => {
  it('adds each line to a total that survives every pass', () => {
    expect(totalFrame(0)).toMatchObject({ total: 10, low: 0, restarted: 10, current: 0 });
    expect(totalFrame(1)).toMatchObject({ total: 12, low: 1, restarted: 2 });
    expect(totalFrame(3)).toMatchObject({ total: 22, low: 2, restarted: 3 });
  });

  it('does not count a line exactly at the minimum as low', () => {
    const last = totalFrame(TOTAL_LINES.length - 1);
    expect(last.total).toBe(35);
    expect(last.low).toBe(2);
    expect(last.restarted).toBe(5);
  });

  it('holds the final frame and loops', () => {
    const hold = totalFrame(TOTAL_LINES.length);
    expect(hold.done).toBe(true);
    expect(hold.current).toBeNull();
    expect(hold.total).toBe(35);
    expect(totalFrame(TOTAL_CYCLE_TICKS - 1)).toEqual(hold);
    expect(totalFrame(TOTAL_CYCLE_TICKS)).toEqual(totalFrame(0));
  });
});
