/**
 * `npm run content:index`
 *
 * Regenerates `content/index.json`, the lightweight mission index the browser
 * loads up front. The full missions stay in their own async chunks.
 * A unit test fails if the committed index is stale.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRawContent } from '../src/adapters/content/fs';
import { buildMissionIndex } from '../src/domain/content/summary';
import { validateMissionShape } from '../src/domain/content/validate';
import type { Mission } from '../src/domain/content/schema';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loaded = await loadRawContent({ root });
const missions: Mission[] = [];
const problems = [...loaded.issues];

for (const record of loaded.raw.missionRecords) {
  const shape = validateMissionShape(record.data, record.source);
  problems.push(...shape.issues.filter((issue) => issue.severity === 'error'));
  if (shape.mission !== null) missions.push(shape.mission);
}

if (problems.length > 0) {
  console.error('content:index aborted — fix these first (npm run validate:content):');
  for (const issue of problems) console.error(`  ${issue.code} ${issue.source ?? ''} ${issue.message}`);
  process.exit(1);
}

const index = buildMissionIndex(missions);
await writeFile(path.join(root, 'content/index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`✓ content/index.json — ${index.missions.length} missions`);
