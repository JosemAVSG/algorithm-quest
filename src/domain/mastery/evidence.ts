/**
 * Evidence events: the only thing mastery is ever computed from
 * (docs/05-mastery.md §1).
 *
 * The invariant that matters (MT4) is that deleting derived mastery and
 * recomputing from events gives identical output. That only holds if events are
 * complete — which is why every field here is measured, never inferred later.
 */

import type { Mission } from '../content/schema';
import type { TestReport } from '../evaluation/test-engine';
import type { ReasoningScore } from './reasoning';

export type ConceptRole = 'primary' | 'secondary' | 'reinforced';

export interface EvidenceEvent {
  id: string;
  missionId: string;
  conceptId: string;
  role: ConceptRole;
  /** Epoch milliseconds. */
  at: number;

  visiblePassed: boolean;
  hiddenPassed: number;
  hiddenTotal: number;
  edgePassed: number;
  edgeTotal: number;
  reasoningScore: ReasoningScore;
  /** 1.0 when the mission has no budget, or the run was within it. */
  efficiencyRatio: number;

  attempts: number;
  hintsUsed: number;
  maxHintLevel: 0 | 1 | 2 | 3 | 4;
  solutionRevealed: boolean;
  strategySubmitted: boolean;
}

export interface EvidenceInput {
  at: number;
  reasoningScore: ReasoningScore;
  attempts: number;
  hintsUsed: number;
  maxHintLevel: 0 | 1 | 2 | 3 | 4;
  solutionRevealed: boolean;
  strategySubmitted: boolean;
  /**
   * Steps of the most expensive case of the run that passed (D13). Wall-clock
   * time used to feed this ratio, which is the signal D13 rejects: a throttled
   * laptop would lower the mastery of a correct solution.
   */
  actualOps?: number;
}

function efficiencyRatio(mission: Mission, actualOps: number | undefined): number {
  const budget = mission.constraints.efficiency?.operationBudget;
  if (budget === undefined || actualOps === undefined) return 1;
  if (actualOps <= 0) return 1;
  return Math.min(1, budget / actualOps);
}

export function buildEvidenceEvents(
  mission: Mission,
  report: TestReport,
  input: EvidenceInput,
): EvidenceEvent[] {
  const counts = report.counts;
  const shared = {
    at: input.at,
    visiblePassed: counts.visible.passed === counts.visible.total,
    hiddenPassed: counts.hidden.passed,
    hiddenTotal: counts.hidden.total,
    edgePassed: counts.edge.passed,
    edgeTotal: counts.edge.total,
    reasoningScore: input.reasoningScore,
    efficiencyRatio: efficiencyRatio(mission, input.actualOps),
    attempts: input.attempts,
    hintsUsed: input.hintsUsed,
    maxHintLevel: input.maxHintLevel,
    solutionRevealed: input.solutionRevealed,
    strategySubmitted: input.strategySubmitted,
  };

  const conceptIds: Array<{ conceptId: string; role: ConceptRole }> = [
    { conceptId: mission.concepts.primary, role: 'primary' },
    ...mission.concepts.secondary.map((conceptId) => ({
      conceptId,
      role: 'secondary' as const,
    })),
  ];

  return conceptIds.map(({ conceptId, role }) => ({
    id: `${mission.id}:${conceptId}:${input.at}`,
    missionId: mission.id,
    conceptId,
    role,
    ...shared,
  }));
}
