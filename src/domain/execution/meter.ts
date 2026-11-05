/**
 * The step meter (D13: cost is counted in steps, not milliseconds).
 *
 * `createMeter` is the counter the instrumented source ticks. It only counts
 * while a case is running, so the harness (probes, comparisons, cloning) never
 * inflates the player's cost, and it has a hard limit per case so a runaway
 * loop stops after a bounded number of steps instead of after a wall-clock
 * timeout.
 *
 * Loops and calls are counted by the instrumentation. The work the built-in
 * array methods do *inside* a call is invisible to it: `xs.indexOf(y)` inside a
 * loop is a second loop. `installBuiltinMeter` closes that gap by wrapping the
 * methods that scan or move elements and charging them what a textbook says
 * they cost. It patches global prototypes, so it is installed only in the
 * execution worker (a disposable realm) and in tools that restore it.
 *
 * Methods that take a callback (`map`, `filter`, `some`, `find`, ...) are *not*
 * wrapped: the callback is player code, already instrumented, and charging the
 * method as well would count every element twice. Early exits (`some`, `find`)
 * are therefore counted exactly.
 */

export class CostLimitExceeded extends Error {
  constructor(readonly limit: number) {
    super(`se superó el límite de ${limit} pasos`);
    this.name = 'CostLimitExceeded';
  }
}

export interface Meter {
  /** Steps counted since the last `start`. */
  readonly ops: number;
  /** True once the limit was crossed in the current case. */
  readonly exceeded: boolean;
  tick(): void;
  add(steps: number): void;
  /** Reset, set the per-case limit and begin counting. */
  start(limit: number): void;
  /** Stop counting and return the steps of the case. */
  stop(): number;
}

export function createMeter(): Meter {
  let ops = 0;
  let limit = Number.POSITIVE_INFINITY;
  let active = false;
  let exceeded = false;

  const charge = (steps: number) => {
    ops += steps;
    if (ops > limit) {
      exceeded = true;
      throw new CostLimitExceeded(limit);
    }
  };

  return {
    get ops() {
      return ops;
    },
    get exceeded() {
      return exceeded;
    },
    tick() {
      if (active) charge(1);
    },
    add(steps) {
      if (active && steps > 0) charge(Math.ceil(steps));
    },
    start(newLimit) {
      ops = 0;
      limit = newLimit;
      exceeded = false;
      active = true;
    },
    stop() {
      active = false;
      return ops;
    },
  };
}

type AnyFn = (...args: unknown[]) => unknown;

/** How many elements a `slice(start, end)` call copies. */
function sliceLength(length: number, start: unknown, end: unknown): number {
  const norm = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback;
    const n = Math.trunc(Number(value)) || 0;
    return n < 0 ? Math.max(length + n, 0) : Math.min(n, length);
  };
  return Math.max(norm(end, length) - norm(start, 0), 0);
}

/**
 * Wrap the array and set/map operations that cost something per element.
 * Returns a function that restores the originals.
 */
export function installBuiltinMeter(meter: Meter): () => void {
  const restore: Array<() => void> = [];
  const wrap = (target: object, name: string, cost: (self: unknown, args: unknown[], original: AnyFn) => number) => {
    const original = (target as Record<string, AnyFn>)[name];
    if (typeof original !== 'function') return;
    const wrapped = function (this: unknown, ...args: unknown[]) {
      meter.add(cost(this, args, original));
      return original.apply(this, args);
    };
    Object.defineProperty(wrapped, 'name', { value: name });
    (target as Record<string, unknown>)[name] = wrapped;
    restore.push(() => {
      (target as Record<string, unknown>)[name] = original;
    });
  };

  const length = (self: unknown) => ((self as { length?: number }).length ?? 0);
  const arrayProto = Array.prototype;
  const indexOf = arrayProto.indexOf as unknown as AnyFn;
  const lastIndexOf = arrayProto.lastIndexOf as unknown as AnyFn;

  // Scans: charged for what they actually walk.
  wrap(arrayProto, 'indexOf', (self, args) => {
    const at = indexOf.apply(self, args) as number;
    return at >= 0 ? at + 1 : length(self);
  });
  wrap(arrayProto, 'includes', (self, args) => {
    const at = indexOf.apply(self, args) as number;
    return at >= 0 ? at + 1 : length(self);
  });
  wrap(arrayProto, 'lastIndexOf', (self, args) => {
    const at = lastIndexOf.apply(self, args) as number;
    return at >= 0 ? length(self) - at : length(self);
  });

  // Copies and moves: charged for the elements they touch.
  wrap(arrayProto, 'slice', (self, args) => sliceLength(length(self), args[0], args[1]));
  wrap(arrayProto, 'splice', (self, args) => {
    const start = Number(args[0]) || 0;
    const from = start < 0 ? Math.max(length(self) + start, 0) : Math.min(start, length(self));
    return length(self) - from + Math.max(args.length - 2, 0);
  });
  wrap(arrayProto, 'shift', (self) => length(self));
  wrap(arrayProto, 'unshift', (self, args) => length(self) + args.length);
  wrap(arrayProto, 'reverse', (self) => length(self));
  wrap(arrayProto, 'fill', (self) => length(self));
  wrap(arrayProto, 'join', (self) => length(self));
  wrap(arrayProto, 'flat', (self) => length(self));
  wrap(arrayProto, 'concat', (self, args) =>
    args.reduce<number>((sum, item) => sum + (Array.isArray(item) ? item.length : 1), length(self)),
  );
  wrap(arrayProto, 'sort', (self) => {
    const n = length(self);
    return n > 1 ? n * Math.ceil(Math.log2(n)) : n;
  });
  wrap(Array, 'from', (_self, args) => {
    const source = args[0] as { length?: number; size?: number } | null | undefined;
    return source?.length ?? source?.size ?? 0;
  });

  // Hash lookups: one step each.
  for (const proto of [Set.prototype, Map.prototype] as object[]) {
    for (const name of ['add', 'has', 'get', 'set', 'delete']) {
      if (name in proto) wrap(proto, name, () => 1);
    }
  }

  return () => {
    for (const undo of restore.reverse()) undo();
  };
}
