/**
 * Pure frame model for the M11 briefing illustration: orders arrive one by
 * one and fall into labelled buckets whose tallies grow; at the end two
 * buckets tie and the alphabetical rule decides.
 */

/** One tick per 700 ms, about 1.4 Hz, well below the 3 Hz flash threshold. */
export const M11_TICK_MS = 700;

/** Categories in the order their bucket is drawn (arrival order of first appearance). */
export const M11_BUCKETS = ['motor', 'frenos', '__proto__'] as const;
/** The incoming stream of order categories. */
export const M11_ORDERS = ['motor', 'frenos', '__proto__', 'motor', 'frenos'] as const;
/** Bucket index of the alphabetical winner of the final tie (frenos < motor). */
export const M11_WINNER_INDEX = 1;

const STREAM_TICKS = M11_ORDERS.length;
const TIE_TICKS = 2;
const WINNER_HOLD_TICKS = 5;
export const M11_CYCLE_TICKS = STREAM_TICKS + TIE_TICKS + WINNER_HOLD_TICKS;

export type M11Phase = 'counting' | 'tie' | 'winner';

export interface M11Frame {
  phase: M11Phase;
  /** Index into M11_ORDERS of the order falling right now, or null. */
  incoming: number | null;
  /** Tally per bucket, parallel to M11_BUCKETS. */
  tallies: number[];
  /** Indexes of the buckets that share the top tally (shown in the tie/winner phases). */
  leaders: number[];
  /** Bucket index that wins, or null until the rule has been applied. */
  winner: number | null;
}

function talliesAfter(count: number): number[] {
  const tallies = M11_BUCKETS.map(() => 0);
  for (const category of M11_ORDERS.slice(0, count)) {
    tallies[M11_BUCKETS.indexOf(category)] += 1;
  }
  return tallies;
}

export function m11Frame(tick: number): M11Frame {
  const position = ((tick % M11_CYCLE_TICKS) + M11_CYCLE_TICKS) % M11_CYCLE_TICKS;

  if (position < STREAM_TICKS) {
    return {
      phase: 'counting',
      incoming: position,
      tallies: talliesAfter(position),
      leaders: [],
      winner: null,
    };
  }

  const tallies = talliesAfter(STREAM_TICKS);
  const top = Math.max(...tallies);
  const leaders = tallies.flatMap((value, index) => (value === top ? [index] : []));
  const resolved = position >= STREAM_TICKS + TIE_TICKS;
  return {
    phase: resolved ? 'winner' : 'tie',
    incoming: null,
    tallies,
    leaders,
    winner: resolved ? M11_WINNER_INDEX : null,
  };
}
