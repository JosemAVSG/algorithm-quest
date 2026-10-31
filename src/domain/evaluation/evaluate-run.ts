/**
 * One attempt, evaluated: execution outcome in, frozen report and diagnosis out.
 *
 * This is the composition docs/07-architecture.md §5 describes, kept as a pure
 * function so the lab does not have to know the order of the three layers. The
 * order is the contract:
 *
 *   outcome -> TestReport -> Diagnosis -> modifiers
 *
 * Nothing here runs code or renders anything. A caller that already has an
 * outcome (a test, a fake adapter) can evaluate an attempt without a browser.
 *
 * M2 separates two questions the UI used to conflate:
 *
 * - `report.allPassed` — did the test engine say every case is right?
 * - `passed` — can this mission be completed? Tests plus the behavioural
 *   probes, because a function that mutates its input or answers differently
 *   each run has not solved anything (docs/04 §2, E07/E11/E18).
 *
 * A harness failure is not a player diagnosis (docs/04 §8): it comes back as
 * `diagnosis: null` with `internalError` set, and no evidence is emitted.
 */

import type { Mission } from '../content/schema';
import { applyModifiers, classify } from '../diagnosis/classify';
import type { Diagnosis, DiagnosisCode } from '../diagnosis/taxonomy';
import type { ExecutionOutcome } from '../execution/port';
import type { TestReport } from './test-engine';
import { buildTestReport } from './test-engine';

export interface EvaluateRunInput {
  mission: Mission;
  outcome: ExecutionOutcome;
  /** The source that produced `outcome`, for the static checks (M3). */
  source: string;
  /** 1-based attempt number this run is about to become. */
  attempt: number;
  /**
   * The *primary* diagnosis code of the previous attempt, when there was one.
   * Using the final code would break repeat detection once E15 replaced it.
   */
  previousCode?: DiagnosisCode;
  /** False when the source is byte-identical to the previous attempt. */
  codeChanged: boolean;
  /** True when the previous attempt had a hint on screen (POST_HINT). */
  previousHadHint?: boolean;
}

export interface ProbeVerdict {
  mutatedInput: boolean;
  nondeterministic: boolean;
  rotationUnstable: boolean;
  /** True when at least one probe ran and contradicted the result. */
  failed: boolean;
}

export interface RunEvaluation {
  report: TestReport;
  /** Null only for harness faults. Every player-attributable attempt has one. */
  diagnosis: Diagnosis | null;
  /**
   * The diagnosis before history modifiers. Kept because repeat detection must
   * compare like with like: once an attempt is labelled E15, comparing the
   * final code on the next attempt would never see a third repetition.
   */
  primaryCode: DiagnosisCode | null;
  /** Set only when the harness failed; the UI shows a neutral message. */
  internalError: string | null;
  /**
   * The verdict the session gates on. Tests passing is necessary, not
   * sufficient: a contradicted probe or a banned construct blocks completion.
   */
  passed: boolean;
  probes: ProbeVerdict;
  durationMs: number;
}

function probeVerdict(outcome: ExecutionOutcome): ProbeVerdict {
  const mutatedInput = outcome.kind === 'completed' && outcome.mutatedInput === true;
  const nondeterministic = outcome.kind === 'completed' && outcome.deterministic === false;
  const rotationUnstable = outcome.kind === 'completed' && outcome.rotationUnstable === true;
  return {
    mutatedInput,
    nondeterministic,
    rotationUnstable,
    failed: mutatedInput || nondeterministic || rotationUnstable,
  };
}

export function evaluateRun(input: EvaluateRunInput): RunEvaluation {
  const { mission, outcome, source, attempt, previousCode, codeChanged, previousHadHint } = input;
  const report = buildTestReport(mission, outcome);
  const probes = probeVerdict(outcome);

  if (outcome.kind === 'internal_error') {
    return {
      report,
      diagnosis: null,
      primaryCode: null,
      internalError: outcome.message,
      passed: false,
      probes,
      durationMs: 0,
    };
  }

  const primary = classify({ mission, outcome, report, source });
  const diagnosis = applyModifiers(primary, {
    attempt,
    codeChanged,
    ...(previousCode === undefined ? {} : { previousCode }),
    ...(previousHadHint === undefined ? {} : { previousHadHint }),
  });

  const durationMs = outcome.kind === 'completed' ? outcome.durationMs : 0;
  // E19 is a mission constraint: the tests can be green and the mission still
  // cannot be completed by using the construct it bans (docs/04 §2).
  const passed = report.allPassed && !probes.failed && primary.code !== 'E19';

  return {
    report,
    diagnosis,
    primaryCode: primary.code,
    internalError: null,
    passed,
    probes,
    durationMs,
  };
}
