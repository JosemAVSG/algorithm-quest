import { beforeAll, describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import type { ExecutionOutcome } from '../../../src/domain/execution/port';
import { runCases } from '../../../src/domain/execution/run-cases';
import { describeDiagnosis } from '../../../src/domain/diagnosis/hints';
import { loadMission } from '../../support/content';

let mission: Mission;

function completed(missionToRun: Mission, code: string): ExecutionOutcome {
  return {
    kind: 'completed',
    durationMs: 4,
    cases: runCases(code, missionToRun.contract.entryPoint, executionCases(missionToRun)),
  };
}

function evaluate(missionToRun: Mission, code: string, attempt = 1) {
  return evaluateRun({
    mission: missionToRun,
    outcome: completed(missionToRun, code),
    source: code,
    attempt,
    codeChanged: true,
  });
}

beforeAll(async () => {
  mission = await loadMission('M01');
});

describe('M01 through the whole domain chain', () => {
  it('loads the shipped mission', () => {
    expect(mission.contract.entryPoint).toBe('isOverLimit');
  });

  it('correct code clears every group', () => {
    const { report, diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}',
    );

    expect(report.allPassed).toBe(true);
    expect(report.counts).toEqual({
      visible: { passed: 3, total: 3 },
      hidden: { passed: 4, total: 4 },
      edge: { passed: 3, total: 3 },
    });
    expect(diagnosis!.code).toBe('CLEAR');
  });

  it('the >= bug is E05 and names the boundary case', () => {
    const { report, diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}',
    );

    expect(report.allPassed).toBe(false);
    expect(report.counts.visible.passed).toBe(3);
    // The boundary and zero-equality cases both catch `>=`.
    expect(report.failingIds).toEqual(['ed1', 'ed3']);
    expect(diagnosis!.code).toBe('E05');
    expect(diagnosis!.confidence).toBe('certain');
    // The precise, boundary-specific message — not the truthiness one.
    expect(diagnosis!.evidence.message).toContain('90 y límite 90');
  });

  it('a missing post-condition default is E08, not E12', () => {
    const { diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  if (temperature > limit) {\n    return true;\n  }\n}',
    );

    expect(diagnosis!.code).toBe('E08');
  });

  it('returning a string is E12', () => {
    const { diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  return "true";\n}',
    );

    expect(diagnosis!.code).toBe('E12');
  });

  it('returning a number is E12, not the E05 catch-all', () => {
    const { diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  return temperature - limit;\n}',
    );

    expect(diagnosis!.code).toBe('E12');
  });

  it('a truthiness check is E05 with its own message', () => {
    const { diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  if (temperature) {\n    return true;\n  }\n  return false;\n}',
    );

    expect(diagnosis!.code).toBe('E05');
    expect(diagnosis!.evidence.message).toContain('85');
  });

  it('a syntax error is E01 and never runs the cases', () => {
    const { report, diagnosis } = evaluateRun({
      mission,
      outcome: { kind: 'syntax_error', message: 'Unexpected end of input' },
      source: 'function isOverLimit( {',
      attempt: 1,
      codeChanged: true,
    });

    expect(diagnosis!.code).toBe('E01');
    expect(report.ranAtAll).toBe(false);
    expect(report.blockedBy).toBe('syntax_error');
  });

  it('a runtime throw is E02 and keeps the message', () => {
    const { diagnosis } = evaluate(
      mission,
      'function isOverLimit(temperature, limit) {\n  throw new Error("boom");\n}',
    );

    expect(diagnosis!.code).toBe('E02');
    expect(diagnosis!.evidence.message).toContain('boom');
  });

  it('a missing entry point is E02 with a specific message', () => {
    const { diagnosis } = evaluateRun({
      mission,
      outcome: { kind: 'missing_entry_point', entryPoint: 'isOverLimit' },
      source: 'const nope = 1;',
      attempt: 1,
      codeChanged: true,
    });

    expect(diagnosis!.code).toBe('E02');
    expect(diagnosis!.evidence.message).toContain('isOverLimit');
  });

  it('a timeout is E03', () => {
    const { diagnosis } = evaluateRun({
      mission,
      outcome: { kind: 'timeout', durationMs: 2000 },
      source: 'while (true) {}',
      attempt: 1,
      codeChanged: true,
    });

    expect(diagnosis!.code).toBe('E03');
  });

  it('applies history modifiers in the documented order', () => {
    const buggy = 'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}';

    const first = evaluate(mission, buggy, 1);
    expect(first.diagnosis!.modifiers).toContain('LOW_ATTEMPT');
    expect(first.diagnosis!.modifiers).not.toContain('REPEAT');

    const again = evaluateRun({
      mission,
      outcome: completed(mission, buggy),
      source: buggy,
      attempt: 2,
      previousCode: 'E05',
      codeChanged: false,
    });
    expect(again.diagnosis!.modifiers).toEqual(
      expect.arrayContaining(['REPEAT', 'NO_PROGRESS']),
    );
    expect(again.diagnosis!.modifiers).not.toContain('STRUGGLING');

    const fourth = evaluateRun({
      mission,
      outcome: completed(mission, buggy),
      source: buggy,
      attempt: 4,
      previousCode: 'E05',
      codeChanged: true,
    });
    expect(fourth.diagnosis!.modifiers).toContain('STRUGGLING');
  });
});

