import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONSOLE_LIMITS,
  createConsoleCollector,
  createConsoleStub,
  formatConsoleArgs,
  onlyVisibleOutput,
  parseConsoleReport,
} from '../../../src/domain/execution/console';
import { compileEntryPoint, runCasesWith } from '../../../src/domain/execution/run-cases';
import { probeDeterminism } from '../../../src/domain/execution/probes';

afterEach(() => vi.unstubAllGlobals());

describe('formatConsoleArgs', () => {
  it('joins primitives with spaces and keeps top-level strings raw', () => {
    expect(formatConsoleArgs(['total:', 3, true, null])).toBe('total: 3 true null');
  });

  it('shows the values JSON would hide', () => {
    expect(formatConsoleArgs([undefined, NaN, Infinity, -0, 10n])).toBe(
      'undefined NaN Infinity -0 10n',
    );
    expect(formatConsoleArgs([Symbol('s')])).toBe('Symbol(s)');
    expect(formatConsoleArgs([function sum() {}])).toBe('[Function sum]');
    expect(formatConsoleArgs([() => 1])).toBe('[Function (anonymous)]');
  });

  it('formats arrays and objects JSON-ish, quoting nested strings', () => {
    expect(formatConsoleArgs([[1, 'a', undefined]])).toBe('[ 1, "a", undefined ]');
    expect(formatConsoleArgs([{ id: 1, tag: 'x' }])).toBe('{ id: 1, tag: "x" }');
    expect(formatConsoleArgs([[]])).toBe('[]');
    expect(formatConsoleArgs([{}])).toBe('{}');
  });

  it('survives circular references', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a['self'] = a;
    expect(formatConsoleArgs([a])).toBe('{ name: "a", self: [Circular] }');
  });

  it('caps depth, breadth and nested string length', () => {
    expect(formatConsoleArgs([{ a: { b: { c: { d: 1 } } } }])).toBe('{ a: { b: { c: [Object] } } }');
    const wide = Array.from({ length: 30 }, (_, i) => i);
    const text = formatConsoleArgs([wide]);
    expect(text).toContain('... 20 more');
    expect(text.startsWith('[ 0, 1, 2')).toBe(true);
    expect(formatConsoleArgs([['x'.repeat(500)]]).length).toBeLessThan(200);
  });

  it('formats errors, dates, maps and sets without throwing', () => {
    expect(formatConsoleArgs([new RangeError('bad')])).toBe('RangeError: bad');
    expect(formatConsoleArgs([new Date(0)])).toBe('1970-01-01T00:00:00.000Z');
    expect(formatConsoleArgs([new Map([['k', 1]])])).toBe('Map(1) { "k" => 1 }');
    expect(formatConsoleArgs([new Set([1, 2])])).toBe('Set(2) { 1, 2 }');
  });

  it('never throws, even when reading the value throws', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('boom');
        },
        get: () => {
          throw new Error('boom');
        },
        getPrototypeOf: () => {
          throw new Error('boom');
        },
      },
    );
    expect(() => formatConsoleArgs([hostile, 1])).not.toThrow();
    const throwing = {
      get x(): number {
        throw new Error('getter');
      },
    };
    expect(formatConsoleArgs([throwing])).toBe('{ x: [Unreadable] }');
    const badToString = { toString: () => { throw new Error('x'); } };
    expect(() => formatConsoleArgs([badToString])).not.toThrow();
  });
});

describe('createConsoleCollector', () => {
  it('labels lines with the visible case that produced them, in call order', () => {
    const c = createConsoleCollector();
    c.enterCase('v1', true);
    c.record('log', ['a']);
    c.record('warn', ['b']);
    c.enterCase('v2', true);
    c.record('error', ['c']);
    c.leave();
    expect(c.report().entries).toEqual([
      { level: 'log', testId: 'v1', text: 'a' },
      { level: 'warn', testId: 'v1', text: 'b' },
      { level: 'error', testId: 'v2', text: 'c' },
    ]);
  });

  it('drops hidden-case and probe output and only flags that something was hidden', () => {
    const c = createConsoleCollector();
    c.enterCase('h1', false);
    c.record('log', ['secret input 91']);
    c.leave();
    c.record('log', ['probe re-run']);
    const report = c.report();
    expect(report.entries).toEqual([]);
    expect(report.hiddenOutput).toBe(true);
    expect(JSON.stringify(report)).not.toContain('91');
    expect(JSON.stringify(report)).not.toContain('h1');
  });

  it('keeps top-level output printed while the code loads, unlabelled', () => {
    const c = createConsoleCollector();
    c.record('info', ['loaded']);
    expect(c.report().entries).toEqual([{ level: 'info', testId: null, text: 'loaded' }]);
  });

  it('caps entries, characters per entry and total characters', () => {
    const many = createConsoleCollector({ ...CONSOLE_LIMITS, maxEntries: 3 });
    many.enterCase('v1', true);
    for (let i = 0; i < 10; i += 1) many.record('log', [i]);
    expect(many.report().entries).toHaveLength(3);
    expect(many.report().truncated).toBe(true);

    const long = createConsoleCollector();
    long.enterCase('v1', true);
    long.record('log', ['x'.repeat(5_000)]);
    const [entry] = long.report().entries;
    expect(entry?.text.length).toBeLessThanOrEqual(CONSOLE_LIMITS.maxEntryChars);
    expect(long.report().truncated).toBe(true);

    const total = createConsoleCollector({ ...CONSOLE_LIMITS, maxTotalChars: 100 });
    total.enterCase('v1', true);
    for (let i = 0; i < 10; i += 1) total.record('log', ['y'.repeat(40)]);
    const sum = total.report().entries.reduce((n, e) => n + e.text.length, 0);
    expect(sum).toBeLessThanOrEqual(100);
    expect(total.report().truncated).toBe(true);
  });

  it('does not even format once the cap is reached', () => {
    const c = createConsoleCollector({ ...CONSOLE_LIMITS, maxEntries: 1 });
    c.enterCase('v1', true);
    c.record('log', ['a']);
    let touched = false;
    c.record('log', [
      {
        get x() {
          touched = true;
          return 1;
        },
      },
    ]);
    expect(touched).toBe(false);
  });
});

