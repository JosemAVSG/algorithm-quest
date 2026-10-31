import { describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';
import { validateMissionShape } from '../../../src/domain/content/validate';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import type { ExecutionOutcome } from '../../../src/domain/execution/port';
import { probeEqual } from '../../../src/domain/execution/probes';
import { broken, validMission } from '../../support/fixtures';

/** A mission whose every case expects `expected`. */
function missionExpecting(expected: unknown): Mission {
  const draft = broken(validMission(), (mission) => {
    for (const group of ['visible', 'hidden', 'edge'] as const) {
      for (const testCase of mission.tests[group]) testCase.expected = expected;
    }
  });
  const { mission } = validateMissionShape(draft, 'fixture.json');
  if (mission === null) throw new Error('fixture mission did not validate');
  return mission;
}

function diagnose(mission: Mission, value: unknown) {
  const outcome: ExecutionOutcome = {
    kind: 'completed',
    durationMs: 3,
    cases: executionCases(mission).map((testCase) => ({
      testId: testCase.testId,
      status: 'returned' as const,
      value,
    })),
  };
  return evaluateRun({
    mission,
    outcome,
    source: 'function isOverLimit(a, b) { return a; }',
    attempt: 1,
    codeChanged: true,
  }).diagnosis;
}

describe('probeEqual', () => {
  it('treats NaN as equal to NaN at any depth', () => {
    expect(probeEqual({ total: Number.NaN, n: 1 }, { total: Number.NaN, n: 1 })).toBe(true);
    expect(probeEqual([1, [Number.NaN]], [1, [Number.NaN]])).toBe(true);
    expect(probeEqual({ total: Number.NaN }, { total: 3 })).toBe(false);
  });
});

describe('classify E10', () => {
  const mission = missionExpecting({ total: 3, count: 2 });

  it('detects NaN inside a returned object', () => {
    expect(diagnose(mission, { total: Number.NaN, count: 2 })!.code).toBe('E10');
  });

  it('detects NaN inside a returned array', () => {
    expect(diagnose(missionExpecting([1, 2]), [1, Number.NaN])!.code).toBe('E10');
  });

  it('detects undefined fields inside a returned object', () => {
    expect(diagnose(mission, { total: undefined, count: 2 })!.code).toBe('E10');
  });
});
