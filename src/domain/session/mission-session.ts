/**
 * The mission session: briefing -> strategy -> lab -> debrief -> complete.
 *
 * This is the state machine docs/07-architecture.md §6 asks for, as a pure
 * reducer. It lives in `domain/` for the same reason the mentor does: the whole
 * flow — the strategy gate, the attempt counter, the hint ladder, and the
 * reasoning gate — can then be tested in Node, without a browser and without a
 * worker.
 *
 * Two deliberate boundaries:
 *
 * - The reducer never executes code and never classifies a run. The lab hands it
 *   an `Evaluation` that `evaluateRun` already froze.
 * - `source` is in state but **not** in the snapshot. Reloading loses the editor
 *   buffer and nothing else (docs/11-delivery-plan.md §3, M1), which is the
 *   behaviour written down in the plan rather than an accident of serialisation.
 */

import type { Mission } from '../content/schema';
import type { SelectedHint } from '../diagnosis/hints';
import { hintAvailable, MAX_HINT_LEVEL, selectHint } from '../diagnosis/hints';
import type { DiagnosisCode, HintLevel } from '../diagnosis/taxonomy';
import type { TestReport } from '../evaluation/test-engine';
import type { RunEvaluation } from '../evaluation/evaluate-run';
import { buildEvidenceEvents, type EvidenceEvent } from '../mastery/evidence';
import {
  assessExplain,
  explainScore,
  type ExplainAnswers,
  type ExplainAssessment,
} from '../evaluation/explain';
import {
  assessReasoning,
  REASONING_MIN_SCORE,
  type ReasoningAssessment,
} from '../mastery/reasoning';

export type { RunEvaluation };

/** docs/06-ux-flows.md §5 — enough to force a commitment, short enough not to be a chore. */
export const STRATEGY_MIN_LENGTH = 15;

/** Re-exported for the debrief UI; the rubric owns the threshold. */
export { REASONING_MIN_SCORE };

/** Re-exported for the UI; the ladder's bound lives with the mentor (`hints.ts`). */
export { MAX_HINT_LEVEL };

export type SessionPhase = 'briefing' | 'strategy' | 'lab' | 'debrief' | 'complete';

/** The phases the rail can show and the player can navigate to. */
export type StepPhase = Exclude<SessionPhase, 'complete'>;

const STEP_ORDER: readonly StepPhase[] = ['briefing', 'strategy', 'lab', 'debrief'];

function stepRank(phase: StepPhase): number {
  return STEP_ORDER.indexOf(phase);
}

function isStepPhase(value: unknown): value is StepPhase {
  return STEP_ORDER.includes(value as StepPhase);
}

/** The step a finished mission counts as having reached. */
function toStepPhase(phase: SessionPhase): StepPhase {
  return phase === 'complete' ? 'debrief' : phase;
}

export interface MissionSessionState {
  mission: Mission;
  phase: SessionPhase;
  /**
   * The furthest step ever reached. Navigation (`go_to_phase`) may go back and
   * forth up to here, never beyond: the strategy cannot be skipped and the
   * debrief still needs passing tests.
   */
  furthestPhase: StepPhase;
  source: string;
  strategy: string;
  attempts: number;
  /** Total hints revealed across the whole session. This is the measured value. */
  hintsUsed: number;
  /** Highest level ever shown, for later mastery weighting. */
  maxHintLevel: 0 | HintLevel;
  /** Level already shown for the current diagnosis. Resets when the code changes. */
  hintLevel: number;
  hint: SelectedHint | null;
  running: boolean;
  lastEvaluation: RunEvaluation | null;
  /** The source that produced `lastEvaluation`; used for NO_PROGRESS detection. */
  previousSource: string | null;
  debriefComplexityIndex: number | null;
  reasoning: string;
  assessment: ReasoningAssessment | null;
  /** Structured explanation (missions with `debrief.explain`): item id -> chosen option. */
  explainAnswers: ExplainAnswers;
  /** Graded submissions that had at least one wrong answer; drives the 3 -> 2 score. */
  explainFailures: number;
  /** Optional, ungraded free-text note. */
  explainNote: string;
  /** Result of the last graded submit; null until then. */
  explainFeedback: ExplainAssessment | null;
  evidence: EvidenceEvent[];
  completedAt: number | null;
}

