/**
 * Structural and referential validation (docs/09-mission-schema.md §4, V1–V12).
 *
 * Pure functions over data. No filesystem, no globals, no ordering assumptions:
 * every check takes what it needs as an argument so it can be tested with
 * synthetic input instead of fixture files.
 */

import type { z } from 'zod';
import {
  type ContentIssue,
  type ContentIssueCode,
  error,
  warning,
} from './errors';
import {
  MissionSchema,
  type Mission,
  type TestCase,
  type WorkshopSystem,
} from './schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPath(path: readonly (string | number)[]): string {
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') out += `[${segment}]`;
    else out += out === '' ? segment : `.${segment}`;
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary match, so `isOver` does not match `isOverLimit`. */
export function containsIdentifier(haystack: string, identifier: string): boolean {
  return new RegExp(`\\b${escapeRegExp(identifier)}\\b`).test(haystack);
}

function describeZodIssue(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'unrecognized_keys':
      return `unknown key(s): ${issue.keys.join(', ')}`;
    case 'invalid_type':
      return `expected ${issue.expected}, received ${issue.received}`;
    case 'too_small':
      return issue.type === 'array'
        ? `must contain at least ${issue.minimum} item(s)`
        : `must be at least ${issue.minimum}`;
    case 'too_big':
      return issue.type === 'array'
        ? `must contain at most ${issue.maximum} item(s)`
        : `must be at most ${issue.maximum}`;
    case 'invalid_literal':
      return `must equal ${JSON.stringify(issue.expected)}`;
    case 'invalid_enum_value':
      return `must be one of: ${issue.options.join(', ')}`;
    case 'not_finite':
      return 'must be a finite number';
    // Zod carries the message the schema author wrote, which is always more
    // useful than a generic "invalid format".
    default:
      return issue.message;
  }
}

function codeForZodIssue(issue: z.ZodIssue, path: string): ContentIssueCode {
  if (issue.code === 'unrecognized_keys') return 'SCHEMA_UNKNOWN_KEY';
  const head = issue.path[0];
  if (head === 'id') return 'SCHEMA_BAD_ID';
  if (head === 'hints') return 'SCHEMA_HINTS';
  if (path.includes('correctIndex')) return 'SCHEMA_BAD_INDEX';
  if (head === 'tests') return 'SCHEMA_OUTPUT_SHAPE';
  return 'SCHEMA_INVALID';
}

// ---------------------------------------------------------------------------
// V7 — output shape
// ---------------------------------------------------------------------------

type JsonKind = 'boolean' | 'number' | 'string' | 'null' | 'array' | 'object';

function jsonKind(value: unknown): JsonKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'boolean' || type === 'number' || type === 'string') return type;
  return 'object';
}

/**
 * Only shapes we can check mechanically are listed. Anything else produces a
 * warning instead of a guess: a validator that silently accepts prose it cannot
 * parse is worse than one that admits it cannot.
 */
const OUTPUT_SHAPE_KINDS: Record<string, readonly JsonKind[]> = {
  boolean: ['boolean'],
  number: ['number'],
  string: ['string'],
  null: ['null'],
  'boolean | null': ['boolean', 'null'],
  'number | null': ['number', 'null'],
  'string | null': ['string', 'null'],
  'number[]': ['array'],
  'string[]': ['array'],
  'boolean[]': ['array'],
};

function allTests(mission: Mission): TestCase[] {
  return [...mission.tests.visible, ...mission.tests.hidden, ...mission.tests.edge];
}

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

export interface ShapeResult {
  mission: Mission | null;
  issues: ContentIssue[];
}

