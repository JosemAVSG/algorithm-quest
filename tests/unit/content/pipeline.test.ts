import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadRawContent } from '../../../src/adapters/content/fs';
import { assembleContent } from '../../../src/domain/content/assemble';
import { countBySeverity } from '../../../src/domain/content/errors';

const root = path.resolve(process.cwd());

describe('real content', () => {
  it('parses, validates and lints with zero errors', async () => {
    const loaded = await loadRawContent({ root });
    expect(loaded.issues).toEqual([]);

    const report = assembleContent(loaded.raw);
    const { errors } = countBySeverity(report.issues);
    expect(
      report.issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.missionId ?? ''} ${issue.message}`),
    ).toEqual([]);
    expect(errors).toBe(0);
  });

  it('loads every mission file that exists on disk', async () => {
    const loaded = await loadRawContent({ root });
    const report = assembleContent(loaded.raw);
    expect(report.bundle).not.toBeNull();
    expect(report.bundle?.missions.map((mission) => mission.id)).toEqual(
      loaded.raw.missionRecords.map((record) => {
        const data = record.data as { id: string };
        return data.id;
      }),
    );
  });

  it('derives a play order that starts at M01', async () => {
    const loaded = await loadRawContent({ root });
    const report = assembleContent(loaded.raw);
    expect(report.bundle?.sequenceById.get('M01')).toBe(0);
  });

  it('keeps every concept referenced by content in the registry', async () => {
    const loaded = await loadRawContent({ root });
    const report = assembleContent(loaded.raw);
    const referenced = new Set(
      (report.bundle?.missions ?? []).flatMap((mission) => [
        mission.concepts.primary,
        ...mission.concepts.secondary,
        ...mission.prerequisites.concepts,
      ]),
    );
    const registered = new Set((report.bundle?.concepts ?? []).map((concept) => concept.id));
    for (const conceptId of referenced) expect(registered.has(conceptId)).toBe(true);
  });
});
