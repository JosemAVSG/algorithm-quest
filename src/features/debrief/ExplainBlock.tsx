/**
 * Structured explanation (docs/04-mentor.md §6): a sentence with blanks the
 * player fills from options, plus comprehension questions. Replaces the
 * free-text box for missions that author `debrief.explain`.
 *
 * Feedback marks *what to rethink* and never reveals the answer.
 */

import { parseTemplate } from "../../domain/evaluation/explain";
import type { MissionSessionState } from "../../domain/session/mission-session";

interface ExplainBlockProps {
  state: MissionSessionState;
  onAnswer: (id: string, index: number) => void;
  onEditNote: (text: string) => void;
}

export function ExplainBlock({
  state,
  onAnswer,
  onEditNote,
}: ExplainBlockProps) {
  const spec = state.mission.debrief.explain;
  if (spec === undefined) return null;

  const { explainAnswers: answers, explainFeedback: feedback } = state;
  const wrongAt = (id: string, given: number | undefined) =>
    feedback !== null && given !== undefined && feedback.wrong[id] === given;

  const blankNumber = new Map<string, number>();
  const parts = parseTemplate(spec.template);
  for (const part of parts) {
    if (part.kind === "blank") blankNumber.set(part.id, blankNumber.size + 1);
  }

  const label = (id: string): string => {
    const blank = blankNumber.get(id);
    if (blank !== undefined) return `hueco ${blank}`;
    return `pregunta ${spec.questions.findIndex((q) => q.id === id) + 1}`;
  };

  const rethink = Object.keys(feedback?.wrong ?? {}).filter((id) =>
    wrongAt(id, answers.blanks[id] ?? answers.questions[id]),
  );
  const missing = (feedback?.missing ?? []).filter(
    (id) =>
      answers.blanks[id] === undefined && answers.questions[id] === undefined,
  );

  return (
    <div className="explain">
      <p>{spec.prompt}</p>

      <p className="explain__sentence">
        {parts.map((part, position) => {
          if (part.kind === "text")
            return <span key={position}>{part.text}</span>;
          const blank = spec.blanks.find((b) => b.id === part.id);
          if (blank === undefined) return null;
          const given = answers.blanks[blank.id];
          const wrong = wrongAt(blank.id, given);
          return (
            <select
              key={position}
              className={`explain__blank${wrong ? " explain__blank--wrong" : ""}`}
              aria-label={`Hueco ${blankNumber.get(blank.id)}`}
              aria-invalid={wrong}
              value={given ?? ""}
              onChange={(event) =>
                onAnswer(blank.id, Number(event.target.value))
              }
            >
              <option value="" disabled>
                …
              </option>
              {blank.options.map((option, index) => (
                <option key={option} value={index}>
                  {option}
                </option>
              ))}
            </select>
          );
        })}
      </p>

      {spec.questions.map((question, number) => {
        const given = answers.questions[question.id];
        const wrong = wrongAt(question.id, given);
        const reason =
          wrong && given !== undefined ? question.whyWrong?.[given] : undefined;
        return (
          <fieldset key={question.id} className="choice explain__question">
            <legend>
              {number + 1}. {question.question}
            </legend>
            {question.options.map((option, index) => (
              <label key={option} className="choice__option">
                <input
                  type="radio"
                  name={`explain-${question.id}`}
                  value={index}
                  checked={given === index}
                  onChange={() => onAnswer(question.id, index)}
                />
                <span>{option}</span>
              </label>
            ))}
            {wrong ? (
              <p className="explain__why">
                {reason !== undefined && reason !== ""
                  ? reason
                  : "Esta opción no encaja con el código: vuelve a mirar qué ocurre paso a paso."}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      <div role="status" aria-live="polite" className="explain__status">
        {rethink.length + missing.length > 0 ? (
          <div className="feedback">
            {rethink.length > 0 ? (
              <p className="feedback__title">
                Aún hay algo que repensar: {rethink.map(label).join(", ")}. No
                es un castigo: así se aprende.
              </p>
            ) : null}
            {missing.length > 0 ? (
              <p>Falta responder: {missing.map(label).join(", ")}.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="field">
        <span className="field__label">Nota (opcional, no puntúa)</span>
        <textarea
          className="field__area"
          rows={2}
          value={state.explainNote}
          onChange={(event) => onEditNote(event.target.value)}
        />
      </label>
    </div>
  );
}
