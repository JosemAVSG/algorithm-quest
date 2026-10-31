/**
 * M09 briefing illustration: every pair of orders gets compared once, and the
 * number of pairs explodes when the queue doubles. A staircase of pair cells
 * fills one row per tick (5 orders, then 10), with a running counter.
 *
 * The frame model is pure (tick -> frame); the component only draws it.
 * Copy must stay clear of the mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

/** Queue sizes shown in turn: the second one is the double of the first. */
export const COST_SIZES = [5, 10] as const;
/** One tick per 450 ms = ~2.2 Hz, below the 3 Hz flash threshold. */
export const COST_TICK_MS = 450;
const HOLD_TICKS = [3, 6] as const;

/** Pairs among `n` orders: each one against the ones behind it. */
export function pairCount(n: number): number {
  return n < 2 ? 0 : (n * (n - 1)) / 2;
}

function stageLength(stage: number): number {
  // frames with 0..(n-1) rows filled, then the hold
  return COST_SIZES[stage] + HOLD_TICKS[stage];
}

export const COST_CYCLE_TICKS = stageLength(0) + stageLength(1);

export interface CostFrame {
  size: number;
  /** Rows of the staircase that have been compared so far. */
  rowsDone: number;
  /** Running counter of comparisons. */
  count: number;
  finished: boolean;
  /** True while showing the doubled queue. */
  doubled: boolean;
}

function countAfterRows(size: number, rows: number): number {
  let total = 0;
  for (let row = 0; row < rows; row += 1) total += size - 1 - row;
  return total;
}

export function costFrame(tick: number): CostFrame {
  const position = ((tick % COST_CYCLE_TICKS) + COST_CYCLE_TICKS) % COST_CYCLE_TICKS;
  const doubled = position >= stageLength(0);
  const stage = doubled ? 1 : 0;
  const size = COST_SIZES[stage];
  const local = doubled ? position - stageLength(0) : position;
  const rowsDone = Math.min(local, size - 1);
  return {
    size,
    rowsDone,
    count: countAfterRows(size, rowsDone),
    finished: rowsDone === size - 1,
    doubled,
  };
}

export type CostCellState = 'none' | 'pending' | 'active' | 'done';

/** Cell (row, col) is the pair "order row vs order col", col > row. */
export function costCellState(row: number, col: number, frame: CostFrame): CostCellState {
  if (col <= row || col >= frame.size) return 'none';
  if (row < frame.rowsDone - 1) return 'done';
  if (row === frame.rowsDone - 1) return frame.finished ? 'done' : 'active';
  return 'pending';
}

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return tick;
}

const PITCH = 14;
const CELL = 12;
const ORIGIN_X = 6;
const ORIGIN_Y = 8;
const MAX_SIZE = COST_SIZES[COST_SIZES.length - 1];

const FILL: Record<CostCellState, { fill: string; stroke: string; opacity?: number }> = {
  none: { fill: 'none', stroke: 'none' },
  pending: { fill: 'var(--surface-sunken)', stroke: 'var(--border)' },
  active: { fill: 'var(--structure)', stroke: 'var(--structure)' },
  done: { fill: 'var(--working)', stroke: 'var(--working)', opacity: 0.6 },
};

export function CostGrid() {
  const tick = useTick(COST_TICK_MS);
  const frame = costFrame(tick);
  const cells: { row: number; col: number; state: CostCellState }[] = [];
  for (let row = 0; row < MAX_SIZE - 1; row += 1) {
    for (let col = row + 1; col < MAX_SIZE; col += 1) {
      const state = costCellState(row, col, frame);
      if (state !== 'none') cells.push({ row, col, state });
    }
  }

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 270 150"
        role="img"
        aria-labelledby="visual-cost-title"
      >
        <title id="visual-cost-title">
          Cada pareja de órdenes se compara una vez. Con 5 órdenes son 10 comparaciones; con 10
          órdenes, el doble, son 45: más de cuatro veces el trabajo.
        </title>
        <g aria-hidden="true">
          {cells.map(({ row, col, state }) => (
            <rect
              key={`${row}-${col}`}
              x={ORIGIN_X + (col - 1) * PITCH}
              y={ORIGIN_Y + row * PITCH}
              width={CELL}
              height={CELL}
              rx={2}
              style={{
                fill: FILL[state].fill,
                stroke: FILL[state].stroke,
                fillOpacity: FILL[state].opacity ?? 1,
                strokeWidth: 1,
              }}
            />
          ))}
          <text x="150" y="24" className="visual__label">
            cola de
          </text>
          <text x="150" y="40" className="visual__label visual__label--strong">
            {frame.size} órdenes
          </text>
          <text x="150" y="82" className="visual__label visual__label--strong" style={{ fontSize: 30 }}>
            {frame.count}
          </text>
          <text x="150" y="98" className="visual__label">
            comparaciones
          </text>
          {frame.finished && frame.doubled ? (
            <>
              <text x="150" y="124" className="visual__label visual__label--broken">
                el doble de órdenes:
              </text>
              <text x="150" y="138" className="visual__label visual__label--broken">
                más de 4 veces el trabajo
              </text>
            </>
          ) : null}
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span><i className="visual__key visual__key--ok" /> pareja comparada</span>
        <span><i className="visual__key visual__key--idle" /> por comparar</span>
      </figcaption>
    </figure>
  );
}
