/**
 * On-demand mission loading (docs/07-architecture.md §7).
 *
 * Importers are injected: the browser adapter hands over `import()` thunks (one
 * async chunk per mission), tests hand over stubs. A failed load is never
 * cached, so "Reintentar" really asks the network again.
 */

import type { Mission } from './schema';
import { validateMissionShape } from './validate';

export type MissionImporter = () => Promise<unknown>;

export interface MissionLoader {
  load(id: string): Promise<Mission>;
  /** Already-loaded mission, or null. Lets the UI skip the loading state on cache hits. */
  peek(id: string): Mission | null;
}

export function createMissionLoader(importers: Readonly<Record<string, MissionImporter>>): MissionLoader {
  const cache = new Map<string, Mission>();
  const pending = new Map<string, Promise<Mission>>();

  async function fetchMission(id: string): Promise<Mission> {
    const importer = importers[id];
    if (importer === undefined) throw new Error(`No content file for mission ${id}`);
    const data = await importer();
    // Cheap shape check; cross-mission rules already ran in CI (validate:content).
    const { mission, issues } = validateMissionShape(data, `content/missions/${id}`);
    if (mission === null) {
      throw new Error(`Mission ${id} is malformed: ${issues[0]?.message ?? 'unknown error'}`);
    }
    if (mission.id !== id) throw new Error(`Mission ${id} resolved to ${mission.id}`);
    cache.set(id, mission);
    return mission;
  }

  return {
    peek: (id) => cache.get(id) ?? null,
    load(id) {
      const cached = cache.get(id);
      if (cached !== undefined) return Promise.resolve(cached);
      const inflight = pending.get(id);
      if (inflight !== undefined) return inflight;
      const promise = fetchMission(id).finally(() => pending.delete(id));
      pending.set(id, promise);
      return promise;
    },
  };
}
