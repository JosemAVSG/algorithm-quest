/**
 * Test panel (docs/06-ux-flows.md §6).
 *
 * Left: code. Right: truth. Always visible, never a modal. Only the visible
 * group is listed: hidden and edge cases are where the mission's lesson lives,
 * and showing them would turn reasoning into copying (docs/missions/M01.md §5).
 *
 * A failed test is rendered in neutral colour with an icon, not in red. Red
 * belongs to the workshop.
 */

import type { RunCost } from '../../domain/evaluation/evaluate-run';
import type { TestReport } from '../../domain/evaluation/test-engine';
import { renderValue } from '../../domain/evaluation/test-engine';
import { splitAtFirstDifference } from './diffText';

interface TestPanelProps {
  report: TestReport | null;
  running: boolean;
  /** What the last run cost in steps (D13), when it was measured. */
  cost?: RunCost | null;
}

const steps = (value: number) => value.toLocaleString('es');

/** The text with its first difference marked (underline and weight, not colour alone). */
function Marked({ text, other }: { text: string; other: string }) {
  const { same, rest } = splitAtFirstDifference(text, other);
  return (
    <code>
      {same}
      {rest === '' ? null : <mark className="diff__mark">{rest}</mark>}
    </code>
  );
}

export function TestPanel({ report, running, cost = null }: TestPanelProps) {
  const visible = report?.results.filter((result) => result.group === 'visible') ?? [];
  const passed = visible.filter((result) => result.status === 'pass').length;

  return (
    <section className="tests" aria-label="Pruebas visibles">
      <header className="tests__header">
        <h2>Pruebas</h2>
        <span className="tests__count" aria-label={`${passed} de ${visible.length} pruebas pasan`}>
          {report === null ? '—' : `${passed}/${visible.length}`}
        </span>
      </header>

      {running ? <p className="tests__idle">Ejecutando…</p> : null}

      {report === null && !running ? (
        <p className="tests__idle">Ejecuta para ver las pruebas.</p>
      ) : null}

      <ul className="tests__list">
        {visible.map((result) => (
          <li key={result.testId} className={`test test--${result.status}`}>
            <span className="test__icon" aria-hidden="true">
              {result.status === 'pass'
                ? '✓'
                : result.status === 'fail'
                  ? '✕'
                  : result.status === 'error'
                    ? '!'
                    : '·'}
            </span>
            <span className="test__body">
              <span className="test__label">{result.label}</span>
              <span className="test__status">
                {result.status === 'pass'
                  ? 'pasa'
                  : result.status === 'fail'
                    ? 'falla'
                    : result.status === 'error'
                      ? 'error'
                      : 'sin ejecutar'}
              </span>

              {result.status === 'fail' ? (
                <span className="diff">
                  <span className="diff__row">
                    <span className="diff__key">entrada</span>
                    <code>{result.input.map(renderValue).join(', ')}</code>
                  </span>
                  <span className="diff__row">
                    <span className="diff__key">esperado</span>
                    <Marked text={renderValue(result.expected)} other={renderValue(result.actual)} />
                  </span>
                  <span className="diff__row">
                    <span className="diff__key">obtenido</span>
                    <Marked text={renderValue(result.actual)} other={renderValue(result.expected)} />
                  </span>
                </span>
              ) : null}

              {result.status === 'error' && result.message !== undefined ? (
                <span className="test__message">{result.message}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {cost !== null ? (
        <p
          className={`tests__cost${cost.over ? ' tests__cost--over' : ''}`}
          data-over={cost.over}
        >
          Coste del caso más grande: {steps(cost.maxOps)} pasos
          {cost.budget !== null ? ` · presupuesto ${steps(cost.budget)}` : ''}
        </p>
      ) : null}

      {report !== null && report.counts.visible.passed === report.counts.visible.total && !report.allPassed ? (
        <p className="tests__note">
          Las pruebas visibles pasan. El sistema todavía tiene casos que no ves.
        </p>
      ) : null}
    </section>
  );
}
