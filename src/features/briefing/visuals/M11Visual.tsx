/**
 * M11 briefing illustration: orders fall into labelled buckets, the tallies
 * grow, two buckets tie and the fixed rule picks one.
 *
 * Copy avoids the mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

import {
  M11_BUCKETS,
  M11_ORDERS,
  M11_TICK_MS,
  m11Frame,
  type M11Frame,
} from './m11';

const CHIP_W = 56;
const CHIP_PITCH = 62;
const CHIP_X0 = 5;
const BUCKET_W = 92;
const BUCKET_PITCH = 106;
const BUCKET_X0 = 11;
const BUCKET_TOP = 50;
const BUCKET_H = 68;

const INK = 'var(--text)';
const MUTED = 'var(--text-muted)';

function bucketCenter(index: number): number {
  return BUCKET_X0 + index * BUCKET_PITCH + BUCKET_W / 2;
}

function caption(frame: M11Frame): string {
  if (frame.phase === 'counting') return 'Cada orden suma 1 en su categoría.';
  if (frame.phase === 'tie') return 'Empate: dos categorías con 2.';
  return 'Gana frenos: va antes en el abecedario.';
}

export function M11Visual() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), M11_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const frame = m11Frame(tick);
  const incomingBucket =
    frame.incoming === null ? -1 : M11_BUCKETS.indexOf(M11_ORDERS[frame.incoming]);

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 320 150"
        role="img"
        aria-labelledby="visual-m11-title"
      >
        <title id="visual-m11-title">
          Órdenes que llegan una a una y caen en cajas con el nombre de su categoría. Cada caja
          cuenta cuántas ha recibido. Al final dos cajas empatan con dos órdenes y gana la que va
          primero alfabéticamente.
        </title>
        <g aria-hidden="true">
          {M11_ORDERS.map((category, index) => {
            const done = frame.incoming === null || index < frame.incoming;
            const current = index === frame.incoming;
            return (
              <g key={index} opacity={done && !current ? 0.4 : 1}>
                <rect
                  x={CHIP_X0 + index * CHIP_PITCH}
                  y={4}
                  width={CHIP_W}
                  height={20}
                  rx={4}
                  style={{
                    fill: current ? 'var(--structure)' : 'var(--surface-sunken)',
                    stroke: current ? 'var(--structure)' : 'var(--border)',
                  }}
                />
                <text
                  x={CHIP_X0 + index * CHIP_PITCH + CHIP_W / 2}
                  y={18}
                  textAnchor="middle"
                  style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: current ? 'var(--surface)' : INK }}
                >
                  {category}
                </text>
              </g>
            );
          })}

          {frame.incoming !== null ? (
            <line
              x1={CHIP_X0 + frame.incoming * CHIP_PITCH + CHIP_W / 2}
              x2={bucketCenter(incomingBucket)}
              y1={26}
              y2={BUCKET_TOP - 2}
              style={{ stroke: 'var(--structure)', strokeWidth: 2, strokeDasharray: '4 3' }}
            />
          ) : null}

          {M11_BUCKETS.map((category, index) => {
            const isLeader = frame.leaders.includes(index);
            const isWinner = frame.winner === index;
            const stroke = isWinner
              ? 'var(--working)'
              : isLeader
                ? 'var(--attention)'
                : index === incomingBucket
                  ? 'var(--structure)'
                  : 'var(--border)';
            return (
              <g key={category}>
                <rect
                  x={BUCKET_X0 + index * BUCKET_PITCH}
                  y={BUCKET_TOP}
                  width={BUCKET_W}
                  height={BUCKET_H}
                  rx={6}
                  style={{
                    fill: isWinner ? 'var(--working)' : 'var(--surface-sunken)',
                    fillOpacity: isWinner ? 0.25 : 1,
                    stroke,
                    strokeWidth: isLeader || isWinner || index === incomingBucket ? 2.5 : 1,
                  }}
                />
                <text
                  x={bucketCenter(index)}
                  y={BUCKET_TOP + 16}
                  textAnchor="middle"
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: INK }}
                >
                  {category}
                </text>
                <text
                  x={bucketCenter(index)}
                  y={BUCKET_TOP + 54}
                  textAnchor="middle"
                  style={{ fontSize: 30, fontFamily: 'var(--font-mono)', fill: INK }}
                >
                  {frame.tallies[index]}
                </text>
              </g>
            );
          })}

          <text
            x="160"
            y="142"
            textAnchor="middle"
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              fill: frame.phase === 'counting' ? MUTED : frame.phase === 'tie' ? 'var(--attention)' : INK,
            }}
          >
            {caption(frame)}
          </text>
        </g>
      </svg>
    </figure>
  );
}
