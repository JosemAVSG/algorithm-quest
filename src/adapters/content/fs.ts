/**
 * Filesystem adapter for the content pipeline.
 *
 * The only place that knows content lives in `content/*.json`. Keeping it out
 * of the domain means the browser can later load the same records through
 * `import.meta.glob` and reuse every validation rule unchanged.
 *
 * Parse failures are returned as issues, never thrown: a broken JSON file is a
 * content error the pipeline reports, not an exception the caller has to guess
 * about.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { RawContent, RawMissionRecord } from '../../domain/content/assemble';
import { type ContentIssue, error } from '../../domain/content/errors';

export interface LoadContentOptions {
  /** Project root, i.e. the directory containing `content/`. */
  root: string;
}

export interface LoadedContent {
  raw: RawContent;
  issues: ContentIssue[];
}

type ParseResult = { ok: true; value: unknown } | { ok: false };

function relative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/');
}

async function readJson(root: string, absolute: string, issues: ContentIssue[]): Promise<ParseResult> {
  const source = relative(root, absolute);
  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch {
    issues.push(error('SCHEMA_JSON', 'file is missing or unreadable', { source }));
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    issues.push(error('SCHEMA_JSON', `invalid JSON — ${message}`, { source }));
    return { ok: false };
  }
}

export async function loadRawContent(options: LoadContentOptions): Promise<LoadedContent> {
  const { root } = options;
  const contentDir = path.join(root, 'content');
  const missionsDir = path.join(contentDir, 'missions');
  const issues: ContentIssue[] = [];

  let missionFiles: string[] = [];
  try {
    const entries = await readdir(missionsDir);
    missionFiles = entries.filter((entry) => entry.endsWith('.json')).sort();
  } catch {
    issues.push(
      error('SCHEMA_JSON', 'missions directory is missing or unreadable', {
        source: 'content/missions',
      }),
    );
  }

  const missionRecords: RawMissionRecord[] = [];
  for (const file of missionFiles) {
    const absolute = path.join(missionsDir, file);
    const parsed = await readJson(root, absolute, issues);
    if (parsed.ok) missionRecords.push({ source: relative(root, absolute), data: parsed.value });
  }

  const registry = async (name: string): Promise<unknown> => {
    const parsed = await readJson(root, path.join(contentDir, `${name}.json`), issues);
    return parsed.ok ? parsed.value : undefined;
  };

  return {
    raw: {
      missionRecords,
      concepts: await registry('concepts'),
      workshop: await registry('workshop'),
      worlds: await registry('worlds'),
      reinforcement: await registry('reinforcement'),
    },
    issues,
  };
}
