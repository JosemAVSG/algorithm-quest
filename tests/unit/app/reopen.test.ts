import { afterEach, describe, expect, it } from 'vitest';

import { markReopen, takeReopen } from '../../../src/app/reopen';

function stubStorage(store: Record<string, string>, blocked = false) {
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (key: string) => {
        if (blocked) throw new Error('blocked');
        return store[key] ?? null;
      },
      setItem: (key: string, value: string) => {
        if (blocked) throw new Error('blocked');
        store[key] = value;
      },
      removeItem: (key: string) => {
        if (blocked) throw new Error('blocked');
        delete store[key];
      },
    },
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('reload-and-reopen', () => {
  it('carries a mission id across a reload and forgets it once read', () => {
    stubStorage({});
    expect(markReopen('M13')).toBe(true);
    expect(takeReopen()).toBe('M13');
    expect(takeReopen()).toBeNull(); // read once: a later reload does not reopen it again
  });

  it('returns null when nothing was marked', () => {
    stubStorage({});
    expect(takeReopen()).toBeNull();
  });

  it('ignores a value that is not a mission id', () => {
    stubStorage({ 'algorithm-quest:reopen': '<script>' });
    expect(takeReopen()).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    stubStorage({}, true);
    expect(markReopen('M01')).toBe(false);
    expect(takeReopen()).toBeNull();
  });
});
