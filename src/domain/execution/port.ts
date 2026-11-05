/**
 * The execution boundary, as a port (docs/07-architecture.md, R3).
 *
 * The domain declares what it needs; an adapter decides how. The MVP adapter is
 * a Web Worker (docs/08-code-execution.md). Nothing in this file knows that
 * workers exist, which is what lets the same domain code run under Node in
 * tests and, later, against a remote sandbox.
 */

import type { ConsoleReport } from './console';
import type { TraceOutcome } from './trace';

export interface ExecutionCase {
  testId: string;
  input: unknown[];
  /**
   * The mission's expected value. It crosses the boundary only so the rotation
   * probe can derive eligibility from the case itself instead of a schema flag
   * (M2). It is never returned to the page or shown to the player.
   */
  expected?: unknown;
  /**
   * True only for the mission's visible group. Console output is recorded for
   * these cases alone; absent means hidden (fail closed). The flag reveals
   * nothing the worker could not already infer.
   */
  visible?: boolean;
}

export interface ExecutionRequest {
  code: string;
  entryPoint: string;
  cases: readonly ExecutionCase[];
  /** Hard ceiling. The adapter kills the run, it does not ask politely. */
  timeoutMs: number;
  /**
   * Mission-authored efficiency budget, carried through the boundary for the
   * probes and for later milestones. M2 does not enforce it: operation budgets
   * and calibration are deliberately deferred (docs/08 §6, open decisions
   * D12/D13). Filled from `mission.constraints.efficiency`.
   */
  budgetMs?: number;
  /** True when the mission treats the budget as a hard requirement. */
  enforced?: boolean;
  /**
   * Steps the worst case of a correct, reasonable solution is allowed. Cases
   * are stopped at a multiple of it, so a runaway solution ends quickly and
   * deterministically instead of at the wall-clock timeout (D13).
   */
  operationBudget?: number;
  /**
   * Behavioural probes to run after the cases. Mutation detection is opt-in per
   * mission (`mustNotMutate`); determinism and rotation are on by default and
   * abstain when the probe budget runs out (docs/04 §2).
   */
  probes?: {
    mutation?: boolean;
    determinism?: boolean;
    rotation?: boolean;
  };
  /**
   * Called at most once per run, with the already-validated console report,
   * before `execute` resolves. Side channel on purpose: console output never
   * becomes part of the outcome the evaluation reads. Not called when the run
   * is killed by the timeout.
   */
  onConsole?: (report: ConsoleReport) => void;
}

export type CaseOutcome =
  | {
      testId: string;
      status: 'returned';
      value: unknown;
      /** True when the call left its arguments different from a pre-call clone (E11). */
      mutatedInput?: boolean;
      /** Steps the call took (loop iterations, calls, built-in work). Absent when not measured. */
      ops?: number;
    }
  | {
      testId: string;
      status: 'threw';
      /** Steps taken before the case stopped. */
      ops?: number;
      /** True when the case was stopped for crossing the step limit, not for an error. */
      costExceeded?: true;
      message: string;
      /** 1-based, in the player's own source. Absent when the engine will not say. */
      line?: number;
      column?: number;
      /** A case can mutate its input and then throw; E11 still wins. */
      mutatedInput?: boolean;
    };

export type ExecutionOutcome =
  | {
      kind: 'completed';
      durationMs: number;
      cases: CaseOutcome[];
      /** True when any case mutated its arguments (E11). */
      mutatedInput?: boolean;
      /**
       * Result of the determinism probe. `undefined` means the probe did not
       * finish within its budget, so no claim is made (E18 is never a guess).
       */
      deterministic?: boolean;
      /** True when rotating an eligible input changed the verdict (E07). */
      rotationUnstable?: boolean;
    }
  /**
   * V8 does not report a line or column for a SyntaxError raised by
   * `new Function`; the stack points at the constructor, not at the offending
   * token. Claiming a position would be a fabrication, so we carry the message
   * only. Adding a real parser (acorn) is the documented fix when it matters.
   */
  | { kind: 'syntax_error'; message: string }
  | { kind: 'missing_entry_point'; entryPoint: string }
  | { kind: 'timeout'; durationMs: number }
  /**
   * A returned value exceeded the output cap. `bytes` is a bounded estimate,
   * produced before the value is cloned or serialised (docs/10 §6, S7).
   */
  | { kind: 'output_too_large'; bytes: number; testId: string }
  /**
   * The harness failed, not the player. Kept distinct from `E_UNKNOWN` so it is
   * never shown as a player diagnosis (docs/04 §8, docs/10 §7).
   */
  | { kind: 'internal_error'; message: string };

/** One case, run step by step. Only ever asked for a case the player can already see. */
export interface TraceRequest {
  code: string;
  entryPoint: string;
  input: readonly unknown[];
  /** How many steps to record before stopping the run. */
  maxSteps?: number;
  timeoutMs: number;
}

export interface ExecutionPort {
  execute(request: ExecutionRequest): Promise<ExecutionOutcome>;
  /**
   * Run a single case with the variables of every step recorded. Optional: an
   * adapter that cannot trace simply does not offer the feature.
   */
  trace?(request: TraceRequest): Promise<TraceOutcome>;
}
