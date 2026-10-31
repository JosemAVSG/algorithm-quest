/**
 * `npm run validate:content`
 *
 * CI entry point for the content pipeline. Exits non-zero on any error so a
 * broken mission can never reach a build.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRawContent } from '../src/adapters/content/fs';
import { assembleContent } from '../src/domain/content/assemble';
import { type ContentIssue, countBySeverity } from '../src/domain/content/errors';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function groupBySource(issues: readonly ContentIssue[]): Map<string, ContentIssue[]> {
  const grouped = new Map<string, ContentIssue[]>();
  for (const issue of issues) {
    const key = issue.source ?? '(cross-mission)';
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [issue]);
    else bucket.push(issue);
  }
  return grouped;
}

function formatIssue(issue: ContentIssue): string {
  const marker = issue.severity === 'error' ? '✗' : '!';
  const location = issue.path === undefined ? '' : ` ${issue.path}`;
  return `  ${marker} ${issue.code}${location}\n      ${issue.message}`;
}

async function main(): Promise<void> {
  const loaded = await loadRawContent({ root });

  if (loaded.issues.length > 0) {
    console.error('Algorithm Quest — content validation failed to read content\n');
    for (const [source, issues] of groupBySource(loaded.issues)) {
      console.error(source);
      for (const issue of issues) console.error(formatIssue(issue));
      console.error('');
    }
    process.exit(1);
  }

  const report = assembleContent(loaded.raw);
  const { errors, warnings } = countBySeverity(report.issues);
  const { bundle } = report;

  console.log('Algorithm Quest — content validation\n');
  if (bundle !== null) {
    console.log(
      `  missions ${bundle.missions.length} · concepts ${bundle.concepts.length} · systems ${bundle.systems.length} · worlds ${bundle.worlds.length}\n`,
    );
  }

  if (report.issues.length === 0) {
    console.log('  no issues\n');
  } else {
    for (const [source, issues] of groupBySource(report.issues)) {
      console.log(source);
      for (const issue of issues) console.log(formatIssue(issue));
      console.log('');
    }
  }

  const summary = `${errors} error(s), ${warnings} warning(s)`;
  if (errors > 0) {
    console.error(`✗ ${summary}`);
    process.exit(1);
  }
  console.log(`✓ ${summary}`);
}

await main();
