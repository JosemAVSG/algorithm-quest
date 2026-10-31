/**
 * Structured explanation (docs/04-mentor.md §6): a cloze sentence plus
 * comprehension questions, graded by exact match. Replaces the keyword rubric
 * for missions that author `debrief.explain`.
 *
 * Pure and deterministic. Feedback names *which* items to rethink and never
 * carries the correct index.
 */

import type { ExplainSpec } from '../content/schema';

export type ExplainScore = 2 | 3;

export interface ExplainAnswers {
  blanks: Record<string, number>;
  questions: Record<string, number>;
}

export interface ExplainAssessment {
  /** Every item answered, every answer right. */
  passed: boolean;
  /** Item id -> the (wrong) option index that was submitted. */
  wrong: Record<string, number>;
  /** Ids of items with no answer yet, in display order. */
  missing: string[];
}

export type TemplatePart = { kind: 'text'; text: string } | { kind: 'blank'; id: string };

const PLACEHOLDER = /\{([^{}]+)\}/g;

export function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', text: template.slice(last, index) });
    parts.push({ kind: 'blank', id: match[1] ?? '' });
    last = index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: 'text', text: template.slice(last) });
  return parts;
}

export function assessExplain(spec: ExplainSpec, answers: ExplainAnswers): ExplainAssessment {
  const wrong: Record<string, number> = {};
  const missing: string[] = [];

  for (const blank of spec.blanks) {
    const given = answers.blanks[blank.id];
    if (given === undefined) missing.push(blank.id);
    else if (given !== blank.correctIndex) wrong[blank.id] = given;
  }
  for (const question of spec.questions) {
    const given = answers.questions[question.id];
    if (given === undefined) missing.push(question.id);
    else if (given !== question.correctIndex) wrong[question.id] = given;
  }

  return { passed: missing.length === 0 && Object.keys(wrong).length === 0, wrong, missing };
}

/**
 * 3 = everything right on the first graded submission, 2 = right after
 * retries. Both clear the gate (REASONING_MIN_SCORE = 2): retrying is
 * learning, not failing.
 */
export function explainScore(failedSubmissions: number): ExplainScore {
  return failedSubmissions === 0 ? 3 : 2;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function checkOptions(id: string, options: readonly string[], correctIndex: number): string[] {
  const problems: string[] = [];
  if (correctIndex >= options.length) {
    problems.push(`${id}: correctIndex ${correctIndex} is outside options`);
  }
  if (new Set(options.map(fold)).size !== options.length) {
    problems.push(`${id}: options contain duplicates`);
  }
  return problems;
}

/** Cross-field rules zod cannot express. Returns human-readable problems. */
export function validateExplainSpec(spec: ExplainSpec): string[] {
  const problems: string[] = [];

  const ids = [...spec.blanks.map((b) => b.id), ...spec.questions.map((q) => q.id)];
  if (new Set(ids).size !== ids.length) problems.push('explain: duplicate item ids');

  const placeholders = parseTemplate(spec.template)
    .filter((part): part is { kind: 'blank'; id: string } => part.kind === 'blank')
    .map((part) => part.id);
  const blankIds = new Set(spec.blanks.map((b) => b.id));
  for (const id of placeholders) {
    if (!blankIds.has(id)) problems.push(`template placeholder {${id}} has no blank`);
  }
  for (const id of blankIds) {
    if (!placeholders.includes(id)) problems.push(`blank ${id} is not used in the template`);
  }
  if (new Set(placeholders).size !== placeholders.length) {
    problems.push('template uses a placeholder more than once');
  }

  for (const blank of spec.blanks) {
    problems.push(...checkOptions(blank.id, blank.options, blank.correctIndex));
  }
  for (const question of spec.questions) {
    problems.push(...checkOptions(question.id, question.options, question.correctIndex));
    if (question.whyWrong !== undefined && question.whyWrong.length !== question.options.length) {
      problems.push(`${question.id}: whyWrong must be parallel to options`);
    }
  }

  return problems;
}
