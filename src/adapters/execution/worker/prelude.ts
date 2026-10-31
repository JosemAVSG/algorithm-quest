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
