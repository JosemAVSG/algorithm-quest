/**
 * The mission stepper (S2–S5), one screen at a time.
 *
 * The flow owns the `useReducer` session, the reload snapshot and the run
 * handler. Screens stay presentational: they receive state and callbacks, never
 * an adapter. The composition root injected the execution port.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";

import { timeoutFor } from "../../adapters/execution/worker/runner";
import type { Mission } from "../../domain/content/schema";
import { evaluateRun } from "../../domain/evaluation/evaluate-run";
import { executionCases, probeSettings } from "../../domain/evaluation/cases";
import type { ExecutionPort } from "../../domain/execution/port";
import type {
  CompletedMissionRecord,
  SessionStore,
} from "../../domain/persistence/port";
import {
  createMissionSession,
  missionSessionReducer,
  restoreSession,
  toSnapshot,
  type SessionPhase,
  type SessionSnapshot,
} from "../../domain/session/mission-session";
import { Briefing } from "../briefing/Briefing";
import { BriefingVisual } from "../briefing/BriefingVisual";
import { Debrief } from "../debrief/Debrief";
import { Lab } from "../lab/Lab";
import { Strategy } from "../strategy/Strategy";

const STEPS: Array<{ phase: SessionPhase; label: string }> = [
  { phase: "briefing", label: "Briefing" },
  { phase: "strategy", label: "Estrategia" },
  { phase: "lab", label: "Laboratorio" },
  { phase: "debrief", label: "Informe" },
];

function stepIndex(phase: SessionPhase): number {
  if (phase === "complete") return STEPS.length;
  return STEPS.findIndex((step) => step.phase === phase);
}

interface MissionFlowProps {
  mission: Mission;
  initialSnapshot: SessionSnapshot | null;
  execution: ExecutionPort;
  sessions: SessionStore;
  onCompleted: (record: CompletedMissionRecord) => void;
  onExit: () => void;
}

export function MissionFlow({
  mission,
  initialSnapshot,
  execution,
  sessions,
  onCompleted,
  onExit,
}: MissionFlowProps) {
  const [state, dispatch] = useReducer(
    missionSessionReducer,
    undefined,
    () =>
      restoreSession(mission, initialSnapshot) ?? createMissionSession(mission),
  );

  const savedRef = useRef<string>("");
  useEffect(() => {
    if (state.phase === "complete") {
      sessions.clear(mission.id);
      return;
    }
    const snapshot = toSnapshot(state);
    const serialized = JSON.stringify(snapshot);
    if (serialized === savedRef.current) return;
    savedRef.current = serialized;
    sessions.save(snapshot);
  }, [state, mission.id, sessions]);

  const completedRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase !== "complete" || state.completedAt === null) return;
    const key = `${mission.id}:${state.completedAt}`;
    if (completedRef.current === key) return;
    completedRef.current = key;
    onCompleted({
      missionId: mission.id,
      completedAt: state.completedAt,
      attempts: state.attempts,
      hintsUsed: state.hintsUsed,
      reasoningScore: state.assessment?.score ?? 0,
      evidence: state.evidence,
    });
  }, [state, mission.id, onCompleted]);

  const run = useCallback(async () => {
    if (state.phase !== "lab" || state.running) return;

    const source = state.source;
    dispatch({ type: "run_started" });

    const efficiency = mission.constraints.efficiency;
    const outcome = await execution.execute({
      code: source,
      entryPoint: mission.contract.entryPoint,
      cases: executionCases(mission),
      timeoutMs: timeoutFor({
        ...(efficiency?.enforced === undefined
          ? {}
          : { enforced: efficiency.enforced }),
      }),
      ...(efficiency === undefined
        ? {}
        : {
            budgetMs: efficiency.budgetMs,
            enforced: efficiency.enforced,
            ...(efficiency.operationBudget === undefined
              ? {}
              : { operationBudget: efficiency.operationBudget }),
          }),
      probes: probeSettings(mission),
    });

    const evaluation = evaluateRun({
      mission,
      outcome,
      source,
      attempt: state.attempts + 1,
      codeChanged:
        state.previousSource === null ? true : state.previousSource !== source,
      ...(state.lastEvaluation?.primaryCode == null
        ? {}
        : { previousCode: state.lastEvaluation.primaryCode }),
      previousHadHint: state.hint !== null,
    });

    if (evaluation.internalError !== null) {
      // Loud on purpose (docs/04 §8): a harness fault must page a developer,
      // not be rewritten as something the player did.
      console.error("[execution] harness failure", evaluation.internalError);
    }

    dispatch({ type: "run_finished", source, evaluation });
  }, [execution, mission, state]);

  const currentStep = stepIndex(state.phase);

  return (
    <div className="mission">
      <header className="mission__bar">
        <button type="button" className="btn btn--link" onClick={onExit}>
          ← Taller
        </button>
        <p className="mission__id">
          {mission.id} · {mission.subtitle}
        </p>
      </header>

      <nav className="rail" aria-label="Pasos de la misión">
        <ol>
          {STEPS.map((step, index) => {
            const status =
              index < currentStep
                ? "done"
                : index === currentStep
                  ? "current"
                  : "todo";
            return (
              <li
                key={step.phase}
                className={`rail__step rail__step--${status}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span className="rail__dot" aria-hidden="true" />
                <span className="rail__label">{step.label}</span>
              </li>
            );
          })}
        </ol>

        {state.phase !== "briefing" ? (
          <details className="rail__brief">
            <summary>Volver a leer el briefing</summary>
            <p>{mission.briefing.body}</p>
            <p className="rail__signature">
              <code>{mission.contract.signature}</code>
            </p>
          </details>
        ) : null}

        {state.phase !== "briefing" && mission.briefing.visual ? (
          <details className="rail__visual" open>
            <summary>Ilustración del problema</summary>
            <BriefingVisual id={mission.briefing.visual} />
          </details>
        ) : null}
      </nav>

      <main className="mission__screen">
        {state.phase === "briefing" ? (
          <Briefing
            mission={mission}
            onContinue={() => dispatch({ type: "open_strategy" })}
          />
        ) : null}

        {state.phase === "strategy" ? (
          <Strategy
            initialValue={state.strategy}
            onSubmit={(text) => dispatch({ type: "submit_strategy", text })}
          />
        ) : null}

        {state.phase === "lab" ? (
          <Lab
            state={state}
            onEditSource={(source) => dispatch({ type: "edit_source", source })}
            onRun={() => {
              void run();
            }}
            onRequestHint={() => dispatch({ type: "request_hint" })}
            onOpenDebrief={() => dispatch({ type: "open_debrief" })}
          />
        ) : null}

        {state.phase === "debrief" || state.phase === "complete" ? (
          <Debrief
            state={state}
            onAnswerComplexity={(index) =>
              dispatch({ type: "answer_complexity", index })
            }
            onEditReasoning={(text) =>
              dispatch({ type: "edit_reasoning", text })
            }
            onSubmit={() =>
              dispatch({ type: "submit_debrief", now: Date.now() })
            }
            onFinish={onExit}
          />
        ) : null}
      </main>
    </div>
  );
}
