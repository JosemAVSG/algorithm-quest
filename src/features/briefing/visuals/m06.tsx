/**
 * M06 illustration: a belt of three readings where one sensor sends no data.
 * The intern's average counts that sensor as a 0 and as a reading, so the
 * result drops; the corrected average skips it. A final phase shows the empty
 * belt, where the intern's code ends in NaN.
 *
 * Pure frame model (tick -> frame) plus a compact SVG. Copy stays clear of the
 * mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

export const BAD_READING_TICK_MS = 900;
export const BAD_READING_READINGS: ReadonlyArray<number | null> = [20, null, 30];
/** Frames 0..3 add one reading each; then the last frame is held. */
const BUILD_TICKS = 4;
const HOLD_TICKS = 3;
const EMPTY_TICKS = 3;
export const BAD_READING_CYCLE_TICKS = BUILD_TICKS + HOLD_TICKS + EMPTY_TICKS;

export interface AverageLine {
  formula: string;
  value: string;
  /** True when the value is wrong for the shop's rules. */
  wrong: boolean;
}

export interface BadReadingFrame {
  phase: 'readings' | 'empty';
  /** How many belt readings have been taken in so far (0..3). */
  processed: number;
  intern: AverageLine;
  fixed: AverageLine;
  note: string;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

const NOTES = [
  'Llegan las lecturas de la cinta…',
  'Primera lectura: los dos coinciden.',
  'Sin dato: aquí cuenta como un 0 más.',
  '16,7 en vez de 25: el cero hundió el promedio.',
] as const;

export function badReadingFrame(tick: number): BadReadingFrame {
  const position = ((tick % BAD_READING_CYCLE_TICKS) + BAD_READING_CYCLE_TICKS) % BAD_READING_CYCLE_TICKS;

  if (position >= BUILD_TICKS + HOLD_TICKS) {
    return {
      phase: 'empty',
      processed: 0,
      intern: { formula: '0 ÷ 0', value: 'NaN', wrong: true },
      fixed: { formula: 'ninguna lectura válida', value: 'null', wrong: false },
      note: 'Cinta vacía: 0 ÷ 0 no es un número.',
    };
  }

  const processed = Math.min(position, BAD_READING_READINGS.length);
  const taken = BAD_READING_READINGS.slice(0, processed);
  const note = NOTES[processed] ?? NOTES[NOTES.length - 1] ?? '';
  if (processed === 0) {
    return {
      phase: 'readings',
      processed,
      intern: { formula: '', value: '—', wrong: false },
      fixed: { formula: '', value: '—', wrong: false },
      note,
    };
  }

  const valid = taken.filter((reading): reading is number => reading !== null);
  const sum = valid.reduce((total, reading) => total + reading, 0);
  const internTerms = taken.map((reading) => (reading === null ? '0' : String(reading)));
  const internFormula = taken.length === 1 ? `${internTerms[0] ?? ''} ÷ 1` : `(${internTerms.join(' + ')}) ÷ ${taken.length}`;
  const internAverage = sum / taken.length;
  const fixedAverage = sum / valid.length;
  const hasGap = taken.includes(null);

  return {
    phase: 'readings',
    processed,
    intern: { formula: internFormula, value: format(internAverage), wrong: hasGap },
    fixed: { formula: `${sum} ÷ ${valid.length}`, value: format(fixedAverage), wrong: false },
    note,
  };
}

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return tick;
}

const CELL_X = [8, 96, 184] as const;

function cellStyle(state: 'idle' | 'current' | 'taken' | 'gap'): React.CSSProperties {
  switch (state) {
    case 'current':
      return { fill: 'var(--structure)', stroke: 'var(--structure)' };
    case 'taken':
      return { fill: 'var(--working)', fillOpacity: 0.55, stroke: 'var(--working)' };
    case 'gap':
      return { fill: 'var(--surface-sunken)', stroke: 'var(--broken)', strokeDasharray: '4 3' };
    default:
      return { fill: 'var(--surface-sunken)', stroke: 'var(--border)' };
  }
}

export function BadReadingVisual() {
  const tick = useTick(BAD_READING_TICK_MS);
  const frame = badReadingFrame(tick);
  const empty = frame.phase === 'empty';

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 280 150"
        role="img"
        aria-labelledby="visual-bad-reading-title"
      >
        <title id="visual-bad-reading-title">
          Una cinta con tres lecturas, una de ellas sin dato. El promedio del becario cuenta ese
          sensor como un cero y sale más bajo que el correcto; con la cinta vacía sale NaN.
        </title>
        <g aria-hidden="true">
          {CELL_X.map((x, index) => {
            const reading = BAD_READING_READINGS[index] ?? null;
            const taken = !empty && index < frame.processed;
            const current = !empty && taken && index === frame.processed - 1;
            const state = empty
              ? 'idle'
              : !taken
                ? 'idle'
                : reading === null
                  ? 'gap'
                  : current
                    ? 'current'
                    : 'taken';
            return (
              <g key={index}>
                <rect x={x} y={8} width={88} height={32} rx={4} style={{ ...cellStyle(state), strokeWidth: 1.5, transition: 'fill 150ms linear' }} />
                <text x={x + 44} y={29} textAnchor="middle" className="visual__label visual__label--strong">
                  {empty ? '' : reading === null ? 'sin dato' : reading}
                </text>
              </g>
            );
          })}
          {empty ? (
            <text x="140" y="29" textAnchor="middle" className="visual__label">cinta vacía</text>
          ) : null}

          <text x="8" y="66" className="visual__label">Código del becario</text>
          <text x="8" y="80" className="visual__label">{frame.intern.formula}</text>
          <text
            x="272"
            y="76"
            textAnchor="end"
            className={`visual__label visual__label--strong${frame.intern.wrong ? ' visual__label--broken' : ''}`}
            style={{ fontSize: 16 }}
          >
            {frame.intern.value}
          </text>

          <text x="8" y="102" className="visual__label">Código corregido</text>
          <text x="8" y="116" className="visual__label">{frame.fixed.formula}</text>
          <text
            x="272"
            y="112"
            textAnchor="end"
            className="visual__label visual__label--strong"
            style={{ fontSize: 16, fill: 'var(--working)' }}
          >
            {frame.fixed.value}
          </text>

          <text x="8" y="142" className={`visual__label${frame.intern.wrong ? ' visual__label--broken' : ''}`}>
            {frame.note}
          </text>
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span>el sensor sin dato no mide 0 °C</span>
      </figcaption>
    </figure>
  );
}