/**
 * M2: the probes and the two outcomes that are not player mistakes.
 *
 * The important assertion in this block is `passed`, not the code. Every one of
 * these runs can have `report.allPassed === true` and still be uncompletable,
 * which is the whole reason the completion gate moved off the test report.
 */
describe('behavioural probes outrank a passing report', () => {
  const correct = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';

  function withOutcome(patch: Partial<Extract<ExecutionOutcome, { kind: 'completed' }>>) {
    const base = completed(mission, correct);
    if (base.kind !== 'completed') throw new Error('expected a completed run');
    return evaluateRun({
      mission,
      outcome: { ...base, ...patch },
      source: correct,
      attempt: 1,
      codeChanged: true,
    });
  }

  it('a clean run is CLEAR and completable', () => {
    const evaluation = evaluate(mission, correct);
    expect(evaluation.diagnosis!.code).toBe('CLEAR');
    expect(evaluation.passed).toBe(true);
    expect(evaluation.probes.failed).toBe(false);
  });

  it('mutating the input is E11 even when every test passes', () => {
    const evaluation = withOutcome({ mutatedInput: true });
    expect(evaluation.report.allPassed).toBe(true);
    expect(evaluation.diagnosis!.code).toBe('E11');
    expect(evaluation.diagnosis!.evidence.message).toContain('modificó');
    expect(evaluation.passed).toBe(false);
  });

  it('different answers for the same input are E18', () => {
    const evaluation = withOutcome({ deterministic: false });
    expect(evaluation.report.allPassed).toBe(true);
    expect(evaluation.diagnosis!.code).toBe('E18');
    expect(evaluation.passed).toBe(false);
  });

  it('a rotation-dependent answer is E07', () => {
    const evaluation = withOutcome({ rotationUnstable: true });
    expect(evaluation.diagnosis!.code).toBe('E07');
    expect(evaluation.passed).toBe(false);
  });

  it('E11 outranks a failing authored diagnosis, because the input is already broken', () => {
    const buggy = 'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}';
    const base = completed(mission, buggy);
    if (base.kind !== 'completed') throw new Error('expected a completed run');
    const evaluation = evaluateRun({
      mission,
      outcome: { ...base, mutatedInput: true },
      source: buggy,
      attempt: 1,
      codeChanged: true,
    });
    expect(evaluation.diagnosis!.code).toBe('E11');
  });

  it('a probe that could not finish makes no claim', () => {
    const evaluation = withOutcome({ deterministic: undefined, rotationUnstable: false });
    expect(evaluation.diagnosis!.code).toBe('CLEAR');
    expect(evaluation.passed).toBe(true);
  });
});

describe('harness faults are not player diagnoses', () => {
  it('rejects an oversized payload as E12 with a size-specific message', () => {
    const evaluation = evaluateRun({
      mission,
      outcome: { kind: 'output_too_large', testId: 'v1', bytes: 5 * 1024 * 1024 },
      source: 'function isOverLimit() { return new Array(5_000_000).join("x"); }',
      attempt: 1,
      codeChanged: true,
    });

    expect(evaluation.diagnosis!.code).toBe('E12');
    expect(evaluation.diagnosis!.evidence.message).toContain('demasiada información');
    expect(evaluation.passed).toBe(false);
  });

  it('returns no diagnosis and no completion for an internal error', () => {
    const evaluation = evaluateRun({
      mission,
      outcome: { kind: 'internal_error', message: 'DataCloneError: nope' },
      source: 'function isOverLimit() { return true; }',
      attempt: 1,
      codeChanged: true,
    });

    expect(evaluation.diagnosis).toBeNull();
    expect(evaluation.internalError).toContain('DataCloneError');
    expect(evaluation.passed).toBe(false);
  });

  it('shows the cap message in the mentor card instead of the generic E12 line', () => {
    const evaluation = evaluateRun({
      mission,
      outcome: { kind: 'output_too_large', testId: 'v1', bytes: 5 * 1024 * 1024 },
      source: 'function isOverLimit() { return new Array(5_000_000).join("x"); }',
      attempt: 1,
      codeChanged: true,
    });
    const card = describeDiagnosis(evaluation.diagnosis!);
    expect(card.detail).toContain('demasiada información');
  });
});
