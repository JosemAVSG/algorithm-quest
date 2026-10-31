/**
 * Pure frame model for the M03 illustration: a line of units is inspected one
 * by one, every defective unit gets a copy in the return box (in arrival
 * order) and the original line never changes. The scan never stops early.
 */

export const COLLECT_LIMIT = 90;
export const COLLECT_UNITS = [
  { id: 'A', temperature: 95 },
  { id: 'B', temperature: 80 },
  { id: 'C', temperature: 97 },
  { id: 'D', temperature: 88 },
  { id: 'E', temperature: 92 },
  { id: 'F', temperature: 85 },
] as const;

export const COLLECT_TICK_MS = 700;
const HOLD_TICKS = 5;
export const COLLECT_CYCLE_TICKS = COLLECT_UNITS.length + HOLD_TICKS;

export type UnitState = 'idle' | 'scanning' | 'defective' | 'fine';

export interface CollectFrame {
  /** Unit being inspected, or null once the whole line was inspected. */
  scanner: number | null;
  /** Ids in the return box, in arrival order. */
  box: string[];
  done: boolean;
}

export function collectFrame(tick: number): CollectFrame {
  const pos = ((tick % COLLECT_CYCLE_TICKS) + COLLECT_CYCLE_TICKS) % COLLECT_CYCLE_TICKS;
  const checked = Math.min(pos, COLLECT_UNITS.length);
  return {
    scanner: pos < COLLECT_UNITS.length ? pos : null,
    box: COLLECT_UNITS.slice(0, checked)
      .filter((unit) => unit.temperature > COLLECT_LIMIT)
      .map((unit) => unit.id),
    done: pos >= COLLECT_UNITS.length,
  };
}

export function unitState(index: number, frame: CollectFrame): UnitState {
  if (frame.scanner === index) return 'scanning';
  const checked = frame.done || (frame.scanner !== null && index < frame.scanner);
  if (!checked) return 'idle';
  return COLLECT_UNITS[index].temperature > COLLECT_LIMIT ? 'defective' : 'fine';
}
