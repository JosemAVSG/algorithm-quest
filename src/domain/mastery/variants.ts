/**
 * Reinforcement variants in play (docs/05-mastery.md §8).
 *
 * A variant is graded by the same test engine as a mission, and what it leaves
 * behind is one evidence event with role `reinforced`. That role weighs 0.5 and
 * is excluded from the transfer gate, so a player cannot grind small variants
 * of one concept into a "transferable" level they have only seen in one fiction.
 */

import type { Mission, ReinforcementVariant } from '../content/schema';
import type { TestReport } from '../evaluation/test-engine';
import type { EvidenceEvent } from './evidence';

/** The tests of a variant in the shape the test engine and the cases builder read. */
export function variantTests(variant: ReinforcementVariant): Mission['tests'] {
  return { visible: variant.tests.visible, hidden: variant.tests.hidden, edge: [] };
}

/**
 * The variant to offer for a concept: the one practised least, then by id, so
 * repeated offers rotate through the variants instead of repeating one.
 */
export function pickVariant(
  variants: readonly ReinforcementVariant[],
  conceptId: string,
  events: readonly EvidenceEvent[],
): ReinforcementVariant | null {
  const candidates = variants.filter((variant) => variant.conceptId === conceptId);
  if (candidates.length === 0) return null;
  const practised = (id: string) => events.filter((event) => event.missionId === id).length;
  return [...candidates].sort(
    (a, b) => practised(a.id) - practised(b.id) || a.id.localeCompare(b.id),
  )[0]!;
}

export interface VariantRun {
  at: number;
  attempts: number;
  hintsUsed: 0 | 1;
}

/**
 * One event for the concept the variant reinforces. A variant has no
 * explanation step, so `reasoningScore` is the neutral 2: asking for a
 * justification the exercise never requested would be inventing evidence.
 */
export function buildVariantEvidence(
  variant: ReinforcementVariant,
  report: TestReport,
  run: VariantRun,
): EvidenceEvent {
  return {
    id: `${variant.id}:${variant.conceptId}:${run.at}`,
    missionId: variant.id,
    conceptId: variant.conceptId,
    role: 'reinforced',
    at: run.at,
    visiblePassed: report.counts.visible.passed === report.counts.visible.total,
    hiddenPassed: report.counts.hidden.passed,
    hiddenTotal: report.counts.hidden.total,
    edgePassed: 0,
    edgeTotal: 0,
    reasoningScore: 2,
    efficiencyRatio: 1,
    attempts: run.attempts,
    hintsUsed: run.hintsUsed,
    maxHintLevel: run.hintsUsed === 0 ? 0 : 1,
    solutionRevealed: false,
    strategySubmitted: false,
  };
}
