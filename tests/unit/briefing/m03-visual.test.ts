import { describe, expect, it } from 'vitest';

import {
  COLLECT_CYCLE_TICKS,
  COLLECT_UNITS,
  collectFrame,
  unitState,
} from '../../../src/features/briefing/visuals/m03-model';

describe('M03 collect-line model', () => {
  it('starts with an empty box and the first unit under inspection', () => {
    const frame = collectFrame(0);
    expect(frame.scanner).toBe(0);
    expect(frame.box).toEqual([]);
    expect(unitState(0, frame)).toBe('scanning');
    expect(unitState(1, frame)).toBe('idle');
  });

  it('copies defective units to the box in arrival order without stopping', () => {
    expect(collectFrame(1).box).toEqual(['A']);
    expect(collectFrame(3).box).toEqual(['A', 'C']);
    expect(collectFrame(4).box).toEqual(['A', 'C']);
    expect(collectFrame(5).box).toEqual(['A', 'C', 'E']);
    expect(collectFrame(6).box).toEqual(['A', 'C', 'E']);
  });

  it('keeps every unit in the line and holds the final frame', () => {
    const last = collectFrame(COLLECT_UNITS.length);
    expect(last.done).toBe(true);
    expect(last.scanner).toBeNull();
    expect(unitState(1, last)).toBe('fine');
    expect(unitState(2, last)).toBe('defective');
    expect(collectFrame(COLLECT_CYCLE_TICKS - 1)).toEqual(last);
  });

  it('loops back to the start', () => {
    expect(collectFrame(COLLECT_CYCLE_TICKS)).toEqual(collectFrame(0));
  });
});
