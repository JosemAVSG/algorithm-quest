import { describe, expect, it } from 'vitest';

import { previewValue, renderPreview } from '../../../src/domain/execution/preview';
import { traceCase } from '../../../src/domain/execution/trace';

describe('previewValue / renderPreview', () => {
  it('renders primitives, arrays and objects compactly', () => {
    expect(renderPreview(previewValue([1, 'a', null, true]))).toBe('[1, "a", null, true]');
    expect(renderPreview(previewValue({ a: 1, b: [2] }))).toBe('{ a: 1, b: [2] }');
    expect(renderPreview(previewValue(undefined))).toBe('undefined');
    expect(renderPreview(previewValue(NaN))).toBe('NaN');
  });

  it('shows Set and Map as what they are', () => {
    expect(renderPreview(previewValue(new Set([1, 2])))).toBe('Set {1, 2}');
    expect(renderPreview(previewValue(new Map([['k', 1]])))).toBe('Map {"k" → 1}');
  });

  it('bounds long arrays and long strings and says how much is missing', () => {
    expect(renderPreview(previewValue(Array.from({ length: 100 }, (_, i) => i)))).toContain('… +76');
    const long = previewValue('x'.repeat(500));
    expect(typeof long === 'string' && long.length).toBeLessThan(100);
  });

  it('survives cycles, depth and values that cannot be cloned', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(renderPreview(previewValue(cyclic))).toBe('{ self: … }');
    expect(renderPreview(previewValue({ a: { b: { c: { d: { e: 1 } } } } }))).toContain('…');
    expect(renderPreview(previewValue(function named() {}))).toBe('ƒ named');
  });
});

describe('traceCase', () => {
  const SUM = 'function sum(xs) {\n  let total = 0;\n  for (const x of xs) {\n    total += x;\n  }\n  return total;\n}';

  it('records the real variables at every step, with the player\'s own line numbers', () => {
    const outcome = traceCase(SUM, 'sum', [[4, 6]]);
    expect(outcome.kind).toBe('traced');
    if (outcome.kind !== 'traced') return;
    expect(outcome.steps.map((s) => s.line)).toEqual([1, 3, 3]);
    const byName = (step: number, name: string) =>
      outcome.steps[step]!.variables.find((v) => v.name === name)!;
    expect(byName(1, 'total').value).toBe(0);
    expect(byName(1, 'x').value).toBe(4);
    expect(byName(2, 'total').value).toBe(4);
    expect(byName(2, 'x').value).toBe(6);
    expect(outcome.result).toEqual({ status: 'returned', value: 10 });
  });

  it('marks what changed since the previous step', () => {
    const outcome = traceCase(SUM, 'sum', [[4, 6]]);
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    const changed = (step: number) =>
      outcome.steps[step]!.variables.filter((v) => v.changed).map((v) => v.name);
    expect(changed(2)).toEqual(['total', 'x']);
  });

  it('shows the parameters of each call in a recursive function', () => {
    const outcome = traceCase('function r(n) {\n  return n === 0 ? 0 : r(n - 1);\n}', 'r', [2]);
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    expect(outcome.steps.map((s) => s.variables.find((v) => v.name === 'n')?.value)).toEqual([2, 1, 0]);
  });

  it('does not touch the caller\'s input', () => {
    const input = [[3, 1, 2]];
    traceCase('function f(xs) { xs.sort(); return xs; }', 'f', input);
    expect(input[0]).toEqual([3, 1, 2]);
  });

  it('keeps a variable that holds undefined and drops one that does not exist yet', () => {
    const outcome = traceCase('function f() {\n  let kept;\n  for (const x of [1]) {\n    const later = x;\n  }\n}', 'f', []);
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    const loopStep = outcome.steps[1]!;
    expect(loopStep.variables.map((v) => v.name)).toContain('kept');
    expect(loopStep.variables.map((v) => v.name)).not.toContain('later');
  });

  it('stops an endless loop after maxSteps and says so', () => {
    const outcome = traceCase('function f() { let i = 0; while (true) { i++; } }', 'f', [], { maxSteps: 25 });
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    expect(outcome.steps).toHaveLength(25);
    expect(outcome.truncated).toBe(true);
    expect(outcome.result).toEqual({ status: 'stopped', reason: 'steps' });
    expect(outcome.steps[24]!.variables.find((v) => v.name === 'i')!.value).toBe(23);
  });

  it('still stops when the player swallows the stop signal', () => {
    const outcome = traceCase(
      'function f() { for (;;) { try { let x = 1; } catch (e) {} } }',
      'f',
      [],
      { maxSteps: 10 },
    );
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    expect(outcome.result).toEqual({ status: 'stopped', reason: 'steps' });
  });

  it('stops work that is cheap to record but expensive to do', () => {
    const outcome = traceCase(
      'function f() { let n = 0; for (let i = 0; i < 1e9; i++) n++; return n; }',
      'f',
      [],
      { maxSteps: 1_000_000, opLimit: 5_000 },
    );
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    expect(outcome.result).toEqual({ status: 'stopped', reason: 'cost' });
  });

  it('reports a thrown error with the player\'s line', () => {
    const outcome = traceCase('function f(xs) {\n  return xs.missing.length;\n}', 'f', [[1]]);
    if (outcome.kind !== 'traced') throw new Error('expected a trace');
    expect(outcome.result.status).toBe('threw');
    if (outcome.result.status === 'threw') {
      expect(outcome.result.message).toContain('TypeError');
      expect(outcome.result.line).toBe(2);
    }
  });

  it('reports syntax errors and a missing entry point without a trace', () => {
    expect(traceCase('function (', 'f', []).kind).toBe('syntax_error');
    expect(traceCase('const x = 1;', 'f', []).kind).toBe('missing_entry_point');
  });
});
