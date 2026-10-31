/**
 * Progress schema migrations (docs/10-testing-and-security.md IT3).
 *
 * The stored blob is untrusted input. A malformed record, a newer schema or a
 * hand-edited field starts a fresh progress with a warning instead of crashing
 * the workshop.
 *
 * Version history:
 *
 * - 0/1 — M1 shape: `{ schemaVersion, completed: CompletedMissionRecord[] }`,
 *   with evidence nested inside each record. Version 0 is accepted because IT3
 *   exercises it and because no field differs from 1 in practice.
 * - 2 — M4 shape: adds the flat `events` log, the reinforcement queue, and the
 *   declined list. Migration flattens nested evidence into `events`; every
 *   mission id and every event is preserved.
 */

import type { EvidenceEvent } from '../mastery/evidence';
import type { ReinforcementItem } from '../mastery/reinforcement';
import {
  emptyProgress,
  PROGRESS_SCHEMA_VERSION,
  type CompletedMissionRecord,
  type PlayerProgress,
  type ProgressLoadResult,
} from './port';

export const WARNING_CORRUPT =
  'No se pudo leer el progreso guardado. Empiezas de cero; el taller sigue funcionando.';

export const WARNING_NEWER =
  'El progreso guardado es de una versión más nueva. Empiezas de cero.';

export const WARNING_UNREADABLE =
  'El navegador no permite leer el progreso. Empiezas de cero.';

const ROLES = new Set(['primary', 'secondary', 'reinforced']);
const REASONS = new Set(['assisted', 'revealed']);

