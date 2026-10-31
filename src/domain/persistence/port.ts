/**
 * The persistence boundary (docs/07-architecture.md §4, R3).
 *
 * Async even though the MVP adapter is synchronous `localStorage`, so a remote
 * implementation is a drop-in replacement rather than a refactor.
 *
 * Schema 2 keeps the **event log** as the source of truth for mastery. The
 * per-mission `completed` records remain because the map needs "the last time
 * this system was repaired", but they no longer drive levels: replaying a
 * mission appends evidence and replaces only that summary record.
 */

import type { EvidenceEvent } from '../mastery/evidence';
import {
  declineReinforcement as declineInQueue,
  enqueueReinforcement,
  reinforcementCandidates,
  type ReinforcementItem,
} from '../mastery/reinforcement';
import type { SessionSnapshot } from '../session/mission-session';

export const PROGRESS_SCHEMA_VERSION = 2;

export interface CompletedMissionRecord {
  missionId: string;
  completedAt: number;
  attempts: number;
  hintsUsed: number;
  reasoningScore: number;
  evidence: EvidenceEvent[];
}

export interface PlayerProgress {
  schemaVersion: typeof PROGRESS_SCHEMA_VERSION;
  completed: CompletedMissionRecord[];
  /** Full history. Levels are recomputed from this, never stored. */
  events: EvidenceEvent[];
  /** At most three, weakest first. */
  reinforcement: ReinforcementItem[];
  /** Concepts whose offer the player dismissed. Recorded, never penalised. */
  declinedReinforcement: string[];
}

export interface ProgressLoadResult {
  progress: PlayerProgress;
  /** Non-null when stored data was unreadable and a fresh start was used. */
  warning: string | null;
}

export function emptyProgress(): PlayerProgress {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    completed: [],
    events: [],
    reinforcement: [],
    declinedReinforcement: [],
  };
}

export function completedMissionIds(progress: PlayerProgress): Set<string> {
  return new Set(progress.completed.map((record) => record.missionId));
}

/**
 * Replaying a mission:
 *
 * - appends the new evidence (IT6), so mastery sees the latest shape;
 * - replaces the mission summary, so the map still shows one completion;
 * - recomputes the reinforcement queue from the new mastery.
 *
 * Duplicate event ids are dropped. They can only appear if a completion is
 * recorded twice with the same timestamp, which would otherwise double-count
 * one attempt.
 */
export function recordCompletion(
  progress: PlayerProgress,
  record: CompletedMissionRecord,
): PlayerProgress {
  const known = new Set(progress.events.map((event) => event.id));
  const added = record.evidence.filter((event) => !known.has(event.id));
  const events = [...progress.events, ...added];

  let reinforcement = progress.reinforcement;
  for (const candidate of reinforcementCandidates(added, events, {
    completedAt: record.completedAt,
    hintsUsed: record.hintsUsed,
  })) {
    reinforcement = enqueueReinforcement(reinforcement, candidate);
  }

  const completed = [
    ...progress.completed.filter((existing) => existing.missionId !== record.missionId),
    record,
  ].sort((a, b) => a.completedAt - b.completedAt);

  return {
    ...progress,
    completed,
    events,
    reinforcement,
  };
}

export function declineReinforcement(
  progress: PlayerProgress,
  conceptId: string,
): PlayerProgress {
  const { queue, declined } = declineInQueue(
    progress.reinforcement,
    progress.declinedReinforcement,
    conceptId,
  );
  return {
    ...progress,
    reinforcement: queue,
    declinedReinforcement: declined,
  };
}

export interface ProgressStore {
  load(): Promise<ProgressLoadResult>;
  save(progress: PlayerProgress): Promise<void>;
  /** JSON blob for download. */
  export(): Promise<string>;
  /** Parse, migrate and save a blob. On failure the current progress is kept. */
  import(blob: string): Promise<ProgressLoadResult>;
  reset(): Promise<void>;
}

/**
 * The minimum a page reload must preserve: the mission session minus the editor
 * buffer (docs/11-delivery-plan.md §3, M1).
 */
export interface SessionStore {
  load(missionId: string): SessionSnapshot | null;
  save(snapshot: SessionSnapshot): void;
  clear(missionId: string): void;
}

/**
 * The slice of `Storage` both adapters need. Declared structurally so the store
 * can be tested in Node with a plain object, and so the domain never sees a DOM
 * type.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
