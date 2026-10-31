/**
 * Behavioural probes: mutation (E11), determinism (E18) and rotation (E07).
 *
 * These exist because source inspection cannot see them reliably. A function
 * that reads only `xs[0]` looks plausible; run it on `xs` and on `rotate(xs, 1)`
 * and the lie is exposed. Same for a function that mutates its argument, or one
 * that uses `Math.random()` behind a correct-looking signature.
 *
 * Two rules keep the probes honest:
 *
 * - They are **best effort**. Every probe has a deadline; when it cannot finish,
 *   it returns `undefined` ("not probed") instead of inventing a verdict.
 * - They never turn a probe crash into a player error. A re-run that throws
 *   tells us nothing about determinism or rotation, so the probe abstains.
 *
 * Inputs are cloned, never frozen. A frozen input would make a player's write
 * throw `TypeError` and the diagnosis would collapse into E02, hiding the very
 * mutation E11 is meant to name (docs/04 §2).
 */

import { deepEqual } from '../../shared/lib/deep-equal';
import type { CaseOutcome } from './port';

export type ProbeClock = () => number;

export interface ProbeBudget {
  /** Milliseconds available for this probe. Zero or less means "not probed". */
  maxMs: number;
  now: ProbeClock;
}

export interface DeterminismCase {
  testId: string;
  input: readonly unknown[];
  /** The raw value from the first run, before transfer sanitising. */
  value: unknown;
}

export interface RotationCase {
  testId: string;
  input: readonly unknown[];
  expected: unknown;
}

/** Trailing newline for exported types is not needed; this alias documents the shape. */
export type ProbeFunction = (...args: unknown[]) => unknown;

function cloneArguments(input: readonly unknown[]): unknown[] | null {
  try {
    return structuredClone(input) as unknown[];
  } catch {
    return null;
  }
}

function budgetExhausted(budget: ProbeBudget, deadline: number): boolean {
  return budget.maxMs <= 0 || budget.now() >= deadline;
}

/**
 * `deepEqual` treats `NaN` as unequal to itself. For the probes, two `NaN`s are
 * the same result (the value still fails the test engine separately).
 */
export function probeEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  return deepEqual(a, b);
}

/** Rotate an array by one position. Non-arrays, and arrays of fewer than two items, are unchanged. */
export function rotateOnce(value: unknown): unknown {
  if (!Array.isArray(value) || value.length < 2) return value;
  return [...value.slice(1), value[0]];
}

/**
 * Rotation eligibility is derived, never authored.
 *
 * A case is eligible when its first argument is an array of at least two items
 * and the expected answer is invariant under a one-step rotation. A scalar
 * answer always is; an ordered array answer (a sorted result, a prefix) is not.
 * That is exactly the distinction between "the answer must not depend on where
 * the list starts" and "the answer is the order".
 */
export function isRotationEligible(firstArgument: unknown, expected: unknown): boolean {
  if (!Array.isArray(firstArgument) || firstArgument.length < 2) return false;
  return probeEqual(rotateOnce(expected), expected);
}

/**
 * The cases the rotation probe may judge.
 *
 * Rotation instability means "this solution was right, and rotating the input
 * made it wrong". A case whose unrotated run already failed (wrong value, threw)
 * says nothing about rotation: probing it would report E07 for any wrong
 * solution and hide the authored diagnosis. So only eligible cases whose
 * unrotated run returned `expected` are probed.
 */
export function selectRotationCases(
  testCases: readonly RotationCase[],
  outcomes: readonly CaseOutcome[],
): RotationCase[] {
  return testCases.filter((testCase) => {
    if (!isRotationEligible(testCase.input[0], testCase.expected)) return false;
    const outcome = outcomes.find((entry) => entry.testId === testCase.testId);
    return (
      outcome !== undefined &&
      outcome.status === 'returned' &&
      probeEqual(outcome.value, testCase.expected)
    );
  });
}

/**
 * Run each value-producing case twice more.
 *
 * Returns:
 * - `true`  — every re-run matched the first value
 * - `false` — a re-run produced a different value (E18)
 * - `undefined` — the budget ran out or a re-run threw, so no claim is made
 */
export function probeDeterminism(
  fn: ProbeFunction,
  cases: readonly DeterminismCase[],
  budget: ProbeBudget,
): boolean | undefined {
  if (cases.length === 0) return true;

  const deadline = budget.now() + budget.maxMs;

  for (const testCase of cases) {
    for (let repetition = 0; repetition < 2; repetition += 1) {
      if (budgetExhausted(budget, deadline)) return undefined;

      const args = cloneArguments(testCase.input);
      if (args === null) return undefined;

      let value: unknown;
      try {
        value = fn(...args);
      } catch {
        return undefined;
      }

      if (!probeEqual(value, testCase.value)) return false;
    }
  }

  return true;
}

/**
 * Run each rotation-eligible case once on its rotated input.
 *
 * Returns `true` when any rotated run no longer produces `expected` (E07),
 * `false` when every eligible case survives rotation, and `undefined` when the
 * budget ran out or a rotated run threw.
 */
export function probeRotation(
  fn: ProbeFunction,
  cases: readonly RotationCase[],
  budget: ProbeBudget,
): boolean | undefined {
  if (cases.length === 0) return false;

  const deadline = budget.now() + budget.maxMs;

  for (const testCase of cases) {
    if (budgetExhausted(budget, deadline)) return undefined;

    const args = cloneArguments(testCase.input);
    if (args === null) return undefined;

    const [first, ...rest] = args;
    const rotated = [rotateOnce(first), ...rest];

    let value: unknown;
    try {
      value = fn(...rotated);
    } catch {
      return undefined;
    }

    if (!probeEqual(value, testCase.expected)) return true;
  }

  return false;
}
