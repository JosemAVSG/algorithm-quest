/**
 * Mastery scoring (docs/05-mastery.md §2–§7).
 *
 * Pure functions over evidence events. Nothing here is stored: the dashboard
 * recomputes every level from the event log, which is what makes the model
 * auditable and what MT4 asserts.
 *
 * The one judgement call the spec leaves open is which evidence the caps look
 * at. They look at the same last-5 window that drives the score, not at the
 * player's full history: a cap that could never be lifted by new evidence would
 * punish the player for a mistake they have already corrected.
 */

import type { ConceptRole, EvidenceEvent } from './evidence';

export const RECENCY_WEIGHTS = [1, 0.85, 0.7, 0.55, 0.4] as const;
export const WINDOW_SIZE = RECENCY_WEIGHTS.length;

export const ROLE_WEIGHTS: Record<ConceptRole, number> = {
  primary: 1,
  secondary: 0.6,
  reinforced: 0.5,
};

export type ConceptLevel = 'locked' | 'introduced' | 'practicing' | 'proficient' | 'transferable';

export type CapKind = 'reveal' | 'assistance' | 'single-source';

export interface Dimensions {
  correctness: number;
  robustness: number;
  reasoning: number;
  efficiency: number;
}

export interface TransferStatus {
  distinctMissions: number;
  independent: boolean;
  eligible: boolean;
}

export interface ConceptLevelResult {
  level: ConceptLevel;
  mastery: number | null;
  cap: CapKind | null;
  dimensions: Dimensions | null;
  window: EvidenceEvent[];
  transfer: TransferStatus;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function ratio(passed: number, total: number): number {
  if (total <= 0) return 1;
  return clamp01(passed / total);
}

/** The four dimensions of docs/05 §2, in 0–1. */
export function dimensionsOf(event: EvidenceEvent): Dimensions {
  return {
    correctness: event.visiblePassed ? ratio(event.hiddenPassed, event.hiddenTotal) : 0,
    robustness: ratio(event.edgePassed, event.edgeTotal),
    reasoning: clamp01(event.reasoningScore / 3),
    efficiency: clamp01(event.efficiencyRatio),
  };
}

/** `0.40·correctness + 0.25·robustness + 0.20·reasoning + 0.15·efficiency`. */
export function missionScore(event: EvidenceEvent): number {
  const dimensions = dimensionsOf(event);
  return (
    0.4 * dimensions.correctness +
    0.25 * dimensions.robustness +
    0.2 * dimensions.reasoning +
    0.15 * dimensions.efficiency
  );
}

/**
 * `w = clamp(1 − 0.10·min(hints, 3) − (revealed ? 0.30 : 0), 0.25, 1)`.
 *
 * The 0.25 floor is unreachable with the current inputs (the worst case is
 * 0.40), but it is the contract: a heavily-assisted success must still count
 * for something.
 */
export function independenceWeight(event: EvidenceEvent): number {
  const raw =
    1 - 0.1 * Math.min(event.hintsUsed, 3) - (event.solutionRevealed ? 0.3 : 0);
  return Math.min(1, Math.max(0.25, raw));
}

export function conceptEvidence(event: EvidenceEvent): number {
  return missionScore(event) * independenceWeight(event) * ROLE_WEIGHTS[event.role];
}

/**
 * The last five events for a concept, newest first. `at` is the ordering key;
 * the sort is stable so equal timestamps keep insertion order.
 */
export function evidenceWindow(
  events: readonly EvidenceEvent[],
  conceptId: string,
): EvidenceEvent[] {
  return events
    .filter((event) => event.conceptId === conceptId)
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, WINDOW_SIZE);
}

/** Recency-weighted mastery in 0–1, or `null` when the concept has no evidence. */
export function conceptMastery(
  events: readonly EvidenceEvent[],
  conceptId: string,
): number | null {
  const window = evidenceWindow(events, conceptId);
  if (window.length === 0) return null;

  let weighted = 0;
  let total = 0;
  window.forEach((event, index) => {
    const recency = RECENCY_WEIGHTS[index];
    weighted += recency * conceptEvidence(event);
    total += recency;
  });

  return weighted / total;
}

/** Recency-weighted shape of the four bars, for the dashboard only. */
export function weightedDimensions(window: readonly EvidenceEvent[]): Dimensions | null {
  if (window.length === 0) return null;

  const sums: Dimensions = { correctness: 0, robustness: 0, reasoning: 0, efficiency: 0 };
  let total = 0;
  window.forEach((event, index) => {
    const recency = RECENCY_WEIGHTS[index];
    const dimensions = dimensionsOf(event);
    sums.correctness += recency * dimensions.correctness;
    sums.robustness += recency * dimensions.robustness;
    sums.reasoning += recency * dimensions.reasoning;
    sums.efficiency += recency * dimensions.efficiency;
    total += recency;
  });

  return {
    correctness: sums.correctness / total,
    robustness: sums.robustness / total,
    reasoning: sums.reasoning / total,
    efficiency: sums.efficiency / total,
  };
}

/**
 * Transfer gate (docs/05 §7). Reinforcement variants cannot satisfy either
 * condition on their own: otherwise three micro-variants of one fiction would
 * look like transfer.
 */
export function transferStatus(window: readonly EvidenceEvent[]): TransferStatus {
  const fullMissions = window.filter((event) => event.role !== 'reinforced');
  const distinctMissions = new Set(fullMissions.map((event) => event.missionId)).size;
  const independent = fullMissions.some(
    (event) => event.hintsUsed <= 1 && !event.solutionRevealed,
  );
  return {
    distinctMissions,
    independent,
    eligible: distinctMissions >= 2 && independent,
  };
}

function levelFromMastery(mastery: number, transferEligible: boolean): ConceptLevel {
  if (mastery < 0.3) return 'introduced';
  if (mastery < 0.6) return 'practicing';
  if (mastery < 0.8) return 'proficient';
  return transferEligible ? 'transferable' : 'proficient';
}

/**
 * The cap that applies to this window, if any. Reveal wins over assistance
 * (it is the more actionable explanation), and both win over single-source.
 */
export function capFor(window: readonly EvidenceEvent[]): CapKind | null {
  const latest = window[0];
  if (latest === undefined) return null;
  if (latest.solutionRevealed) return 'reveal';
  if (independenceWeight(latest) < 0.5) return 'assistance';
  if (new Set(window.map((event) => event.missionId)).size <= 1) return 'single-source';
  return null;
}

export function conceptLevel(
  events: readonly EvidenceEvent[],
  conceptId: string,
): ConceptLevelResult {
  const window = evidenceWindow(events, conceptId);
  const mastery = conceptMastery(events, conceptId);
  const transfer = transferStatus(window);

  if (mastery === null) {
    return {
      level: 'locked',
      mastery: null,
      cap: null,
      dimensions: null,
      window,
      transfer,
    };
  }

  let level = levelFromMastery(mastery, transfer.eligible);
  const cap = capFor(window);

  if (cap === 'reveal' || cap === 'assistance') {
    if (level === 'proficient' || level === 'transferable') level = 'practicing';
  } else if (cap === 'single-source') {
    if (level === 'transferable') level = 'proficient';
  }

  return {
    level,
    mastery,
    cap,
    dimensions: weightedDimensions(window),
    window,
    transfer,
  };
}
