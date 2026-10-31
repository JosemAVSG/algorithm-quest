/**
 * Browser content adapter (docs/07-architecture.md §7).
 *
 * The filesystem adapter reads the same files in Node for CI (full validation
 * through `assembleContent`). The browser only bundles the lightweight pieces
 * (registries + `content/index.json`); each mission file is a lazy glob entry,
 * so Vite emits one async chunk per mission and `import()`s it when opened.
 *
 * A mission file added under `content/missions/` is picked up by the glob with
 * no code change; only `npm run content:index` must be re-run so the map knows
 * about it (a unit test fails while the index is stale).
 */

import concepts from '../../../content/concepts.json';
import missionIndex from '../../../content/index.json';
import workshop from '../../../content/workshop.json';
import worlds from '../../../content/worlds.json';
import { assembleCatalog, type CatalogReport } from '../../domain/content/catalog';
import {
  createMissionLoader,
  type MissionImporter,
  type MissionLoader,
} from '../../domain/content/mission-loader';

export function loadBrowserCatalog(): CatalogReport {
  return assembleCatalog({ index: missionIndex, concepts, workshop, worlds });
}

/** One lazy importer per mission file. Never `eager`: that would put them all in the main chunk. */
const missionImporters = import.meta.glob('../../../content/missions/*.json', {
  import: 'default',
}) as Record<string, MissionImporter>;

export function createBrowserMissionLoader(): MissionLoader {
  const byId: Record<string, MissionImporter> = {};
  for (const [path, importer] of Object.entries(missionImporters)) {
    const id = /([^/]+)\.json$/.exec(path)?.[1]?.toUpperCase();
    if (id !== undefined) byId[id] = importer;
  }
  return createMissionLoader(byId);
}
