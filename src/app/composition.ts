/**
 * Composition root (docs/07-architecture.md §3).
 *
 * The only place that decides which adapter backs a port. Screens receive the
 * ports, never an adapter, which is what keeps a future HTTP execution backend
 * or a remote progress store to a one-line change here.
 */

import { createWorkerExecutionPort } from '../adapters/execution/worker/runner';
import { createLocalProgressStore } from '../adapters/persistence/local/progress-store';
import { createLocalSessionStore } from '../adapters/persistence/local/session-store';
import type { KeyValueStorage } from '../domain/persistence/port';

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/**
 * `localStorage` can throw on access in private mode and in some embedded
 * webviews. A player who cannot persist progress can still play; a player who
 * sees a crash cannot.
 */
function browserStorage(): { storage: KeyValueStorage; persistent: boolean } {
  try {
    const probe = globalThis.localStorage;
    if (probe === undefined) return { storage: memoryStorage(), persistent: false };
    return { storage: probe, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}

export function createComposition() {
  const { storage, persistent } = browserStorage();
  return {
    execution: createWorkerExecutionPort(),
    progress: createLocalProgressStore(storage),
    sessions: createLocalSessionStore(storage),
    /** False when the app fell back to memory and progress will not survive a reload. */
    persistent,
  };
}
