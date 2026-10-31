/**
 * Pure frame model for the briefing illustrations. The component only maps
 * these frames to SVG, so the timeline is testable without a DOM.
 */

export const SENSOR_COUNT = 40;
/** Zero-based index of the first reading above the limit (cell #7). */
export const STOP_INDEX = 6;
/** Ticks the stopped frame is held before the loop restarts. */
const HOLD_TICKS = 6;
export const CYCLE_TICKS = STOP_INDEX + 1 + HOLD_TICKS;
/** One tick per 400 ms = 2.5 Hz, below the 3 Hz flash threshold. */
export const SCAN_TICK_MS = 400;

export type CellState = 'idle' | 'scanning' | 'ok' | 'over';

export interface ScanFrame {
  scannerIndex: number;
  stopped: boolean;
}

export function scanFrame(tick: number): ScanFrame {
  const position = ((tick % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS;
  const scannerIndex = Math.min(position, STOP_INDEX);
  return { scannerIndex, stopped: position >= STOP_INDEX };
}

export function cellState(index: number, frame: ScanFrame): CellState {
  if (index < frame.scannerIndex) return 'ok';
  if (index === frame.scannerIndex) return frame.stopped ? 'over' : 'scanning';
  return 'idle';
}

export const GAUGE_LIMIT = 90;
export const GAUGE_MIN = 60;
export const GAUGE_MAX = 110;
export const GAUGE_TICK_MS = 1800;
const GAUGE_READINGS = [75, GAUGE_LIMIT, 95] as const;

export interface GaugeFrame {
  reading: number;
  alarm: boolean;
}

export function gaugeFrame(tick: number): GaugeFrame {
  const reading = GAUGE_READINGS[((tick % 3) + 3) % 3];
  return { reading, alarm: reading > GAUGE_LIMIT };
}
