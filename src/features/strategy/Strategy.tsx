/**
 * S3 — Strategy prompt (docs/06-ux-flows.md §5).
 *
 * Never graded, and the copy says so before the player writes anything. The
 * gate exists to force a commitment that the debrief can echo back; a player who
 * believes the sentence is being judged writes what we want to hear.
 */

import { useState } from 'react';

import { STRATEGY_MIN_LENGTH } from '../../domain/session/mission-session';

interface StrategyProps {
  initialValue: string;
  onSubmit: (text: string) => void;
}

export function Strategy({ initialValue, onSubmit }: StrategyProps) {
  const [text, setText] = useState(initialValue);
  const trimmed = text.trim();
  const ready = trimmed.length >= STRATEGY_MIN_LENGTH;

  return (
    <div className="strategy">
      <p className="eyebrow">Antes de escribir código</p>
      <h1>¿Cómo lo vas a resolver?</h1>

      <p className="lede">
        No hay respuesta incorrecta aquí. Solo quiero saber qué tienes en la cabeza antes de
        empezar. No se puntúa.
      </p>

      <label className="field">
        <span className="field__label">Tu enfoque</span>
        <textarea
          className="field__area"
          value={text}
          rows={4}
          onChange={(event) => setText(event.target.value)}
          placeholder="Voy a recorrer la lista y guardar…"
          autoFocus
        />
      </label>

      <div className="strategy__footer">
        <span className={`counter ${ready ? 'counter--ready' : ''}`}>
          {trimmed.length} / {STRATEGY_MIN_LENGTH} mínimo
        </span>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ready}
          onClick={() => onSubmit(trimmed)}
        >
          Empezar a programar →
        </button>
      </div>
    </div>
  );
}
