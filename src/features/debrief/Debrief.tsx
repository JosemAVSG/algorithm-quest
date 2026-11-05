/**
 * S5 — Debrief (docs/06-ux-flows.md §7).
 *
 * Four blocks, in order: why it works, edge cases, cost, reasoning. The
 * edge-case and cost answers are deterministic; the reasoning block is the only
 * one that can hold up completion (docs/04-mentor.md §6).
 *
 * No confetti. The debrief is a document, and the reward is the workshop.
 */

import { STATE_LABEL } from '../workshop-map/stateLabels';
import { ExplainBlock } from './ExplainBlock';
import type { MissionSessionState } from '../../domain/session/mission-session';
import { REASONING_MIN_SCORE } from '../../domain/session/mission-session';

interface DebriefProps {
  state: MissionSessionState;
  /** The repaired system's name, from the workshop registry. Falls back to its id. */
  systemName?: string;
  /** The mission the engine would offer next, when there is one. */
  upcoming?: { id: string; title: string } | null;
  onOpenUpcoming?: (missionId: string) => void;
  onAnswerComplexity: (index: number) => void;
  onEditReasoning: (text: string) => void;
  onAnswerExplain: (id: string, index: number) => void;
  onEditExplainNote: (text: string) => void;
  onSubmit: () => void;
  onFinish: () => void;
}

export function Debrief({
  state,
  onAnswerComplexity,
  onEditReasoning,
  onAnswerExplain,
  onEditExplainNote,
  onSubmit,
  onFinish,
  systemName,
  upcoming = null,
  onOpenUpcoming,
}: DebriefProps) {
  const { mission, assessment } = state;
  const debrief = mission.debrief;
  const complexity = mission.debrief.complexity;

  if (state.phase === 'complete') {
    return (
      <div className="complete">
        <p className="eyebrow">Misión completada</p>
        <h1>{mission.title}</h1>
        <p className="lede">{mission.reward.narrative}</p>

        <div className="complete__transition">
          <span className="complete__system">{systemName ?? mission.reward.systemId}</span>
          <span className="complete__arrow" aria-hidden="true">
            →
          </span>
          <span className="complete__state">
            {STATE_LABEL[mission.workshop.from]} → {STATE_LABEL[mission.workshop.to]}
          </span>
        </div>

        {debrief.explain !== undefined ? (
          <ul className="complete__recap">
            {debrief.explain.questions.map((question) => (
              <li key={question.id}>{question.explanation}</li>
            ))}
          </ul>
        ) : null}

        <dl className="complete__stats">
          <div>
            <dt>Intentos</dt>
            <dd>{state.attempts}</dd>
          </div>
          <div>
            <dt>Pistas</dt>
            <dd>{state.hintsUsed}</dd>
          </div>
          <div>
            <dt>Razonamiento</dt>
            <dd>{assessment?.score ?? 0} / 3</dd>
          </div>
        </dl>

        <div className="actions">
          {upcoming !== null && onOpenUpcoming !== undefined ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onOpenUpcoming(upcoming.id)}
            >
              Siguiente: {upcoming.title} →
            </button>
          ) : null}
          <button
            type="button"
            className={
              upcoming !== null && onOpenUpcoming !== undefined ? 'btn btn--ghost' : 'btn btn--primary'
            }
            onClick={onFinish}
          >
            Volver al taller →
          </button>
        </div>
      </div>
    );
  }

  const structured = debrief.explain !== undefined;
  const rejected =
    !structured &&
    assessment !== null &&
    assessment.score < REASONING_MIN_SCORE;

  return (
    <div className="debrief">
      <p className="eyebrow">Informe de la misión</p>
      <h1>{mission.title}</h1>

      {state.strategy !== '' ? (
        <p className="debrief__echo">
          Empezaste diciendo: <q>{state.strategy}</q>
        </p>
      ) : null}
      <p className="debrief__meta">
        Lo resolviste en {state.attempts}{' '}
        {state.attempts === 1 ? 'intento' : 'intentos'}, con {state.hintsUsed}{' '}
        {state.hintsUsed === 1 ? 'pista' : 'pistas'}.
      </p>

      <section className="debrief__block">
        <h2>
          <span className="block__index" aria-hidden="true">
            1
          </span>
          Por qué funciona
        </h2>
        <p>{debrief.whyItWorks}</p>
        <p className="debrief__aside">{debrief.realWorld}</p>
      </section>

      <section className="debrief__block">
        <h2>
          <span className="block__index" aria-hidden="true">
            2
          </span>
          Casos límite
        </h2>
        <p>{debrief.edgeCaseNote}</p>
      </section>

      <section className="debrief__block">
        <h2>
          <span className="block__index" aria-hidden="true">
            3
          </span>
          Coste
        </h2>
        <fieldset className="choice">
          <legend>{complexity.question}</legend>
          {complexity.options.map((option, index) => (
            <label key={option} className="choice__option">
              <input
                type="radio"
                name="complexity"
                value={index}
                checked={state.debriefComplexityIndex === index}
                onChange={() => onAnswerComplexity(index)}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        {state.debriefComplexityIndex !== null ? (
          <p className="debrief__aside">{complexity.explanation}</p>
        ) : null}
      </section>

      <section className="debrief__block">
        <h2>
          <span className="block__index" aria-hidden="true">
            4
          </span>
          Explica con tus palabras
        </h2>
        {structured ? (
          <ExplainBlock
            state={state}
            onAnswer={onAnswerExplain}
            onEditNote={onEditExplainNote}
          />
        ) : (
          <>
            <p>{debrief.reasoningPrompt}</p>

            <label className="field">
              <span className="field__label">Tu explicación</span>
              <textarea
                className="field__area"
                rows={4}
                value={state.reasoning}
                onChange={(event) => onEditReasoning(event.target.value)}
                aria-describedby={rejected ? 'reasoning-feedback' : undefined}
              />
            </label>

            {rejected ? (
              <div className="feedback" id="reasoning-feedback" role="status">
                <p className="feedback__title">
                  La explicación todavía no llega a {REASONING_MIN_SCORE}. No es
                  un castigo: así se aprende.
                </p>
                <ul>
                  {assessment.tooShort ? (
                    <li>Necesita una frase completa, no una palabra.</li>
                  ) : null}
                  {assessment.restatesResult ? (
                    <li>
                      «Porque funciona» describe el resultado, no el mecanismo.
                    </li>
                  ) : null}
                  {!assessment.matchedMechanism ? (
                    <li>
                      Nombra qué hace tu código: comparar, devolver, recorrer…
                    </li>
                  ) : null}
                  {!assessment.matchedObjective ? (
                    <li>
                      Conéctalo con el objetivo: la alarma, el límite, el
                      sensor.
                    </li>
                  ) : null}
                  {assessment.score === 1 ? (
                    <li>
                      Añade por qué esa decisión es la correcta, no solo cómo la
                      tomas.
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={onSubmit}>
            Cerrar la misión
          </button>
        </div>
      </section>
    </div>
  );
}
