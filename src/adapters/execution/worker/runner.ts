/**
 * Web Worker execution adapter (docs/08-code-execution.md §6).
 *
 * One worker per run, terminated after the answer or the timeout. Terminating is
 * what makes an infinite loop recoverable, and it is the only reason this
 * adapter exists rather than running `runCases` on the page.
 *
 * M2 adds the budget-derived timeout, the output cap and the probe verdicts.
 * Calibration stays out on purpose: docs/08 §6 defines no reference workload,
 * and open decision D13 argues wall-clock budgets should not be enforced at all.
 * Inventing a calibration constant here would make the numbers look measured
 * when they are not.
 */

import type {
  ExecutionOutcome,
  ExecutionPort,
  ExecutionRequest,
  TraceRequest,
} from '../../../domain/execution/port';
import type { TraceOutcome } from '../../../domain/execution/trace';
import { parseConsoleReport } from '../../../domain/execution/console';
import type {
  WorkerConsoleMessage,
  WorkerRequest,
  WorkerResponse,
  WorkerTraceRequest,
} from './protocol';

/** A safety valve, not a mission budget: no M1 mission declares an efficiency budget. */
export const DEFAULT_TIMEOUT_MS = 2_000;

/** docs/08 §6: budgeted missions get a tighter ceiling because they are measured. */
export const BUDGETED_TIMEOUT_MS = 400;

/**
 * The single place that decides how long a run may take.
 *
 * `enforced` is what separates "this mission claims to be about efficiency"
 * from "this mission will fail you for taking 3 ms too long". Only the second
 * one gets the tighter ceiling.
 */
export function timeoutFor(request: {
  enforced?: boolean;
  timeoutMs?: number;
}): number {
  if (request.enforced === true) return Math.min(request.timeoutMs ?? BUDGETED_TIMEOUT_MS, BUDGETED_TIMEOUT_MS);
  return request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

/** Steps a case may take when the mission declares no budget: only a runaway loop reaches it. */
/**
 * About 0.6 s of work: low enough that a runaway loop is stopped by the step
 * limit, deterministically, before the 2 s wall-clock timeout can be the one to
 * end it. Missions with a budget are limited much lower (see `opLimitFor`).
 */
export const DEFAULT_OP_LIMIT = 100_000_000;
/** A case is stopped at this multiple of the budget: generous, so slow-but-correct still finishes. */
export const OP_LIMIT_FACTOR = 20;
const MIN_OP_LIMIT = 200_000;

/** The step limit for one case. Deterministic, unlike the wall-clock timeout. */
export function opLimitFor(request: { operationBudget?: number }): number {
  if (request.operationBudget === undefined) return DEFAULT_OP_LIMIT;
  return Math.max(request.operationBudget * OP_LIMIT_FACTOR, MIN_OP_LIMIT);
}

function toOutcome(response: WorkerResponse): ExecutionOutcome {
  switch (response.kind) {
    case 'completed':
      return {
        kind: 'completed',
        durationMs: response.durationMs,
        cases: response.cases,
        ...(response.mutatedInput === undefined ? {} : { mutatedInput: response.mutatedInput }),
        ...(response.deterministic === undefined ? {} : { deterministic: response.deterministic }),
        ...(response.rotationUnstable === undefined
          ? {}
          : { rotationUnstable: response.rotationUnstable }),
      };
    case 'output_too_large':
      return { kind: 'output_too_large', bytes: response.bytes, testId: response.testId };
    case 'syntax_error':
      return { kind: 'syntax_error', message: response.message };
    case 'missing_entry_point':
      return { kind: 'missing_entry_point', entryPoint: response.entryPoint };
    case 'internal_error':
      return { kind: 'internal_error', message: response.message };
  }
}

export const TRACE_OP_LIMIT = 5_000_000;
const DEFAULT_TRACE_STEPS = 400;

function traceInWorker(request: TraceRequest): Promise<TraceOutcome> {
  return new Promise<TraceOutcome>((resolve) => {
    let settled = false;
    let worker: Worker | null = null;
    const finish = (outcome: TraceOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
      worker?.terminate();
    };

    try {
      worker = new Worker(new URL('./worker-entry.ts', import.meta.url), {
        type: 'module',
        name: 'algorithm-quest-trace',
      });
    } catch (error) {
      finish({ kind: 'internal_error', message: error instanceof Error ? error.message : String(error) });
      return;
    }

    globalThis.setTimeout(
      () => finish({ kind: 'timeout', durationMs: request.timeoutMs }),
      request.timeoutMs,
    );
    worker.onmessage = (event: MessageEvent<TraceOutcome>) => finish(event.data);
    worker.onerror = (event: ErrorEvent) =>
      finish({
        kind: 'internal_error',
        message: event.message === '' ? 'el worker falló sin mensaje' : event.message,
      });

    const message: WorkerTraceRequest = {
      type: 'trace',
      code: request.code,
      entryPoint: request.entryPoint,
      input: request.input,
      maxSteps: request.maxSteps ?? DEFAULT_TRACE_STEPS,
      opLimit: TRACE_OP_LIMIT,
    };
    worker.postMessage(message);
  });
}

export function createWorkerExecutionPort(): ExecutionPort {
  return {
    trace: traceInWorker,
    execute(request: ExecutionRequest): Promise<ExecutionOutcome> {
      return new Promise<ExecutionOutcome>((resolve) => {
        let settled = false;
        let worker: Worker | null = null;

        const finish = (outcome: ExecutionOutcome) => {
          if (settled) return;
          settled = true;
          resolve(outcome);
        };

        try {
          worker = new Worker(new URL('./worker-entry.ts', import.meta.url), {
            type: 'module',
            name: 'algorithm-quest-run',
          });
        } catch (error) {
          finish({
            kind: 'internal_error',
            message: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        // Not cleared: a pending timer that fires after the result is a no-op,
        // and the worker is already terminated. One less lifecycle edge.
        globalThis.setTimeout(() => {
          finish({ kind: 'timeout', durationMs: request.timeoutMs });
          worker?.terminate();
        }, request.timeoutMs);

        let consoleSeen = false;

        worker.onmessage = (event: MessageEvent<WorkerResponse | WorkerConsoleMessage>) => {
          // One response per run (docs/10 §6, S8). A second message is either a
          // duplicate or a player trying to chatter on the channel; either way
          // it gets no reply and no state.
          if (settled) return;

          // The console report is a separate, optional message that precedes
          // the result. It is accepted once, validated, and never touches the
          // outcome.
          if (event.data.kind === 'console') {
            if (!consoleSeen) {
              consoleSeen = true;
              const report = parseConsoleReport((event.data as WorkerConsoleMessage).report);
              if (report !== null) request.onConsole?.(report);
            }
            return;
          }

          finish(toOutcome(event.data as WorkerResponse));
          worker?.terminate();
        };

        worker.onerror = (event: ErrorEvent) => {
          finish({
            kind: 'internal_error',
            message: event.message === '' ? 'el worker falló sin mensaje' : event.message,
          });
          worker?.terminate();
        };

        const message: WorkerRequest = {
          code: request.code,
          entryPoint: request.entryPoint,
          cases: request.cases,
          timeoutMs: request.timeoutMs,
          opLimit: opLimitFor(request),
          probes: {
            mutation: request.probes?.mutation ?? false,
            determinism: request.probes?.determinism ?? true,
            rotation: request.probes?.rotation ?? true,
          },
        };
        worker.postMessage(message);
      });
    },
  };
}
