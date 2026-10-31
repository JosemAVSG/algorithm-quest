/**
 * The hardening prelude (docs/08-code-execution.md §2).
 *
 * This raises the bar against curiosity and accident. It is **not** a security
 * boundary, and docs/08 §8 forbids describing it as one: player code runs in the
 * same realm, and the `Function` constructor can reconstruct a capability.
 *
 * `postMessage` is blocked after the worker captures the real one, so the worker
 * can still answer while player code cannot chatter on the channel.
 */

const BLOCKED = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'navigator',
  'postMessage',
  'BroadcastChannel',
  'SharedWorker',
] as const;

/**
 * A value that refuses every use: calling it, constructing it, or reading any
 * property from it.
 *
 * A bare thrower function is not enough. `indexedDB` exists in a worker, so a
 * player who writes `indexedDB.open('x')` would hit "open is not a function" —
 * a true sentence that explains nothing. The proxy turns both shapes into the
 * same honest message.
 */
function blockedValue(name: string): unknown {
  const fail = (): never => {
    throw new Error(`${name} is not available`);
  };

  return new Proxy(fail, {
    apply: fail,
    construct: fail,
    get: fail,
    set: fail,
    has: fail,
  });
}

export function installPrelude(scope: typeof globalThis): void {
  const record = scope as unknown as Record<string, unknown>;

  for (const name of BLOCKED) {
    try {
      delete record[name];
    } catch {
      // Non-configurable. The defineProperty below either shadows it or fails.
    }

    try {
      Object.defineProperty(scope, name, {
        configurable: false,
        writable: false,
        value: blockedValue(name),
      });
    } catch {
      // Last resort: the original stays visible. Documented, not hidden.
    }
  }
}

/**
 * Replace the worker's `console` with the capturing stub.
 *
 * Until now the player's `console.*` went to the browser's devtools, invisible
 * in the lab. The stub is installed like the blocked globals (own property,
 * not writable), so `console.log` keeps working and cannot be swapped by
 * accident; assigning to a method of it is the player's own business.
 */
export function installConsole(scope: typeof globalThis, stub: unknown): void {
  const record = scope as unknown as Record<string, unknown>;
  try {
    delete record['console'];
  } catch {
    // Non-configurable: defineProperty below decides.
  }
  try {
    Object.defineProperty(scope, 'console', { configurable: false, writable: false, value: stub });
  } catch {
    // The original console stays visible; output is simply not captured.
  }
}
