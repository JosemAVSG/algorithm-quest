/**
 * Mentor panel (docs/04-mentor.md §1, §9).
 *
 * The card is automatic and carries the evidence plus exactly one next action.
 * The hint is requested, one rung at a time. They are separate on purpose: a card
 * that also contained a hint would make `hintsUsed` a guess.
 *
 * This panel has no way to say "passed": the verdict comes from the test report,
 * which is passed in separately. That is the type-level guarantee from
 * docs/07 §5, enforced by not giving this component a pass/fail prop at all.
 */

import { describeDiagnosis } from '../../domain/diagnosis/hints';
import { renderValue } from '../../domain/evaluation/test-engine';
import type { MissionSessionState } from '../../domain/session/mission-session';
import { canOpenDebrief, canRequestHint } from '../../domain/session/mission-session';

interface MentorPanelProps {
  state: MissionSessionState;
  onRequestHint: () => void;
  onOpenDebrief: () => void;
}

export function MentorPanel({ state, onRequestHint, onOpenDebrief }: MentorPanelProps) {
  const evaluation = state.lastEvaluation;

  if (state.running) {
    return (
      <section className="mentor" aria-label="Mentor">
        <h2>Mentor</h2>
        <p className="mentor__idle">Ejecutando…</p>
      </section>
    );
  }

  if (evaluation === null) {
    return (
      <section className="mentor" aria-label="Mentor">
        <h2>Mentor</h2>
        <p className="mentor__idle">Ejecuta para ver el diagnóstico.</p>
      </section>
    );
  }

  // A harness fault is not the player's mistake (docs/04 §8, docs/10 §7). No
  // diagnosis, no hint, no accusation — just the truth that it is our problem.
  if (evaluation.diagnosis === null) {
    return (
      <section className="mentor" aria-label="Mentor">
        <h2>Mentor</h2>
        <p className="mentor__headline">El taller falló al ejecutar tu código.</p>
        <p className="mentor__detail">
          No es tu culpa y no cuenta como intento contra ti. Vuelve a ejecutar; si sigue
          pasando, avisa.
        </p>
      </section>
    );
  }

  const card = describeDiagnosis(evaluation.diagnosis);

  if (evaluation.passed) {
    return (
      <section className="mentor mentor--clear" aria-label="Mentor">
        <h2>Mentor</h2>
        <p className="mentor__headline">Las pruebas pasan.</p>
        <p className="mentor__detail">
          Antes de cerrar la misión, explica por qué tu solución funciona.
        </p>
        {canOpenDebrief(state) ? (
          <button type="button" className="btn btn--primary" onClick={onOpenDebrief}>
            Abrir el informe →
          </button>
        ) : null}
      </section>
    );
  }

  const failingVisible = evaluation.report.results
    .filter((result) => result.group === 'visible' && result.status !== 'pass')
    .map((result) => result.label);

  return (
    <section className="mentor mentor--amber" aria-label="Mentor" data-code={card.code}>
      <h2>Mentor</h2>
      <p className="mentor__headline">{card.headline}</p>

      {card.detail !== '' ? <p className="mentor__detail">{card.detail}</p> : null}

      {card.detail === '' ? (
        <p className="mentor__detail">
          {failingVisible.length > 0
            ? `Falla: ${failingVisible.join(' · ')}.`
            : 'Falla un caso del sistema que no ves. El valor que devuelves no coincide con el esperado.'}
        </p>
      ) : null}

      {card.canRequestHint && canRequestHint(state) ? (
        <button type="button" className="btn btn--ghost" onClick={onRequestHint}>
          {state.hint === null ? 'Ver pista' : 'Siguiente pista'}
        </button>
      ) : null}

      {state.hint !== null ? (
        <div className="hint" data-modality={state.hint.modality}>
          <p className="hint__level">
            Pista {state.hint.level} de 4
            {state.hint.modality === 'smaller_input' ? ' · caso más pequeño' : ''}
            {state.hint.modality === 'worked_variant' ? ' · ejemplo parecido' : ''}
          </p>
          <p className="hint__text">{state.hint.text}</p>

          {state.hint.modality === 'smaller_input' &&
          evaluation.diagnosis.evidence.input !== undefined ? (
            <dl className="hint__case">
              <dt>Entrada</dt>
              <dd>
                <code>
                  {evaluation.diagnosis.evidence.input.map(renderValue).join(', ')}
                </code>
              </dd>
              <dt>Esperado</dt>
              <dd>
                <code>{renderValue(evaluation.diagnosis.evidence.expected)}</code>
              </dd>
              <dt>Tu resultado</dt>
              <dd>
                <code>{renderValue(evaluation.diagnosis.evidence.actual)}</code>
              </dd>
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
