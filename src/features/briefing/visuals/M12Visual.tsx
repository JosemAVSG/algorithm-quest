/**
 * M12 briefing illustration: each order of a mixed stream goes through three
 * questions (seen before? how many per category? which one comes first by
 * priority?), each answered by a different small memory.
 *
 * Copy avoids the mission's forbiddenVocabulary (no "estructura", "recorrido").
 */

import { useEffect, useState } from 'react';

import { M12_ORDERS, M12_TICK_MS, m12Frame } from './m12';

const PANEL_W = 100;
const PANEL_PITCH = 108;
const PANEL_X0 = 2;
const PANEL_TOP = 50;
const PANEL_H = 92;

const INK = 'var(--text)';
const MUTED = 'var(--text-muted)';
const MONO = 'var(--font-mono)';

const HEADS = [
  { question: '¿Repetida?', memory: 'cajón de vistas' },
  { question: '¿Cuántas?', memory: 'pizarra' },
  { question: '¿Quién manda?', memory: 'una ficha' },
] as const;

export function M12Visual() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), M12_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const frame = m12Frame(tick);
  const order = frame.current === null ? null : M12_ORDERS[frame.current];
  const report = frame.phase === 'report';
  const px = (panel: number) => PANEL_X0 + panel * PANEL_PITCH;

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox="0 0 320 160"
        role="img"
        aria-labelledby="visual-m12-title"
      >
        <title id="visual-m12-title">
          Una cola de órdenes mezcladas pasa por tres preguntas. Un cajón recuerda los id vistos y
          detecta las repetidas, una pizarra cuenta las órdenes de cada categoría y una ficha
          guarda la de mayor prioridad, quedándose con la primera si hay empate.
        </title>
        <g aria-hidden="true">
          {/* The order currently being asked about */}
          <rect
            x="62"
            y="4"
            width="196"
            height="24"
            rx="5"
            style={{
              fill: order ? 'var(--structure)' : 'var(--surface-sunken)',
              stroke: order ? 'var(--structure)' : 'var(--border)',
            }}
          />
          <text
            x="160"
            y="20"
            textAnchor="middle"
            style={{ fontSize: 11, fontFamily: MONO, fill: order ? 'var(--surface)' : MUTED }}
          >
            {order
              ? `${order.id} · ${order.category} · prioridad ${order.priority}`
              : 'informe listo'}
          </text>

          {HEADS.map((head, panel) => (
            <g key={head.question}>
              <line
                x1="160"
                x2={px(panel) + PANEL_W / 2}
                y1="29"
                y2={PANEL_TOP - 1}
                style={{ stroke: order ? 'var(--structure)' : 'var(--border)', strokeWidth: 1.5 }}
              />
              <rect
                x={px(panel)}
                y={PANEL_TOP}
                width={PANEL_W}
                height={PANEL_H}
                rx={6}
                style={{
                  fill: 'var(--surface-sunken)',
                  stroke:
                    report ? 'var(--working)'
                    : panel === 0 && frame.repeatNow ? 'var(--attention)'
                    : 'var(--border)',
                  strokeWidth: report || (panel === 0 && frame.repeatNow) ? 2.5 : 1,
                }}
              />
              <text x={px(panel) + 6} y={PANEL_TOP + 14} style={{ fontSize: 12, fontFamily: 'var(--font-ui)', fill: INK }}>
                {head.question}
              </text>
              <text x={px(panel) + 6} y={PANEL_TOP + 26} style={{ fontSize: 10, fontFamily: 'var(--font-ui)', fill: MUTED }}>
                {head.memory}
              </text>
            </g>
          ))}

          {/* Panel 1: drawer of seen ids + repeated ones */}
          {frame.seen.map((id, index) => (
            <g key={id}>
              <rect
                x={px(0) + 8 + index * 28}
                y={PANEL_TOP + 36}
                width="22"
                height="20"
                rx="4"
                style={{
                  fill: 'var(--surface)',
                  stroke: frame.duplicates.includes(id) ? 'var(--attention)' : 'var(--border)',
                  strokeWidth: frame.duplicates.includes(id) ? 2 : 1,
                }}
              />
              <text x={px(0) + 19 + index * 28} y={PANEL_TOP + 50} textAnchor="middle" style={{ fontSize: 11, fontFamily: MONO, fill: INK }}>
                {id}
              </text>
            </g>
          ))}
          <text
            x={px(0) + 6}
            y={PANEL_TOP + 80}
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
              fill: frame.repeatNow || frame.duplicates.length > 0 ? 'var(--attention)' : MUTED,
            }}
          >
            {frame.repeatNow
              ? `${order?.id} ya estaba`
              : frame.duplicates.length > 0
                ? `repetidas: ${frame.duplicates.join(' ')}`
                : 'ninguna repetida'}
          </text>

          {/* Panel 2: tally board in first-appearance order */}
          {frame.counts.map(([category, count], index) => (
            <g key={category}>
              <text x={px(1) + 6} y={PANEL_TOP + 44 + index * 17} style={{ fontSize: 10, fontFamily: MONO, fill: INK }}>
                {category}
              </text>
              {Array.from({ length: count }, (_, bar) => (
                <rect
                  key={bar}
                  x={px(1) + 56 + bar * 12}
                  y={PANEL_TOP + 35 + index * 17}
                  width="10"
                  height="12"
                  rx="2"
                  style={{ fill: 'var(--structure)' }}
                />
              ))}
            </g>
          ))}

          {/* Panel 3: single candidate */}
          {frame.best ? (
            <>
              <text x={px(2) + 6} y={PANEL_TOP + 54} style={{ fontSize: 24, fontFamily: MONO, fill: INK }}>
                {frame.best.id}
              </text>
              <text x={px(2) + 34} y={PANEL_TOP + 54} style={{ fontSize: 11, fontFamily: MONO, fill: MUTED }}>
                prio {frame.best.priority}
              </text>
              <text
                x={px(2) + 6}
                y={PANEL_TOP + 80}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-ui)',
                  fill: frame.priorityNote === 'tie' ? 'var(--attention)' : MUTED,
                }}
              >
                {frame.priorityNote === 'tie'
                  ? 'empate: sigue la primera'
                  : frame.priorityNote === 'new'
                    ? 'nueva favorita'
                    : frame.priorityNote === 'keep'
                      ? 'no la supera'
                      : 'la mejor del año'}
              </text>
            </>
          ) : null}

          <text x="160" y="155" textAnchor="middle" style={{ fontSize: 11, fontFamily: 'var(--font-ui)', fill: report ? INK : MUTED }}>
            {report
              ? 'Tres preguntas, tres memorias distintas.'
              : 'Cada orden pasa por las tres preguntas.'}
          </text>
        </g>
      </svg>
    </figure>
  );
}
