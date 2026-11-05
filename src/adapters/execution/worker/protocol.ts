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

import type { ConsoleReport } from '../../../domain/execution/console';
import type { CaseOutcome, ExecutionCase, ExecutionOutcome } from '../../../domain/execution/port';

export interface WorkerRequest {
  code: string;
  entryPoint: string;
  cases: readonly ExecutionCase[];
  timeoutMs: number;
  /** Steps one case may take before it is stopped (D13). */
  opLimit: number;
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

/**
 * Sent once, before the final response. A dedicated kind keeps it apart from
 * the outcome: the runner validates it with `parseConsoleReport` and hands it to
 * a side-channel callback, so console output can never alter a verdict.
 */
export interface WorkerConsoleMessage {
  kind: 'console';
  report: ConsoleReport;
}

/**
 * A trace request. It shares the worker with ordinary runs but is a different
 * message: no probes, no console, and the reply is a `TraceOutcome`.
 */
export interface WorkerTraceRequest {
  type: 'trace';
  code: string;
  entryPoint: string;
  input: readonly unknown[];
  maxSteps: number;
  /** Steps the work itself may take, so a runaway loop ends deterministically. */
  opLimit: number;
}

export type WorkerMessage = WorkerRequest | WorkerTraceRequest;

export function isTraceRequest(message: WorkerMessage): message is WorkerTraceRequest {
  return (message as WorkerTraceRequest).type === 'trace';
}
