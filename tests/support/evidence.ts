import type { EvidenceEvent } from '../../src/domain/mastery/evidence';

/** A passing, independent evidence event; override only what a test measures. */
export function evidenceEvent(overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    id: 'e1',
    missionId: 'M01',
    conceptId: 'C01',
    role: 'primary',
    at: 1,
    visiblePassed: true,
    hiddenPassed: 1,
    hiddenTotal: 1,
    edgePassed: 1,
    edgeTotal: 1,
    reasoningScore: 3,
    efficiencyRatio: 1,
    attempts: 1,
    hintsUsed: 0,
    maxHintLevel: 0,
    solutionRevealed: false,
    strategySubmitted: true,
    ...overrides,
  };
}
