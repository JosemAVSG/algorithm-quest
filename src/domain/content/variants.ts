/**
 * Checks for reinforcement variants (docs/05-mastery.md §8).
 *
 * A variant is short, so the checks are few, but each protects something the
 * player relies on: the exercise must be solvable as written, its hidden cases
 * must not just repeat the visible ones, and a concept a mission points to
 * must be the concept the variant actually reinforces.
 */

import { deepEqual } from '../../shared/lib/deep-equal';
import { type ContentIssue, error, warning } from './errors';
import type { Concept, Mission, ReinforcementVariant } from './schema';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const PLACEHOLDER = /\b(todo|tbd|fixme|lorem ipsum|placeholder|pendiente|por escribir|xxx+)\b/i;

export function lintVariants(
  variants: readonly ReinforcementVariant[],
  concepts: readonly Concept[],
  missions: readonly Mission[],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const source = 'content/reinforcement.json';
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const seen = new Set<string>();

  for (const variant of variants) {
    const at = (path: string) => ({ source, path: `variants[${variant.id}].${path}` });

    if (seen.has(variant.id)) {
      issues.push(error('REF_VARIANT', `variant "${variant.id}" is declared twice`, at('id')));
    }
    seen.add(variant.id);

    if (!conceptIds.has(variant.conceptId)) {
      issues.push(
        error('REF_VARIANT', `variant "${variant.id}" reinforces unknown concept "${variant.conceptId}"`, at('conceptId')),
      );
    }
    if (!variant.id.startsWith(`R-${variant.conceptId}-`)) {
      issues.push(
        error('REF_VARIANT', `variant id "${variant.id}" does not carry its concept "${variant.conceptId}"`, at('id')),
      );
    }

    const { entryPoint } = variant.contract;
    if (!IDENTIFIER.test(entryPoint) || !new RegExp(`\\b${entryPoint}\\b`).test(variant.starterCode)) {
      issues.push(
        error('L10_VARIANT', `entry point "${entryPoint}" is not declared in the starter code`, at('contract.entryPoint')),
      );
    }

    const ids = [...variant.tests.visible, ...variant.tests.hidden].map((testCase) => testCase.id);
    if (new Set(ids).size !== ids.length) {
      issues.push(error('L10_VARIANT', 'test ids must be unique inside a variant', at('tests')));
    }
    for (const group of [...variant.tests.visible, ...variant.tests.hidden]) {
      if (group.edge === true || group.edgeKind !== undefined) {
        issues.push(error('L10_VARIANT', `test "${group.id}" is marked as an edge case; variants have none`, at('tests')));
      }
    }
    // Same reason as L6: hidden cases that repeat visible inputs prove nothing.
    for (const hidden of variant.tests.hidden) {
      const repeated = variant.tests.visible.find((visible) => deepEqual(visible.input, hidden.input));
      if (repeated !== undefined) {
        issues.push(
          error('L10_VARIANT', `hidden test "${hidden.id}" repeats the input of visible test "${repeated.id}"`, at('tests.hidden')),
        );
      }
    }

    for (const [field, text] of [
      ['prompt', variant.prompt],
      ['hint', variant.hint],
    ] as const) {
      if (PLACEHOLDER.test(text)) {
        issues.push(error('L10_VARIANT', `${field} contains placeholder text`, at(field)));
      }
    }
    // A hint that names the entry point is a copy task, like the last rung of a mission.
    if (new RegExp(`\\b${entryPoint}\\b`).test(variant.hint)) {
      issues.push(warning('L10_VARIANT', 'the hint names the entry point; it should teach, not dictate', at('hint')));
    }
  }

  // A mission may only list variants of a concept it teaches.
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  for (const mission of missions) {
    const taught = new Set([mission.concepts.primary, ...mission.concepts.secondary]);
    for (const id of mission.mastery.reinforcementVariants) {
      const variant = byId.get(id);
      if (variant !== undefined && !taught.has(variant.conceptId)) {
        issues.push(
          error(
            'REF_VARIANT',
            `${mission.id} lists variant "${id}", which reinforces ${variant.conceptId}, a concept the mission does not teach`,
            { missionId: mission.id, path: 'mastery.reinforcementVariants' },
          ),
        );
      }
    }
  }

  // Not an error: a concept with no variant falls back to replaying its mission.
  const covered = new Set(variants.map((variant) => variant.conceptId));
  const missing = concepts.filter((concept) => !covered.has(concept.id)).map((concept) => concept.id);
  if (variants.length > 0 && missing.length > 0) {
    issues.push(
      warning('L10_VARIANT', `no reinforcement variant for: ${missing.join(', ')}`, { source }),
    );
  }

  return issues;
}
