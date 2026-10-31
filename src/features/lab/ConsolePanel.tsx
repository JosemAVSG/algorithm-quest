/**
 * Console panel: what the player's `console.log` printed in the last run.
 *
 * Only lines from visible tests arrive here (docs/08 §6). Each one carries the
 * id of the test that produced it, so the player can tell "v2" from "v3".
 * Hidden-case output is reduced to one content-free line; text is rendered as
 * text, never as markup.
 */

import type { ConsoleReport } from '../../domain/execution/console';

interface ConsolePanelProps {
  report: ConsoleReport | null;
  /** Visible test id → its human note, shown as a tooltip on the line label. */
  labels: Readonly<Record<string, string>>;
  onClear: () => void;
}

export function ConsolePanel({ report, labels, onClear }: ConsolePanelProps) {
  const entries = report?.entries ?? [];
  const isEmpty = entries.length === 0 && report?.hiddenOutput !== true;

  return (
    <section className="console" aria-label="Consola">
      <header className="console__header">
        <h2>Consola</h2>
        <button
          type="button"
          className="btn btn--link console__clear"
          onClick={onClear}
          disabled={report === null}
        >
          Limpiar
        </button>
      </header>

      {isEmpty ? (
        <p className="console__empty">Aquí aparece lo que imprimas con console.log</p>
      ) : (
        <ol className="console__list" aria-live="off">
          {entries.map((entry, index) => (
            <li key={index} className={`console__line console__line--${entry.level}`}>
              <span
                className="console__source"
                title={entry.testId === null ? undefined : labels[entry.testId]}
              >
                {entry.testId ?? 'inicio'}
              </span>
              <span className="console__level">{entry.level}</span>
              <span className="console__text">{entry.text}</span>
            </li>
          ))}
        </ol>
      )}

      {report?.truncated === true ? (
        <p className="console__note">Salida recortada: se alcanzó el límite de la consola.</p>
      ) : null}
      {report?.hiddenOutput === true ? (
        <p className="console__note console__note--dim">
          También hubo salida en pruebas ocultas (no se muestra).
        </p>
      ) : null}
    </section>
  );
}
