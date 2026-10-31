/**
 * In-flight mission sessions, one key per mission.
 *
 * A reload restores everything except the editor buffer. Completed missions are
 * cleared here and live in the progress store instead, so the two stores never
 * disagree about whether a mission is finished.
 */

import type {
  KeyValueStorage,
  SessionStore,
} from '../../../domain/persistence/port';
import type { SessionPhase, SessionSnapshot } from '../../../domain/session/mission-session';

const KEY_PREFIX = 'algorithm-quest:session:v1:';

const PHASES: readonly SessionPhase[] = ['briefing', 'strategy', 'lab', 'debrief', 'complete'];

function looksLikeSnapshot(value: unknown, missionId: string): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SessionSnapshot>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.missionId === missionId &&
    typeof candidate.phase === 'string' &&
    PHASES.includes(candidate.phase as SessionPhase) &&
    typeof candidate.attempts === 'number'
  );
}

export function createLocalSessionStore(storage: KeyValueStorage): SessionStore {
  return {
    load(missionId: string): SessionSnapshot | null {
      let raw: string | null;
      try {
        raw = storage.getItem(KEY_PREFIX + missionId);
      } catch {
        return null;
      }
      if (raw === null) return null;

      try {
        const parsed: unknown = JSON.parse(raw);
        return looksLikeSnapshot(parsed, missionId) ? parsed : null;
      } catch {
        return null;
      }
    },

    save(snapshot: SessionSnapshot): void {
      try {
        storage.setItem(KEY_PREFIX + snapshot.missionId, JSON.stringify(snapshot));
      } catch {
        // Storage is unavailable. The mission continues in memory.
      }
    },

    clear(missionId: string): void {
      try {
        storage.removeItem(KEY_PREFIX + missionId);
      } catch {
        // Same as above: never block the player on storage.
      }
    },
  };
}
