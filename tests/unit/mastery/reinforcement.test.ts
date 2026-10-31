import { describe, expect, it } from 'vitest';

import {
  enqueueReinforcement,
  MAX_PENDING_REINFORCEMENTS,
  shouldReinforce,
  type ReinforcementItem,
} from '../../../src/domain/mastery/reinforcement';
import {
  declineReinforcement as declineInProgress,
  emptyProgress,
  recordCompletion,
} from '../../../src/domain/persistence/port';
import { evidenceEvent } from '../../support/evidence';

function item(conceptId: string, mastery: number): ReinforcementItem {
  return {
    conceptId,
    missionId: 'M01',
    mastery,
    reason: 'assisted',
    queuedAt: 1,
  };
}

describe('reinforcement trigger (MT9)', () => {
  it('enqueues at mastery < 0.45 with three hints or a reveal', () => {
    expect(shouldReinforce(0.4, 3, false)).toBe(true);
    expect(shouldReinforce(0.4, 0, true)).toBe(true);
  });

  it('does not enqueue without help or at the threshold', () => {
    expect(shouldReinforce(0.4, 2, false)).toBe(false);
    expect(shouldReinforce(0.45, 3, false)).toBe(false);
    expect(shouldReinforce(0.6, 4, true)).toBe(false);
    expect(shouldReinforce(null, 3, true)).toBe(false);
  });
});

describe('reinforcement cap (MT10)', () => {
  it('keeps the three lowest-mastery concepts', () => {
    let queue: ReinforcementItem[] = [];
    queue = enqueueReinforcement(queue, item('C01', 0.4));
    queue = enqueueReinforcement(queue, item('C02', 0.3));
    queue = enqueueReinforcement(queue, item('C03', 0.2));

    expect(queue.map((entry) => entry.conceptId)).toEqual(['C03', 'C02', 'C01']);
    expect(queue).toHaveLength(MAX_PENDING_REINFORCEMENTS);
  });

  it('does not enqueue a fourth concept that is stronger than all three', () => {
    const queue = [item('C03', 0.2), item('C02', 0.3), item('C01', 0.4)];
    const next = enqueueReinforcement(queue, item('C04', 0.5));
    expect(next.map((entry) => entry.conceptId)).toEqual(['C03', 'C02', 'C01']);
  });

  it('lets a weaker fourth concept evict the strongest pending one', () => {
    const queue = [item('C03', 0.2), item('C02', 0.3), item('C01', 0.4)];
    const next = enqueueReinforcement(queue, item('C04', 0.1));
    expect(next.map((entry) => entry.conceptId)).toEqual(['C04', 'C03', 'C02']);
  });
});

describe('reinforcement lifecycle (IT5, IT6)', () => {
  const struggling = evidenceEvent({
    id: 'M01:C01:1',
    missionId: 'M01',
    conceptId: 'C01',
    at: 1,
    visiblePassed: false,
    hiddenPassed: 0,
    edgePassed: 0,
    reasoningScore: 0,
    efficiencyRatio: 0,
    hintsUsed: 3,
    maxHintLevel: 3,
  });

  const record = {
    missionId: 'M01',
    completedAt: 1,
    attempts: 2,
    hintsUsed: 3,
    reasoningScore: 0,
    evidence: [struggling],
  };

  it('records a decline without blocking progress', () => {
    const progress = recordCompletion(emptyProgress(), record);
    expect(progress.reinforcement.map((entry) => entry.conceptId)).toEqual(['C01']);

    const declined = declineInProgress(progress, 'C01');
    expect(declined.reinforcement).toEqual([]);
    expect(declined.declinedReinforcement).toEqual(['C01']);
    expect(declined.completed).toHaveLength(1);

    const declinedTwice = declineInProgress(declined, 'C01');
    expect(declinedTwice.declinedReinforcement).toEqual(['C01']);
  });

  it('appends replay evidence without duplicating the completion record', () => {
    const first = recordCompletion(emptyProgress(), record);
    const replay = recordCompletion(first, {
      ...record,
      completedAt: 2,
      evidence: [{ ...struggling, id: 'M01:C01:2', at: 2 }],
    });

    expect(replay.completed).toHaveLength(1);
    expect(replay.completed[0].completedAt).toBe(2);
    expect(replay.events).toHaveLength(2);
  });

  it('deduplicates an event recorded twice with the same id', () => {
    const first = recordCompletion(emptyProgress(), record);
    const duplicate = recordCompletion(first, record);
    expect(duplicate.events).toHaveLength(1);
  });
});
