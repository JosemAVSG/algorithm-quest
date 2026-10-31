import { describe, expect, it } from 'vitest';

import {
  MAX_CASE_OUTPUT_BYTES,
  estimateSerializedBytes,
} from '../../../src/domain/execution/output-cap';

/**
 * The cap is the only thing standing between a 5 MB return value and a second
 * copy of it crossing the worker boundary (docs/10 §6, S7). Its whole point is
 * to stop early, so the tests check that it stops, not just what it reports.
 */
describe('output cap', () => {
  it('accepts ordinary values', () => {
    const estimate = estimateSerializedBytes({ ok: true, values: [1, 2, 3] });
    expect(estimate.exceeded).toBe(false);
    expect(estimate.bytes).toBeLessThan(100);
  });

  it('rejects a 5 MB string without scanning all of it', () => {
    const huge = 'x'.repeat(5 * 1024 * 1024);
    const estimate = estimateSerializedBytes(huge);
    expect(estimate.exceeded).toBe(true);
    // The early exit reports the first bound it can justify, not a full count.
    expect(estimate.bytes).toBeGreaterThan(MAX_CASE_OUTPUT_BYTES);
  });

  it('counts keys and escapes, not just values', () => {
    const small = estimateSerializedBytes({ a: 'b' });
    const escaped = estimateSerializedBytes({ a: '\n\t"\\' });
    expect(escaped.bytes).toBeGreaterThan(small.bytes);
  });

  it('terminates on cycles instead of hanging', () => {
    const cycle: Record<string, unknown> = { name: 'loop' };
    cycle['self'] = cycle;
    const estimate = estimateSerializedBytes(cycle);
    expect(estimate.exceeded).toBe(false);
    expect(estimate.bytes).toBeLessThan(1000);
  });

  it('stops walking a gigantic array quickly', () => {
    // Sparse on purpose: the walk must abort by budget, not by materialising it.
    const wide: unknown[] = new Array(5_000_000);
    const started = performance.now();
    const estimate = estimateSerializedBytes(wide);
    const elapsed = performance.now() - started;
    expect(estimate.exceeded).toBe(true);
    // Aborting early is the point; a full walk would visit five million holes.
    expect(elapsed).toBeLessThan(1_000);
  });

  it('honours a caller-supplied limit', () => {
    expect(estimateSerializedBytes('abcdef', 4).exceeded).toBe(true);
  });
});
