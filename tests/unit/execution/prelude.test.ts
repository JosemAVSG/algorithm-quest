import { describe, expect, it } from 'vitest';

import { installConsole, installPrelude } from '../../../src/adapters/execution/worker/prelude';

/**
 * S3–S5 and S10 in their cheapest form (docs/10 §6).
 *
 * These assert the prelude's behaviour, not the impossibility of escape. A test
 * claiming the worker is sealed would be a lie encoded in CI (docs/08 §8).
 */
const BLOCKED = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'navigator',
  'postMessage',
  'BroadcastChannel',
  'SharedWorker',
] as const;

describe('execution prelude', () => {
  it('replaces every blocked global with a thrower', () => {
    const scope: Record<string, unknown> = {};
    for (const name of BLOCKED) scope[name] = () => 'original';

    installPrelude(scope as unknown as typeof globalThis);

    for (const name of BLOCKED) {
      const blocked = scope[name] as () => never;
      expect(() => blocked()).toThrow(`${name} is not available`);
    }
  });

  it('rejects property access with the same message, not a generic TypeError', () => {
    const scope: Record<string, unknown> = { indexedDB: { open: () => 'real' } };
    installPrelude(scope as unknown as typeof globalThis);

    const blocked = scope['indexedDB'] as { open: unknown };
    expect(() => blocked.open).toThrow('indexedDB is not available');
  });

  it('keeps working when the global cannot be deleted or redefined', () => {
    const scope: Record<string, unknown> = {};
    Object.defineProperty(scope, 'fetch', {
      configurable: false,
      writable: true,
      value: () => 'still here',
    });

    expect(() => installPrelude(scope as unknown as typeof globalThis)).not.toThrow();
  });

  it('does not touch anything outside the list', () => {
    const scope: Record<string, unknown> = { console, Math, structuredClone };
    installPrelude(scope as unknown as typeof globalThis);
    expect(scope['Math']).toBe(Math);
    expect(typeof scope['structuredClone']).toBe('function');
  });
});

describe('console installation', () => {
  it('replaces the console with the stub and refuses reassignment', () => {
    const scope: Record<string, unknown> = { console: { log: () => 'original' } };
    const stub = { log: () => 'stub' };
    installConsole(scope as unknown as typeof globalThis, stub);

    expect(scope['console']).toBe(stub);
    expect(() => {
      'use strict';
      scope['console'] = {};
    }).toThrow();
  });
});
