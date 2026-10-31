import { describe, expect, it } from 'vitest';

import { buildMasteryDashboard } from '../../../src/domain/mastery/dashboard';
import type { EvidenceEvent } from '../../../src/domain/mastery/evidence';
import {
  conceptEvidence,
  conceptLevel,
  conceptMastery,
  evidenceWindow,
  independenceWeight,
  missionScore,
} from '../../../src/domain/mastery/score';
import { evidenceEvent } from '../../support/evidence';

const CONCEPT = { id: 'C04', label: 'Salida temprana', world: 'w1' as const, mvp: true };

describe('mastery formula (MT1)', () => {
  // docs/05 §11: M02, 5/6 hidden, 2/3 edge, reasoning 2, 2 hints.
  const m02 = evidenceEvent({
    conceptId: 'C04',
    hiddenPassed: 5,
    hiddenTotal: 6,
    edgePassed: 2,
    edgeTotal: 3,
    reasoningScore: 2,
    hintsUsed: 2,
    maxHintLevel: 2,
  });

  it('reproduces the worked example exactly', () => {
    expect(missionScore(m02)).toBeCloseTo(0.783, 3);
    expect(independenceWeight(m02)).toBeCloseTo(0.8, 5);
    expect(conceptEvidence(m02)).toBeCloseTo(0.627, 3);

    const secondary = { ...m02, conceptId: 'C03', role: 'secondary' as const };
    expect(conceptEvidence(secondary)).toBeCloseTo(0.376, 3);
  });

  it('places C04 at proficient and C03 at practicing, held by the single-source cap', () => {
    const c04 = conceptLevel([m02], 'C04');
    expect(c04.level).toBe('proficient');
    expect(c04.cap).toBe('single-source');

    const c03 = conceptLevel([{ ...m02, conceptId: 'C03', role: 'secondary' }], 'C03');
    expect(c03.level).toBe('practicing');
    expect(c03.cap).toBe('single-source');
  });

  it('does not enqueue reinforcement at mastery ≥ 0.45', () => {
    expect(conceptMastery([m02], 'C04')).toBeGreaterThan(0.45);
  });
});

describe('independence weight (MT2)', () => {
  it('follows the table', () => {
    expect(independenceWeight(evidenceEvent({ hintsUsed: 0 }))).toBeCloseTo(1, 6);
    expect(independenceWeight(evidenceEvent({ hintsUsed: 1 }))).toBeCloseTo(0.9, 6);
    expect(independenceWeight(evidenceEvent({ hintsUsed: 2 }))).toBeCloseTo(0.8, 6);
    expect(independenceWeight(evidenceEvent({ hintsUsed: 3 }))).toBeCloseTo(0.7, 6);
    expect(independenceWeight(evidenceEvent({ hintsUsed: 9 }))).toBeCloseTo(0.7, 6);
    expect(
      independenceWeight(evidenceEvent({ hintsUsed: 0, solutionRevealed: true })),
    ).toBeCloseTo(0.7, 6);
    expect(
      independenceWeight(evidenceEvent({ hintsUsed: 2, solutionRevealed: true })),
    ).toBeCloseTo(0.5, 6);
    expect(
      independenceWeight(evidenceEvent({ hintsUsed: 3, solutionRevealed: true })),
    ).toBeCloseTo(0.4, 6);
  });

  it('never reaches zero: the floor is the contract', () => {
    for (const hintsUsed of [0, 1, 2, 3, 4, 20]) {
      for (const solutionRevealed of [false, true]) {
        expect(independenceWeight(evidenceEvent({ hintsUsed, solutionRevealed }))).toBeGreaterThanOrEqual(
          0.25,
        );
      }
    }
  });
});

