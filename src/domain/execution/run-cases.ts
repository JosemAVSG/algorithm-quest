/**
 * Compiling and running player code, once, in whatever realm the caller is in.
 *
 * This is the semantics. The Web Worker adapter is only a transport around it,
 * which is why the same code runs under Node in tests without a browser.
 *
 * Two things here are deliberate and worth reading before changing:
 *
 * 1. `new Function` is used, not `eval`. It cannot see the caller's scope, so a
 *    player function cannot reach the mentor, the mission, or the test data by
 *    name. It is not a security boundary (docs/08 §3) but it is a real
 *    encapsulation boundary.
 *
 * 2. Line numbers are *calibrated*, not assumed. Engines disagree about how many
 *    lines the `new Function` wrapper adds to a reported frame, so we measure
 *    the offset once with a probe that throws on a known line. If the engine
 *    will not report a position, we say nothing rather than guess.
 */

import { deepEqual } from '../../shared/lib/deep-equal';
import { instrumentSource } from './instrument';
import { CostLimitExceeded, type Meter } from './meter';
import type { CaseOutcome, ExecutionCase } from './port';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Lines prepended to the player's source before it is compiled. */
const PREPENDED_LINES = 1;

const MAX_DEPTH = 20;

export class PlayerSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerSyntaxError';
  }
}

export class MissingEntryPointError extends Error {
  constructor(readonly entryPoint: string) {
    super(`entry point "${entryPoint}" is not a function`);
    this.name = 'MissingEntryPointError';
  }
}

/**
 * A value the structured-clone algorithm would refuse to send. We replace it
 * with a plain object so the worker can still report *that* it happened instead
 * of dying with a DataCloneError the player cannot act on.
 */
export interface Unserializable {
  readonly __unserializable: 'function' | 'symbol' | 'depth';
}

export function isUnserializable(value: unknown): value is Unserializable {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__unserializable' in value &&
    typeof (value as Unserializable).__unserializable === 'string'
  );
}

/**
 * How many lines the engine adds to a frame's reported line. `-1` means the
 * engine gave us nothing to calibrate against.
 */
let calibratedShift: number | null = null;

function engineLineShift(): number {
  if (calibratedShift !== null) return calibratedShift;
  try {
    // The probe throws on body line 2. Any reported line above that is wrapper.
    new Function('"use strict";\nthrow new Error("__probe__");\n')();
    calibratedShift = -1;
  } catch (error) {
    const match = /<anonymous>:(\d+):\d+/.exec(String((error as Error).stack ?? ''));
    calibratedShift = match ? Number(match[1]) - 2 : -1;
  }
  return calibratedShift;
}

function frameOf(stack: string | undefined): { line: number; column: number } | undefined {
  if (stack === undefined) return undefined;
  const shift = engineLineShift();
  if (shift < 0) return undefined;
  const match = /<anonymous>:(\d+):(\d+)/.exec(stack);
  if (match === null) return undefined;
  const line = Number(match[1]) - shift - PREPENDED_LINES;
  if (!Number.isFinite(line) || line < 1) return undefined;
  return { line, column: Number(match[2]) };
}

function sanitize(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (typeof value === 'function') return { __unserializable: 'function' } satisfies Unserializable;
  if (typeof value === 'symbol') return { __unserializable: 'symbol' } satisfies Unserializable;
  if (depth > MAX_DEPTH) return { __unserializable: 'depth' } satisfies Unserializable;
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return { __unserializable: 'depth' } satisfies Unserializable;

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen, depth + 1));
  }
  const source = value as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    copy[key] = sanitize(source[key], seen, depth + 1);
  }
  return copy;
}

export function sanitizeForTransfer(value: unknown): unknown {
  return sanitize(value, new WeakSet<object>(), 0);
}

export type PlayerFunction = (...args: unknown[]) => unknown;

/**
 * Compile the player's source and hand back the entry point.
 *
 * @throws PlayerSyntaxError when the source does not parse
 * @throws MissingEntryPointError when the entry point is absent or not callable
 */
export interface CompileOptions {
  /**
   * When present, the source is instrumented so loop iterations and calls tick
   * this meter. Source that cannot be instrumented runs as written and reports
   * no cost (never a made-up one).
   */
  meter?: Meter;
  /** Receives a variable snapshot at each step. Only used for the trace. */
  snapshot?: (line: number, read: () => [string, unknown][]) => void;
}

