/**
 * S4 — Lab (docs/06-ux-flows.md §6).
 *
 * Left the code, right the truth. No modal, no hidden results, no red for a
 * failed test. The run button is the only primary action.
 */

import { useEffect, useState, type ReactNode } from 'react';

import type { MissionSessionState } from '../../domain/session/mission-session';
import type { ConsoleReport } from '../../domain/execution/console';
import { ConsolePanel } from './ConsolePanel';
import { Editor } from './Editor';
import { MentorPanel } from './MentorPanel';
import { TestPanel } from './TestPanel';
import { TracePanel, type TraceView } from './TracePanel';

interface LabProps {
  state: MissionSessionState;
  /** The briefing illustration, shown compact above the test panel. */
  illustration?: ReactNode;
  /** Console output of the last run, already limited to visible tests. */
  consoleReport: ConsoleReport | null;
  onClearConsole: () => void;
  onEditSource: (source: string) => void;
  onRun: () => void;
  onRequestHint: () => void;
  onOpenDebrief: () => void;
  /** Present only when the execution adapter can run a case step by step. */
  onTrace?: (testId: string) => void;
  traceView?: TraceView | null;
  onCloseTrace?: () => void;
}

export function Lab({
  state,
  illustration = null,
  consoleReport,
  onClearConsole,
  onEditSource,
  onRun,
  onRequestHint,
  onOpenDebrief,
  onTrace,
  traceView = null,
  onCloseTrace = () => {},
}: LabProps) {
  const { mission, lastEvaluation } = state;

  // The step the trace is showing. UI state only; a new trace starts at its first step.
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [traceView?.testId, traceView?.outcome === 'running']);
  const traced =
    traceView !== null && traceView.outcome !== 'running' && traceView.outcome.kind === 'traced'
      ? traceView.outcome
      : null;
  const markedLine = traced === null ? null : (traced.steps[Math.min(step, traced.steps.length - 1)]?.line ?? null);
  const visibleResults = new Map(
    (lastEvaluation?.report.results ?? [])
      .filter((result) => result.group === 'visible')
      .map((result) => [result.testId, result.status]),
  );
  const consoleLabels = Object.fromEntries(
    mission.tests.visible.map((testCase) => [testCase.id, testCase.note ?? testCase.id]),
  );

  return (
    <div className="lab">
      <header className="lab__bar">
        <div>
          <p className="eyebrow">
            {mission.id} · Laboratorio
          </p>
          <h1>{mission.title}</h1>
        </div>
        <div className="lab__meta">
          <span className="lab__counter">intentos {state.attempts}</span>
          <span className="lab__counter">pistas {state.hintsUsed}</span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRun}
            disabled={state.running}
          >
            {state.running ? 'Ejecutando…' : 'Ejecutar'}
          </button>
        </div>
      </header>

      <p className="lab__contract">
        <code>{mission.contract.signature}</code>
      </p>

      <div className="lab__grid">
        <div className="lab__left">
          <section className="lab__code" aria-label="Editor de código">
            <div className="code__head">
              <span>{mission.contract.entryPoint}</span>
              <span className="code__hint">Cmd/Ctrl + Enter · Esc y Tab para salir</span>
            </div>
            <Editor
              value={state.source}
              onChange={onEditSource}
              onRun={onRun}
              disabled={state.running}
              highlightLine={markedLine}
            />
          </section>

          {onTrace === undefined ? null : (
            <TracePanel
              tests={mission.tests.visible.map((testCase) => ({
                id: testCase.id,
                label: testCase.note ?? testCase.id,
                status: visibleResults.get(testCase.id) ?? 'not_run',
              }))}
              view={traceView}
              step={step}
              onStep={setStep}
              onTrace={onTrace}
              onClose={onCloseTrace}
            />
          )}
        </div>

        <aside className="lab__panel" aria-live="polite">
          {illustration === null ? null : <div className="lab__visual">{illustration}</div>}
          <TestPanel
            report={lastEvaluation?.report ?? null}
            running={state.running}
            cost={lastEvaluation?.cost ?? null}
          />
          <MentorPanel
            state={state}
            onRequestHint={onRequestHint}
            onOpenDebrief={onOpenDebrief}
          />
          <ConsolePanel report={consoleReport} labels={consoleLabels} onClear={onClearConsole} />
        </aside>
      </div>
    </div>
  );
}