describe('createConsoleStub', () => {
  it('routes the five levels and swallows every other method', () => {
    const c = createConsoleCollector();
    c.enterCase('v1', true);
    const stub = createConsoleStub(c);
    stub.log('l');
    stub.info('i');
    stub.warn('w');
    stub.error('e');
    stub.debug('d');
    expect(() => {
      stub.table([1]);
      stub.group('g');
      stub.groupEnd();
      stub.time('t');
      stub.assert(false, 'x');
      stub.trace();
    }).not.toThrow();
    expect(c.report().entries.map((e) => e.level)).toEqual(['log', 'info', 'warn', 'error', 'debug']);
  });
});

describe('worker-side capture (node)', () => {
  const cases = [
    { testId: 'v1', input: [1], visible: true },
    { testId: 'h1', input: [91], visible: false },
  ];

  function run(code: string) {
    const collector = createConsoleCollector();
    vi.stubGlobal('console', createConsoleStub(collector));
    const fn = compileEntryPoint(code, 'f');
    const outcomes = runCasesWith(fn, cases, {
      onCase: {
        before: (testCase) => collector.enterCase(testCase.testId, testCase.visible === true),
        after: () => collector.leave(),
      },
    });
    return { collector, fn, outcomes };
  }

  it('captures what player code prints in visible cases only', () => {
    const { collector, outcomes } = run('function f(n) { console.log("n =", n); return n; }');
    expect(outcomes.map((o) => o.status)).toEqual(['returned', 'returned']);
    const report = collector.report();
    expect(report.entries).toEqual([{ level: 'log', testId: 'v1', text: 'n = 1' }]);
    expect(report.hiddenOutput).toBe(true);
    expect(JSON.stringify(report)).not.toContain('91');
  });

  it('keeps the lines printed before a case throws', () => {
    const { collector, outcomes } = run('function f(n) { console.log("antes"); throw new Error("x"); }');
    expect(outcomes[0]?.status).toBe('threw');
    expect(collector.report().entries[0]?.text).toBe('antes');
  });

  it('a logged non-deterministic value does not make the determinism probe fail', () => {
    const { collector, fn, outcomes } = run(
      'function f(n) { console.log(Date.now(), Math.random()); return n * 2; }',
    );
    const returned = outcomes.flatMap((o) =>
      o.status === 'returned'
        ? [{ testId: o.testId, input: cases.find((c) => c.testId === o.testId)?.input ?? [], value: o.value }]
        : [],
    );
    const before = collector.report().entries.length;
    const verdict = probeDeterminism(fn, returned, { maxMs: 1_000, now: () => performance.now() });
    expect(verdict).toBe(true);
    // Probe re-runs print too, but never reach the report.
    expect(collector.report().entries).toHaveLength(before);
  });

  it('a hostile argument cannot turn into a harness failure', () => {
    const { outcomes } = run(
      'function f(n) { console.log(new Proxy({}, { ownKeys() { throw new Error("x"); } })); return n; }',
    );
    expect(outcomes.map((o) => o.status)).toEqual(['returned', 'returned']);
  });
});

describe('parseConsoleReport / onlyVisibleOutput', () => {
  it('accepts a well-formed report and rejects anything else', () => {
    const good = { entries: [{ level: 'log', testId: 'v1', text: 'hi' }], truncated: false, hiddenOutput: false };
    expect(parseConsoleReport(good)).toEqual(good);
    expect(parseConsoleReport(null)).toBeNull();
    expect(parseConsoleReport({ ...good, entries: 'x' })).toBeNull();
    expect(parseConsoleReport({ ...good, entries: [{ level: 'exit', testId: null, text: 'x' }] })).toBeNull();
    expect(parseConsoleReport({ ...good, entries: [{ level: 'log', testId: 3, text: 'x' }] })).toBeNull();
    expect(parseConsoleReport({ ...good, truncated: 'yes' })).toBeNull();
  });

  it('re-applies the caps to a report it did not build itself', () => {
    const big = {
      entries: Array.from({ length: 500 }, () => ({ level: 'log', testId: 'v1', text: 'z'.repeat(2_000) })),
      truncated: false,
      hiddenOutput: false,
    };
    const parsed = parseConsoleReport(big);
    expect(parsed?.entries.length).toBeLessThanOrEqual(CONSOLE_LIMITS.maxEntries);
    const chars = parsed?.entries.reduce((n, e) => n + e.text.length, 0) ?? 0;
    expect(chars).toBeLessThanOrEqual(CONSOLE_LIMITS.maxTotalChars);
    expect(parsed?.truncated).toBe(true);
  });

  it('drops entries whose test id is not a visible one', () => {
    const report = {
      entries: [
        { level: 'log' as const, testId: 'v1', text: 'ok' },
        { level: 'log' as const, testId: 'h1', text: 'forged' },
        { level: 'log' as const, testId: null, text: 'load' },
      ],
      truncated: false,
      hiddenOutput: false,
    };
    const filtered = onlyVisibleOutput(report, new Set(['v1']));
    expect(filtered.entries.map((e) => e.text)).toEqual(['ok', 'load']);
    expect(filtered.hiddenOutput).toBe(true);
  });
});
