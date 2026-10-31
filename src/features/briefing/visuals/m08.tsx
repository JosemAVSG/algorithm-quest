/**
 * M08 illustration: every identifier is compared with the ones after it. The
 * comparison arcs pile up as the search goes on, and it stops at the first
 * pair that matches.
 *
 * Pure frame model (tick -> frame) plus a compact SVG. Copy stays clear of the
 * mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

export const PAIR_SCAN_IDS: readonly number[] = [3, 7, 5, 9, 5, 1];
export const PAIR_SCAN_TICK_MS = 450;
const HOLD_TICKS = 5;

export type Pair = readonly [number, number];

/** Pairs in the order the nested loops visit them. */
export function pairsInOrder(count: number): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    for (let j = i + 1; j < count; j += 1) pairs.push([i, j]);
  }
  return pairs;
}

/** Comparisons made until the first matching pair (inclusive). */
export function visitedPairs(ids: readonly number[]): Pair[] {
  const visited: Pair[] = [];
  for (const pair of pairsInOrder(ids.length)) {
    visited.push(pair);
    if (ids[pair[0]] === ids[pair[1]]) break;
  }
  return visited;
}

const VISITED = visitedPairs(PAIR_SCAN_IDS);
export const PAIR_SCAN_TOTAL_PAIRS = pairsInOrder(PAIR_SCAN_IDS.length).length;
export const PAIR_SCAN_CYCLE_TICKS = VISITED.length + HOLD_TICKS;

export interface PairScanFrame {
  /** Pairs compared so far, the last one being the current comparison. */
  compared: readonly Pair[];
  current: Pair;
  found: boolean;
  note: string;
}

export function pairScanFrame(tick: number): PairScanFrame {
  const position = ((tick % PAIR_SCAN_CYCLE_TICKS) + PAIR_SCAN_CYCLE_TICKS) % PAIR_SCAN_CYCLE_TICKS;
  const count = Math.min(position + 1, VISITED.length);
  const compared = VISITED.slice(0, count);
  const current = compared[compared.length - 1] ?? VISITED[0] ?? [0, 1];
  const found = count === VISITED.length;
  return {
    compared,
    current,
    found,
    note: found
      ? `Repetida: posiciones ${current[0]} y ${current[1]}. Se para.`
      : `Comparación ${count} de ${PAIR_SCAN_TOTAL_PAIRS} posibles`,
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

const NODE_X = (index: number) => 28 + index * 44.8;
const NODE_Y = 108;

function arc(pair: Pair): string {
  const x1 = NODE_X(pair[0]);
  const x2 = NODE_X(pair[1]);
  const lift = (x2 - x1) * 0.26;
  return `M ${x1} ${NODE_Y - 14} Q ${(x1 + x2) / 2} ${NODE_Y - 14 - lift} ${x2} ${NODE_Y - 14}`;
}

export function PairScanVisual() {
  const tick = useTick(PAIR_SCAN_TICK_MS);
  const frame = pairScanFrame(tick);
  const [a, b] = frame.current;

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 280 150"
        role="img"
        aria-labelledby="visual-pair-scan-title"
      >
        <title id="visual-pair-scan-title">
          Seis identificadores en fila. Cada uno se compara con los que vienen después y las
          comparaciones se acumulan; la búsqueda se para en el primer par repetido.
        </title>
        <g aria-hidden="true">
          {frame.compared.slice(0, -1).map((pair) => (
            <path
              key={`${pair[0]}-${pair[1]}`}
              d={arc(pair)}
              style={{ fill: 'none', stroke: 'var(--structure)', strokeOpacity: 0.3, strokeWidth: 1.2 }}
            />
          ))}
          <path
            d={arc(frame.current)}
            style={{
              fill: 'none',
              stroke: frame.found ? 'var(--broken)' : 'var(--attention)',
              strokeWidth: 2.5,
            }}
          />
          {PAIR_SCAN_IDS.map((id, index) => {
            const active = index === a || index === b;
            return (
              <g key={index}>
                <rect
                  x={NODE_X(index) - 15}
                  y={NODE_Y - 14}
                  width={30}
                  height={28}
                  rx={4}
                  style={{
                    fill: active ? (frame.found ? 'var(--broken)' : 'var(--structure)') : 'var(--surface-sunken)',
                    stroke: active ? (frame.found ? 'var(--broken)' : 'var(--structure)') : 'var(--border)',
                    strokeWidth: 1.5,
                  }}
                />
                <text
                  x={NODE_X(index)}
                  y={NODE_Y + 5}
                  textAnchor="middle"
                  className="visual__label visual__label--strong"
                  style={active ? { fill: 'var(--surface)' } : undefined}
                >
                  {id}
                </text>
                <text x={NODE_X(index)} y={NODE_Y + 28} textAnchor="middle" className="visual__label" style={{ fontSize: 9 }}>
                  pos. {index}
                </text>
              </g>
            );
          })}
          <text x="8" y="12" className={`visual__label${frame.found ? ' visual__label--broken' : ''}`}>
            {frame.note}
          </text>
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span>con 10 órdenes serían 45 comparaciones; con 1.000, 499.500</span>
      </figcaption>
    </figure>
  );
}