export function compileEntryPoint(
  code: string,
  entryPoint: string,
  options: CompileOptions = {},
): PlayerFunction {
  if (!IDENTIFIER.test(entryPoint)) throw new MissingEntryPointError(entryPoint);

  const instrumented =
    options.meter === undefined
      ? null
      : instrumentSource(code, { snapshots: options.snapshot !== undefined });
  const source = instrumented ?? code;
  const body = `"use strict";\n${source}\nreturn typeof ${entryPoint} === "function" ? ${entryPoint} : undefined;`;

  let factory: (tick: () => void, snap: (line: number, read: () => [string, unknown][]) => void) => unknown;
  try {
    factory = new Function('__t', '__s', body) as typeof factory;
  } catch (error) {
    throw new PlayerSyntaxError((error as Error).message);
  }

  const meter = options.meter;
  const candidate = factory(
    meter === undefined ? () => {} : () => meter.tick(),
    options.snapshot ?? (() => {}),
  );
  if (typeof candidate !== 'function') throw new MissingEntryPointError(entryPoint);
  return candidate as PlayerFunction;
}

/**
 * Run every case. A throw in one case does not stop the others: the player
 * needs to know that case 2 crashes and case 3 returns the wrong type, and
 * stopping at the first throw hides half the evidence.
 */
export function runCases(
  code: string,
  entryPoint: string,
  cases: readonly ExecutionCase[],
): CaseOutcome[] {
  return runCasesWith(compileEntryPoint(code, entryPoint), cases);
}

/**
 * The same semantics, against an already-compiled function.
 *
 * The worker compiles once and then needs the same function for the probes.
 * Compiling twice would re-run any top-level statements the player wrote, which
 * turns a probe into a second, invisible execution of their code.
 *
 * Mutation detection is opt-in and happens here rather than in a separate pass
 * because the arguments are already in hand: clone, call, compare. Pass
 * `detectMutation` only when the mission declares `mustNotMutate`; a mission
 * that legitimately sorts its input in place is not making a mistake.
 */
export function runCasesWith(
  fn: PlayerFunction,
  cases: readonly ExecutionCase[],
  options: {
    detectMutation?: boolean;
    /** Bracket each case, so the caller can attribute side effects (console output) to it. */
    onCase?: { before(testCase: ExecutionCase): void; after(testCase: ExecutionCase): void };
    /** Counts steps while a case runs. Absent means no cost is reported. */
    meter?: Meter;
    /** Steps a single case may take before it is stopped. */
    opLimit?: number;
  } = {},
): CaseOutcome[] {
  return cases.map((testCase) => {
    options.onCase?.before(testCase);
    try {
      return runOne(
        fn,
        testCase,
        options.detectMutation === true,
        options.meter,
        options.opLimit ?? Number.POSITIVE_INFINITY,
      );
    } finally {
      options.onCase?.after(testCase);
    }
  });
}

function runOne(
  fn: PlayerFunction,
  testCase: ExecutionCase,
  detectMutation: boolean,
  meter: Meter | undefined,
  opLimit: number,
): CaseOutcome {
  const before = detectMutation ? tryClone(testCase.input) : null;

  // Only the call itself is metered: cloning, comparing and sanitising the
  // result are the harness, and must not be charged to the player.
  let value: unknown;
  let failure: unknown;
  let threw = false;
  meter?.start(opLimit);
  try {
    value = fn(...testCase.input);
  } catch (error) {
    threw = true;
    failure = error;
  }
  const ops = meter?.stop();
  const costExceeded =
    meter !== undefined && (meter.exceeded || failure instanceof CostLimitExceeded);
  const cost = ops === undefined ? {} : { ops };
  const mutated = before === null ? undefined : !deepEqual(before, testCase.input);
  const mutation = mutated === undefined ? {} : { mutatedInput: mutated };

  if (costExceeded) {
    return {
      testId: testCase.testId,
      status: 'threw',
      message: `se detuvo al superar ${opLimit} pasos en este caso`,
      costExceeded: true,
      ...cost,
      ...mutation,
    };
  }

  if (!threw) {
    return {
      testId: testCase.testId,
      status: 'returned',
      value: sanitizeForTransfer(value),
      ...cost,
      ...mutation,
    };
  }

  const frame = frameOf((failure as Error | undefined)?.stack);
  const message =
    failure instanceof Error
      ? `${failure.name}: ${failure.message}`
      : `se lanzó un valor no-Error: ${String(failure)}`;
  return {
    testId: testCase.testId,
    status: 'threw',
    message,
    ...(frame ?? {}),
    ...cost,
    ...mutation,
  };
}

function tryClone(value: unknown): unknown[] | null {
  try {
    return structuredClone(value) as unknown[];
  } catch {
    // Uncloneable input (a function in a fixture): no claim is possible, and a
    // guess here would be a false E11.
    return null;
  }
}
