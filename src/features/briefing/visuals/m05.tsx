/**
 * M05 illustration: every original record stays untouched while a new copy,
 * with its status and priority added, appears below it. Same count out as in,
 * same order. Copy avoids the mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

import { COPY_LIMIT_HOURS, COPY_RECORDS, COPY_TICK_MS, copyFrame } from './m05-model';

const PITCH = 57;
const W = 52;

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return tick;
}

export function CopyRows() {
  const frame = copyFrame(useTick(COPY_TICK_MS));

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 240 150"
        role="img"
        aria-labelledby="visual-copy-title"
      >
        <title id="visual-copy-title">
          Cuatro reparaciones del registro original, que no cambian. Debajo aparece una copia
          nueva de cada una, en el mismo orden, con estado y prioridad añadidos.
        </title>
        <g aria-hidden="true">
          <text x="8" y="11" className="visual__label">
            Registro original (no se toca)
          </text>
          {COPY_RECORDS.map((record, index) => {
            const active = frame.current === index;
            return (
              <g key={record.id}>
                <rect
                  x={8 + index * PITCH}
                  y={18}
                  width={W}
                  height={38}
                  rx={3}
                  style={{
                    fill: active ? 'var(--structure)' : 'var(--surface-sunken)',
                    fillOpacity: active ? 0.35 : 1,
                    stroke: active ? 'var(--structure)' : 'var(--border)',
                    strokeWidth: active ? 2 : 1,
                  }}
                />
                <text x={8 + index * PITCH + W / 2} y={31} textAnchor="middle" className="visual__label visual__label--strong">
                  {record.id}
                </text>
                <text x={8 + index * PITCH + W / 2} y={48} textAnchor="middle" className="visual__label">
                  {record.hours} h
                </text>
              </g>
            );
          })}

          <text x="8" y="80" className="visual__label visual__label--strong">
            Copias para el panel
          </text>
          {frame.panel.map((row, index) => (
            <g key={row.id}>
              <rect
                x={8 + index * PITCH}
                y={86}
                width={W}
                height={38}
                rx={3}
                style={{
                  fill: row.priority === 'high' ? 'var(--broken)' : 'var(--working)',
                  fillOpacity: 0.3,
                  stroke: row.priority === 'high' ? 'var(--broken)' : 'var(--working)',
                }}
              />
              <text x={8 + index * PITCH + W / 2} y={99} textAnchor="middle" className="visual__label visual__label--strong">
                {row.id}
              </text>
              <text x={8 + index * PITCH + W / 2} y={111} textAnchor="middle" className="visual__label">
                {row.status}
              </text>
              <text x={8 + index * PITCH + W / 2} y={121} textAnchor="middle" className="visual__label">
                {row.priority}
              </text>
            </g>
          ))}
          <text x="8" y="144" className="visual__label">
            {frame.done
              ? `Salen las 4, en orden. Con ${COPY_LIMIT_HOURS} h: normal.`
              : 'Una copia nueva por cada una…'}
          </text>
        </g>
      </svg>
    </figure>
  );
}
