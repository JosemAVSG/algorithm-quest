import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import { createMeter, installBuiltinMeter } from '../../../src/domain/execution/meter';
import type { ExecutionOutcome } from '../../../src/domain/execution/port';
import { compileEntryPoint, runCasesWith } from '../../../src/domain/execution/run-cases';
import { loadMission } from '../../support/content';

/** Correct for M01, with a deliberately wasteful loop so the cost is measurable. */
const WASTEFUL = `function isOverLimit(temperature, limit) {
  let answer = false;
  for (let i = 0; i < 50; i++) { answer = temperature > limit; }
  return answer;
}`;
const LEAN = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';

let base: Mission;
let uninstall: (() => void) | null = null;
afterEach(() => {
  uninstall?.();
  uninstall = null;
});
beforeAll(async () => {
  base = await loadMission('M01');
});

function withBudget(budget: number | undefined, enforced: boolean): Mission {
  return {
    ...base,
    constraints: {
      ...base.constraints,
      ...(budget === undefined
        ? {}
        : { efficiency: { budgetMs: 100, calibrated: true as const, enforced, operationBudget: budget } }),
    },
  };
}

function evaluate(mission: Mission, code: string, opLimit?: number) {
  const meter = createMeter();
  uninstall = installBuiltinMeter(meter);
  const fn = compileEntryPoint(code, mission.contract.entryPoint, { meter });
  const outcome: ExecutionOutcome = {
    kind: 'completed',
    durationMs: 1,
    cases: runCasesWith(fn, executionCases(mission), { meter, ...(opLimit === undefined ? {} : { opLimit }) }),
  };
  return evaluateRun({ mission, outcome, source: code, attempt: 1, codeChanged: true });
}

describe('step cost (D13)', () => {
  it('measures the most expensive case', () => {
    const { cost } = evaluate(withBudget(undefined, false), WASTEFUL);
    expect(cost).not.toBeNull();
    expect(cost!.maxOps).toBe(1 + 50);
    expect(cost!.budget).toBeNull();
    expect(cost!.over).toBe(false);
  });

  it('a correct solution over an advisory budget still passes, with E16 as advice', () => {
    const evaluation = evaluate(withBudget(20, false), WASTEFUL);
    expect(evaluation.report.allPassed).toBe(true);
    expect(evaluation.diagnosis!.code).toBe('E16');
    expect(evaluation.cost).toMatchObject({ over: true, enforced: false, budget: 20 });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.diagnosis!.evidence.message).toContain('51');
  });

  it('the same solution is blocked when the mission enforces the budget', () => {
    const evaluation = evaluate(withBudget(20, true), WASTEFUL);
    expect(evaluation.diagnosis!.code).toBe('E16');
    expect(evaluation.passed).toBe(false);
  });

  it('a solution within budget is CLEAR', () => {
    const evaluation = evaluate(withBudget(20, true), LEAN);
    expect(evaluation.diagnosis!.code).toBe('CLEAR');
    expect(evaluation.cost!.over).toBe(false);
    expect(evaluation.passed).toBe(true);
  });

  it('a case stopped at the step limit is E16, not a thrown error', () => {
    const evaluation = evaluate(
      withBudget(20, false),
      'function isOverLimit(t, l) { while (true) {} }',
      200,
    );
    expect(evaluation.diagnosis!.code).toBe('E16');
    expect(evaluation.passed).toBe(false);
    expect(evaluation.cost!.over).toBe(true);
  });

  it('feeds mastery from steps, not from the clock', async () => {
    const { buildEvidenceEvents } = await import('../../../src/domain/mastery/evidence');
    const mission = withBudget(100, false);
    const evaluation = evaluate(mission, LEAN);
    const input = { at: 0, reasoningScore: 2 as const, attempts: 1, hintsUsed: 0, maxHintLevel: 0 as const, solutionRevealed: false, strategySubmitted: true };
    const frugal = buildEvidenceEvents(mission, evaluation.report, { ...input, actualOps: 50 });
    const wasteful = buildEvidenceEvents(mission, evaluation.report, { ...input, actualOps: 400 });
    expect(frugal[0]!.efficiencyRatio).toBe(1);
    expect(wasteful[0]!.efficiencyRatio).toBeCloseTo(0.25);
  });
});
