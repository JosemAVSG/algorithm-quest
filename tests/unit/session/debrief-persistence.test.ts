import { beforeAll, describe, expect, it } from 'vitest';

import { createLocalSessionStore } from '../../../src/adapters/persistence/local/session-store';
import type { Mission } from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import { runCases } from '../../../src/domain/execution/run-cases';
import type { KeyValueStorage } from '../../../src/domain/persistence/port';
import {
  createMissionSession,
  missionSessionReducer as reduce,
  restoreSession,
  toSnapshot,
  type MissionAction,
} from '../../../src/domain/session/mission-session';
import { loadMission } from '../../support/content';

const FIXED = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';
let mission: Mission;

beforeAll(async () => {
  mission = await loadMission('M01');
});

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function atDebrief() {
  const actions: MissionAction[] = [
    { type: 'open_strategy' },
    { type: 'submit_strategy', text: 'Voy a comparar temperatura y límite.' },
    {
      type: 'run_finished',
      source: FIXED,
      evaluation: evaluateRun({
        mission,
        outcome: {
          kind: 'completed',
          durationMs: 3,
          cases: runCases(FIXED, mission.contract.entryPoint, executionCases(mission)),
        },
        source: FIXED,
        attempt: 1,
        codeChanged: true,
      }),
    },
    { type: 'open_debrief' },
  ];
  return actions.reduce(reduce, createMissionSession(mission));
}

describe('partial debrief answers survive leaving and reloading', () => {
  it('keeps complexity, reasoning and explain answers when moving to another step and back', () => {
    let state = atDebrief();
    state = reduce(state, { type: 'answer_complexity', index: 1 });
    state = reduce(state, { type: 'edit_reasoning', text: 'Comparo con > para excluir la igualdad.' });
    state = reduce(state, { type: 'go_to_phase', phase: 'lab' });
    state = reduce(state, { type: 'go_to_phase', phase: 'debrief' });
    expect(state.debriefComplexityIndex).toBe(1);
    expect(state.reasoning).toBe('Comparo con > para excluir la igualdad.');
  });

  it('round-trips them through the local session store after a reload', () => {
    const state = reduce(
      reduce(atDebrief(), { type: 'answer_complexity', index: 2 }),
      { type: 'edit_reasoning', text: 'Comparo con > para excluir la igualdad.' },
    );
    const storage = memoryStorage();
    createLocalSessionStore(storage).save(toSnapshot(state));

    const loaded = createLocalSessionStore(storage).load('M01');
    const restored = restoreSession(mission, loaded);
    expect(restored?.phase).toBe('debrief');
    expect(restored?.debriefComplexityIndex).toBe(2);
    expect(restored?.reasoning).toBe('Comparo con > para excluir la igualdad.');
  });
});
