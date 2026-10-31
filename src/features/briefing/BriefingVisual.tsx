/**
 * Small 2D illustration shown beside the briefing text. Pure SVG, driven by a
 * pure frame model (visualModel.ts).
 *
 * Copy here must stay clear of each mission's forbiddenVocabulary.
 */

import { useEffect, useState } from 'react';

import type { Mission } from '../../domain/content/schema';
import {
  GAUGE_LIMIT,
  GAUGE_MAX,
  GAUGE_MIN,
  GAUGE_TICK_MS,
  SCAN_TICK_MS,
  SENSOR_COUNT,
  cellState,
  gaugeFrame,
  scanFrame,
} from './visualModel';
import { CollectLine } from './visuals/m03';

type VisualId = NonNullable<Mission['briefing']['visual']>;

/** Advances one frame every `intervalMs`. */
function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return tick;
}

const CELL_W = 6.5;
const CELL_PITCH = 8;
const ROW_WIDTH = SENSOR_COUNT * CELL_PITCH;

function EarlyExitScan() {
  const tick = useTick(SCAN_TICK_MS);
  const frame = scanFrame(tick);
  const markX = frame.scannerIndex * CELL_PITCH + CELL_W / 2;

  return (
    <figure className="visual">
      <svg
        className="visual__svg"
        viewBox={`0 0 ${ROW_WIDTH} 120`}
        role="img"
        aria-labelledby="visual-scan-title"
      >
        <title id="visual-scan-title">
          Cuarenta sensores en fila. Se revisan de izquierda a derecha y se para en el séptimo,
          que supera el límite; los demás no se revisan.
        </title>
        <g aria-hidden="true">
          {Array.from({ length: SENSOR_COUNT }, (_, index) => (
            <rect
              key={index}
              className={`visual__cell visual__cell--${cellState(index, frame)}`}
              x={index * CELL_PITCH}
              y={10}
              width={CELL_W}
              height={34}
              rx={1.5}
            />
          ))}
          {frame.stopped ? (
            <>
              <polygon
                points={`${markX},52 ${markX + 6},62 ${markX - 6},62`}
                className="visual__stop-mark"
              />
              <text x={markX - 6} y="80" className="visual__label visual__label--broken">
                supera el límite
              </text>
            </>
          ) : null}
          <text x="0" y="108" className="visual__label">
            {frame.stopped ? 'Se para aquí: los demás ya no hacen falta.' : 'Revisando de uno en uno…'}
          </text>
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span><i className="visual__key visual__key--ok" /> revisado, bien</span>
        <span><i className="visual__key visual__key--over" /> supera el límite</span>
        <span><i className="visual__key visual__key--idle" /> sin revisar</span>
      </figcaption>
    </figure>
  );
}

const GAUGE_TOP = 16;
const GAUGE_BOTTOM = 156;

function yFor(value: number): number {
  const ratio = (value - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
  return GAUGE_BOTTOM - ratio * (GAUGE_BOTTOM - GAUGE_TOP);
}

function Gauge() {
  const tick = useTick(GAUGE_TICK_MS);
  const frame = gaugeFrame(tick);
  const levelY = yFor(frame.reading);
  const limitY = yFor(GAUGE_LIMIT);
  const verdict = frame.alarm
    ? 'Arriba del límite: alarma'
    : frame.reading === GAUGE_LIMIT
      ? 'Igual al límite: sin alarma'
      : 'Debajo del límite: sin alarma';

  return (
    <figure className="visual">
      <svg className="visual__svg visual__svg--gauge" viewBox="0 0 240 176" role="img" aria-labelledby="visual-gauge-title">
        <title id="visual-gauge-title">
          Termómetro con una línea de límite. Una lectura por encima del límite dispara la alarma;
          una lectura igual al límite no.
        </title>
        <g aria-hidden="true">
          <rect x="40" y={GAUGE_TOP} width="28" height={GAUGE_BOTTOM - GAUGE_TOP} rx="6" className="visual__tube" />
          <rect
            x="40"
            y={levelY}
            width="28"
            height={GAUGE_BOTTOM - levelY}
            rx="6"
            className={`visual__level${frame.alarm ? ' visual__level--alarm' : ''}`}
          />
          <line x1="30" x2="150" y1={limitY} y2={limitY} className="visual__limit" />
          <text x="156" y={limitY + 14} className="visual__label">límite ({GAUGE_LIMIT})</text>
          <text x="156" y={levelY - 6} className="visual__label visual__label--strong">lectura {frame.reading}</text>
          <text x="80" y="172" className={`visual__label${frame.alarm ? ' visual__label--broken' : ''}`}>
            {verdict}
          </text>
        </g>
      </svg>
      <figcaption className="visual__legend" aria-hidden="true">
        <span>arriba = alarma</span>
        <span>igual = sin alarma</span>
      </figcaption>
    </figure>
  );
}

export function BriefingVisual({ id }: { id: VisualId }) {
  if (id === 'collect-line') return <CollectLine />;
  return id === 'gauge' ? <Gauge /> : <EarlyExitScan />;
}
