/**
 * M07 illustration: five orders are looked at one by one while a single
 * candidate is kept. It only changes for a strictly better order; on a full
 * tie the earlier order stays.
 *
 * Pure frame model (tick -> frame) plus a compact SVG. Copy stays clear of the
 * mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

export interface DemoOrder {
  label: string;
  priority: number;
  /** Creation day: lower is older. */
  createdAt: number;
}

export const BEST_SCAN_ORDERS: readonly DemoOrder[] = [
  { label: '#1', priority: 3, createdAt: 40 },
  { label: '#2', priority: 5, createdAt: 20 },
  { label: '#3', priority: 2, createdAt: 10 },
  { label: '#4', priority: 5, createdAt: 20 },
  { label: '#5', priority: 4, createdAt: 5 },
];
export const BEST_SCAN_TICK_MS = 1000;
const HOLD_TICKS = 3;
export const BEST_SCAN_CYCLE_TICKS = BEST_SCAN_ORDERS.length + HOLD_TICKS;

export type ScanOutcome = 'first' | 'replaced' | 'kept' | 'tie-kept';

export interface BestScanFrame {
  /** Order being looked at, or null on the held final frame. */
  scanIndex: number | null;
  /** Index of the kept candidate after looking at `scanIndex`. */
  candidateIndex: number;
  outcome: ScanOutcome | 'done';
  note: string;
}

/** True when `challenger` is strictly better than `holder`. */
export function isStrictlyBetter(challenger: DemoOrder, holder: DemoOrder): boolean {
  if (challenger.priority !== holder.priority) return challenger.priority > holder.priority;
  return challenger.createdAt < holder.createdAt;
}

export function bestScanFrame(tick: number): BestScanFrame {
  const count = BEST_SCAN_ORDERS.length;
  const position = ((tick % BEST_SCAN_CYCLE_TICKS) + BEST_SCAN_CYCLE_TICKS) % BEST_SCAN_CYCLE_TICKS;

  let candidate = 0;
  let outcome: ScanOutcome = 'first';
  const last = Math.min(position, count - 1);
  for (let index = 1; index <= last; index += 1) {
    const order = BEST_SCAN_ORDERS[index];
    const holder = BEST_SCAN_ORDERS[candidate];
    if (order === undefined || holder === undefined) continue;
    if (isStrictlyBetter(order, holder)) {
      candidate = index;
      outcome = 'replaced';
    } else if (order.priority === holder.priority && order.createdAt === holder.createdAt) {
      outcome = 'tie-kept';
    } else {
      outcome = 'kept';
    }
  }

  if (position >= count) {
    return {
      scanIndex: null,
      candidateIndex: candidate,
      outcome: 'done',
      note: `Se devuelve la orden ${BEST_SCAN_ORDERS[candidate]?.label ?? ''}.`,
    };
  }
  const notes: Record<ScanOutcome, string> = {
    first: 'La primera es la candidata por ahora.',
    replaced: 'Prioridad mayor: reemplaza a la candidata.',
    kept: 'No supera a la candidata: se queda.',
    'tie-kept': 'Empate total: se queda la que llegó antes.',
  };
  return { scanIndex: position, candidateIndex: candidate, outcome, note: notes[outcome] };
}

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return tick;
}

const COL_X = (index: number) => 20 + index * 52;
const BASE_Y = 96;
const BAR_UNIT = 11;

export function BestScanVisual() {
  const tick = useTick(BEST_SCAN_TICK_MS);
  const frame = bestScanFrame(tick);
  const tied = frame.outcome === 'tie-kept';

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 280 150"
        role="img"
        aria-labelledby="visual-best-scan-title"
      >
        <title id="visual-best-scan-title">
          Cinco órdenes con su prioridad. Se miran una a una y se guarda una candidata que solo
          cambia ante una estrictamente mejor; en un empate total se queda la que llegó antes.
        </title>
        <g aria-hidden="true">
          {BEST_SCAN_ORDERS.map((order, index) => {
            const isCandidate = index === frame.candidateIndex;
            const isLooked = index === frame.scanIndex;
            const seen = frame.scanIndex === null || index <= frame.scanIndex;
            const height = order.priority * BAR_UNIT;
            const x = COL_X(index);
            const tieClash = tied && isLooked;
            return (
              <g key={order.label} style={{ opacity: seen ? 1 : 0.35, transition: 'opacity 150ms linear' }}>
                <rect
                  x={x}
                  y={BASE_Y - height}
                  width={36}
                  height={height}
                  rx={3}
                  style={{
                    fill: isCandidate ? 'var(--working)' : isLooked ? 'var(--structure)' : 'var(--surface-sunken)',
                    fillOpacity: isCandidate ? 0.75 : 1,
                    stroke: tieClash ? 'var(--attention)' : isCandidate ? 'var(--working)' : isLooked ? 'var(--structure)' : 'var(--border)',
                    strokeWidth: isLooked || isCandidate ? 2 : 1,
                    transition: 'fill 150ms linear',
                  }}
                />
                <text x={x + 18} y={BASE_Y - height - 5} textAnchor="middle" className="visual__label visual__label--strong">
                  P{order.priority}
                </text>
                <text x={x + 18} y={BASE_Y + 13} textAnchor="middle" className="visual__label visual__label--strong">
                  {order.label}
                </text>
                <text x={x + 18} y={BASE_Y + 25} textAnchor="middle" className="visual__label" style={{ fontSize: 9 }}>
                  día {order.createdAt}
                </text>
                {isCandidate ? (
                  <text x={x + 18} y={BASE_Y - height - 18} textAnchor="middle" className="visual__label" style={{ fill: 'var(--working)', fontSize: 10 }}>
                    candidata
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x="8" y="144" className="visual__label" style={tied ? { fill: 'var(--attention)' } : undefined}>
            {frame.note}
          </text>
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span>P = prioridad · día = cuándo se creó</span>
      </figcaption>
    </figure>
  );
}
