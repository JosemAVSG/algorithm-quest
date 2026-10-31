import { describe, expect, it } from 'vitest';

import {
  isRotationEligible,
  probeDeterminism,
  probeRotation,
  rotateOnce,
  type ProbeBudget,
} from '../../../src/domain/execution/probes';

const budget = (ms = 500): ProbeBudget => ({ maxMs: ms, now: () => performance.now() });

describe('rotateOnce', () => {
  it('moves the first element to the end', () => {
    expect(rotateOnce([1, 2, 3])).toEqual([2, 3, 1]);
  });

  it('leaves scalars and one-element arrays alone', () => {
    expect(rotateOnce(7)).toBe(7);
    expect(rotateOnce([1])).toEqual([1]);
  });
});

describe('rotation eligibility', () => {
  it('is eligible when the answer does not depend on where the list starts', () => {
    expect(isRotationEligible([1, 2, 3], 6)).toBe(true);
    expect(isRotationEligible(['a', 'b'], true)).toBe(true);
  });

  it('is not eligible when the answer is the order', () => {
    expect(isRotationEligible([3, 1, 2], [1, 2, 3])).toBe(false);
  });

  it('is not eligible without an array to rotate', () => {
    expect(isRotationEligible(90, true)).toBe(false);
    expect(isRotationEligible([1], 1)).toBe(false);
  });
});

describe('determinism probe', () => {
  it('accepts a pure function', () => {
    const fn = (...args: unknown[]) => (args[0] as number[]).reduce((total, value) => total + value, 0);
    const verdict = probeDeterminism(
      fn,
      [{ testId: 'v1', input: [[1, 2, 3]], value: 6 }],
      budget(),
    );
    expect(verdict).toBe(true);
  });

  it('rejects a function that answers differently each run', () => {
    let calls = 0;
    const fn = () => {
      calls += 1;
      return calls;
    };
    const verdict = probeDeterminism(fn, [{ testId: 'v1', input: [], value: 1 }], budget());
    expect(verdict).toBe(false);
  });

  it('abstains when the budget is gone', () => {
    const fn = () => 1;
    const verdict = probeDeterminism(fn, [{ testId: 'v1', input: [], value: 1 }], budget(0));
    expect(verdict).toBeUndefined();
  });

  it('abstains when a re-run throws', () => {
    const fn = () => {
      throw new Error('boom');
    };
    expect(probeDeterminism(fn, [{ testId: 'v1', input: [], value: 1 }], budget())).toBeUndefined();
  });
});

describe('rotation probe', () => {
  it('catches a function that only looks at the first element', () => {
    const fn = (...args: unknown[]) => (args[0] as number[])[0];
    const verdict = probeRotation(
      fn,
      [{ testId: 'v1', input: [[1, 2, 3]], expected: 1 }],
      budget(),
    );
    expect(verdict).toBe(true);
  });

  it('accepts a function whose answer is rotation-invariant', () => {
    const fn = (...args: unknown[]) => (args[0] as number[]).reduce((total, value) => total + value, 0);
    const verdict = probeRotation(
      fn,
      [{ testId: 'v1', input: [[1, 2, 3]], expected: 6 }],
      budget(),
    );
    expect(verdict).toBe(false);
  });

  it('abstains when there is nothing eligible', () => {
    expect(probeRotation(() => 1, [], budget())).toBe(false);
  });
});
