import { describe, expect, it } from 'vitest';

import {
  LEGACY_PROGRESS_KEYS,
  PROGRESS_KEY,
  createLocalProgressStore,
} from '../../../src/adapters/persistence/local/progress-store';
import { createLocalSessionStore } from '../../../src/adapters/persistence/local/session-store';
import { emptyProgress, type KeyValueStorage, type PlayerProgress } from '../../../src/domain/persistence/port';
import { createMissionSession, toSnapshot } from '../../../src/domain/session/mission-session';
import { evidenceEvent } from '../../support/evidence';
import { loadMission } from '../../support/content';

function memoryStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

const evidence = evidenceEvent({
  id: 'M01:C01:1234',
  missionId: 'M01',
  conceptId: 'C01',
  at: 1234,
  hintsUsed: 1,
});

const record = {
  missionId: 'M01',
  completedAt: 1234,
  attempts: 2,
  hintsUsed: 1,
  reasoningScore: 2,
  evidence: [evidence],
};

const saved: PlayerProgress = {
  schemaVersion: 2,
  completed: [record],
  events: [evidence],
  reinforcement: [
    {
      conceptId: 'C02',
      missionId: 'M01',
      mastery: 0.4,
      reason: 'assisted',
      queuedAt: 1234,
    },
  ],
  declinedReinforcement: ['C03'],
};

describe('progress store', () => {
  it('starts empty', async () => {
    const store = createLocalProgressStore(memoryStorage());
    expect(await store.load()).toEqual({ progress: emptyProgress(), warning: null });
  });

  it('round-trips progress (IT1)', async () => {
    const store = createLocalProgressStore(memoryStorage());
    await store.save(saved);
    expect(await store.load()).toEqual({ progress: saved, warning: null });
  });

  it('starts fresh with a warning on corrupt JSON (IT2)', async () => {
    const store = createLocalProgressStore(memoryStorage({ [PROGRESS_KEY]: '{oops' }));
    const result = await store.load();

    expect(result.progress).toEqual(emptyProgress());
    expect(result.warning).not.toBeNull();
  });

  it('starts fresh with a warning on a newer schema', async () => {
    const store = createLocalProgressStore(
      memoryStorage({
        [PROGRESS_KEY]: JSON.stringify({ schemaVersion: 99, completed: [] }),
      }),
    );
    const result = await store.load();

    expect(result.progress).toEqual(emptyProgress());
    expect(result.warning).not.toBeNull();
  });

  it('migrates a schemaVersion 0 blob without losing evidence (IT3)', async () => {
    const storage = memoryStorage({
      [PROGRESS_KEY]: JSON.stringify({ schemaVersion: 0, completed: [record] }),
    });
    const store = createLocalProgressStore(storage);
    const result = await store.load();

    expect(result.warning).toBeNull();
    expect(result.progress.completed).toEqual([record]);
    expect(result.progress.events).toEqual([evidence]);
    expect(result.progress.reinforcement).toEqual([]);
    expect(result.progress.declinedReinforcement).toEqual([]);
    expect(result.progress.schemaVersion).toBe(2);
  });

  it('migrates and moves a blob stored under the M1 key', async () => {
    const storage = memoryStorage({
      [LEGACY_PROGRESS_KEYS[0]]: JSON.stringify({ schemaVersion: 1, completed: [record] }),
    });
    const store = createLocalProgressStore(storage);
    const result = await store.load();

    expect(result.progress.events).toEqual([evidence]);
    expect(storage.getItem(LEGACY_PROGRESS_KEYS[0])).toBeNull();
    expect(storage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it('exports, resets and imports the same progress (IT4)', async () => {
    const store = createLocalProgressStore(memoryStorage());
    await store.save(saved);

    const blob = await store.export();
    await store.reset();
    expect(await store.load()).toEqual({ progress: emptyProgress(), warning: null });

    const imported = await store.import(blob);
    expect(imported).toEqual({ progress: saved, warning: null });
    expect(await store.load()).toEqual({ progress: saved, warning: null });
  });

  it('keeps current progress when an import is invalid', async () => {
    const store = createLocalProgressStore(memoryStorage());
    await store.save(saved);

    const imported = await store.import('not json');
    expect(imported.warning).not.toBeNull();
    expect(await store.load()).toEqual({ progress: saved, warning: null });
  });

  it('resets by removing current and legacy keys', async () => {
    const storage = memoryStorage({
      [PROGRESS_KEY]: JSON.stringify(saved),
      [LEGACY_PROGRESS_KEYS[0]]: JSON.stringify(saved),
    });
    const store = createLocalProgressStore(storage);

    await store.reset();
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_PROGRESS_KEYS[0])).toBeNull();
  });
});

describe('session store', () => {
  it('round-trips the session without the editor buffer', async () => {
    const mission = await loadMission('M01');
    const storage = memoryStorage();
    const store = createLocalSessionStore(storage);
    const snapshot = toSnapshot(createMissionSession(mission));

    store.save(snapshot);
    const restored = store.load('M01');

    expect(restored?.missionId).toBe('M01');
    expect(restored?.phase).toBe('briefing');
    expect(restored).not.toHaveProperty('source');
  });

  it('returns null for another mission, corrupt data or a missing key', async () => {
    const mission = await loadMission('M01');
    const storage = memoryStorage();
    const store = createLocalSessionStore(storage);
    store.save(toSnapshot(createMissionSession(mission)));

    expect(store.load('M02')).toBeNull();

    storage.setItem('algorithm-quest:session:v1:M02', '{oops');
    expect(store.load('M02')).toBeNull();

    expect(store.load('M03')).toBeNull();
  });

  it('clears one mission without touching another', async () => {
    const mission = await loadMission('M01');
    const storage = memoryStorage();
    const store = createLocalSessionStore(storage);
    store.save(toSnapshot(createMissionSession(mission)));

    store.clear('M01');
    expect(store.load('M01')).toBeNull();
  });
});
