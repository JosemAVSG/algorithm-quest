/**
 * The execution boundary, as a port (docs/07-architecture.md, R3).
 *
 * The domain declares what it needs; an adapter decides how. The MVP adapter is
 * a Web Worker (docs/08-code-execution.md). Nothing in this file knows that
 * workers exist, which is what lets the same domain code run under Node in
 * tests and, later, against a remote sandbox.
 */

export interface ExecutionCase {
  testId: string;
  input: unknown[];
  /**
   * The mission's expected value. It crosses the boundary only so the rotation
   * probe can derive eligibility from the case itself instead of a schema flag
   * (M2). It is never returned to the page or shown to the player.
   */
  expected?: unknown;
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
  /** Operations the mission expects a correct solution to need, when declared. */
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
}

export type CaseOutcome =
  | {
      testId: string;
      status: 'returned';
      value: unknown;
      /** True when the call left its arguments different from a pre-call clone (E11). */
      mutatedInput?: boolean;
    }
  | {
      testId: string;
      status: 'threw';
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

export interface ExecutionPort {
  execute(request: ExecutionRequest): Promise<ExecutionOutcome>;
}
