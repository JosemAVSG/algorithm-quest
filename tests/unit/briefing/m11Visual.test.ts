import { describe, expect, it } from 'vitest';

import {
  M11_BUCKETS,
  M11_CYCLE_TICKS,
  M11_ORDERS,
  M11_WINNER_INDEX,
  m11Frame,
} from '../../../src/features/briefing/visuals/m11';

describe('M11 tally model', () => {
  it('starts empty with the first order falling', () => {
    const frame = m11Frame(0);
    expect(frame.phase).toBe('counting');
    expect(frame.incoming).toBe(0);
    expect(frame.tallies).toEqual([0, 0, 0]);
    expect(frame.winner).toBeNull();
  });

  it('grows the tallies as orders land', () => {
    expect(m11Frame(2).tallies).toEqual([1, 1, 0]);
    expect(m11Frame(4).tallies).toEqual([2, 1, 1]);
  });

  it('shows the tie between two buckets before applying the rule', () => {
    const frame = m11Frame(M11_ORDERS.length);
    expect(frame.phase).toBe('tie');
    expect(frame.tallies).toEqual([2, 2, 1]);
    expect(frame.leaders).toEqual([0, 1]);
    expect(frame.winner).toBeNull();
  });

  it('resolves the tie alphabetically, not by arrival', () => {
    const frame = m11Frame(M11_ORDERS.length + 2);
    expect(frame.phase).toBe('winner');
    expect(frame.winner).toBe(M11_WINNER_INDEX);
    const [first, second] = frame.leaders.map((i) => M11_BUCKETS[i]);
    expect(first).toBe('motor');
    expect([first, second].sort()[0]).toBe(M11_BUCKETS[M11_WINNER_INDEX]);
  });

  it('holds the final frame then loops', () => {
    expect(m11Frame(M11_CYCLE_TICKS - 1).phase).toBe('winner');
    expect(m11Frame(M11_CYCLE_TICKS)).toEqual(m11Frame(0));
    expect(m11Frame(-1)).toEqual(m11Frame(M11_CYCLE_TICKS - 1));
  });
});
