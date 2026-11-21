/**
 * "What opened since the player last looked at the map?"
 *
 * Pure diff plus a tiny storage wrapper. It never decides what is unlocked
 * (progression does); it only remembers which ids the map has already shown, so
 * the unlock animation plays once.
 */

const STORAGE_KEY = 'aq.map.seen';

/** Ids present now that were not in the last snapshot. No snapshot (first visit) means nothing is "new". */
export function newlyUnlocked(
  previous: readonly string[] | null,
  current: readonly string[],
): string[] {
  if (previous === null) return [];
  const seen = new Set(previous);
  return current.filter((id) => !seen.has(id));
}

/**
 * Snapshot to store after showing `visible` ids: everything seen before plus what
 * is on screen now. Ids of a level the player has not opened stay "new" until it is shown.
 */
export function nextSeen(
  previous: readonly string[] | null,
  visible: readonly string[],
  everything: readonly string[],
): string[] {
  if (previous === null) return [...everything];
  return [...new Set([...previous, ...visible])];
}

export function readSeen(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSeen(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Blocked storage: the animation may replay next visit, nothing else changes.
  }
}
