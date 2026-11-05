/**
 * "Paso a paso": one visible case, run with the variables of every step shown
 * (docs/04 §5). It never says whether the code is right: it shows what the
 * program held at each moment, so the player can see *where* it stopped doing
 * what they meant. The tests stay the only judge.
 */

import type { TraceOutcome, TraceStep } from '../../domain/execution/trace';
import { renderPreview } from '../../domain/execution/preview';

export interface TraceView {
  testId: string;
  label: string;
  outcome: TraceOutcome | 'running';
}

interface TracePanelProps {
  tests: { id: string; label: string; status: string }[];
  view: TraceView | null;
  step: number;
  onStep: (step: number) => void;
  onTrace: (testId: string) => void;
  onClose: () => void;
}

function describeEnd(outcome: Extract<TraceOutcome, { kind: 'traced' }>, steps: number): string {
  const { result } = outcome;
  switch (result.status) {
    case 'returned':
      return `Termina y devuelve ${renderPreview(result.value)}.`;
    case 'threw':
      return `Se detiene con un error${result.line === undefined ? '' : ` en la línea ${result.line}`}: ${result.message}`;
    case 'stopped':
      return result.reason === 'steps'
        ? `Se paró tras ${steps} pasos y el programa seguía. Es lo que ocurre con un bucle que no termina, o con una repetición enorme. Mira qué variables no cambian de un paso a otro.`
        : 'Se paró porque el programa hacía demasiado trabajo para este caso.';
  }
}

function StepView({ step, total, current }: { step: TraceStep; total: number; current: number }) {
  return (
    <>
      <p className="trace__where" aria-live="polite">
        Paso {current + 1} de {total} · línea {step.line}
      </p>
      {step.variables.length === 0 ? (
        <p className="trace__empty">En este punto no hay variables todavía.</p>
      ) : (
        <table className="trace__vars">
          <caption className="sr-only">Variables en este paso</caption>
          <thead>
            <tr>
              <th scope="col">variable</th>
              <th scope="col">valor</th>
            </tr>
          </thead>
          <tbody>
            {step.variables.map((variable) => (
              <tr key={variable.name} className={variable.changed ? 'trace__var--changed' : undefined}>
                <th scope="row">{variable.name}</th>
                <td>
                  <code>{renderPreview(variable.value)}</code>
                  {variable.changed ? <span className="sr-only"> (cambió)</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function TracePanel({ tests, view, step, onStep, onTrace, onClose }: TracePanelProps) {
  const defaultTest = tests.find((test) => test.status !== 'pass') ?? tests[0];
  const selected = view?.testId ?? defaultTest?.id ?? '';

  const outcome = view?.outcome ?? null;
  const traced = outcome !== null && outcome !== 'running' && outcome.kind === 'traced' ? outcome : null;
  const last = traced === null ? 0 : Math.max(traced.steps.length - 1, 0);
  const at = Math.min(step, last);

  return (
    <section className="trace" aria-label="Paso a paso">
      <header className="trace__head">
        <h2>Paso a paso</h2>
        <div className="trace__pick">
          <label className="sr-only" htmlFor="trace-case">
            Caso para ejecutar paso a paso
          </label>
          <select
            id="trace-case"
            value={selected}
            onChange={(event) => onTrace(event.target.value)}
            disabled={outcome === 'running'}
          >
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={outcome === 'running' || selected === ''}
            onClick={() => onTrace(selected)}
          >
            {view === null ? 'Ver paso a paso' : 'Repetir'}
          </button>
          {view === null ? null : (
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cerrar
            </button>
          )}
        </div>
      </header>

      {view === null ? (
        <p className="trace__hint">
          Ejecuta uno de los casos visibles despacio y mira qué valor tiene cada variable en cada
          vuelta.
        </p>
      ) : null}

      {outcome === 'running' ? <p className="trace__hint">Ejecutando paso a paso…</p> : null}

      {outcome !== null && outcome !== 'running' && outcome.kind === 'syntax_error' ? (
        <p className="trace__hint">El código no se puede interpretar todavía: {outcome.message}</p>
      ) : null}
      {outcome !== null && outcome !== 'running' && outcome.kind === 'missing_entry_point' ? (
        <p className="trace__hint">No encuentro una función llamada «{outcome.entryPoint}».</p>
      ) : null}
      {outcome !== null &&
      outcome !== 'running' &&
      (outcome.kind === 'timeout' || outcome.kind === 'internal_error') ? (
        <p className="trace__hint">
          No se pudo seguir la ejecución paso a paso. Puedes volver a intentarlo.
        </p>
      ) : null}

      {traced !== null && traced.steps.length === 0 ? (
        <p className="trace__hint">
          Este código no entra en ningún bucle ni función que se pueda seguir. {describeEnd(traced, 0)}
        </p>
      ) : null}

      {traced !== null && traced.steps.length > 0 ? (
        <>
          <div className="trace__controls">
            <button type="button" className="btn btn--ghost" onClick={() => onStep(0)} disabled={at === 0} aria-label="Primer paso">
              ⏮
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onStep(at - 1)} disabled={at === 0} aria-label="Paso anterior">
              ◀
            </button>
            <input
              type="range"
              min={0}
              max={last}
              value={at}
              onChange={(event) => onStep(Number(event.target.value))}
              aria-label="Paso"
            />
            <button type="button" className="btn btn--ghost" onClick={() => onStep(at + 1)} disabled={at === last} aria-label="Paso siguiente">
              ▶
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onStep(last)} disabled={at === last} aria-label="Último paso">
              ⏭
            </button>
          </div>
          <StepView step={traced.steps[at]!} total={traced.steps.length} current={at} />
          {at === last ? (
            <p className="trace__end" data-status={traced.result.status}>
              {describeEnd(traced, traced.steps.length)}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
