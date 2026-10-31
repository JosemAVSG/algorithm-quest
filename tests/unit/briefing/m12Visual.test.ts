import { describe, expect, it } from 'vitest';

import { M12_CYCLE_TICKS, M12_ORDERS, m12Frame } from '../../../src/features/briefing/visuals/m12';

describe('M12 strategy model', () => {
  it('starts with the first order in all three memories', () => {
    const frame = m12Frame(0);
    expect(frame.phase).toBe('stream');
    expect(frame.current).toBe(0);
    expect(frame.seen).toEqual(['A']);
    expect(frame.counts).toEqual([['motor', 1]]);
    expect(frame.best?.id).toBe('A');
    expect(frame.duplicates).toEqual([]);
  });

  it('flags a repeated id once and keeps first-seen order', () => {
    const frame = m12Frame(2);
    expect(frame.repeatNow).toBe(true);
    expect(frame.seen).toEqual(['A', 'B']);
    expect(frame.duplicates).toEqual(['A']);
    expect(m12Frame(3).repeatNow).toBe(false);
    expect(m12Frame(4).duplicates).toEqual(['A', 'B']);
  });

  it('counts per category in first-appearance order, including __proto__', () => {
    expect(m12Frame(4).counts).toEqual([
      ['motor', 2],
      ['frenos', 2],
      ['__proto__', 1],
    ]);
  });

  it('keeps the first order on a priority tie', () => {
    const tie = m12Frame(3);
    expect(tie.priorityNote).toBe('tie');
    expect(tie.best?.id).toBe('B');
    expect(m12Frame(1).priorityNote).toBe('new');
  });

  it('holds the report then loops', () => {
    const report = m12Frame(M12_ORDERS.length);
    expect(report.phase).toBe('report');
    expect(report.current).toBeNull();
    expect(report.duplicates).toEqual(['A', 'B']);
    expect(m12Frame(M12_CYCLE_TICKS - 1)).toEqual(report);
    expect(m12Frame(M12_CYCLE_TICKS)).toEqual(m12Frame(0));
  });
});