export type MissionAction =
  | { type: 'go_to_phase'; phase: StepPhase }
  | { type: 'open_strategy' }
  | { type: 'submit_strategy'; text: string }
  | { type: 'edit_source'; source: string }
  | { type: 'run_started' }
  | { type: 'run_finished'; evaluation: RunEvaluation; source: string }
  | { type: 'request_hint' }
  | { type: 'open_debrief' }
  | { type: 'answer_complexity'; index: number }
  | { type: 'edit_reasoning'; text: string }
  | { type: 'answer_explain'; id: string; index: number }
  | { type: 'edit_explain_note'; text: string }
  | { type: 'submit_debrief'; now: number };

export function createMissionSession(mission: Mission): MissionSessionState {
  return {
    mission,
    phase: 'briefing',
    furthestPhase: 'briefing',
    source: mission.starterCode,
    strategy: '',
    attempts: 0,
    hintsUsed: 0,
    maxHintLevel: 0,
    hintLevel: 0,
    hint: null,
    running: false,
    lastEvaluation: null,
    previousSource: null,
    debriefComplexityIndex: null,
    reasoning: '',
    assessment: null,
    explainAnswers: { blanks: {}, questions: {} },
    explainFailures: 0,
    explainNote: '',
    explainFeedback: null,
    evidence: [],
    completedAt: null,
  };
}

/**
 * The completion gate. Not the same as `report.allPassed`: a run that satisfies
 * every test but mutates its input or answers differently each time is not a
 * solution (docs/04 §2), and `passed` already folds that in.
 */
export function allTestsPassed(state: MissionSessionState): boolean {
  return state.lastEvaluation?.passed ?? false;
}

export function canOpenDebrief(state: MissionSessionState): boolean {
  return state.phase === 'lab' && allTestsPassed(state);
}

/**
 * Whether the mentor can honestly offer another rung right now. The level-4
 * guard is part of the answer: at `attempts: 3, hints: 3` the button is absent,
 * not merely discouraging.
 */
export function canRequestHint(state: MissionSessionState): boolean {
  const diagnosis = state.lastEvaluation?.diagnosis;
  if (diagnosis == null) return false;
  return hintAvailable(state.mission, diagnosis, {
    hintLevel: state.hintLevel,
    hintsUsed: state.hintsUsed,
    attempts: state.attempts,
  });
}

/**
 * Where "continue" lands. Moving forward from a step you already left must not
 * rewind the session: it returns to the furthest step reached, or to the lab
 * when that was a debrief whose tests no longer pass.
 */
function resumePhase(state: MissionSessionState, next: StepPhase): StepPhase {
  const furthest =
    state.furthestPhase === 'debrief' && !allTestsPassed(state) ? 'lab' : state.furthestPhase;
  return stepRank(furthest) > stepRank(next) ? furthest : next;
}

function advanceTo(state: MissionSessionState, phase: StepPhase): MissionSessionState {
  return {
    ...state,
    phase,
    furthestPhase: stepRank(phase) > stepRank(state.furthestPhase) ? phase : state.furthestPhase,
  };
}

function withHint(
  state: MissionSessionState,
  hint: SelectedHint | null,
  level: number,
): MissionSessionState {
  return {
    ...state,
    hint,
    hintLevel: level,
    hintsUsed: state.hintsUsed + 1,
    maxHintLevel: Math.max(state.maxHintLevel, level) as 0 | HintLevel,
  };
}

