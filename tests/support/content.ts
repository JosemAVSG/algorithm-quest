/**
 * Real content, loaded the way CI loads it.
 *
 * Domain tests use the actual M01 rather than a fixture: the mission is the
 * specification for the flow, and a synthetic mission would let the tests pass
 * while the shipped content fails.
 */

import path from 'node:path';

import { loadRawContent } from '../../src/adapters/content/fs';
import { assembleContent, type ContentBundle } from '../../src/domain/content/assemble';
import type { Mission } from '../../src/domain/content/schema';
import { countBySeverity } from '../../src/domain/content/errors';

const root = path.resolve(process.cwd());

export async function loadBundle(): Promise<ContentBundle> {
  const loaded = await loadRawContent({ root });
  const report = assembleContent(loaded.raw);
  if (report.bundle === null) {
    throw new Error('content bundle is null — the test fixture content is invalid');
  }
  const { errors } = countBySeverity(report.issues);
  if (errors > 0) {
    throw new Error(
      `content has ${errors} error(s): ${report.issues.map((issue) => issue.code).join(', ')}`,
    );
  }
  return report.bundle;
}

export async function loadMission(id = 'M01'): Promise<Mission> {
  const bundle = await loadBundle();
  const mission = bundle.missions.find((candidate) => candidate.id === id);
  if (mission === undefined) throw new Error(`mission ${id} is not in the content bundle`);
  return mission;
}
