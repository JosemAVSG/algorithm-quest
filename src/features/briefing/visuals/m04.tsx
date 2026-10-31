/**
 * M04 illustration: a running total and a running count of low lines survive
 * every pass of the loop. A faint row shows what a total re-declared on each
 * pass would hold: only the last line. Copy avoids the forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

import { TOTAL_LINES, TOTAL_MINIMUM, TOTAL_TICK_MS, totalFrame } from './m04-model';

const PITCH = 38;
const FULL_TOTAL = TOTAL_LINES.reduce((sum, quantity) => sum + quantity, 0);
const BAR_W = 150;

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return tick;
}

export function RunningTotal() {
  const frame = totalFrame(useTick(TOTAL_TICK_MS));

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 240 160"
        role="img"
        aria-labelledby="visual-total-title"
      >
        <title id="visual-total-title">
          Seis líneas de inventario recorridas una a una. El total sigue creciendo en cada vuelta
          y también las líneas por reponer; un total que empezara de cero en cada vuelta solo
          mostraría la última línea.
        </title>
        <g aria-hidden="true">
          <text x="8" y="11" className="visual__label">
            Líneas (unidades), mínimo {TOTAL_MINIMUM}
          </text>
          {TOTAL_LINES.map((quantity, index) => {
            const seen = index < frame.processed;
            const low = quantity < TOTAL_MINIMUM;
            const active = frame.current === index;
            const color = active ? 'var(--structure)' : seen && low ? 'var(--broken)' : seen ? 'var(--working)' : 'var(--border)';
            return (
              <g key={index}>
                <rect
                  x={8 + index * PITCH}
                  y={18}
                  width={32}
                  height={28}
                  rx={3}
                  style={{
                    fill: seen || active ? color : 'var(--surface-sunken)',
                    fillOpacity: active ? 0.45 : seen ? 0.3 : 1,
                    stroke: color,
                    strokeWidth: active ? 2 : 1,
                    transition: 'fill 120ms linear',
                  }}
                />
                <text x={8 + index * PITCH + 16} y={37} textAnchor="middle" className="visual__label visual__label--strong">
                  {quantity}
                </text>
              </g>
            );
          })}

          <text x="8" y="68" className="visual__label visual__label--strong">
            Total que se conserva
          </text>
          <rect x="8" y="73" width={BAR_W} height="12" rx="3" style={{ fill: 'var(--surface-sunken)', stroke: 'var(--border)' }} />
          <rect
            x="8"
            y="73"
            width={(frame.total / FULL_TOTAL) * BAR_W}
            height="12"
            rx="3"
            style={{ fill: 'var(--working)', fillOpacity: 0.7, transition: 'width 300ms ease' }}
          />
          <text x={8 + BAR_W + 8} y="83" className="visual__label visual__label--strong">
            {frame.total}
          </text>

          <text x="8" y="108" className="visual__label">
            Si se declara dentro del bucle
          </text>
          <rect x="8" y="113" width={BAR_W} height="12" rx="3" style={{ fill: 'var(--surface-sunken)', stroke: 'var(--border)' }} />
          <rect
            x="8"
            y="113"
            width={(frame.restarted / FULL_TOTAL) * BAR_W}
            height="12"
            rx="3"
            style={{ fill: 'var(--broken)', fillOpacity: 0.6, transition: 'width 300ms ease' }}
          />
          <text x={8 + BAR_W + 8} y="123" className="visual__label visual__label--broken">
            {frame.restarted}
          </text>

          <text x="8" y="150" className={`visual__label${frame.done ? ' visual__label--strong' : ''}`}>
            Por reponer: {frame.low} {frame.low === 1 ? 'línea' : 'líneas'}
          </text>
        </g>
      </svg>
    </figure>
  );
}
