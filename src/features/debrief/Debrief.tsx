/**
 * S5 — Debrief (docs/06-ux-flows.md §7).
 *
 * Four blocks, in order: why it works, edge cases, cost, reasoning. The
 * edge-case and cost answers are deterministic; the reasoning block is the only
 * one that can hold up completion (docs/04-mentor.md §6).
 *
 * No confetti. The debrief is a document, and the reward is the workshop.
 */

import { useRef } from 'react';

import { STATE_LABEL } from '../workshop-map/stateLabels';
import { ExplainBlock } from './ExplainBlock';
import type { MissionSessionState } from '../../domain/session/mission-session';
import { REASONING_MIN_SCORE } from '../../domain/session/mission-session';
import { debriefProgress, missingLabel } from './progress';

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

  const rootRef = useRef<HTMLDivElement>(null);
  const explainSpec = debrief.explain;
  const progress = debriefProgress({
    structured:
      explainSpec === undefined
        ? null
        : {
            blanks: explainSpec.blanks.map((b) => b.id),
            questions: explainSpec.questions.map((q) => q.id),
          },
    complexityAnswered: state.debriefComplexityIndex !== null,
    reasoning: state.reasoning,
    explainAnswers: state.explainAnswers,
  });

  // The close button stays reachable (aria-disabled, not disabled) so that
  // pressing it names what is missing and moves focus there.
  const handleClose = () => {
    if (!progress.complete) {
      focusAnswer(rootRef.current, progress.firstMissing);
      return;
    }
    onSubmit();
  };

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
        <p className="complete__hint">
          {debrief.explain !== undefined
            ? 'Razonamiento: 3 significa que completaste la explicación sin ningún fallo a la primera; 2, que la afinaste tras repensar algún hueco. No son puntos: solo refleja cuánto te costó afinarla.'
            : 'Razonamiento: 3 significa que tu explicación nombró el mecanismo, el objetivo y el coste; 2, que nombró el mecanismo y el objetivo. No son puntos: valora la explicación, no a ti.'}
        </p>

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
    <div className="debrief" ref={rootRef}>
      <p className="eyebrow">Informe de la misión</p>
      <h1>{mission.title}</h1>

      {state.strategy !== '' ? (
        <blockquote className="debrief__echo">
          <p className="debrief__echo-label">Empezaste diciendo:</p>
          <p className="debrief__echo-text">{state.strategy}</p>
        </blockquote>
      ) : null}
      <p className="debrief__meta">
        Lo resolviste en {state.attempts}{' '}
        {state.attempts === 1 ? 'intento' : 'intentos'}, con {state.hintsUsed}{' '}
        {state.hintsUsed === 1 ? 'pista' : 'pistas'}.
      </p>

      <div
        className="debrief__progress"
        role="progressbar"
        aria-label="Respuestas del informe"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.answered}
        aria-valuetext={`${progress.answered} de ${progress.total} respondidas`}
      >
        <p className="debrief__progress-text">
          {progress.answered} de {progress.total} respondidas
        </p>
        <div className="debrief__progress-track" aria-hidden="true">
          <div
            className="debrief__progress-fill"
            style={{ width: `${(progress.answered / progress.total) * 100}%` }}
          />
        </div>
      </div>

      <details className="debrief__block debrief__fold" open>
        <summary>
          <h2>
            <span className="block__index" aria-hidden="true">
              1
            </span>
            Por qué funciona
          </h2>
          <span className="block__status">Para leer</span>
        </summary>
        <p>{debrief.whyItWorks}</p>
        <p className="debrief__aside">{debrief.realWorld}</p>
      </details>

      <details className="debrief__block debrief__fold" open>
        <summary>
          <h2>
            <span className="block__index" aria-hidden="true">
              2
            </span>
            Casos límite
          </h2>
          <span className="block__status">Para leer</span>
        </summary>
        <p>{debrief.edgeCaseNote}</p>
      </details>

      <section className="debrief__block">
        <div className="debrief__head">
          <h2>
            <span className="block__index" aria-hidden="true">
              3
            </span>
            Coste
          </h2>
          <SectionStatus {...progress.cost} />
        </div>
        <fieldset className="choice">
          <legend>{complexity.question}</legend>
          {complexity.options.map((option, index) => (
            <label key={option} className="choice__option">
              <input
                type="radio"
                name="complexity"
                data-answer-key={index === 0 ? 'complexity' : undefined}
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
        <div className="debrief__head">
          <h2>
            <span className="block__index" aria-hidden="true">
              4
            </span>
            Explica con tus palabras
          </h2>
          <SectionStatus {...progress.explain} />
        </div>
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
                data-answer-key="reasoning"
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

      </section>

      <div className="debrief__bar">
        <p
          className={`debrief__bar-reason${progress.complete ? ' debrief__bar-reason--ready' : ''}`}
          id="debrief-close-reason"
        >
          {progress.complete
            ? 'Todo respondido. Puedes cerrar la misión.'
            : `${missingLabel(progress.total - progress.answered)}.`}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          aria-disabled={!progress.complete}
          aria-describedby="debrief-close-reason"
          onClick={handleClose}
        >
          Cerrar la misión
        </button>
      </div>
    </div>
  );
}

/** Done/pending as text, so colour is never the only signal. */
function SectionStatus({ answered, total }: { answered: number; total: number }) {
  const done = answered === total;
  return (
    <span className={`block__status${done ? ' block__status--done' : ''}`}>
      {done ? 'Completado' : `Pendiente · ${answered} de ${total}`}
    </span>
  );
}

/** Move keyboard focus to the first unanswered item and bring it into view. */
function focusAnswer(root: HTMLElement | null, key: string | null): void {
  if (root === null || key === null) return;
  const target = root.querySelector<HTMLElement>(`[data-answer-key="${key}"]`);
  if (target === null) return;
  const focusable =
    target instanceof HTMLFieldSetElement
      ? (target.querySelector<HTMLElement>('input') ?? target)
      : target;
  focusable.focus();
  focusable.scrollIntoView({ block: 'center' });
}
