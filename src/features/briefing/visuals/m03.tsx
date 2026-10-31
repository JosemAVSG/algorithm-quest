/**
 * M03 illustration: a line of units is inspected one by one; every defective
 * unit is copied into the return box in arrival order and the original line
 * stays as it was. Copy avoids the mission's forbiddenVocabulary.
 */

import { useEffect, useState, type CSSProperties } from 'react';

import {
  COLLECT_LIMIT,
  COLLECT_TICK_MS,
  COLLECT_UNITS,
  collectFrame,
  unitState,
  type UnitState,
} from './m03-model';

const PITCH = 37;
const UNIT_W = 32;

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return tick;
}

function unitStyle(state: UnitState): CSSProperties {
  const color =
    state === 'defective'
      ? 'var(--broken)'
      : state === 'fine'
        ? 'var(--working)'
        : state === 'scanning'
          ? 'var(--structure)'
          : 'var(--border)';
  return {
    fill: state === 'idle' ? 'var(--surface-sunken)' : color,
    fillOpacity: state === 'idle' ? 1 : state === 'scanning' ? 0.45 : 0.3,
    stroke: color,
    strokeWidth: state === 'scanning' ? 2 : 1,
    transition: 'fill 120ms linear',
  };
}

export function CollectLine() {
  const frame = collectFrame(useTick(COLLECT_TICK_MS));

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 240 150"
        role="img"
        aria-labelledby="visual-collect-title"
      >
        <title id="visual-collect-title">
          Fila de seis unidades revisadas de una en una hasta el final. Las que superan el límite
          se copian, en el mismo orden, a la lista del proveedor; la fila original no cambia.
        </title>
        <g aria-hidden="true">
          <text x="8" y="11" className="visual__label">
            Fila de llegada (no cambia)
          </text>
          {COLLECT_UNITS.map((unit, index) => (
            <g key={unit.id}>
              <rect
                x={8 + index * PITCH}
                y={18}
                width={UNIT_W}
                height={34}
                rx={3}
                style={unitStyle(unitState(index, frame))}
              />
              <text x={8 + index * PITCH + UNIT_W / 2} y={32} textAnchor="middle" className="visual__label visual__label--strong">
                {unit.id}
              </text>
              <text x={8 + index * PITCH + UNIT_W / 2} y={46} textAnchor="middle" className="visual__label">
                {unit.temperature}°
              </text>
            </g>
          ))}
          <text x="8" y="68" className="visual__label">
            Límite: {COLLECT_LIMIT}°. Se mira hasta la última.
          </text>
          <text x="8" y="90" className="visual__label visual__label--strong">
            Lista para el proveedor
          </text>
          <rect
            x={8}
            y={95}
            width={224}
            height={34}
            rx={3}
            style={{ fill: 'none', stroke: 'var(--border)', strokeDasharray: '4 3' }}
          />
          {frame.box.map((id, slot) => {
            const unit = COLLECT_UNITS.find((candidate) => candidate.id === id);
            return (
              <g key={id}>
                <rect
                  x={14 + slot * 42}
                  y={100}
                  width={36}
                  height={24}
                  rx={3}
                  style={{ fill: 'var(--broken)', fillOpacity: 0.3, stroke: 'var(--broken)' }}
                />
                <text x={14 + slot * 42 + 18} y={116} textAnchor="middle" className="visual__label visual__label--strong">
                  {id} {unit?.temperature}°
                </text>
              </g>
            );
          })}
          <text x="8" y="146" className={`visual__label${frame.done ? ' visual__label--broken' : ''}`}>
            {frame.done ? 'Salen todas las defectuosas, en orden.' : 'Revisando…'}
          </text>
        </g>
      </svg>
    </figure>
  );
}
