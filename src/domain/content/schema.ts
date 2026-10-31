/**
 * Mission and registry schemas.
 *
 * This file is the single source of truth for both the runtime shape and the
 * TypeScript types. Types are inferred, never hand-written twice
 * (docs/09-mission-schema.md §1, rule 1).
 *
 * Everything is `.strict()`: an unknown key is an authoring mistake, not
 * forward compatibility. V1 in docs/09 §4.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Identifiers and closed vocabularies
// ---------------------------------------------------------------------------

export const MISSION_ID_PATTERN = /^M\d{2}$/;
export const CONCEPT_ID_PATTERN = /^C\d{2}$/;
export const SYSTEM_ID_PATTERN = /^sys\.[a-z][a-z0-9]*$/;
export const ERROR_CODE_PATTERN = /^E\d{2}$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const WORLD_IDS = ['w1', 'transition', 'w2', 'w3', 'w4', 'w5', 'w6'] as const;
export type WorldId = (typeof WORLD_IDS)[number];

export const WORLD_STATUSES = ['planned', 'in-progress', 'complete'] as const;
export type WorldStatus = (typeof WORLD_STATUSES)[number];

/**
 * Closed set of edge-case kinds. Extending it is a schema change, because an
 * open vocabulary would let an author label anything "edge" and pass L7.
 */