describe('caps (MT3, MT6)', () => {
  it('caps a perfect revealed run at practicing', () => {
    const perfectReveal = evidenceEvent({ solutionRevealed: true });
    expect(conceptMastery([perfectReveal], 'C01')).toBeCloseTo(0.7, 5);
    expect(conceptLevel([perfectReveal], 'C01').level).toBe('practicing');
    expect(conceptLevel([perfectReveal], 'C01').cap).toBe('reveal');
  });

  it('caps a perfect single mission at proficient', () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      evidenceEvent({ id: `e${index}`, missionId: 'M08', at: index + 1 }),
    );
    expect(conceptMastery(events, 'C01')).toBeCloseTo(1, 5);
    const result = conceptLevel(events, 'C01');
    expect(result.level).toBe('proficient');
    expect(result.cap).toBe('single-source');
  });
});

describe('recency window (MT5)', () => {
  it('keeps the five newest events and drops the oldest', () => {
    const events: EvidenceEvent[] = [
      evidenceEvent({ id: 'oldest', at: 1 }),
      ...Array.from({ length: 5 }, (_, index) =>
        evidenceEvent({
          id: `bad${index}`,
          at: index + 2,
          visiblePassed: false,
          hiddenPassed: 0,
          edgePassed: 0,
          reasoningScore: 0,
          efficiencyRatio: 0,
        }),
      ),
    ];

    expect(evidenceWindow(events, 'C01').map((event) => event.id)).toEqual([
      'bad4',
      'bad3',
      'bad2',
      'bad1',
      'bad0',
    ]);
    expect(conceptMastery(events, 'C01')).toBe(0);
  });
});

describe('transfer gate (MT7, MT8, MT11)', () => {
  const twoHintM02 = evidenceEvent({
    id: 'a',
    missionId: 'M02',
    at: 1,
    hintsUsed: 2,
    maxHintLevel: 2,
  });
  const twoHintM07 = evidenceEvent({
    id: 'b',
    missionId: 'M07',
    at: 2,
    hintsUsed: 2,
    maxHintLevel: 2,
  });

  it('does not transfer when both contexts needed two hints', () => {
    const events = [twoHintM02, twoHintM07];
    expect(conceptMastery(events, 'C01')).toBeCloseTo(0.8, 5);
    const result = conceptLevel(events, 'C01');
    expect(result.level).toBe('proficient');
    expect(result.transfer.eligible).toBe(false);
    expect(result.transfer.independent).toBe(false);
  });

  it('transfers with two contexts when one was independent', () => {
    const independentM02 = evidenceEvent({ id: 'a', missionId: 'M02', at: 1, hintsUsed: 1 });
    const result = conceptLevel([independentM02, twoHintM07], 'C01');
    expect(conceptMastery([independentM02, twoHintM07], 'C01')).toBeGreaterThanOrEqual(0.8);
    expect(result.transfer.eligible).toBe(true);
    expect(result.level).toBe('transferable');
  });

  it('cannot be satisfied by reinforced variants alone (MT11)', () => {
    const variants = Array.from({ length: 3 }, (_, index) =>
      evidenceEvent({
        id: `r${index}`,
        missionId: 'R-C01',
        role: 'reinforced',
        at: index + 1,
      }),
    );
    const result = conceptLevel(variants, 'C01');
    expect(conceptMastery(variants, 'C01')).toBeCloseTo(0.5, 5);
    expect(result.transfer.eligible).toBe(false);
    expect(result.level).not.toBe('transferable');
  });
});

describe('recomputability (MT4)', () => {
  it('produces identical derived output from the same events', () => {
    const events = [
      evidenceEvent({ id: 'a', missionId: 'M02', at: 1, hintsUsed: 1 }),
      evidenceEvent({ id: 'b', missionId: 'M07', at: 2, hintsUsed: 2, hiddenPassed: 2, hiddenTotal: 3 }),
      evidenceEvent({ id: 'c', missionId: 'M12', at: 3, hintsUsed: 0, edgePassed: 0 }),
    ];

    const input = {
      concepts: [CONCEPT],
      events,
      pendingReinforcement: [],
    };
    const first = buildMasteryDashboard(input);
    const second = buildMasteryDashboard({
      ...input,
      events: events.map((event) => ({ ...event })),
    });

    expect(second).toEqual(first);
  });
});
