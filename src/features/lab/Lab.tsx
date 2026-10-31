/**
 * S4 — Lab (docs/06-ux-flows.md §6).
 *
 * Left the code, right the truth. No modal, no hidden results, no red for a
 * failed test. The run button is the only primary action.
 */

import type { MissionSessionState } from '../../domain/session/mission-session';
import type { ConsoleReport } from '../../domain/execution/console';
import { ConsolePanel } from './ConsolePanel';
import { Editor } from './Editor';
import { MentorPanel } from './MentorPanel';
import { TestPanel } from './TestPanel';

interface LabProps {
  state: MissionSessionState;
  /** Console output of the last run, already limited to visible tests. */
  consoleReport: ConsoleReport | null;
  onClearConsole: () => void;
  onEditSource: (source: string) => void;
  onRun: () => void;
  onRequestHint: () => void;
  onOpenDebrief: () => void;
}

export function Lab({
  state,
  consoleReport,
  onClearConsole,
  onEditSource,
  onRun,
  onRequestHint,
  onOpenDebrief,
}: LabProps) {
  const { mission, lastEvaluation } = state;
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
          />
        </section>

        <aside className="lab__panel" aria-live="polite">
          <TestPanel report={lastEvaluation?.report ?? null} running={state.running} />
          <ConsolePanel report={consoleReport} labels={consoleLabels} onClear={onClearConsole} />
          <MentorPanel
            state={state}
            onRequestHint={onRequestHint}
            onOpenDebrief={onOpenDebrief}
          />
        </aside>
      </div>

      <p className="lab__note">
        El laboratorio necesita una pantalla de al menos 900 px. En una pantalla menor, el mapa y
        el informe siguen funcionando.
      </p>
    </div>
  );
}
