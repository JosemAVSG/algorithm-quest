/**
 * The reinforcement queue (docs/05-mastery.md §8).
 *
 * Two decisions worth stating:
 *
 * - The cap keeps the **three lowest-mastery concepts**, not the three oldest.
 *   The spec says "lowest-mastery concept wins", so a weaker concept replaces
 *   the strongest pending one; a fourth stronger concept is not enqueued.
 * - Declining is recorded and nothing else. There is no penalty, no hidden
 *   flag, no lock: IT5 asserts the next mission is unaffected.
 */

import type { EvidenceEvent } from './evidence';
import { conceptMastery } from './score';

export const MAX_PENDING_REINFORCEMENTS = 3;
export const REINFORCEMENT_MASTERY_THRESHOLD = 0.45;

export type ReinforcementReason = 'assisted' | 'revealed';

export interface ReinforcementItem {
  conceptId: string;
  /** The mission whose completion triggered the offer. */
  missionId: string;
  /** Mastery at the moment it was enqueued, for ordering. */
  mastery: number;
  reason: ReinforcementReason;
  queuedAt: number;
}

/** `mastery < 0.45 AND (hintsUsed >= 3 OR solutionRevealed)`. */
export function shouldReinforce(
  mastery: number | null,
  hintsUsed: number,
  solutionRevealed: boolean,
): boolean {
  if (mastery === null) return false;
  return mastery < REINFORCEMENT_MASTERY_THRESHOLD && (hintsUsed >= 3 || solutionRevealed);
}

/**
 * Add or refresh one concept. The queue is ordered weakest first and capped at
 * three; a candidate weaker than the current worst evicts it.
 */
export function enqueueReinforcement(
  queue: readonly ReinforcementItem[],
  candidate: ReinforcementItem,
): ReinforcementItem[] {
  const withoutConcept = queue.filter((item) => item.conceptId !== candidate.conceptId);
  return [...withoutConcept, candidate]
    .sort((a, b) => a.mastery - b.mastery || a.conceptId.localeCompare(b.conceptId))
    .slice(0, MAX_PENDING_REINFORCEMENTS);
}

export function declineReinforcement(
  queue: readonly ReinforcementItem[],
  declined: readonly string[],
  conceptId: string,
): { queue: ReinforcementItem[]; declined: string[] } {
  return {
    queue: queue.filter((item) => item.conceptId !== conceptId),
    declined: declined.includes(conceptId) ? [...declined] : [...declined, conceptId],
  };
}

/**
 * The concepts a completed mission can trigger reinforcement for, with the
 * behavioural context of that completion. Returns at most one offer per concept.
 */
export function reinforcementCandidates(
  evidence: readonly EvidenceEvent[],
  history: readonly EvidenceEvent[],
  record: { completedAt: number; hintsUsed: number },
): ReinforcementItem[] {
  const seen = new Set<string>();
  const candidates: ReinforcementItem[] = [];

  for (const event of evidence) {
    if (seen.has(event.conceptId)) continue;
    seen.add(event.conceptId);

    const mastery = conceptMastery(history, event.conceptId);
    if (!shouldReinforce(mastery, record.hintsUsed, event.solutionRevealed)) continue;

    candidates.push({
      conceptId: event.conceptId,
      missionId: event.missionId,
      mastery: mastery ?? 0,
      reason: event.solutionRevealed ? 'revealed' : 'assisted',
      queuedAt: record.completedAt,
    });
  }

  return candidates;
}
