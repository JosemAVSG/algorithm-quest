/**
 * Pure frame model for the M12 briefing illustration: a mixed stream of
 * orders passes three questions, each answered by a different small memory:
 * a drawer of seen ids (repeats), a tally board (per category) and a single
 * candidate slot (top priority, first one wins ties).
 */

/** One tick per 800 ms, about 1.25 Hz, well below the 3 Hz flash threshold. */
export const M12_TICK_MS = 800;

export interface M12Order {
  id: string;
  category: string;
  priority: number;
}

export const M12_ORDERS: readonly M12Order[] = [
  { id: 'A', category: 'motor', priority: 2 },
  { id: 'B', category: 'frenos', priority: 5 },
  { id: 'A', category: 'motor', priority: 2 },
  { id: 'C', category: '__proto__', priority: 5 },
  { id: 'B', category: 'frenos', priority: 5 },
];

const STREAM_TICKS = M12_ORDERS.length;
const REPORT_HOLD_TICKS = 5;
export const M12_CYCLE_TICKS = STREAM_TICKS + REPORT_HOLD_TICKS;

export type M12PriorityNote = 'new' | 'keep' | 'tie';

export interface M12Frame {
  phase: 'stream' | 'report';
  /** Index into M12_ORDERS of the order being processed, or null. */
  current: number | null;
  /** Ids seen so far, in first-seen order (the drawer). */
  seen: string[];
  /** Whether the current order is a repeat of an id already in the drawer. */
  repeatNow: boolean;
  /** Ids reported as duplicates, once each, in order of first appearance. */
  duplicates: string[];
  /** [category, count] in first-appearance order (the tally board). */
  counts: [string, number][];
  /** The single candidate kept for the top-priority question. */
  best: M12Order | null;
  /** What the current order did to the candidate. */
  priorityNote: M12PriorityNote | null;
}

/** Applies the first `processed` orders. */
function state(processed: number) {
  const seen: string[] = [];
  const repeated = new Set<string>();
  const counts: [string, number][] = [];
  let best: M12Order | null = null;
  let note: M12PriorityNote | null = null;
  let repeatNow = false;

  for (const order of M12_ORDERS.slice(0, processed)) {
    repeatNow = seen.includes(order.id);
    if (repeatNow) repeated.add(order.id);
    else seen.push(order.id);

    const entry = counts.find(([category]) => category === order.category);
    if (entry) entry[1] += 1;
    else counts.push([order.category, 1]);

    if (best === null || order.priority > best.priority) {
      best = order;
      note = 'new';
    } else {
      note = order.priority === best.priority ? 'tie' : 'keep';
    }
  }

  const duplicates = seen.filter((id) => repeated.has(id));
  return { seen, repeatNow, duplicates, counts, best, note };
}

export function m12Frame(tick: number): M12Frame {
  const position = ((tick % M12_CYCLE_TICKS) + M12_CYCLE_TICKS) % M12_CYCLE_TICKS;
  const inStream = position < STREAM_TICKS;
  const processed = inStream ? position + 1 : STREAM_TICKS;
  const s = state(processed);
  return {
    phase: inStream ? 'stream' : 'report',
    current: inStream ? position : null,
    seen: s.seen,
    repeatNow: inStream && s.repeatNow,
    duplicates: s.duplicates,
    counts: s.counts,
    best: s.best,
    priorityNote: inStream ? s.note : null,
  };
}