export const EDGE_KINDS = [
  'empty',
  'singleton',
  'all-match',
  'none-match',
  'boundary-equal',
  'duplicate',
  'negative',
  'zero',
  'extreme',
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const SYSTEM_STATES = ['broken', 'working', 'reliable', 'absent', 'installed'] as const;
export type SystemState = (typeof SYSTEM_STATES)[number];

export const WORKSHOP_FROM_STATES = ['broken', 'working', 'absent'] as const;
export const WORKSHOP_TO_STATES = ['working', 'reliable', 'installed'] as const;

const MissionIdSchema = z.string().regex(MISSION_ID_PATTERN, 'must match /^M\\d{2}$/');
const ConceptIdSchema = z.string().regex(CONCEPT_ID_PATTERN, 'must match /^C\\d{2}$/');
const SystemIdSchema = z.string().regex(SYSTEM_ID_PATTERN, 'must match /^sys\\.[a-z][a-z0-9]*$/');

/**
 * A JSON value. Deliberately not `z.unknown()`: `unknown` is treated as
 * optional by Zod, which would let `expected` be omitted from a test case.
 * Rejecting `undefined`, `NaN` and `Infinity` here also covers half of V7.
 */
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

// ---------------------------------------------------------------------------
// Mission pieces
// ---------------------------------------------------------------------------

export const TestCaseSchema = z
  .object({
    id: z.string().min(1),
    input: z.array(JsonValueSchema),
    expected: JsonValueSchema,
    note: z.string().min(1).optional(),
    edge: z.boolean().optional(),
    edgeKind: z.enum(EDGE_KINDS).optional(),
  })
  .strict();

export type TestCase = z.infer<typeof TestCaseSchema>;

const DiagnosticRuleSchema = z
  .object({
    code: z.string().regex(ERROR_CODE_PATTERN, 'must match /^E\\d{2}$/'),
    when: z
      .object({
        failingTestIds: z.array(z.string().min(1)).optional(),
        construct: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    message: z.string().min(1),
  })
  .strict();

const HintSchema = z
  .object({
    level: z.number().int().min(1).max(4),
    text: z.string().min(1),
    unlock: z
      .object({
        attempts: z.number().int().positive().optional(),
        hintsUsed: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/**
 * Exactly four hints, levels [1,2,3,4] in order (V5).
 *
 * A tuple makes the rule structural: three hints, five hints, or a shuffled
 * ladder cannot even parse. "Up to four" was rejected on purpose — a missing
 * level means the ladder was never designed (docs/09 §1, rule 3).
 */
export const HintsSchema = z.tuple([
  HintSchema.extend({ level: z.literal(1) }),
  HintSchema.extend({ level: z.literal(2) }),
  HintSchema.extend({ level: z.literal(3) }),
  HintSchema.extend({ level: z.literal(4) }),
]);

export type Hint = z.infer<typeof HintSchema>;

const ComplexitySchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().min(1),
  })
  .strict();

const ExplainBlankSchema = z
  .object({
    id: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(5),
    correctIndex: z.number().int().nonnegative(),
  })
  .strict();

const ExplainQuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(5),
    correctIndex: z.number().int().nonnegative(),
    /** Optional, parallel to `options`: why that distractor is a misconception. */
    whyWrong: z.array(z.string()).optional(),
    explanation: z.string().min(1),
  })
  .strict();

/**
 * Structured replacement for the free-text reasoning step (docs/04 §6): a
 * cloze sentence plus comprehension questions. `template` holds `{id}`
 * placeholders, one per blank.
 */
const ExplainSchema = z
  .object({
    prompt: z.string().min(1),
    template: z.string().min(1),
    blanks: z.array(ExplainBlankSchema).min(2),
    questions: z.array(ExplainQuestionSchema).min(1),
  })
  .strict();

export type ExplainSpec = z.infer<typeof ExplainSchema>;

const DebriefSchema = z
  .object({
    whyItWorks: z.string().min(1),
    edgeCaseNote: z.string().min(1),
    complexity: ComplexitySchema,
    realWorld: z.string().min(1),
    reasoningPrompt: z.string().min(1),
    objectiveNouns: z.array(z.string().min(1)).min(2),
    reasoningLexicon: z.array(z.string().min(1)),
    explain: ExplainSchema.optional(),
  })
  .strict();

const StrategyQuestionSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().nonnegative(),
    allowJustifiedIndices: z.array(z.number().int().nonnegative()).optional(),
  })
  .strict();

export const MissionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: MissionIdSchema,
    contentVersion: z.string().regex(SEMVER_PATTERN, 'must be semver'),
    locale: z.literal('es'),
    world: z.enum(WORLD_IDS),
    order: z.number().int().positive(),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    estimatedMinutes: z.number().int().positive(),

    concepts: z
      .object({
        primary: ConceptIdSchema,
        // Length is enforced by lint L2, not here: a structural error would
        // make the lint untestable and give a worse message.
        secondary: z.array(ConceptIdSchema),
      })
      .strict(),

    prerequisites: z
      .object({
        missions: z.array(MissionIdSchema),
        concepts: z.array(ConceptIdSchema),
      })
      .strict(),

    workshop: z
      .object({
        systemId: SystemIdSchema,
        from: z.enum(WORKSHOP_FROM_STATES),
        to: z.enum(WORKSHOP_TO_STATES),
      })
      .strict(),

    briefing: z
      .object({
        headline: z.string().min(1),
        body: z.string().min(1),
        requirements: z.array(z.string().min(1)).min(1),
        forbiddenVocabulary: z.array(z.string().min(1)),
        visual: z.enum(['gauge', 'early-exit-scan', 'cost-grid', 'seen-drawer']).optional(),
      })
      .strict(),

    contract: z
      .object({
        entryPoint: z.string().min(1),
        signature: z.string().min(1),
        inputShape: z.string().min(1),
        outputShape: z.string().min(1),
        rules: z.array(z.string().min(1)).min(2),
      })
      .strict(),

    constraints: z
      .object({
        bannedConstructs: z.array(z.string().min(1)),
        allowClosedForm: z.boolean(),
        mustNotMutate: z.boolean(),
        /** `false` opts the mission out of the rotation probe (E07). Absent = probed. */
        rotationInvariant: z.boolean().optional(),
        efficiency: z
          .object({
            budgetMs: z.number().positive(),
            calibrated: z.literal(true),
            enforced: z.boolean(),
            operationBudget: z.number().int().positive().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),

    starterCode: z.string(),

    tests: z
      .object({
        visible: z.array(TestCaseSchema).min(2).max(4),
        hidden: z.array(TestCaseSchema).min(3).max(5),
        edge: z.array(TestCaseSchema).min(2).max(4),
      })
      .strict(),

    diagnostics: z.array(DiagnosticRuleSchema).min(1),

    hints: HintsSchema,

    debrief: DebriefSchema,

    mastery: z
      .object({
        transferMissionId: MissionIdSchema.optional(),
        reinforcementVariants: z.array(z.string().min(1)),
      })
      .strict(),

    strategyAssessment: z.array(StrategyQuestionSchema).optional(),

    reward: z
      .object({
        systemId: SystemIdSchema,
        effect: z.string().min(1),
        narrative: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type Mission = z.infer<typeof MissionSchema>;
export type DiagnosticRule = z.infer<typeof DiagnosticRuleSchema>;

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

export const ConceptRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    concepts: z.array(
      z
        .object({
          id: ConceptIdSchema,
          label: z.string().min(1),
          world: z.enum(WORLD_IDS),
          mvp: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

export type ConceptRegistry = z.infer<typeof ConceptRegistrySchema>;
export type Concept = ConceptRegistry['concepts'][number];

export const WorkshopSystemSchema = z
  .object({
    id: SystemIdSchema,
    name: z.string().min(1),
    initialState: z.enum(SYSTEM_STATES),
    states: z.array(z.enum(SYSTEM_STATES)).min(1),
    transitions: z.array(
      z
        .object({
          from: z.enum(SYSTEM_STATES),
          to: z.enum(SYSTEM_STATES),
        })
        .strict(),
    ),
  })
  .strict();

export type WorkshopSystem = z.infer<typeof WorkshopSystemSchema>;

export const WorkshopRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    systems: z.array(WorkshopSystemSchema),
  })
  .strict();

export const WorldsRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    worlds: z.array(
      z
        .object({
          id: z.enum(WORLD_IDS),
          name: z.string().min(1),
          status: z.enum(WORLD_STATUSES),
          missionIds: z.array(MissionIdSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type WorldsRegistry = z.infer<typeof WorldsRegistrySchema>;
export type World = WorldsRegistry['worlds'][number];

export const ReinforcementRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    variants: z.array(z.object({ id: z.string().min(1) }).strict()),
  })
  .strict();

export type ReinforcementRegistry = z.infer<typeof ReinforcementRegistrySchema>;
