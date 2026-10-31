import { beforeAll, describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import { runCases } from '../../../src/domain/execution/run-cases';
import {
  createMissionSession,
  missionSessionReducer,
  restoreSession,
  STRATEGY_MIN_LENGTH,
  toSnapshot,
  type MissionSessionState,
} from '../../../src/domain/session/mission-session';
import { loadMission } from '../../support/content';

let mission: Mission;

const BUGGY = 'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}';
const FIXED = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';
const GOOD_REASONING =
  'Comparo la temperatura con el límite y devuelvo true solo cuando la supera; con 90 y límite 90 no se dispara la alarma, y el coste es O(1).';

beforeAll(async () => {
  // The legacy free-text rubric stays for missions without `debrief.explain`.
  const authored = await loadMission('M01');
  const debrief = { ...authored.debrief };
  delete debrief.explain;
  mission = { ...authored, debrief };
});

/** One run, evaluated and applied, exactly as the lab does it. */
function run(state: MissionSessionState, code: string): MissionSessionState {
  const outcome = {
    kind: 'completed' as const,
    durationMs: 3,
    cases: runCases(code, mission.contract.entryPoint, executionCases(mission)),
  };

  return missionSessionReducer(state, {
    type: 'run_finished',
    source: code,
    evaluation: evaluateRun({
      mission,
      outcome,
      source: code,
      attempt: state.attempts + 1,
      codeChanged: state.previousSource === null ? true : state.previousSource !== code,
      ...(state.lastEvaluation === null
        ? {}
        : { previousCode: state.lastEvaluation.primaryCode! }),
    }),
  });
}

function start(): MissionSessionState {
  return createMissionSession(mission);
}

function atLab(): MissionSessionState {
  const opened = missionSessionReducer(start(), { type: 'open_strategy' });
  return missionSessionReducer(opened, {
    type: 'submit_strategy',
    text: 'Voy a comparar temperatura y límite.',
  });
}

describe('mission session', () => {
  it('starts at the briefing and gates the strategy text', () => {
    const briefing = start();
    expect(briefing.phase).toBe('briefing');

    const strategy = missionSessionReducer(briefing, { type: 'open_strategy' });
    expect(strategy.phase).toBe('strategy');

    const tooShort = missionSessionReducer(strategy, {
      type: 'submit_strategy',
      text: 'corto',
    });
    expect(tooShort.phase).toBe('strategy');
    expect(tooShort.strategy).toBe('');

    const padded = ' '.repeat(STRATEGY_MIN_LENGTH);
    expect(
      missionSessionReducer(strategy, { type: 'submit_strategy', text: padded }).phase,
    ).toBe('strategy');

    const accepted = missionSessionReducer(strategy, {
      type: 'submit_strategy',
      text: '  Voy a comparar temperatura y límite.  ',
    });
    expect(accepted.phase).toBe('lab');
    expect(accepted.strategy).toBe('Voy a comparar temperatura y límite.');
  });

  it('cannot open the debrief before every test passes', () => {
    const state = run(atLab(), BUGGY);
    const attempted = missionSessionReducer(state, { type: 'open_debrief' });
    expect(attempted.phase).toBe('lab');
  });

  it('escalates the hint ladder one rung at a time and stops at 3', () => {
    let state = run(atLab(), BUGGY);

    state = missionSessionReducer(state, { type: 'request_hint' });
    expect(state.hint).toEqual({ level: 1, text: mission.hints[0].text, modality: 'prose' });
    expect(state.hintsUsed).toBe(1);

    state = missionSessionReducer(state, { type: 'request_hint' });
    expect(state.hint?.level).toBe(2);
    // The precise E05 message for this failure, not the generic one.
    expect(state.hint?.text).toContain('90 y límite 90');
    expect(state.hintsUsed).toBe(2);

    state = missionSessionReducer(state, { type: 'request_hint' });
    expect(state.hint).toEqual({ level: 3, text: mission.hints[2].text, modality: 'prose' });
    expect(state.hintsUsed).toBe(3);
    expect(state.maxHintLevel).toBe(3);

    const exhausted = missionSessionReducer(state, { type: 'request_hint' });
    expect(exhausted.hintsUsed).toBe(3);
  });

  it('resets the ladder when the diagnosis changes', () => {
    let state = run(atLab(), BUGGY);
    state = missionSessionReducer(state, { type: 'request_hint' });
    state = missionSessionReducer(state, { type: 'request_hint' });
    expect(state.hintLevel).toBe(2);

    state = run(state, 'function isOverLimit(temperature, limit) {\n  return "true";\n}');
    expect(state.lastEvaluation?.diagnosis!.code).toBe('E12');
    expect(state.hintLevel).toBe(0);
    expect(state.hint).toBeNull();
    // The measured total is never reset: it is evidence, not a UI counter.
    expect(state.hintsUsed).toBe(2);
  });

  it('completes only when the tests pass and the reasoning reaches 2', () => {
    let state = run(atLab(), FIXED);
    expect(state.attempts).toBe(1);
    expect(state.lastEvaluation?.report.allPassed).toBe(true);
    expect(state.lastEvaluation?.diagnosis!.code).toBe('CLEAR');

    state = missionSessionReducer(state, { type: 'open_debrief' });
    expect(state.phase).toBe('debrief');

    const refused = missionSessionReducer(state, {
      type: 'edit_reasoning',
      text: 'porque funciona',
    });
    const rejected = missionSessionReducer(refused, { type: 'submit_debrief', now: 1000 });
    expect(rejected.phase).toBe('debrief');
    expect(rejected.assessment?.score).toBe(0);
    expect(rejected.evidence).toEqual([]);
    expect(rejected.completedAt).toBeNull();

    const written = missionSessionReducer(rejected, {
      type: 'edit_reasoning',
      text: GOOD_REASONING,
    });
    expect(written.assessment).toBeNull();

    const completed = missionSessionReducer(written, { type: 'submit_debrief', now: 2000 });
    expect(completed.phase).toBe('complete');
    expect(completed.assessment?.score).toBe(3);
    expect(completed.completedAt).toBe(2000);
    expect(completed.evidence).toHaveLength(2);
    expect(completed.evidence.map((event) => event.conceptId).sort()).toEqual(['C01', 'C02']);
    expect(completed.evidence[0].strategySubmitted).toBe(true);
    expect(completed.evidence[0].attempts).toBe(1);

    const again = missionSessionReducer(completed, { type: 'submit_debrief', now: 3000 });
    expect(again).toBe(completed);
  });

  it('is deterministic: the same actions produce the same state', () => {
    const once = run(atLab(), BUGGY);
    const twice = run(atLab(), BUGGY);
    expect(twice).toEqual(once);
  });

  it('snapshots everything except the editor buffer', () => {
    let state = run(atLab(), BUGGY);
    state = missionSessionReducer(state, { type: 'request_hint' });
    state = missionSessionReducer(state, { type: 'edit_source', source: 'while (true) {}' });

    const snapshot = toSnapshot(state);
    expect(Object.keys(snapshot)).not.toContain('source');

    const restored = restoreSession(mission, snapshot);
    expect(restored).not.toBeNull();
    expect(restored?.phase).toBe('lab');
    expect(restored?.source).toBe(mission.starterCode);
    expect(restored?.attempts).toBe(state.attempts);
    expect(restored?.hintsUsed).toBe(state.hintsUsed);
    expect(restored?.lastEvaluation?.diagnosis!.code).toBe('E05');
    expect(restored?.previousSource).toBeNull();
  });

  it('refuses a snapshot from another mission', () => {
    const snapshot = toSnapshot(run(atLab(), BUGGY));
    expect(restoreSession({ ...mission, id: 'M99' }, snapshot)).toBeNull();
    expect(restoreSession(mission, null)).toBeNull();
  });
});
