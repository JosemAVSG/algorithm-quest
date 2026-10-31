/**
 * Pure frame model for the M04 illustration: a running total and a running
 * count of low lines that survive every pass of the loop, next to what a total
 * declared inside the loop would show (only the last line).
 */

export const TOTAL_MINIMUM = 5;
export const TOTAL_LINES = [10, 2, 7, 3, 8, 5] as const;
export const TOTAL_TICK_MS = 800;
const HOLD_TICKS = 5;
export const TOTAL_CYCLE_TICKS = TOTAL_LINES.length + HOLD_TICKS;

export interface TotalFrame {
  /** Line being added, or null once all lines were processed. */
  current: number | null;
  processed: number;
  total: number;
  low: number;
  /** What a total re-declared on each pass would show: only the last line. */
  restarted: number;
  done: boolean;
}

export function totalFrame(tick: number): TotalFrame {
  const pos = ((tick % TOTAL_CYCLE_TICKS) + TOTAL_CYCLE_TICKS) % TOTAL_CYCLE_TICKS;
  // Line `pos` is processed on its own tick, so the counters already include it.
  const processed = Math.min(pos + 1, TOTAL_LINES.length);
  const seen = TOTAL_LINES.slice(0, processed);
  return {
    current: pos < TOTAL_LINES.length ? pos : null,
    processed,
    total: seen.reduce((sum, quantity) => sum + quantity, 0),
    low: seen.filter((quantity) => quantity < TOTAL_MINIMUM).length,
    restarted: seen[seen.length - 1],
    done: pos >= TOTAL_LINES.length,
  };
}
