import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadRawContent } from '../../../src/adapters/content/fs';
import {
  MissionIndexSchema,
  buildMissionIndex,
  summarizeMission,
} from '../../../src/domain/content/summary';
import { validateMissionShape } from '../../../src/domain/content/validate';

const root = path.resolve(process.cwd());

async function fullMissions() {
  const loaded = await loadRawContent({ root });
  return loaded.raw.missionRecords.map((record) => {
    const { mission } = validateMissionShape(record.data, record.source);
    if (mission === null) throw new Error(`${record.source} is not a valid mission`);
    return mission;
  });
}

describe('mission index (map data)', () => {
  it('summarises only what the map, unlock, progress and concept search read', async () => {
    const [m01] = await fullMissions();
    const summary = summarizeMission(m01);
    expect(Object.keys(summary).sort()).toEqual(
      ['concepts', 'id', 'order', 'prerequisites', 'reward', 'subtitle', 'title', 'workshop', 'world'].sort(),
    );
    expect(summary.workshop).toEqual({ systemId: m01.workshop.systemId, to: m01.workshop.to });
    expect(summary.prerequisites).toEqual({ missions: m01.prerequisites.missions });
  });

  it('names every mission file after its id, which is how the browser maps files to ids', async () => {
    const loaded = await loadRawContent({ root });
    for (const record of loaded.raw.missionRecords) {
      const id = (record.data as { id: string }).id;
      expect(record.source).toBe(`content/missions/${id.toLowerCase()}.json`);
    }
  });

  it('is sorted by mission id so regeneration is deterministic', async () => {
    const index = buildMissionIndex(await fullMissions());
    const ids = index.missions.map((mission) => mission.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('content/index.json is not stale: run `npm run content:index` after editing a mission', async () => {
    const onDisk = JSON.parse(await readFile(path.join(root, 'content/index.json'), 'utf8')) as unknown;
    expect(MissionIndexSchema.parse(onDisk)).toEqual(buildMissionIndex(await fullMissions()));
  });
});