export function validateMissionShape(raw: unknown, source?: string): ShapeResult {
  const parsed = MissionSchema.safeParse(raw);

  if (!parsed.success) {
    const seen = new Set<string>();
    const issues: ContentIssue[] = [];
    for (const zodIssue of parsed.error.issues) {
      const path = formatPath(zodIssue.path);
      const code = codeForZodIssue(zodIssue, path);
      const key = `${code}::${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(
        error(code, `${path || '<root>'}: ${describeZodIssue(zodIssue)}`, {
          path: path || undefined,
          source,
        }),
      );
    }
    return { mission: null, issues };
  }

  const mission = parsed.data;
  const issues: ContentIssue[] = [];
  const base = { missionId: mission.id, source };

  // V3 — entryPoint must exist in the starter code, unless there is none.
  if (
    mission.starterCode !== '' &&
    !containsIdentifier(mission.starterCode, mission.contract.entryPoint)
  ) {
    issues.push(
      error(
        'SCHEMA_NO_ENTRY',
        `contract.entryPoint "${mission.contract.entryPoint}" does not appear in starterCode, and starterCode is not empty`,
        { ...base, path: 'contract.entryPoint' },
      ),
    );
  }

  // V4 — test ids are globally unique within the mission, across all three groups.
  const seenTestIds = new Map<string, string>();
  for (const group of ['visible', 'hidden', 'edge'] as const) {
    mission.tests[group].forEach((testCase, index) => {
      const previous = seenTestIds.get(testCase.id);
      if (previous !== undefined) {
        issues.push(
          error(
            'SCHEMA_DUP_TEST_ID',
            `test id "${testCase.id}" is used in both ${previous} and ${group}; ids are referenced by diagnostics and must be unique`,
            { ...base, path: `tests.${group}[${index}].id` },
          ),
        );
      } else {
        seenTestIds.set(testCase.id, group);
      }
    });
  }

  // Edge hygiene — the flag is what feeds the robustness dimension. A test in
  // the edge group without it would silently stop counting.
  mission.tests.edge.forEach((testCase, index) => {
    if (testCase.edge !== true) {
      issues.push(
        error('SCHEMA_INVALID', `edge test "${testCase.id}" must set edge: true`, {
          ...base,
          path: `tests.edge[${index}].edge`,
        }),
      );
    }
  });
  for (const group of ['visible', 'hidden'] as const) {
    mission.tests[group].forEach((testCase, index) => {
      if (testCase.edge === true) {
        issues.push(
          error('SCHEMA_INVALID', `${group} test "${testCase.id}" must not set edge: true`, {
            ...base,
            path: `tests.${group}[${index}].edge`,
          }),
        );
      }
    });
  }

  // Diagnostics may only reference tests that exist, or the rule can never fire.
  mission.diagnostics.forEach((rule, index) => {
    for (const testId of rule.when?.failingTestIds ?? []) {
      if (!seenTestIds.has(testId)) {
        issues.push(
          error(
            'SCHEMA_INVALID',
            `diagnostic rule ${index} references unknown test id "${testId}"`,
            { ...base, path: `diagnostics[${index}].when.failingTestIds` },
          ),
        );
      }
    }
  });

  // V7 — expected values must agree with the declared output shape.
  const allowedKinds = OUTPUT_SHAPE_KINDS[mission.contract.outputShape];
  const tests = allTests(mission);
  if (allowedKinds === undefined) {
    issues.push(
      warning(
        'SCHEMA_OUTPUT_SHAPE',
        `contract.outputShape "${mission.contract.outputShape}" is prose the validator cannot check; only these are verified: ${Object.keys(OUTPUT_SHAPE_KINDS).join(', ')}`,
        { ...base, path: 'contract.outputShape' },
      ),
    );
  } else {
    for (const testCase of tests) {
      const kind = jsonKind(testCase.expected);
      if (!allowedKinds.includes(kind)) {
        issues.push(
          error(
            'SCHEMA_OUTPUT_SHAPE',
            `test "${testCase.id}" expects a ${kind} but contract.outputShape is "${mission.contract.outputShape}"`,
            { ...base, path: 'tests' },
          ),
        );
      }
    }
  }

  // V6 — the cost question must have a selectable correct answer.
  const complexity = mission.debrief.complexity;
  if (complexity.correctIndex >= complexity.options.length) {
    issues.push(
      error(
        'SCHEMA_BAD_INDEX',
        `debrief.complexity.correctIndex ${complexity.correctIndex} is outside options (length ${complexity.options.length})`,
        { ...base, path: 'debrief.complexity.correctIndex' },
      ),
    );
  }

  // Strategy questions share the complexity-question invariant (V6 applied twice).
  mission.strategyAssessment?.forEach((question, index) => {
    if (question.correctIndex >= question.options.length) {
      issues.push(
        error(
          'SCHEMA_BAD_INDEX',
          `strategyAssessment[${index}].correctIndex ${question.correctIndex} is outside options (length ${question.options.length})`,
          { ...base, path: `strategyAssessment[${index}].correctIndex` },
        ),
      );
    }
  });

  return { mission, issues };
}

// ---------------------------------------------------------------------------
// Referential validation
// ---------------------------------------------------------------------------

export interface ReferenceContext {
  missions: readonly Mission[];
  conceptIds: ReadonlySet<string>;
  systems: ReadonlyMap<string, WorkshopSystem>;
  /**
   * Global play order derived from content/worlds.json. Mission `order` is
   * per-world, so it cannot be compared across worlds; the sequence can.
   */
  sequenceById: ReadonlyMap<string, number>;
  reinforcementIds: ReadonlySet<string>;
}

export function validateReferences(
  mission: Mission,
  context: ReferenceContext,
  source?: string,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const base = { missionId: mission.id, source };

  // V9 — concepts.
  const referencedConcepts = [
    mission.concepts.primary,
    ...mission.concepts.secondary,
    ...mission.prerequisites.concepts,
  ];
  for (const conceptId of new Set(referencedConcepts)) {
    if (!context.conceptIds.has(conceptId)) {
      issues.push(
        error('REF_CONCEPT', `concept "${conceptId}" is not in content/concepts.json`, {
          ...base,
          path: 'concepts',
        }),
      );
    }
  }

  // V10 — workshop system.
  if (!context.systems.has(mission.workshop.systemId)) {
    issues.push(
      error(
        'REF_SYSTEM',
        `workshop.systemId "${mission.workshop.systemId}" is not in content/workshop.json`,
        { ...base, path: 'workshop.systemId' },
      ),
    );
  }

  // V8 — prerequisites exist and come earlier in the global sequence.
  const ownSequence = context.sequenceById.get(mission.id);
  for (const prerequisiteId of mission.prerequisites.missions) {
    if (prerequisiteId === mission.id) {
      issues.push(
        error('REF_PREREQ', `mission "${mission.id}" lists itself as a prerequisite`, {
          ...base,
          path: 'prerequisites.missions',
        }),
      );
      continue;
    }
    const prerequisiteSequence = context.sequenceById.get(prerequisiteId);
    if (prerequisiteSequence === undefined) {
      issues.push(
        error(
          'REF_PREREQ',
          `prerequisite mission "${prerequisiteId}" does not exist`,
          { ...base, path: 'prerequisites.missions' },
        ),
      );
      continue;
    }
    if (ownSequence !== undefined && prerequisiteSequence >= ownSequence) {
      issues.push(
        error(
          'REF_PREREQ',
          `prerequisite "${prerequisiteId}" is not earlier in play order than "${mission.id}"`,
          { ...base, path: 'prerequisites.missions' },
        ),
      );
    }
  }

  // V12 — the reward must be for the system the mission actually repaired.
  if (mission.reward.systemId !== mission.workshop.systemId) {
    issues.push(
      error(
        'REF_REWARD_MISMATCH',
        `reward.systemId "${mission.reward.systemId}" differs from workshop.systemId "${mission.workshop.systemId}"`,
        { ...base, path: 'reward.systemId' },
      ),
    );
  }

  // Transfer target and reinforcement variants must resolve, or mastery
  // evidence silently points at nothing.
  if (
    mission.mastery.transferMissionId !== undefined &&
    !context.sequenceById.has(mission.mastery.transferMissionId)
  ) {
    issues.push(
      error(
        'REF_PREREQ',
        `mastery.transferMissionId "${mission.mastery.transferMissionId}" does not exist`,
        { ...base, path: 'mastery.transferMissionId' },
      ),
    );
  }
  for (const variantId of mission.mastery.reinforcementVariants) {
    if (!context.reinforcementIds.has(variantId)) {
      issues.push(
        error(
          'REF_PREREQ',
          `mastery.reinforcementVariants references "${variantId}", absent from content/reinforcement.json`,
          { ...base, path: 'mastery.reinforcementVariants' },
        ),
      );
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// V11 — prerequisite cycles
// ---------------------------------------------------------------------------

/**
 * Returns every cycle reachable in the prerequisite graph, as id lists.
 * Reported per cycle rather than per edge so a two-mission loop produces one
 * message a human can act on.
 */
export function findPrerequisiteCycles(missions: readonly Mission[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const mission of missions) {
    graph.set(mission.id, [...mission.prerequisites.missions]);
  }

  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seenCycles = new Set<string>();

  function visit(node: string): void {
    colour.set(node, GREY);
    stack.push(node);

    for (const next of graph.get(node) ?? []) {
      const nextColour = colour.get(next) ?? WHITE;
      if (nextColour === WHITE) {
        visit(next);
      } else if (nextColour === GREY) {
        const start = stack.indexOf(next);
        const cycle = stack.slice(start);
        const key = [...cycle].sort().join('>');
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push([...cycle, next]);
        }
      }
    }

    stack.pop();
    colour.set(node, BLACK);
  }

  for (const mission of missions) {
    if ((colour.get(mission.id) ?? WHITE) === WHITE) visit(mission.id);
  }

  return cycles;
}
