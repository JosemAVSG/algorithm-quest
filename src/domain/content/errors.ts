/**
 * Content validation vocabulary.
 *
 * Every issue the pipeline can emit has a stable code. Codes are part of the
 * contract: the CLI prints them, CI matches on them, and tests assert on them.
 * Adding a code is additive; renaming one is a breaking change for tooling.
 */

export type Severity = 'error' | 'warning';

export const CONTENT_ISSUE_CODES = [
  // Structural (docs/09-mission-schema.md §4, V1–V7)
  'SCHEMA_UNKNOWN_KEY',
  'SCHEMA_BAD_ID',
  'SCHEMA_NO_ENTRY',
  'SCHEMA_DUP_TEST_ID',
  'SCHEMA_HINTS',
  'SCHEMA_BAD_INDEX',
  'SCHEMA_OUTPUT_SHAPE',
  'SCHEMA_INVALID',
  'SCHEMA_JSON',

  // Referential (V8–V12)
  'REF_PREREQ',
  'REF_CONCEPT',
  'REF_SYSTEM',
  'REF_CYCLE',
  'REF_REWARD_MISMATCH',
  'REF_WORLD',
  'REF_WORLD_ORDER',
  'REF_DUP_MISSION',
  'REF_REGISTRY',

  // Pedagogical lints (docs/10-testing-and-security.md §4, L1–L8)
  'L1_VOCABULARY_LEAK',
  'L2_CONCEPT_BUDGET',
  'L3_OPTIMIZATION_ORDER',
  'L4_REWARD_TRANSITION',
  'L5_HINT_LADDER',
  'L6_TEST_INDEPENDENCE',
  'L7_EDGE_COVERAGE',
  'L8_DEBRIEF_SUBSTANCE',
  'L9_EXPLAIN_SHAPE',

  // Curriculum invariants
  'COVERAGE_INSUFFICIENT',
  'WORLD_INCOMPLETE',
] as const;

export type ContentIssueCode = (typeof CONTENT_ISSUE_CODES)[number];

export interface ContentIssue {
  code: ContentIssueCode;
  severity: Severity;
  /** Human-readable, actionable. Names the field and what is wrong. */
  message: string;
  /** Mission the issue belongs to, when it is mission-scoped. */
  missionId?: string;
  /** Source file, relative to the project root. */
  source?: string;
  /** Dotted path inside the record, e.g. `tests.edge[2].edgeKind`. */
  path?: string;
}

export function error(
  code: ContentIssueCode,
  message: string,
  extra: Omit<ContentIssue, 'code' | 'severity' | 'message'> = {},
): ContentIssue {
  return { code, severity: 'error', message, ...extra };
}

export function warning(
  code: ContentIssueCode,
  message: string,
  extra: Omit<ContentIssue, 'code' | 'severity' | 'message'> = {},
): ContentIssue {
  return { code, severity: 'warning', message, ...extra };
}

export function countBySeverity(issues: readonly ContentIssue[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === 'error') errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}
