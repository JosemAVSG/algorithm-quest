/**
 * Running one case step by step (docs/04 §5, the trace table M2 refused).
 *
 * M2 declined to build a trace because a read-only `Proxy` only yields
 * `(index, value)`: the `condition` and `accumulator` columns would have been
 * invented. Instrumenting the source gives the real thing. At the start of every
 * loop body and every function body the instrumented code hands this module the
 * variables in scope, and each is recorded exactly as the program holds it.
 *
 * The trace is a *view of one execution*. It decides nothing: the test engine
 * stays the only judge of correctness (docs/04, principle 3), and a trace is
 * only ever produced for a case the player already sees.
 */

import { createMeter, CostLimitExceeded, type Meter } from './meter';
import { previewValue, type Preview } from './preview';
import { compileEntryPoint, frameOf, MissingEntryPointError, PlayerSyntaxError } from './run-cases';

export interface TraceVariable {
  name: string;
  value: Preview;
  /** True when the value differs from the same variable one step earlier. */
  changed: boolean;
}

export interface TraceStep {
  /** 1-based position in the trace. */
  n: number;
  /** 1-based line of the player's own source this step belongs to. */
  line: number;
  variables: TraceVariable[];
}

export type TraceResult =
  | { status: 'returned'; value: Preview }
  | { status: 'threw'; message: string; line?: number }
  /** The run was stopped before it ended: too many steps recorded, or too much work. */
  | { status: 'stopped'; reason: 'steps' | 'cost' };

export type TraceOutcome =
  | { kind: 'traced'; steps: TraceStep[]; truncated: boolean; result: TraceResult }
  | { kind: 'syntax_error'; message: string }
  | { kind: 'missing_entry_point'; entryPoint: string }
  | { kind: 'timeout'; durationMs: number }
  | { kind: 'internal_error'; message: string };

export const DEFAULT_TRACE_STEPS = 400;
const TRACE_COST_LIMIT = 5_000_000;

class TraceLimit extends Error {
  constructor() {
    super('trace limit');
    this.name = 'TraceLimit';
  }
}

export interface TraceOptions {
  maxSteps?: number;
  /** Step limit for the work itself, so a runaway loop ends deterministically. */
  opLimit?: number;
  /** Injected so the worker can share the meter that wraps the built-ins. */
  meter?: Meter;
}

type Read = () => [string, boolean, unknown?][];

export function traceCase(
  code: string,
  entryPoint: string,
  input: readonly unknown[],
  options: TraceOptions = {},
): TraceOutcome {
  const maxSteps = options.maxSteps ?? DEFAULT_TRACE_STEPS;
  const meter = options.meter ?? createMeter();
  const steps: TraceStep[] = [];
  let previous = new Map<string, string>();
  let truncated = false;

  const snapshot = (line: number, read: Read) => {
    if (steps.length >= maxSteps) {
      truncated = true;
      throw new TraceLimit();
    }
    const current = new Map<string, string>();
    const variables: TraceVariable[] = [];
    for (const [name, ok, value] of read()) {
      if (!ok) continue;
      const shown = previewValue(value);
      const key = JSON.stringify(shown);
      current.set(name, key);
      variables.push({ name, value: shown, changed: previous.get(name) !== key });
    }
    steps.push({ n: steps.length + 1, line, variables });
    previous = current;
  };

  let fn;
  try {
    fn = compileEntryPoint(code, entryPoint, { meter, snapshot });
  } catch (error) {
    if (error instanceof PlayerSyntaxError) return { kind: 'syntax_error', message: error.message };
    if (error instanceof MissingEntryPointError) {
      return { kind: 'missing_entry_point', entryPoint: error.entryPoint };
    }
    return {
      kind: 'internal_error',
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }

  let cloned: unknown[];
  try {
    cloned = structuredClone([...input]);
  } catch {
    cloned = [...input];
  }

  let result: TraceResult;
  meter.start(options.opLimit ?? TRACE_COST_LIMIT);
  try {
    result = { status: 'returned', value: previewValue(fn(...cloned)) };
  } catch (error) {
    if (error instanceof TraceLimit) result = { status: 'stopped', reason: 'steps' };
    else if (error instanceof CostLimitExceeded) result = { status: 'stopped', reason: 'cost' };
    else {
      const frame = frameOf((error as Error | undefined)?.stack);
      result = {
        status: 'threw',
        message:
          error instanceof Error ? `${error.name}: ${error.message}` : `se lanzó ${String(error)}`,
        ...(frame === undefined ? {} : { line: frame.line }),
      };
    }
  } finally {
    meter.stop();
  }
  // A player's try/catch can swallow the stop signal; the flags still tell.
  if (truncated && result.status !== 'stopped') result = { status: 'stopped', reason: 'steps' };
  if (meter.exceeded && result.status === 'returned') result = { status: 'stopped', reason: 'cost' };

  return { kind: 'traced', steps, truncated, result };
}
