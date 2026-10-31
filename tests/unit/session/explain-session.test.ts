import { beforeAll, describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import { runCases } from '../../../src/domain/execution/run-cases';
import {
  createMissionSession,
  missionSessionReducer,
  restoreSession,
  toSnapshot,
  type MissionAction,
  type MissionSessionState,
} from '../../../src/domain/session/mission-session';
import { loadMission } from '../../support/content';

const FIXED = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';

let mission: Mission;

beforeAll(async () => {
  const base = await loadMission('M01');
  mission = {
    ...base,
    debrief: {
      ...base.debrief,
      explain: {
        prompt: 'Completa la explicación.',
        template: 'Comparo {a} y devuelvo {b}.',
        blanks: [
          { id: 'a', options: ['uno', 'dos', 'tres'], correctIndex: 1 },
          { id: 'b', options: ['true', 'false', 'nada'], correctIndex: 0 },
        ],
        questions: [
          {
            id: 'q',
            question: '¿Por qué?',
            options: ['x', 'y', 'z'],
            correctIndex: 2,
            whyWrong: ['mal x', 'mal y', ''],
            explanation: 'Porque z.',
          },
        ],
      },
    },
  };
});

function reduce(state: MissionSessionState, ...actions: MissionAction[]): MissionSessionState {
  return actions.reduce((acc, action) => missionSessionReducer(acc, action), state);
}

function atDebrief(): MissionSessionState {
  let state = reduce(
    createMissionSession(mission),
    { type: 'open_strategy' },
    { type: 'submit_strategy', text: 'Voy a comparar temperatura y límite.' },
  );
  state = missionSessionReducer(state, {
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
  });
  return missionSessionReducer(state, { type: 'open_debrief' });
}

const RIGHT: MissionAction[] = [
  { type: 'answer_explain', id: 'a', index: 1 },
  { type: 'answer_explain', id: 'b', index: 0 },
  { type: 'answer_explain', id: 'q', index: 2 },
];

describe('structured explanation in the session', () => {
  it('completes with score 3 when everything is right on the first submit', () => {
    const state = reduce(atDebrief(), ...RIGHT, { type: 'submit_debrief', now: 1 });
    expect(state.phase).toBe('complete');
    expect(state.assessment?.score).toBe(3);
  });

  it('does not complete with unanswered items and does not count it as a failure', () => {
    const state = reduce(atDebrief(), RIGHT[0]!, { type: 'submit_debrief', now: 1 });
    expect(state.phase).toBe('debrief');
    expect(state.explainFeedback?.missing).toEqual(['b', 'q']);
    expect(state.explainFailures).toBe(0);
  });

  it('flags wrong answers, counts the failure, and completes with score 2 after a retry', () => {
    let state = reduce(
      atDebrief(),
      { type: 'answer_explain', id: 'a', index: 0 },
      RIGHT[1]!,
      RIGHT[2]!,
      { type: 'submit_debrief', now: 1 },
    );
    expect(state.phase).toBe('debrief');
    expect(state.explainFeedback?.wrong).toEqual({ a: 0 });
    expect(state.explainFailures).toBe(1);
    expect(JSON.stringify(state.explainFeedback)).not.toContain('correctIndex');

    state = reduce(state, RIGHT[0]!, { type: 'submit_debrief', now: 2 });
    expect(state.phase).toBe('complete');
    expect(state.assessment?.score).toBe(2);
  });

  it('ignores free-text reasoning for missions with an explain block', () => {
    const state = reduce(
      atDebrief(),
      { type: 'edit_reasoning', text: 'Comparo la temperatura con el límite, alarma, O(1), devuelvo.' },
      { type: 'submit_debrief', now: 1 },
    );
    expect(state.phase).toBe('debrief');
  });

  it('keeps an optional note and survives a snapshot round trip', () => {
    const state = reduce(
      atDebrief(),
      RIGHT[0]!,
      { type: 'edit_explain_note', text: 'mi nota' },
      { type: 'answer_explain', id: 'q', index: 0 },
      { type: 'submit_debrief', now: 1 },
    );
    const restored = restoreSession(mission, JSON.parse(JSON.stringify(toSnapshot(state))));
    expect(restored?.explainAnswers).toEqual(state.explainAnswers);
    expect(restored?.explainNote).toBe('mi nota');
    expect(restored?.explainFailures).toBe(state.explainFailures);
  });

  it('restores a legacy snapshot without explain fields', () => {
    const snapshot = JSON.parse(JSON.stringify(toSnapshot(atDebrief())));
    delete snapshot.explainAnswers;
    delete snapshot.explainFailures;
    delete snapshot.explainNote;
    delete snapshot.explainFeedback;
    const restored = restoreSession(mission, snapshot);
    expect(restored?.explainAnswers).toEqual({ blanks: {}, questions: {} });
    expect(restored?.explainFailures).toBe(0);
  });
});
