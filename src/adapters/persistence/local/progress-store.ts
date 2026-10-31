/**
 * `localStorage` progress adapter (D3, docs/07-architecture.md §6).
 *
 * The adapter trusts nothing it reads: a corrupt blob, a newer schema, or a
 * hand-edited value starts the player fresh instead of crashing the app. Losing
 * progress is bad; losing the session because storage is unreadable is worse.
 *
 * The storage key is versioned, but the `schemaVersion` inside the blob is the
 * authority. A blob under the M1 key is migrated on first read and then moved
 * to the current key, so upgrading does not silently discard a save.
 */

import {
  parseProgress,
  serializeProgress,
  WARNING_CORRUPT,
  WARNING_UNREADABLE,
} from '../../../domain/persistence/migrations';
import {
  emptyProgress,
  PROGRESS_SCHEMA_VERSION,
  type KeyValueStorage,
  type PlayerProgress,
  type ProgressLoadResult,
  type ProgressStore,
} from '../../../domain/persistence/port';

export const PROGRESS_KEY = 'algorithm-quest:progress:v2';

/** Keys written by earlier milestones, read once and then migrated. */
export const LEGACY_PROGRESS_KEYS = ['algorithm-quest:progress:v1'] as const;

function fresh(warning: string | null): ProgressLoadResult {
  return { progress: emptyProgress(), warning };
}

export function createLocalProgressStore(storage: KeyValueStorage): ProgressStore {
  function write(progress: PlayerProgress): void {
    try {
      storage.setItem(PROGRESS_KEY, serializeProgress(progress));
      for (const key of LEGACY_PROGRESS_KEYS) storage.removeItem(key);
    } catch {
      // Quota or private mode. The UI surfaces a banner; the session continues.
    }
  }

  async function load(): Promise<ProgressLoadResult> {
    let raw: string | null = null;
    let fromLegacy = false;

    try {
      raw = storage.getItem(PROGRESS_KEY);
      if (raw === null) {
        for (const key of LEGACY_PROGRESS_KEYS) {
          const legacy = storage.getItem(key);
          if (legacy !== null) {
            raw = legacy;
            fromLegacy = true;
            break;
          }
        }
      }
    } catch {
      return fresh(WARNING_UNREADABLE);
    }

    if (raw === null) return fresh(null);

    let decoded: unknown;
    try {
      decoded = JSON.parse(raw) as unknown;
    } catch {
      return fresh(WARNING_CORRUPT);
    }

    const result = parseProgress(decoded);
    if (result.warning !== null) return result;

    const version =
      typeof decoded === 'object' && decoded !== null && 'schemaVersion' in decoded
        ? (decoded as { schemaVersion?: unknown }).schemaVersion
        : undefined;

    // Persist the migrated shape only when it actually changed, not on every
    // load: `localStorage` writes are synchronous.
    if (fromLegacy || version !== PROGRESS_SCHEMA_VERSION) write(result.progress);

    return result;
  }

  return {
    load,

    async save(progress: PlayerProgress): Promise<void> {
      write(progress);
    },

    async export(): Promise<string> {
      const { progress } = await load();
      return serializeProgress(progress);
    },

    async import(blob: string): Promise<ProgressLoadResult> {
      let decoded: unknown;
      try {
        decoded = JSON.parse(blob) as unknown;
      } catch {
        return fresh(
          'El texto importado no es un progreso válido. No se ha cambiado nada.',
        );
      }

      const result = parseProgress(decoded);
      if (result.warning !== null) {
        return {
          progress: result.progress,
          warning: 'El texto importado no es un progreso válido. No se ha cambiado nada.',
        };
      }

      write(result.progress);
      return result;
    },

    async reset(): Promise<void> {
      try {
        storage.removeItem(PROGRESS_KEY);
        for (const key of LEGACY_PROGRESS_KEYS) storage.removeItem(key);
      } catch {
        // Nothing useful to do: the caller asked for a reset, not a guarantee.
      }
    },
  };
}
