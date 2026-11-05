import { afterEach, describe, expect, it } from 'vitest';

import { CostLimitExceeded, createMeter, installBuiltinMeter } from '../../../src/domain/execution/meter';
import { compileEntryPoint, runCasesWith } from '../../../src/domain/execution/run-cases';

let uninstall: (() => void) | null = null;
afterEach(() => {
  uninstall?.();
  uninstall = null;
});

describe('createMeter', () => {
  it('counts only while a case is running', () => {
    const meter = createMeter();
    meter.tick();
    expect(meter.ops).toBe(0);
    meter.start(10);
    meter.tick();
    meter.add(4);
    expect(meter.stop()).toBe(5);
    meter.tick();
    expect(meter.ops).toBe(5);
  });

  it('throws once the limit is crossed, and keeps throwing', () => {
    const meter = createMeter();
    meter.start(3);
    meter.add(3);
    expect(() => meter.tick()).toThrow(CostLimitExceeded);
    expect(meter.exceeded).toBe(true);
    expect(() => meter.tick()).toThrow(CostLimitExceeded);
  });
});

describe('installBuiltinMeter', () => {
  function metered(code: string, entry: string, args: unknown[]) {
    const meter = createMeter();
    uninstall = installBuiltinMeter(meter);
    const fn = compileEntryPoint(code, entry, { meter });
    const [outcome] = runCasesWith(fn, [{ testId: 't', input: args }], { meter });
    return outcome!;
  }

  it('charges indexOf inside a loop as the second loop it is', () => {
    const outcome = metered(
      'function f(xs) { let c = 0; for (const x of xs) { if (xs.indexOf(x) === -2) c++; } return c; }',
      'f',
      [[1, 2, 3, 4, 5]],
    );
    // 1 call + 5 iterations + (1 + 2 + 3 + 4 + 5) scanned elements
    expect(outcome.ops).toBe(1 + 5 + 15);
  });

  it('does not count a callback method twice', () => {
    const outcome = metered('function f(xs) { return xs.map((x) => x * 2); }', 'f', [[1, 2, 3, 4]]);
    expect(outcome.ops).toBe(1 + 4); // the call, and one per callback; map itself is free
  });

  it('charges shift for the elements it moves', () => {
    const outcome = metered(
      'function f(xs) { while (xs.length) xs.shift(); return 0; }',
      'f',
      [[1, 2, 3, 4]],
    );
    // 1 call + 4 iterations + shifts of 4, 3, 2, 1 elements
    expect(outcome.ops).toBe(1 + 4 + 10);
  });

  it('charges hash lookups one step each', () => {
    const outcome = metered(
      'function f(xs) { const s = new Set(); for (const x of xs) { if (!s.has(x)) s.add(x); } return s.size; }',
      'f',
      [[1, 2, 2, 3]],
    );
    // 1 call + 4 iterations + 4 has + 3 add
    expect(outcome.ops).toBe(1 + 4 + 4 + 3);
  });

  it('restores the prototypes when uninstalled', () => {
    const original = Array.prototype.indexOf;
    const meter = createMeter();
    const undo = installBuiltinMeter(meter);
    expect(Array.prototype.indexOf).not.toBe(original);
    undo();
    expect(Array.prototype.indexOf).toBe(original);
  });
});

describe('runCasesWith with a meter', () => {
  it('stops a runaway loop at the limit instead of at a timeout', () => {
    const meter = createMeter();
    const fn = compileEntryPoint('function f() { while (true) {} }', 'f', { meter });
    const [outcome] = runCasesWith(fn, [{ testId: 't', input: [] }], { meter, opLimit: 1_000 });
    expect(outcome).toMatchObject({ status: 'threw', costExceeded: true });
  });

  it('still stops a loop whose body swallows the limit error', () => {
    const meter = createMeter();
    const fn = compileEntryPoint(
      'function f() { let n = 0; for (;;) { try { n++; if (n > 5000) return n; } catch (e) {} } }',
      'f',
      { meter },
    );
    const [outcome] = runCasesWith(fn, [{ testId: 't', input: [] }], { meter, opLimit: 100 });
    expect(outcome).toMatchObject({ costExceeded: true });
  });

  it('does not run the cases after one was stopped at the limit', () => {
    const meter = createMeter();
    const fn = compileEntryPoint('function f(n) { while (n > 0) {} return n; }', 'f', { meter });
    const outcomes = runCasesWith(
      fn,
      [
        { testId: 'a', input: [1] },
        { testId: 'b', input: [1] },
        { testId: 'c', input: [0] },
      ],
      { meter, opLimit: 500 },
    );
    expect(outcomes[0]).toMatchObject({ costExceeded: true });
    expect(outcomes[1]).toMatchObject({ costExceeded: true, message: expect.stringContaining('no se ejecutó') });
    expect(outcomes[2]).toMatchObject({ costExceeded: true, message: expect.stringContaining('no se ejecutó') });
    expect(outcomes[1]).not.toHaveProperty('ops');
  });

  it('reports the steps of each case separately', () => {
    const meter = createMeter();
    const fn = compileEntryPoint('function f(n) { let s = 0; for (let i = 0; i < n; i++) s += i; return s; }', 'f', { meter });
    const outcomes = runCasesWith(
      fn,
      [
        { testId: 'small', input: [3] },
        { testId: 'large', input: [100] },
      ],
      { meter },
    );
    expect(outcomes.map((o) => o.ops)).toEqual([1 + 3, 1 + 100]);
  });

  it('reports no cost without a meter', () => {
    const fn = compileEntryPoint('function f() { return 1; }', 'f');
    const [outcome] = runCasesWith(fn, [{ testId: 't', input: [] }]);
    expect(outcome).not.toHaveProperty('ops');
  });
});
