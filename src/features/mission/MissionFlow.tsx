/**
 * The mission stepper (S2–S5), one screen at a time.
 *
 * The flow owns the `useReducer` session, the reload snapshot and the run
 * handler. Screens stay presentational: they receive state and callbacks, never
 * an adapter. The composition root injected the execution port.
 */

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { timeoutFor } from "../../adapters/execution/worker/runner";
import type { Mission } from "../../domain/content/schema";
import { evaluateRun } from "../../domain/evaluation/evaluate-run";
import { executionCases, probeSettings } from "../../domain/evaluation/cases";
import { onlyVisibleOutput, type ConsoleReport } from "../../domain/execution/console";
import type { ExecutionPort } from "../../domain/execution/port";
import type {
  CompletedMissionRecord,
  SessionStore,
} from "../../domain/persistence/port";
import {
  allTestsPassed,
  createMissionSession,
  missionSessionReducer,
  restoreSession,
  toSnapshot,
  type SessionPhase,
  type SessionSnapshot,
  type StepPhase,
} from "../../domain/session/mission-session";
import { Briefing } from "../briefing/Briefing";
import { BriefingVisual } from "../briefing/BriefingVisual";
import { Debrief } from "../debrief/Debrief";
import { Lab } from "../lab/Lab";
import { Strategy } from "../strategy/Strategy";

const STEPS: Array<{ phase: StepPhase; label: string }> = [
  { phase: "briefing", label: "Briefing" },
  { phase: "strategy", label: "Estrategia" },
  { phase: "lab", label: "Laboratorio" },
  { phase: "debrief", label: "Informe" },
];

function stepIndex(phase: SessionPhase): number {
  if (phase === "complete") return STEPS.length;
  return STEPS.findIndex((step) => step.phase === phase);
}

/**
 * Content with the briefing illustration beside it. Without an illustration it
 * renders the content alone, exactly as before (no empty column).
 */
function SideBySide({
  visual,
  children,
}: {
  visual: ReactNode;
  children: ReactNode;
}) {
  if (visual === null) return <>{children}</>;
  return (
    <div className="split">
      <div className="split__main">{children}</div>
      <aside className="split__aside" aria-label="Ilustración del problema">
        {visual}
      </aside>
    </div>
  );
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

  // Console output of the last run only. Lab-local on purpose: it is never
  // saved, never reloaded and never read by the evaluation.
  const [consoleReport, setConsoleReport] = useState<ConsoleReport | null>(null);

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
    setConsoleReport(null);
    let captured: ConsoleReport | null = null;

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
      onConsole: (report) => {
        captured = report;
      },
    });
    setConsoleReport(
      captured === null
        ? null
        : onlyVisibleOutput(captured, new Set(mission.tests.visible.map((test) => test.id))),
    );

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
  const visual = mission.briefing.visual ? (
    <BriefingVisual id={mission.briefing.visual} />
  ) : null;

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
            const reached =
              state.phase !== "complete" &&
              index <= stepIndex(state.furthestPhase) &&
              // The debrief stays locked while the tests do not pass.
              (step.phase !== "debrief" || allTestsPassed(state));
            const isCurrent = status === "current";
            return (
              <li key={step.phase} className={`rail__step rail__step--${status}`}>
                <button
                  type="button"
                  className="rail__button"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={isCurrent ? undefined : `Ir a ${step.label}`}
                  disabled={!reached || isCurrent}
                  title={
                    reached || isCurrent
                      ? undefined
                      : state.phase === "complete"
                        ? "La misión ya está cerrada"
                        : "Aún no llegas aquí"
                  }
                  onClick={() => dispatch({ type: "go_to_phase", phase: step.phase })}
                >
                  <span className="rail__dot" aria-hidden="true" />
                  <span className="rail__label">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="mission__screen">
        {state.phase === "briefing" ? (
          <Briefing
            mission={mission}
            onContinue={() => dispatch({ type: "open_strategy" })}
          />
        ) : null}

        {state.phase === "strategy" ? (
          <SideBySide visual={visual}>
            <Strategy
              initialValue={state.strategy}
              onSubmit={(text) => dispatch({ type: "submit_strategy", text })}
            />
          </SideBySide>
        ) : null}

        {state.phase === "lab" ? (
          <Lab
            state={state}
            illustration={visual}
            consoleReport={consoleReport}
            onClearConsole={() => setConsoleReport(null)}
            onEditSource={(source) => dispatch({ type: "edit_source", source })}
            onRun={() => {
              void run();
            }}
            onRequestHint={() => dispatch({ type: "request_hint" })}
            onOpenDebrief={() => dispatch({ type: "open_debrief" })}
          />
        ) : null}

        {state.phase === "debrief" || state.phase === "complete" ? (
          <SideBySide visual={visual}>
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
          </SideBySide>
        ) : null}
      </main>
    </div>
  );
}
