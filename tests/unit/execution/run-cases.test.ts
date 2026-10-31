import { describe, expect, it } from 'vitest';

import { runCases, runCasesWith, compileEntryPoint } from '../../../src/domain/execution/run-cases';

/**
 * Mutation detection lives beside the call because the arguments are already in
 * hand there (E11, docs/04 §2). The guard matters as much as the detection: a
 * mission that never declared `mustNotMutate` must not be diagnosed from it.
 */
describe('runCasesWith', () => {
  const mutating = 'function f(xs) { xs.push(99); return xs.length; }';
  const pure = 'function f(xs) { return xs.length; }';

  it('reports a mutated argument when the mission asked for the check', () => {
    const cases = runCasesWith(compileEntryPoint(mutating, 'f'), [{ testId: 'v1', input: [[1, 2]] }], {
      detectMutation: true,
    });
    expect(cases[0]?.mutatedInput).toBe(true);
  });

  it('stays silent when the check is off, so in-place algorithms are not accused', () => {
    const cases = runCasesWith(compileEntryPoint(mutating, 'f'), [{ testId: 'v1', input: [[1, 2]] }]);
    expect(cases[0]?.mutatedInput).toBeUndefined();
  });

  it('does not accuse a pure function', () => {
    const cases = runCasesWith(compileEntryPoint(pure, 'f'), [{ testId: 'v1', input: [[1, 2]] }], {
      detectMutation: true,
    });
    expect(cases[0]?.mutatedInput).toBe(false);
    expect(cases[0]?.status).toBe('returned');
  });

  it('still detects mutation when the call then throws', () => {
    const cases = runCases(
      'function f(xs) { xs.push(1); throw new Error("boom"); }',
      'f',
      [{ testId: 'v1', input: [[1]] }],
    );
    // runCases does not opt in; the worker does, from the mission constraint.
    expect(cases[0]?.status).toBe('threw');
  });
});
