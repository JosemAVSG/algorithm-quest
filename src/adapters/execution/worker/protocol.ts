/**
 * The message protocol between the page and the execution worker.
 *
 * One message in, one message out, then the worker is terminated
 * (docs/08-code-execution.md §6, "one worker per run"). Keeping the protocol in
 * its own file means the runner and the worker cannot drift apart silently.
 *
 * The request carries the probes the mission wants and the budget they share;
 * the response carries their verdicts, never a partially finished one. A probe
 * that ran out of time is absent, not `false` (docs/04 §2).
 */

import type { CaseOutcome, ExecutionCase, ExecutionOutcome } from '../../../domain/execution/port';

export interface WorkerRequest {
  code: string;
  entryPoint: string;
  cases: readonly ExecutionCase[];
  timeoutMs: number;
  probes: {
    /** True only when the mission declares `mustNotMutate`. */
    mutation: boolean;
    determinism: boolean;
    rotation: boolean;
  };
}

export type WorkerResponse =
  | {
      kind: 'completed';
      durationMs: number;
      cases: CaseOutcome[];
      mutatedInput?: boolean;
      deterministic?: boolean;
      rotationUnstable?: boolean;
    }
  | Extract<ExecutionOutcome, { kind: 'output_too_large' }>
  | Extract<ExecutionOutcome, { kind: 'syntax_error' }>
  | Extract<ExecutionOutcome, { kind: 'missing_entry_point' }>
  | Extract<ExecutionOutcome, { kind: 'internal_error' }>;
