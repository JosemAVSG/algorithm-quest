/**
 * S4 — Lab (docs/06-ux-flows.md §6).
 *
 * Left the code, right the truth. No modal, no hidden results, no red for a
 * failed test. The run button is the only primary action.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { canOpenDebrief, type MissionSessionState } from '../../domain/session/mission-session';
import type { ConsoleReport } from '../../domain/execution/console';
import { ConsolePanel } from './ConsolePanel';
import { Editor } from './Editor';
import { MentorPanel } from './MentorPanel';
import { currentRunShortcut } from './shortcut';
import { SymbolBar } from './SymbolBar';
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

type EditorTab = 'code' | 'trace';
const TABS: { id: EditorTab; label: string }[] = [
  { id: 'code', label: 'Código' },
  { id: 'trace', label: 'Paso a paso' },
];

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
  const insertRef = useRef<((text: string) => void) | null>(null);
  const [tab, setTab] = useState<EditorTab>('code');
  const tabRefs = useRef<Record<EditorTab, HTMLButtonElement | null>>({ code: null, trace: null });
  const shortcut = currentRunShortcut();
  const hasTrace = onTrace !== undefined;
  const activeTab: EditorTab = hasTrace ? tab : 'code';
  const cleared =
    !state.running &&
    lastEvaluation?.passed === true &&
    lastEvaluation.diagnosis !== null &&
    canOpenDebrief(state);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = TABS.findIndex((entry) => entry.id === activeTab);
    const next =
      event.key === 'ArrowRight'
        ? (at + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (at - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : -1;
    if (next === -1) return;
    event.preventDefault();
    const target = TABS[next]!.id;
    setTab(target);
    tabRefs.current[target]?.focus();
  };

  const runButton = (className: string) => (
    <button
      type="button"
      className={`btn btn--primary ${className}`}
      onClick={onRun}
      disabled={state.running}
      aria-keyshortcuts="Control+Enter Meta+Enter"
    >
      {state.running ? 'Ejecutando…' : 'Ejecutar'}
    </button>
  );

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
          {/* Only shown on narrow screens, where this bar is sticky and the editor bar scrolls away. */}
          {runButton('lab__run lab__run--sticky')}
        </div>
      </header>

      {cleared ? (
        <section className="lab__success" role="status" aria-label="Pruebas superadas">
          <p className="lab__success-title">¡Las pruebas pasan!</p>
          <button type="button" className="btn btn--primary" onClick={onOpenDebrief}>
            Abrir el informe →
          </button>
        </section>
      ) : null}

      <p className="lab__contract">
        <code>{mission.contract.signature}</code>
      </p>

      <div className="lab__grid">
        <div className="lab__left">
          <section className="lab__code" aria-label="Editor de código">
            <div className="code__head">
              <span className="code__fn">{mission.contract.entryPoint}</span>
              {hasTrace ? (
                <div className="code__tabs" role="tablist" aria-label="Vista del editor">
                  {TABS.map((entry) => (
                    <button
                      key={entry.id}
                      ref={(node) => {
                        tabRefs.current[entry.id] = node;
                      }}
                      type="button"
                      role="tab"
                      id={`lab-tab-${entry.id}`}
                      aria-selected={activeTab === entry.id}
                      aria-controls={`lab-panel-${entry.id}`}
                      tabIndex={activeTab === entry.id ? 0 : -1}
                      className="code__tab"
                      onClick={() => setTab(entry.id)}
                      onKeyDown={onTabKey}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="code__run">
                <kbd className="code__kbd" aria-hidden="true">
                  {shortcut}
                </kbd>
                {runButton('lab__run lab__run--editor')}
              </span>
            </div>
            <div
              role={hasTrace ? 'tabpanel' : undefined}
              id="lab-panel-code"
              aria-labelledby={hasTrace ? 'lab-tab-code' : undefined}
              hidden={activeTab !== 'code'}
            >
              <Editor
                value={state.source}
                onChange={onEditSource}
                onRun={onRun}
                disabled={state.running}
                highlightLine={markedLine}
                onReady={(insert) => {
                  insertRef.current = insert;
                }}
              />
              <SymbolBar disabled={state.running} onInsert={(text) => insertRef.current?.(text)} />
              <p className="code__hint">Esc y Tab para salir del editor</p>
            </div>
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
                source={state.source}
                tabId="lab-tab-trace"
                panelId="lab-panel-trace"
                hidden={activeTab !== 'trace'}
              />
            )}
          </section>
        </div>

        <aside className="lab__panel" aria-live="polite">
          <TestPanel
            report={lastEvaluation?.report ?? null}
            running={state.running}
            cost={lastEvaluation?.cost ?? null}
          />
          <MentorPanel state={state} onRequestHint={onRequestHint} />
          <ConsolePanel report={consoleReport} labels={consoleLabels} onClear={onClearConsole} />
          {/* Below the verdict: the picture must not push the tests off the first screen. */}
          {illustration === null ? null : <div className="lab__visual">{illustration}</div>}
        </aside>
      </div>
    </div>
  );
}
