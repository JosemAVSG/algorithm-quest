/**
 * Reload-and-reopen, for a mission whose files could not be loaded.
 *
 * A browser remembers that a dynamic `import()` of an address failed and fails
 * again without asking the network, even after the server recovers. So asking
 * the loader to "retry" in the same page can never succeed; only a fresh page
 * can. That is also what a player is stuck with after a new deployment: the open
 * tab asks for files whose names changed. The way out is to reload, and to come
 * back to the mission they were opening instead of the map.
 *
 * `sessionStorage` carries the id across the reload. It lives for this tab only
 * and every access is guarded: a blocked storage must not break the error screen.
 */

const KEY = 'algorithm-quest:reopen';

/** Remember which mission to reopen after the next load. Returns false if it could not. */
export function markReopen(missionId: string): boolean {
  try {
    window.sessionStorage.setItem(KEY, missionId);
    return true;
  } catch {
    return false;
  }
}

/** The mission to reopen, if one was marked. Read once: it is cleared as it is taken. */
export function takeReopen(): string | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return value !== null && /^M\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
