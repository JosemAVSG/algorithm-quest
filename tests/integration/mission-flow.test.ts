/**
 * The integration test docs/10-testing-and-security.md §3.1 asks for: the whole
 * M01 flow, domain layer only, with no browser and no worker.
 *
 * If this test needs a browser to pass, the architecture has leaked.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import type { Mission } from '../../src/domain/content/schema';
import { executionCases } from '../../src/domain/evaluation/cases';
import { evaluateRun } from '../../src/domain/evaluation/evaluate-run';
import { runCases } from '../../src/domain/execution/run-cases';
import {
  completedMissionIds,
  emptyProgress,
  recordCompletion,
} from '../../src/domain/persistence/port';
import { missionStates, nextMission } from '../../src/domain/progression/unlock';
import {
  createMissionSession,
  missionSessionReducer,
  type MissionSessionState,
} from '../../src/domain/session/mission-session';
import { loadBundle, loadMission } from '../support/content';
import type { ContentBundle } from '../../src/domain/content/assemble';

let mission: Mission;
let bundle: ContentBundle;

const BUGGY = 'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}';
const FIXED = 'function isOverLimit(temperature, limit) {\n  return temperature > limit;\n}';

beforeAll(async () => {
  bundle = await loadBundle();
  mission = await loadMission('M01');
});

function run(state: MissionSessionState, code: string): MissionSessionState {
  return missionSessionReducer(state, {
    type: 'run_finished',
    source: code,
    evaluation: evaluateRun({
      mission,
      outcome: {
        kind: 'completed',
        durationMs: 2,
        cases: runCases(code, mission.contract.entryPoint, executionCases(mission)),
      },
      source: code,
      attempt: state.attempts + 1,
      codeChanged: state.previousSource === null ? true : state.previousSource !== code,
      ...(state.lastEvaluation === null
        ? {}
        : { previousCode: state.lastEvaluation.diagnosis!.code }),
    }),
  });
}

describe('full M01 flow', () => {
  it('blocks the run until a strategy is committed', () => {
    const session = createMissionSession(mission);
    const atStrategy = missionSessionReducer(session, { type: 'open_strategy' });
    const stillLocked = missionSessionReducer(atStrategy, {
      type: 'submit_strategy',
      text: 'no',
    });
    expect(stillLocked.phase).toBe('strategy');
  });

  it('goes from the >= bug to green sensor, with evidence and a working system', () => {
    // briefing -> strategy -> lab
    let state = createMissionSession(mission);
    state = missionSessionReducer(state, { type: 'open_strategy' });
    state = missionSessionReducer(state, {
      type: 'submit_strategy',
      text: 'Voy a comparar la temperatura con el límite.',
    });
    expect(state.phase).toBe('lab');

    // first run: visible tests pass, the boundary does not
    state = run(state, BUGGY);
    expect(state.lastEvaluation?.diagnosis!.code).toBe('E05');
    expect(state.lastEvaluation?.report.counts.visible).toEqual({ passed: 3, total: 3 });
    expect(state.lastEvaluation?.diagnosis!.modifiers).toContain('LOW_ATTEMPT');

    // the player asks for a hint: level 1, then the specific level 2
    state = missionSessionReducer(state, { type: 'request_hint' });
    expect(state.hint?.level).toBe(1);
    state = missionSessionReducer(state, { type: 'request_hint' });
    expect(state.hint?.text).toContain('90 y límite 90');

    // fix -> all green
    state = run(state, FIXED);
    expect(state.lastEvaluation?.report.allPassed).toBe(true);
    expect(state.attempts).toBe(2);
    expect(state.hintsUsed).toBe(2);

    // debrief: the reasoning gate holds
    state = missionSessionReducer(state, { type: 'open_debrief' });
    expect(state.phase).toBe('debrief');

    // M01 authors a structured explanation: a wrong blank is feedback, not a lock.
    const explain = mission.debrief.explain!;
    const wrongBlank = explain.blanks[1]!;
    state = missionSessionReducer(state, {
      type: 'answer_explain',
      id: wrongBlank.id,
      index: (wrongBlank.correctIndex + 1) % wrongBlank.options.length,
    });
    state = missionSessionReducer(state, { type: 'submit_debrief', now: 1000 });
    expect(state.phase).toBe('debrief');
    expect(state.explainFailures).toBe(1);

    state = missionSessionReducer(state, { type: 'answer_complexity', index: 0 });
    for (const item of [...explain.blanks, ...explain.questions]) {
      state = missionSessionReducer(state, {
        type: 'answer_explain',
        id: item.id,
        index: item.correctIndex,
      });
    }
    state = missionSessionReducer(state, { type: 'submit_debrief', now: 2000 });

    expect(state.phase).toBe('complete');
    expect(state.evidence).toHaveLength(2);

    // evidence -> progress -> map
    const progress = recordCompletion(emptyProgress(), {
      missionId: mission.id,
      completedAt: 2000,
      attempts: state.attempts,
      hintsUsed: state.hintsUsed,
      reasoningScore: state.assessment?.score ?? 0,
      evidence: state.evidence,
    });

    const ids = completedMissionIds(progress);
    expect(missionStates(bundle.missions, ids).get('M01')).toBe('completed');
    expect(nextMission(bundle.missions, ids)?.id).toBe('M02');
  });

  it('keeps a replay as one completion record, not two', () => {
    const once = recordCompletion(emptyProgress(), {
      missionId: 'M01',
      completedAt: 1,
      attempts: 1,
      hintsUsed: 0,
      reasoningScore: 3,
      evidence: [],
    });
    const twice = recordCompletion(once, {
      missionId: 'M01',
      completedAt: 2,
      attempts: 1,
      hintsUsed: 0,
      reasoningScore: 2,
      evidence: [],
    });

    expect(twice.completed).toHaveLength(1);
    expect(twice.completed[0].completedAt).toBe(2);
  });
});
