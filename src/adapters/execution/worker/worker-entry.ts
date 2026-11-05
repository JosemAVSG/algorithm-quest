/**
 * Execution worker entry point.
 *
 * The worker runs exactly one request and is then terminated by the runner. It
 * captures the real `postMessage` **before** the prelude shadows it, which is
 * what lets player code be denied the channel while the result still comes back.
 *
 * Order matters here and is the same order as the diagnosis (docs/04 §3):
 * compile → run every case → reject an oversized output → probe behaviour.
 * Probing a value we are about to reject would waste the budget on evidence the
 * player cannot use, and probing before the cap would clone the payload the cap
 * exists to stop.
 */

import {
  MissingEntryPointError,
  PlayerSyntaxError,
  compileEntryPoint,
  runCasesWith,
} from '../../../domain/execution/run-cases';
import { MAX_CASE_OUTPUT_BYTES, estimateSerializedBytes } from '../../../domain/execution/output-cap';
import type { CaseOutcome } from '../../../domain/execution/port';
import {
  probeDeterminism,
  probeRotation,
  selectRotationCases,
  type ProbeBudget,
} from '../../../domain/execution/probes';
import { createConsoleCollector, createConsoleStub } from '../../../domain/execution/console';
import { createMeter, installBuiltinMeter } from '../../../domain/execution/meter';
import { installConsole, installPrelude } from './prelude';
import { traceCase } from '../../../domain/execution/trace';
import {
  isTraceRequest,
  type WorkerConsoleMessage,
  type WorkerMessage,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol';

const send = globalThis.postMessage.bind(globalThis);
installPrelude(globalThis);

// Console capture (docs/08 §6). The collector decides what may be kept; this
// file only brackets the phases of the run.
const consoleCollector = createConsoleCollector();
installConsole(globalThis, createConsoleStub(consoleCollector));

// Step counting (D13). The worker is a disposable realm, so wrapping the array
// and set/map methods here is safe; the meter only counts while a case runs.
const meter = createMeter();
installBuiltinMeter(meter);

/**
 * Time reserved for the probes, taken from what the main run did not use.
 *
 * A fixed slice would either starve a slow machine or waste a fast one. The
 * reserve at the end keeps the worker from finishing at the exact millisecond
 * the runner kills it, which would turn a correct answer into `E03`.
 */
const PROBE_RESERVE_MS = 150;

function oversizedCase(cases: readonly CaseOutcome[]): { testId: string; bytes: number } | null {
  for (const entry of cases) {
    if (entry.status !== 'returned') continue;
    const estimate = estimateSerializedBytes(entry.value, MAX_CASE_OUTPUT_BYTES);
    if (estimate.exceeded) return { testId: entry.testId, bytes: estimate.bytes };
  }
  return null;
}

function execute(request: WorkerRequest, startedAt: number): WorkerResponse {
  let fn;
  try {
    fn = compileEntryPoint(request.code, request.entryPoint, { meter });
    // Top-level output is over; probes and the rest are never captured.
    consoleCollector.leave();
  } catch (error) {
    consoleCollector.leave();
    if (error instanceof PlayerSyntaxError) {
      return { kind: 'syntax_error', message: error.message };
    }
    if (error instanceof MissingEntryPointError) {
      return { kind: 'missing_entry_point', entryPoint: error.entryPoint };
    }
    return {
      kind: 'internal_error',
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }

  let cases: CaseOutcome[];
  try {
    cases = runCasesWith(fn, request.cases, {
      detectMutation: request.probes.mutation,
      meter,
      opLimit: request.opLimit,
      onCase: {
        before: (testCase) => consoleCollector.enterCase(testCase.testId, testCase.visible === true),
        after: () => consoleCollector.leave(),
      },
    });
  } catch (error) {
    return {
      kind: 'internal_error',
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }

  const oversized = oversizedCase(cases);
  if (oversized !== null) {
    return { kind: 'output_too_large', testId: oversized.testId, bytes: oversized.bytes };
  }

  const elapsed = performance.now() - startedAt;
  const budget: ProbeBudget = {
    maxMs: Math.floor(request.timeoutMs - elapsed - PROBE_RESERVE_MS),
    now: () => performance.now(),
  };

  const returned = cases.filter((entry) => entry.status === 'returned');
  const deterministic = request.probes.determinism
    ? probeDeterminism(
        fn,
        returned.map((entry) => ({
          testId: entry.testId,
          input: request.cases.find((testCase) => testCase.testId === entry.testId)?.input ?? [],
          value: entry.value,
        })),
        budget,
      )
    : undefined;

  const rotationUnstable = request.probes.rotation
    ? probeRotation(
        fn,
        selectRotationCases(
          request.cases.map((testCase) => ({
            testId: testCase.testId,
            input: testCase.input,
            expected: testCase.expected,
          })),
          cases,
        ),
        budget,
      )
    : undefined;

  const mutatedInput = cases.some((entry) => entry.mutatedInput === true);

  return {
    kind: 'completed',
    durationMs: performance.now() - startedAt,
    cases,
    ...(request.probes.mutation ? { mutatedInput } : {}),
    ...(deterministic === undefined ? {} : { deterministic }),
    ...(rotationUnstable === undefined ? {} : { rotationUnstable }),
  };
}

function executeSafely(request: WorkerRequest): WorkerResponse {
  try {
    return execute(request, performance.now());
  } catch (error) {
    // Reaching here is a harness bug, never the player's fault (E-codes stay honest).
    return {
      kind: 'internal_error',
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

globalThis.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (isTraceRequest(event.data)) {
    const { code, entryPoint, input, maxSteps, opLimit } = event.data;
    try {
      send(traceCase(code, entryPoint, input, { maxSteps, opLimit, meter }));
    } catch (error) {
      send({
        kind: 'internal_error',
        message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }
    return;
  }
  const response = executeSafely(event.data);
  try {
    const message: WorkerConsoleMessage = { kind: 'console', report: consoleCollector.report() };
    send(message);
  } catch {
    // Console output is a courtesy. Losing it must never lose the result.
  }
  send(response);
};
