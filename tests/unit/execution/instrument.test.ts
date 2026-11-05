import { describe, expect, it } from 'vitest';

import { instrumentSource } from '../../../src/domain/execution/instrument';

function run(source: string, entry: string, args: unknown[], snapshots = false) {
  const code = instrumentSource(source, { snapshots });
  expect(code).not.toBeNull();
  let ticks = 0;
  const seen: { line: number; vars: Record<string, unknown> }[] = [];
  const tick = () => {
    ticks += 1;
  };
  const snap = (line: number, read: () => [string, boolean, unknown?][]) => {
    seen.push({
      line,
      vars: Object.fromEntries(
        read()
          .filter(([, ok, v]) => ok && v !== undefined)
          .map(([name, , value]) => [name, value]),
      ),
    });
  };
  const factory = new Function('__t', '__s', `"use strict";\n${code}\nreturn ${entry};`);
  const fn = factory(tick, snap) as (...a: unknown[]) => unknown;
  return { value: fn(...args), ticks, seen, code: code as string };
}

describe('instrumentSource', () => {
  it('counts one step per loop iteration and one per call', () => {
    const { value, ticks } = run(
      'function sum(xs) { let s = 0; for (const x of xs) { s += x; } return s; }',
      'sum',
      [[1, 2, 3, 4]],
    );
    expect(value).toBe(10);
    expect(ticks).toBe(1 + 4); // the call, then four iterations
  });

  it('counts nested loops multiplicatively', () => {
    const { ticks } = run(
      'function f(n) { let c = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c++; return c; }',
      'f',
      [10],
    );
    // 1 call + 10 outer + 100 inner. The unbraced inner body is wrapped, not lost.
    expect(ticks).toBe(1 + 10 + 100);
  });

  it('counts recursion by calls', () => {
    const { value, ticks } = run('function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }', 'fib', [10]);
    expect(value).toBe(55);
    expect(ticks).toBe(177); // calls of fib(10)
  });

  it('counts expression-bodied arrows, including object literals', () => {
    const { value, ticks } = run(
      'function f(xs) { return xs.map((x) => ({ v: x * 2 })); }',
      'f',
      [[1, 2, 3]],
    );
    expect(value).toEqual([{ v: 2 }, { v: 4 }, { v: 6 }]);
    expect(ticks).toBe(1 + 3);
  });

  it('keeps a "use strict" directive a directive', () => {
    const { value } = run('function f() { "use strict"; return this === undefined; }', 'f', []);
    expect(value).toBe(true);
  });

  it('wraps unbraced loop bodies and keeps else attached', () => {
    const { value } = run(
      'function f(a, b) { if (a) for (let i = 0; i < 3; i++) b++; else b = -1; return b; }',
      'f',
      [true, 0],
    );
    expect(value).toBe(3);
  });

  it('inserts no newline, so line numbers stay true', () => {
    const source = 'function f(xs) {\n  for (const x of xs) {\n    if (x) return x;\n  }\n}\n';
    const { code } = run(source, 'f', [[0, 1]]);
    expect(code.split('\n').length).toBe(source.split('\n').length);
  });

  it('returns null for source it cannot parse, leaving the real error to the engine', () => {
    expect(instrumentSource('function (')).toBeNull();
  });

  describe('snapshots', () => {
    it('records the variables in scope at each step, with the original line', () => {
      const { seen } = run(
        'function f(xs) {\n  let total = 0;\n  for (const x of xs) {\n    total += x;\n  }\n  return total;\n}',
        'f',
        [[5, 7]],
        true,
      );
      expect(seen.map((s) => s.line)).toEqual([1, 3, 3]);
      expect(seen[0]!.vars).toMatchObject({ xs: [5, 7] });
      expect(seen[1]!.vars).toMatchObject({ total: 0, x: 5 });
      expect(seen[2]!.vars).toMatchObject({ total: 5, x: 7 });
    });

    it('tells a variable holding undefined from one that does not exist yet', () => {
      const code = instrumentSource('function f() { let kept; for (const x of [1]) { const later = x; } }', {
        snapshots: true,
      });
      const reads: Record<string, boolean>[] = [];
      new Function('__t', '__s', `"use strict";\n${code}\nf();`)(
        () => {},
        (_line: number, read: () => [string, boolean][]) => reads.push(Object.fromEntries(read().map(([n, ok]) => [n, ok]))),
      );
      // `kept` exists (holding undefined); `later` is not declared at the loop's first line
      const loopStep = reads[1]!;
      expect(loopStep.kept).toBe(true);
      expect(loopStep.later).toBe(false);
    });

    it('sees the parameters of recursive calls', () => {
      const { seen } = run('function r(n) { return n === 0 ? 0 : r(n - 1); }', 'r', [2], true);
      expect(seen.map((s) => s.vars.n)).toEqual([2, 1, 0]);
    });
  });
});