export function missionSessionReducer(
  state: MissionSessionState,
  action: MissionAction,
): MissionSessionState {
  switch (action.type) {
    case 'go_to_phase': {
      // Free movement inside what was already reached; nothing is reset.
      if (state.phase === 'complete' || action.phase === state.phase) return state;
      if (stepRank(action.phase) > stepRank(state.furthestPhase)) return state;
      if (action.phase === 'debrief' && !allTestsPassed(state)) return state;
      return { ...state, phase: action.phase };
    }

    case 'open_strategy':
      // Re-reading the briefing and pressing "Entendido" resumes where the
      // player was instead of sending them back to the strategy.
      return state.phase === 'briefing'
        ? advanceTo(state, resumePhase(state, 'strategy'))
        : state;

    case 'submit_strategy': {
      if (state.phase !== 'strategy') return state;
      const text = action.text.trim();
      if (text.length < STRATEGY_MIN_LENGTH) return state;
      // Resubmitting an edited strategy updates the text only; lab progress is
      // kept and the player resumes at the furthest step reached.
      return { ...advanceTo(state, resumePhase(state, 'lab')), strategy: text };
    }

    case 'edit_source':
      return state.phase === 'lab' ? { ...state, source: action.source } : state;

    case 'run_started':
      if (state.phase !== 'lab' || state.running) return state;
      return { ...state, running: true };

    case 'run_finished': {
      if (state.phase !== 'lab') return state;

      // Compare primary codes, not final ones: an E15 is a repeated E05, and
      // comparing the final code would reset the ladder on every repetition.
      const previousCode = state.lastEvaluation?.primaryCode ?? undefined;
      const sameCode =
        previousCode !== undefined &&
        action.evaluation.primaryCode !== null &&
        previousCode === action.evaluation.primaryCode &&
        // A changed source after a hint is an attempt, not a repeat: the
        // POST_HINT rule already cleared the REPEAT modifier.
        !action.evaluation.diagnosis?.modifiers.includes('POST_HINT');

      return {
        ...state,
        running: false,
        attempts: state.attempts + 1,
        lastEvaluation: action.evaluation,
        previousSource: action.source,
        // A new diagnosis restarts the ladder at level 1; the same diagnosis
        // keeps the rung the player already earned. Escalation is never reset
        // by editing, only by a different fault.
        ...(sameCode ? {} : { hint: null, hintLevel: 0 }),
      };
    }

    case 'request_hint': {
      if (state.lastEvaluation?.diagnosis == null) return state;
      const next = selectHint(state.mission, state.lastEvaluation.diagnosis, {
        hintLevel: state.hintLevel,
        hintsUsed: state.hintsUsed,
        attempts: state.attempts,
      });
      if (next === null) return state;
      if (next.level <= state.hintLevel) return state;
      return withHint(state, next, next.level);
    }

    case 'open_debrief':
      return canOpenDebrief(state) ? advanceTo(state, 'debrief') : state;

    case 'answer_complexity':
      return state.phase === 'debrief'
        ? { ...state, debriefComplexityIndex: action.index }
        : state;

    case 'edit_reasoning':
      return state.phase === 'debrief'
        ? // Editing after a rejected answer clears the stale verdict; keeping it
          // visible next to changed text would describe a sentence that no
          // longer exists.
          { ...state, reasoning: action.text, assessment: null }
        : state;

    case 'answer_explain': {
      const spec = state.mission.debrief.explain;
      if (state.phase !== 'debrief' || spec === undefined) return state;
      const group = spec.blanks.some((b) => b.id === action.id)
        ? 'blanks'
        : spec.questions.some((q) => q.id === action.id)
          ? 'questions'
          : null;
      if (group === null) return state;
      return {
        ...state,
        explainAnswers: {
          ...state.explainAnswers,
          [group]: { ...state.explainAnswers[group], [action.id]: action.index },
        },
        // Feedback stays: the UI only marks an item while its answer still
        // equals the submitted wrong one, so fixing one item keeps the rest.
      };
    }

    case 'edit_explain_note':
      return state.phase === 'debrief' ? { ...state, explainNote: action.text } : state;

    case 'submit_debrief': {
      if (state.phase !== 'debrief' || state.lastEvaluation === null) return state;
      if (!state.lastEvaluation.passed) return state;

      const spec = state.mission.debrief.explain;
      let assessment: ReasoningAssessment;
      if (spec !== undefined) {
        // Structured explanation: exact-match items, retries allowed.
        const result = assessExplain(spec, state.explainAnswers);
        if (!result.passed) {
          const failed = Object.keys(result.wrong).length > 0;
          return {
            ...state,
            explainFeedback: result,
            explainFailures: failed ? state.explainFailures + 1 : state.explainFailures,
          };
        }
        assessment = {
          score: explainScore(state.explainFailures),
          matchedMechanism: true,
          matchedObjective: true,
          matchedCost: true,
          tooShort: false,
          restatesResult: false,
        };
      } else {
        assessment = assessReasoning(state.mission, state.reasoning);
        if (assessment.score < REASONING_MIN_SCORE) {
          return { ...state, assessment };
        }
      }

      const completedAt = action.now;
      const evidence = buildEvidenceEvents(state.mission, state.lastEvaluation.report, {
        at: completedAt,
        reasoningScore: assessment.score,
        attempts: state.attempts,
        hintsUsed: state.hintsUsed,
        maxHintLevel: state.maxHintLevel,
        solutionRevealed: false,
        strategySubmitted: state.strategy.length > 0,
        actualMs: state.lastEvaluation.durationMs,
      });

      return {
        ...state,
        assessment,
        explainFeedback: null,
        evidence,
        completedAt,
        phase: 'complete',
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Snapshot: what survives a reload. Everything except the editor buffer.
// ---------------------------------------------------------------------------

export interface SessionSnapshot {
  schemaVersion: 1;
  missionId: string;
  phase: SessionPhase;
  /** Absent in snapshots saved before step navigation existed. */
  furthestPhase?: StepPhase;
  strategy: string;
  attempts: number;
  hintsUsed: number;
  maxHintLevel: 0 | HintLevel;
  hintLevel: number;
  hint: SelectedHint | null;
  lastEvaluation: RunEvaluation | null;
  debriefComplexityIndex: number | null;
  reasoning: string;
  assessment: ReasoningAssessment | null;
  /** Optional: snapshots written before the structured explanation have none. */
  explainAnswers?: ExplainAnswers;
  explainFailures?: number;
  explainNote?: string;
  explainFeedback?: ExplainAssessment | null;
  evidence: EvidenceEvent[];
  completedAt: number | null;
}

export function toSnapshot(state: MissionSessionState): SessionSnapshot {
  return {
    schemaVersion: 1,
    missionId: state.mission.id,
    phase: state.phase,
    furthestPhase: state.furthestPhase,
    strategy: state.strategy,
    attempts: state.attempts,
    hintsUsed: state.hintsUsed,
    maxHintLevel: state.maxHintLevel,
    hintLevel: state.hintLevel,
    hint: state.hint,
    lastEvaluation: state.lastEvaluation,
    debriefComplexityIndex: state.debriefComplexityIndex,
    reasoning: state.reasoning,
    assessment: state.assessment,
    explainAnswers: state.explainAnswers,
    explainFailures: state.explainFailures,
    explainNote: state.explainNote,
    explainFeedback: state.explainFeedback,
    evidence: state.evidence,
    completedAt: state.completedAt,
  };
}

/**
 * Restore a session, or return null when the snapshot does not belong to this
 * mission. `previousSource` is intentionally null: the source was not persisted,
 * so claiming "the code changed" or "did not change" would be a guess.
 */
export function restoreSession(
  mission: Mission,
  snapshot: SessionSnapshot | null,
): MissionSessionState | null {
  if (snapshot === null || snapshot.missionId !== mission.id) return null;
  if (snapshot.phase === 'complete' && snapshot.completedAt === null) return null;

  // Never behind the current phase, and never an unknown value: older
  // snapshots simply treat the current phase as the furthest.
  const current = toStepPhase(snapshot.phase);
  const furthestPhase =
    isStepPhase(snapshot.furthestPhase) && stepRank(snapshot.furthestPhase) > stepRank(current)
      ? snapshot.furthestPhase
      : current;

  return {
    mission,
    phase: snapshot.phase,
    furthestPhase,
    source: mission.starterCode,
    strategy: snapshot.strategy,
    attempts: snapshot.attempts,
    hintsUsed: snapshot.hintsUsed,
    maxHintLevel: snapshot.maxHintLevel,
    hintLevel: snapshot.hintLevel,
    running: false,
    lastEvaluation: snapshot.lastEvaluation,
    previousSource: null,
    debriefComplexityIndex: snapshot.debriefComplexityIndex,
    reasoning: snapshot.reasoning,
    assessment: snapshot.assessment,
    explainAnswers: snapshot.explainAnswers ?? { blanks: {}, questions: {} },
    explainFailures: snapshot.explainFailures ?? 0,
    explainNote: snapshot.explainNote ?? '',
    explainFeedback: snapshot.explainFeedback ?? null,
    evidence: snapshot.evidence,
    completedAt: snapshot.completedAt,
    // Snapshots written before M3 have no modality. Defaulting to `prose` is
    // the honest reading: that is what the panel actually showed.
    hint:
      snapshot.hint === null
        ? null
        : { ...snapshot.hint, modality: snapshot.hint.modality ?? 'prose' },
  };
}

/** Convenience for the mentor card: the code of the last run, if any. */
export function lastDiagnosisCode(state: MissionSessionState): DiagnosisCode | null {
  return state.lastEvaluation?.diagnosis?.code ?? null;
}

/** Convenience for the test panel: the visible subset of a report. */
export function visibleResults(report: TestReport) {
  return report.results.filter((result) => result.group === 'visible');
}
