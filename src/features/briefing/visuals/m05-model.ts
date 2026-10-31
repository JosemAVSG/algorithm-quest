/**
 * Pure frame model for the M05 illustration: each original record stays as it
 * is while a new copy, with `status` and `priority` added, appears below it.
 * Same number of records out as in, same order.
 */

export const COPY_LIMIT_HOURS = 8;
export const COPY_RECORDS = [
  { id: 'R1', device: 'horno', resolved: true, hours: 12 },
  { id: 'R2', device: 'sensor', resolved: false, hours: 2 },
  { id: 'R3', device: 'prensa', resolved: true, hours: 8 },
  { id: 'R4', device: 'bomba', resolved: false, hours: 9 },
] as const;

export const COPY_TICK_MS = 800;
const HOLD_TICKS = 5;
export const COPY_CYCLE_TICKS = COPY_RECORDS.length + HOLD_TICKS;

export interface PanelRow {
  id: string;
  status: 'closed' | 'open';
  priority: 'high' | 'normal';
}

export interface CopyFrame {
  /** Record being copied, or null once all were copied. */
  current: number | null;
  panel: PanelRow[];
  done: boolean;
}

export function panelRow(record: (typeof COPY_RECORDS)[number]): PanelRow {
  return {
    id: record.id,
    status: record.resolved ? 'closed' : 'open',
    priority: record.hours > COPY_LIMIT_HOURS ? 'high' : 'normal',
  };
}

export function copyFrame(tick: number): CopyFrame {
  const pos = ((tick % COPY_CYCLE_TICKS) + COPY_CYCLE_TICKS) % COPY_CYCLE_TICKS;
  const copied = Math.min(pos + 1, COPY_RECORDS.length);
  return {
    current: pos < COPY_RECORDS.length ? pos : null,
    panel: COPY_RECORDS.slice(0, copied).map(panelRow),
    done: pos >= COPY_RECORDS.length,
  };
}