function fresh(warning: string): ProgressLoadResult {
  return { progress: emptyProgress(), warning };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function parseEvidence(raw: unknown): EvidenceEvent | null {
  if (!isObject(raw)) return null;

  if (
    !isString(raw.id) ||
    !isString(raw.missionId) ||
    !isString(raw.conceptId) ||
    typeof raw.role !== 'string' ||
    !ROLES.has(raw.role) ||
    !isFiniteNumber(raw.at) ||
    !isBoolean(raw.visiblePassed) ||
    !isCount(raw.hiddenPassed) ||
    !isCount(raw.hiddenTotal) ||
    !isCount(raw.edgePassed) ||
    !isCount(raw.edgeTotal) ||
    !isCount(raw.reasoningScore) ||
    raw.reasoningScore > 3 ||
    !isFiniteNumber(raw.efficiencyRatio) ||
    !isCount(raw.attempts) ||
    !isCount(raw.hintsUsed) ||
    !isCount(raw.maxHintLevel) ||
    raw.maxHintLevel > 4 ||
    !isBoolean(raw.solutionRevealed) ||
    !isBoolean(raw.strategySubmitted)
  ) {
    return null;
  }

  return {
    id: raw.id,
    missionId: raw.missionId,
    conceptId: raw.conceptId,
    role: raw.role as EvidenceEvent['role'],
    at: raw.at,
    visiblePassed: raw.visiblePassed,
    hiddenPassed: raw.hiddenPassed,
    hiddenTotal: raw.hiddenTotal,
    edgePassed: raw.edgePassed,
    edgeTotal: raw.edgeTotal,
    reasoningScore: raw.reasoningScore as EvidenceEvent['reasoningScore'],
    efficiencyRatio: raw.efficiencyRatio,
    attempts: raw.attempts,
    hintsUsed: raw.hintsUsed,
    maxHintLevel: raw.maxHintLevel as EvidenceEvent['maxHintLevel'],
    solutionRevealed: raw.solutionRevealed,
    strategySubmitted: raw.strategySubmitted,
  };
}

function parseRecord(raw: unknown): CompletedMissionRecord | null {
  if (!isObject(raw)) return null;
  if (
    !isString(raw.missionId) ||
    !isFiniteNumber(raw.completedAt) ||
    !isCount(raw.attempts) ||
    !isCount(raw.hintsUsed) ||
    !isCount(raw.reasoningScore) ||
    raw.reasoningScore > 3
  ) {
    return null;
  }

  // Version 0 blobs may predate nested evidence. An absent array is not data
  // loss: there is nothing to preserve.
  const evidenceRaw = raw.evidence ?? [];
  if (!Array.isArray(evidenceRaw)) return null;

  const evidence: EvidenceEvent[] = [];
  for (const item of evidenceRaw) {
    const parsed = parseEvidence(item);
    if (parsed === null) return null;
    evidence.push(parsed);
  }

  return {
    missionId: raw.missionId,
    completedAt: raw.completedAt,
    attempts: raw.attempts,
    hintsUsed: raw.hintsUsed,
    reasoningScore: raw.reasoningScore,
    evidence,
  };
}

function parseReinforcement(raw: unknown): ReinforcementItem | null {
  if (!isObject(raw)) return null;
  if (
    !isString(raw.conceptId) ||
    !isString(raw.missionId) ||
    !isFiniteNumber(raw.mastery) ||
    typeof raw.reason !== 'string' ||
    !REASONS.has(raw.reason) ||
    !isFiniteNumber(raw.queuedAt)
  ) {
    return null;
  }

  return {
    conceptId: raw.conceptId,
    missionId: raw.missionId,
    mastery: raw.mastery,
    reason: raw.reason as ReinforcementItem['reason'],
    queuedAt: raw.queuedAt,
  };
}

function dedupeById(events: readonly EvidenceEvent[]): EvidenceEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

/**
 * Parse an already-decoded blob. Exported for the store and for IT3/IT4.
 */
export function parseProgress(raw: unknown): ProgressLoadResult {
  if (!isObject(raw)) return fresh(WARNING_CORRUPT);

  const version = raw.schemaVersion;
  if (!isCount(version) || version > PROGRESS_SCHEMA_VERSION) {
    return fresh(typeof version === 'number' ? WARNING_NEWER : WARNING_CORRUPT);
  }
  if (version !== 0 && version !== 1 && version !== PROGRESS_SCHEMA_VERSION) {
    return fresh(WARNING_CORRUPT);
  }

  if (!Array.isArray(raw.completed)) return fresh(WARNING_CORRUPT);

  const completed: CompletedMissionRecord[] = [];
  for (const item of raw.completed) {
    const parsed = parseRecord(item);
    if (parsed === null) return fresh(WARNING_CORRUPT);
    completed.push(parsed);
  }

  if (version === PROGRESS_SCHEMA_VERSION) {
    if (!Array.isArray(raw.events)) return fresh(WARNING_CORRUPT);

    const events: EvidenceEvent[] = [];
    for (const item of raw.events) {
      const parsed = parseEvidence(item);
      if (parsed === null) return fresh(WARNING_CORRUPT);
      events.push(parsed);
    }

    const reinforcementRaw = raw.reinforcement ?? [];
    if (!Array.isArray(reinforcementRaw)) return fresh(WARNING_CORRUPT);
    const reinforcement: ReinforcementItem[] = [];
    for (const item of reinforcementRaw) {
      const parsed = parseReinforcement(item);
      if (parsed === null) return fresh(WARNING_CORRUPT);
      reinforcement.push(parsed);
    }

    const declinedRaw = raw.declinedReinforcement ?? [];
    if (!Array.isArray(declinedRaw) || declinedRaw.some((id) => !isString(id))) {
      return fresh(WARNING_CORRUPT);
    }

    return {
      progress: {
        schemaVersion: PROGRESS_SCHEMA_VERSION,
        completed,
        events: dedupeById(events),
        reinforcement,
        declinedReinforcement: [...new Set(declinedRaw as string[])],
      },
      warning: null,
    };
  }

  // Versions 0 and 1: the event log is nested in each completion record.
  const migrated: PlayerProgress = {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    completed,
    events: dedupeById(completed.flatMap((record) => record.evidence)),
    reinforcement: [],
    declinedReinforcement: [],
  };

  return { progress: migrated, warning: null };
}

export function parseProgressJson(text: string): ProgressLoadResult {
  try {
    return parseProgress(JSON.parse(text) as unknown);
  } catch {
    return fresh(WARNING_CORRUPT);
  }
}

export function serializeProgress(progress: PlayerProgress): string {
  return JSON.stringify(progress, null, 2);
}
