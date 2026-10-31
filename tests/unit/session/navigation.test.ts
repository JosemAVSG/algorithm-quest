import { beforeAll, describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import { runCases } from '../../../src/domain/execution/run-cases';
import {
  createMissionSession,
  missionSessionReducer as reduce,
  restoreSession,
  toSnapshot,
  type MissionAction,
  type MissionSessionState,
} from '../../../src/domain/session/mission-session';
import { loadMission } from '../../support/content';

let mission: Mission;

const BUGGY = 'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}';
const FIXED = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';
const STRATEGY = 'Voy a comparar temperatura y límite.';

beforeAll(async () => {
  mission = await loadMission('M01');
});

function apply(state: MissionSessionState, ...actions: MissionAction[]): MissionSessionState {
  return actions.reduce(reduce, state);
}

function run(state: MissionSessionState, code: string): MissionSessionState {
  const outcome = {
    kind: 'completed' as const,
    durationMs: 3,
    cases: runCases(code, mission.contract.entryPoint, executionCases(mission)),
  };
  return reduce(state, {
    type: 'run_finished',
    source: code,
    evaluation: evaluateRun({
      mission,
      outcome,
      source: code,
      attempt: state.attempts + 1,
      codeChanged: state.previousSource === null ? true : state.previousSource !== code,
      ...(state.lastEvaluation === null ? {} : { previousCode: state.lastEvaluation.primaryCode! }),
    }),
  });
}

const atLab = () =>
  apply(createMissionSession(mission), { type: 'open_strategy' }, { type: 'submit_strategy', text: STRATEGY });

const atDebrief = () =>
  apply(run(atLab(), FIXED), { type: 'open_debrief' });

describe('step navigation', () => {
  it('starts with the current phase as the furthest reached', () => {
    expect(createMissionSession(mission).furthestPhase).toBe('briefing');
    expect(atLab().furthestPhase).toBe('lab');
  });

  it('denies future phases and a skipped strategy', () => {
    const fresh = createMissionSession(mission);
    expect(reduce(fresh, { type: 'go_to_phase', phase: 'lab' })).toBe(fresh);
    expect(reduce(fresh, { type: 'go_to_phase', phase: 'strategy' })).toBe(fresh);
    const inStrategy = reduce(fresh, { type: 'open_strategy' });
    expect(reduce(inStrategy, { type: 'go_to_phase', phase: 'lab' })).toBe(inStrategy);
    expect(reduce(atLab(), { type: 'go_to_phase', phase: 'debrief' }).phase).toBe('lab');
  });

  it('goes back to any reached phase and forward again without losing data', () => {
    let state = run(atLab(), BUGGY);
    state = reduce(state, { type: 'edit_source', source: 'draft()' });
    state = reduce(state, { type: 'request_hint' });
    const before = state;

    const back = reduce(state, { type: 'go_to_phase', phase: 'briefing' });
    expect(back.phase).toBe('briefing');
    expect(back.furthestPhase).toBe('lab');
    expect(back.source).toBe('draft()');
    expect(back.strategy).toBe(STRATEGY);
    expect(back.attempts).toBe(before.attempts);
    expect(back.hintsUsed).toBe(before.hintsUsed);
    expect(back.hint).toEqual(before.hint);
    expect(back.lastEvaluation).toBe(before.lastEvaluation);

    const forward = reduce(back, { type: 'go_to_phase', phase: 'lab' });
    expect(forward).toEqual(before);
  });

  it('ignores edits and runs outside the lab', () => {
    const away = reduce(atLab(), { type: 'go_to_phase', phase: 'strategy' });
    expect(reduce(away, { type: 'edit_source', source: 'x' })).toBe(away);
    expect(reduce(away, { type: 'run_started' })).toBe(away);
  });

  it('briefing "Entendido" returns to the furthest phase when already beyond it', () => {
    const state = run(atLab(), BUGGY);
    const back = reduce(state, { type: 'go_to_phase', phase: 'briefing' });
    expect(reduce(back, { type: 'open_strategy' }).phase).toBe('lab');
  });

  it('resubmitting the strategy updates the text and keeps lab progress', () => {
    const state = run(atLab(), BUGGY);
    const back = reduce(state, { type: 'go_to_phase', phase: 'strategy' });
    const again = reduce(back, { type: 'submit_strategy', text: 'Otra idea: usar solo una comparación.' });
    expect(again.phase).toBe('lab');
    expect(again.strategy).toBe('Otra idea: usar solo una comparación.');
    expect(again.attempts).toBe(state.attempts);
    expect(again.lastEvaluation).toBe(state.lastEvaluation);
  });

  it('only reopens the debrief once the tests have passed', () => {
    const debrief = atDebrief();
    const inLab = reduce(debrief, { type: 'go_to_phase', phase: 'lab' });
    expect(reduce(inLab, { type: 'go_to_phase', phase: 'debrief' }).phase).toBe('debrief');

    const failing = run(inLab, BUGGY);
    expect(reduce(failing, { type: 'go_to_phase', phase: 'debrief' })).toBe(failing);
    // Same rule from the briefing: "Entendido" never lands on a locked debrief.
    const fromBriefing = reduce(failing, { type: 'go_to_phase', phase: 'briefing' });
    expect(reduce(fromBriefing, { type: 'open_strategy' }).phase).toBe('lab');
  });

  it('keeps the debrief draft when stepping away', () => {
    let state = reduce(atDebrief(), { type: 'edit_reasoning', text: 'borrador' });
    state = reduce(state, { type: 'answer_complexity', index: 1 });
    const back = reduce(state, { type: 'go_to_phase', phase: 'lab' });
    const again = reduce(back, { type: 'go_to_phase', phase: 'debrief' });
    expect(again.reasoning).toBe('borrador');
    expect(again.debriefComplexityIndex).toBe(1);
  });

  it('is disabled once the mission is complete', () => {
    const complete = { ...atDebrief(), phase: 'complete' as const };
    expect(reduce(complete, { type: 'go_to_phase', phase: 'lab' })).toBe(complete);
  });
});

describe('furthestPhase persistence', () => {
  it('round-trips through the snapshot', () => {
    const state = reduce(run(atLab(), BUGGY), { type: 'go_to_phase', phase: 'strategy' });
    const restored = restoreSession(mission, toSnapshot(state));
    expect(restored?.phase).toBe('strategy');
    expect(restored?.furthestPhase).toBe('lab');
  });

  it('defaults to the current phase for snapshots saved before the field existed', () => {
    const legacy = { ...toSnapshot(atLab()) };
    delete legacy.furthestPhase;
    expect(restoreSession(mission, legacy)?.furthestPhase).toBe('lab');
    expect(restoreSession(mission, { ...legacy, phase: 'complete', completedAt: 1 })?.furthestPhase).toBe(
      'debrief',
    );
  });

  it('never trusts a furthestPhase behind the current phase or unknown', () => {
    const snapshot = toSnapshot(atLab());
    expect(restoreSession(mission, { ...snapshot, furthestPhase: 'briefing' })?.furthestPhase).toBe('lab');
    expect(
      restoreSession(mission, { ...snapshot, furthestPhase: 'bogus' as never })?.furthestPhase,
    ).toBe('lab');
  });
});
