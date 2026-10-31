/**
 * M10 briefing illustration: finding the first repeated id by looking back
 * over the whole list every time, versus noting each id in a "seen" drawer and
 * asking the drawer (one look per id). Both rows walk the same ids; the
 * counters show how many looks each way has cost when the repeat is caught.
 *
 * The frame model is pure (tick -> frame); the component only draws it.
 * Copy must stay clear of the mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

export const DRAWER_IDS = [4, 8, 2, 9, 5, 1, 2, 6] as const;
/** Position of the id that shows up for the second time first. */
export const REPEAT_INDEX = 6;
/** Position of that id's first appearance (the chip that gets highlighted). */
export const MATCH_INDEX = 2;
/** One tick per 450 ms = ~2.2 Hz, below the 3 Hz flash threshold. */
export const DRAWER_TICK_MS = 450;
const HOLD_TICKS = 6;
export const DRAWER_CYCLE_TICKS = REPEAT_INDEX + 1 + HOLD_TICKS;

export interface DrawerFrame {
  /** Index of the id being handled. */
  current: number;
  /** Looks spent by re-reading every earlier id each time. */
  scanLooks: number;
  /** Looks spent by asking the drawer once per id. */
  drawerLooks: number;
  found: boolean;
}

export function drawerFrame(tick: number): DrawerFrame {
  const position = ((tick % DRAWER_CYCLE_TICKS) + DRAWER_CYCLE_TICKS) % DRAWER_CYCLE_TICKS;
  const current = Math.min(position, REPEAT_INDEX);
  return {
    current,
    scanLooks: (current * (current + 1)) / 2,
    drawerLooks: current + 1,
    found: current === REPEAT_INDEX,
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

const PITCH = 28;
const BOX = 24;
const X0 = 8;

type Look = 'idle' | 'current' | 'looked' | 'stored' | 'found';

const LOOK_STYLE: Record<Look, { fill: string; stroke: string; opacity: number; width: number }> = {
  idle: { fill: 'var(--surface-sunken)', stroke: 'var(--border)', opacity: 1, width: 1 },
  current: { fill: 'var(--surface)', stroke: 'var(--attention)', opacity: 1, width: 2.5 },
  looked: { fill: 'var(--structure)', stroke: 'var(--structure)', opacity: 0.35, width: 1 },
  stored: { fill: 'var(--working)', stroke: 'var(--working)', opacity: 0.45, width: 1 },
  found: { fill: 'var(--broken)', stroke: 'var(--broken)', opacity: 0.6, width: 1.5 },
};

function Box({ x, y, id, look }: { x: number; y: number; id: number; look: Look }) {
  const style = LOOK_STYLE[look];
  return (
    <>
      <rect
        x={x}
        y={y}
        width={BOX}
        height={22}
        rx={3}
        style={{
          fill: style.fill,
          stroke: style.stroke,
          fillOpacity: style.opacity,
          strokeWidth: style.width,
        }}
      />
      <text
        x={x + BOX / 2}
        y={y + 15}
        textAnchor="middle"
        className="visual__label visual__label--strong"
      >
        {id}
      </text>
    </>
  );
}

export function SeenDrawer() {
  const tick = useTick(DRAWER_TICK_MS);
  const frame = drawerFrame(tick);

  const scanLook = (index: number): Look => {
    if (frame.found && (index === REPEAT_INDEX || index === MATCH_INDEX)) return 'found';
    if (index === frame.current) return 'current';
    return index < frame.current ? 'looked' : 'idle';
  };
  const listLook = (index: number): Look => {
    if (frame.found && index === REPEAT_INDEX) return 'found';
    if (index === frame.current) return 'current';
    return index < frame.current ? 'stored' : 'idle';
  };

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 240 158"
        role="img"
        aria-labelledby="visual-drawer-title"
      >
        <title id="visual-drawer-title">
          Dos formas de buscar el primer id repetido en una lista de ocho. Volver a mirar todo lo
          anterior para cada id suma 21 miradas; anotar cada id en un cajón y preguntarle al cajón
          solo cuesta 7, y el repetido se detecta en el mismo momento.
        </title>
        <g aria-hidden="true">
          <text x={X0} y="11" className="visual__label">volver a mirar la lista</text>
          <text x="232" y="11" textAnchor="end" className="visual__label visual__label--strong">
            {frame.scanLooks} miradas
          </text>
          {DRAWER_IDS.map((id, index) => (
            <Box key={`a${index}`} x={X0 + index * PITCH} y={16} id={id} look={scanLook(index)} />
          ))}

          <text x={X0} y="70" className="visual__label">preguntar al cajón</text>
          <text x="232" y="70" textAnchor="end" className="visual__label visual__label--strong">
            {frame.drawerLooks} miradas
          </text>
          {DRAWER_IDS.map((id, index) => (
            <Box key={`b${index}`} x={X0 + index * PITCH} y={76} id={id} look={listLook(index)} />
          ))}

          <rect
            x="3"
            y="106"
            width="234"
            height="34"
            rx="4"
            style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.5, strokeDasharray: '4 3' }}
          />
          {DRAWER_IDS.map((id, index) =>
            index < frame.current ? (
              <Box
                key={`c${index}`}
                x={X0 + index * PITCH}
                y={112}
                id={id}
                look={frame.found && index === MATCH_INDEX ? 'found' : 'stored'}
              />
            ) : null,
          )}
          <text x={X0} y="153" className="visual__label">cajón de ids ya vistos</text>
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span><i className="visual__key" style={{ background: 'var(--structure)', opacity: 0.5 }} /> se vuelve a mirar</span>
        <span><i className="visual__key visual__key--ok" /> ya anotado</span>
        <span><i className="visual__key visual__key--over" /> primer repetido</span>
        <span><i className="visual__key visual__key--idle" /> sin ver</span>
      </figcaption>
    </figure>
  );
}
