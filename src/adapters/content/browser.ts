/**
 * Browser content adapter (docs/07-architecture.md §7).
 *
 * The filesystem adapter reads the same files in Node; this one lets Vite inline
 * them into the bundle. Both feed `assembleContent`, which is the point: the
 * validation rules are written once and enforced in CI and in the browser.
 *
 * A mission file added under `content/missions/` is picked up by the glob with
 * no code change (docs/07 §7, "adding a mission without touching code").
 */

import concepts from '../../../content/concepts.json';
import reinforcement from '../../../content/reinforcement.json';
import workshop from '../../../content/workshop.json';
import worlds from '../../../content/worlds.json';
import {
  assembleContent,
  type ContentReport,
  type RawMissionRecord,
} from '../../domain/content/assemble';

const missionModules = import.meta.glob('../../../content/missions/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function missionRecords(): RawMissionRecord[] {
  return Object.keys(missionModules)
    .sort()
    .map((path) => ({
      source: path.replace(/^.*\/content\//, 'content/'),
      data: missionModules[path],
    }));
}

export function loadBrowserContent(): ContentReport {
  return assembleContent({
    missionRecords: missionRecords(),
    concepts,
    workshop,
    worlds,
    reinforcement,
  });
}
