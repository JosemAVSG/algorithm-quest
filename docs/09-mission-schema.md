# 09 — Mission Schema

Covers deliverable B11. A versioned, validated, data-only format. Every field below exists
because a mission genuinely needs it; anything that could be derived is derived instead of stored.

---

## 1. Design rules for the schema

1. **No duplicated truth.** The contract box in the briefing is rendered from `contract`, not
   authored twice.
2. **No prose that a lint can check.** `forbiddenVocabulary` makes principle 1 machine-checkable.
3. **Exactly four hints.** Not "up to four". A missing level means the ladder was never designed.
4. **Tests are data, not code.** A mission cannot ship a test that requires a new engine feature.
5. **Versioned twice.** `schemaVersion` (structure) and `contentVersion` (this mission's text).
   They change for different reasons and must not be conflated.

---

## 2. Type definition

```ts
type MissionSchema = {
  schemaVersion: 1;
  id: MissionId;                    // 'M01' — stable forever, never reused
  contentVersion: string;           // semver of the mission's own content
  locale: 'es';                     // additive later
  world: 'w1' | 'transition' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6';
  order: number;                    // position within the world
  title: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;

  concepts: {
    primary: ConceptId;             // exactly one
    secondary: ConceptId[];         // zero or one
  };

  prerequisites: {
    missions: MissionId[];          // must exist and be earlier in order (V8)
    concepts: ConceptId[];          // must exist (V9); required level is derived (05 §9)
  };

  workshop: {
    systemId: WorkshopSystemId;     // must exist in content/workshop.json
    from: 'broken' | 'working' | 'absent';
    to: 'working' | 'reliable' | 'installed';
  };

  briefing: {
    headline: string;
    body: string;                   // markdown, player-facing
    requirements: string[];         // the 3–4 bullets in the contract box
    forbiddenVocabulary: string[];  // lint L1: must not appear in headline+body
    visual?: 'gauge' | 'early-exit-scan' | 'collect-line' | 'running-total' | 'copy-rows';  // optional id of a built-in 2D illustration
  };

  contract: {
    entryPoint: string;             // must match a function in starterCode or the solution
    signature: string;              // displayed verbatim
    inputShape: string;             // TypeScript-ish, for display
    outputShape: string;
    rules: string[];                // normative statements, testable
  };

  constraints: {
    bannedConstructs: string[];     // e.g. ['.some', '.filter', 'Set']
    allowClosedForm: boolean;       // disables E13 hardcode detection
    mustNotMutate: boolean;         // enables the mutation invariant check
    rotationInvariant?: boolean;    // false = skip the rotation probe (E07); default: probed.
                                    // Use when rotating the input legitimately changes the
                                    // answer (e.g. full-tie "earlier index wins").
    efficiency?: {
      budgetMs: number;
      calibrated: true;             // budgets are always calibration-relative
      enforced: boolean;            // false = warning only
      operationBudget?: number;
    };
  };

  starterCode: string;              // '' means "no scaffolding" (M10, M12)

  tests: {
    visible: TestCase[];            // 2–4
    hidden: TestCase[];             // 3–5
    edge: TestCase[];               // 2–4, each flagged edge:true
  };

  diagnostics: DiagnosticRule[];    // authored messages per error code

  hints: [Hint, Hint, Hint, Hint];  // exactly four, ascending specificity

  debrief: {
    whyItWorks: string;
    edgeCaseNote: string;
    complexity: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    };
    realWorld: string;
    reasoningPrompt: string;
    objectiveNouns: string[];       // used by the deterministic reasoning heuristic
    reasoningLexicon: string[];
    explain?: {                     // optional: replaces the free-text reasoning step
      prompt: string;
      template: string;             // cloze sentence with {id} placeholders, one per blank
      blanks: { id: string; options: string[]; correctIndex: number }[];   // >=2, 3-5 options
      questions: {                  // >=1 comprehension question, exactly one correct option
        id: string;
        question: string;
        options: string[];          // 3-5, distractors are real misconceptions
        correctIndex: number;
        whyWrong?: string[];        // parallel to options; shown when that option is chosen
        explanation: string;        // shown on the completion screen
      }[];
    };
  };

  mastery: {
    transferMissionId?: MissionId;
    reinforcementVariants: string[]; // ids in content/reinforcement.json
  };

  strategyAssessment?: StrategyQuestion[];  // M12 only

  reward: {
    systemId: WorkshopSystemId;
    effect: string;
    narrative: string;              // one sentence, shown on the map
  };
};

type TestCase = {
  id: string;                       // stable, referenced by diagnostics
  input: unknown[];                 // positional args
  expected: unknown;
  note?: string;                    // shown to the player as the test name
  edge?: boolean;                   // true in the `edge` array, forbidden elsewhere
  edgeKind?: EdgeKind;              // required on edge tests (lint L7)
};

// Closed set. Extending it is a schema change, not an authoring decision:
// an open vocabulary would let an author label anything "edge" and pass L7.
type EdgeKind =
  | 'empty'           // zero-length input, no items
  | 'singleton'       // exactly one item
  | 'all-match'       // every item satisfies the condition
  | 'none-match'      // no item satisfies the condition
  | 'boundary-equal'  // the value sits exactly on the threshold
  | 'duplicate'       // repeated values, the case naive code collapses
  | 'negative'        // sign flips relative to the happy path
  | 'zero'            // numeric zero, the falsy trap
  | 'extreme';        // far outside the plausible range

type DiagnosticRule = {
  code: ErrorCode;                  // E01..E22
  when?: {
    failingTestIds?: string[];      // narrows the rule to specific failures
    construct?: string;             // narrows to a banned construct
  };
  message: string;                  // the level-2 hint body
};

type Hint = {
  level: 1 | 2 | 3 | 4;
  text: string;
  unlock?: { attempts?: number; hintsUsed?: number };  // level 4 only
};

type StrategyQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  allowJustifiedIndices?: number[]; // indices accepted with written justification
};
```

---

## 3. Field obligations

Which fields are required, and why. "Derived" means the runtime computes it and the schema
forbids storing it.

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | ✅ | Integer. A breaking change bumps it and ships a migration. |
| `contentVersion` | ✅ | Bump on any text change, even a typo. Telemetry joins on it. |
| `concepts.primary` | ✅ | Exactly one. Lint L2. |
| `concepts.secondary` | ✅ (may be `[]`) | Max one. Lint L2. |
| `prerequisites` | ✅ (may be empty) | Required so a mission cannot silently forget it. V8/V9/V11. |
| `tests.edge[].edgeKind` | ✅ | Closed set. Without it L7 is unenforceable. |
| `workshop.systemId` | ✅ | Must resolve in `content/workshop.json`. Lint L4. |
| `briefing.forbiddenVocabulary` | ✅ | May be `[]` for missions with no pattern to hide. |
| `briefing.visual` | optional | An id only, never data. Renders a built-in SVG next to the briefing text; absent means no illustration. Unknown ids fail validation. |
| `contract.rules` | ✅ | At least two. A mission with one rule is underspecified. |
| `constraints.bannedConstructs` | ✅ (may be `[]`) | Displayed in the UI, not just enforced in tests. |
| `constraints.efficiency` | optional | Only M10 (warning) and M12 (enforced) set it. |
| `starterCode` | ✅ (may be `''`) | `''` is a deliberate signal: "choosing the structure is the task". |
| `tests.visible` | ✅ | 2–4. More than 4 makes the lab panel scroll. |
| `tests.hidden` | ✅ | 3–5. Must not reuse any visible input (lint L6). |
| `tests.edge` | ✅ | 2–4, all with `edge: true`. Feeds the robustness dimension. |
| `diagnostics` | ✅ | At least one rule per `E` code the mission can plausibly produce. |
| `hints` | ✅ | Exactly 4 (lint L5). |
| `debrief.complexity` | ✅ | Even M01. The cost question scales with the mission. |
| `debrief.objectiveNouns` | ✅ | ≥2. Drives the deterministic reasoning heuristic (free-text path). |
| `debrief.explain` | optional | Structured cloze + questions. When present it replaces the free-text rubric for that mission; when absent the keyword rubric still applies. |
| `mastery.transferMissionId` | optional | Set when the transfer target already exists. |
| `strategyAssessment` | optional | M12 only in the MVP. |
| `reward.narrative` | ✅ | One sentence. Rendered on the map, not in a modal. |
| — | **derived** | mastery level, evidence, next mission, unlock state, cost display |

---

## 4. Validation rules

Run in CI (`npm run validate:content`) and again at load time.

### Structural

| # | Rule | Error |
| --- | --- | --- |
| V1 | Matches the schema exactly; no extra keys | `SCHEMA_UNKNOWN_KEY` |
| V2 | `id` matches `/^M\d{2}$/` and is unique | `SCHEMA_BAD_ID` |
| V3 | `entryPoint` appears in `starterCode` **or** `starterCode === ''` | `SCHEMA_NO_ENTRY` |
| V4 | Every `TestCase.id` is unique within the mission | `SCHEMA_DUP_TEST_ID` |
| V5 | `hints` has exactly 4 entries with levels `[1,2,3,4]` in order | `SCHEMA_HINTS` |
| V6 | `debrief.complexity.correctIndex` is within `options` | `SCHEMA_BAD_INDEX` |
| V7 | `expected` values are JSON-serializable and match `outputShape` | `SCHEMA_OUTPUT_SHAPE` |

### Referential

| # | Rule | Error |
| --- | --- | --- |
| V8 | Every `prerequisites` mission id exists and is earlier in `order` | `REF_PREREQ` |
| V9 | Every `conceptId` exists in the concept registry | `REF_CONCEPT` |
| V10 | Every `workshop.systemId` exists in `content/workshop.json` | `REF_SYSTEM` |
| V11 | No prerequisite cycle (DFS over the mission graph) | `REF_CYCLE` |
| V12 | `reward.systemId === workshop.systemId` | `REF_REWARD_MISMATCH` |

### Pedagogical (lints, see `10` §4)

| # | Rule |
| --- | --- |
| L1 | `forbiddenVocabulary` terms do not appear (case-insensitive) in `briefing.headline` or `briefing.body` |
| L2 | Exactly one primary concept, ≤1 secondary |
| L3 | An efficiency-enforcing mission has a prior non-enforcing mission with the same primary concept |
| L4 | `reward.systemId` resolves and the `from → to` transition is legal for that system's current state |
| L5 | Hint specificity increases; level 4 must not contain the mission's `entryPoint` name or its solution lines |
| L6 | No hidden or edge test input deep-equals any visible test input |
| L7 | Every mission declares ≥2 edge cases drawn from the closed set `{empty, singleton, all-match, none-match, boundary-equal, duplicate, negative, zero, extreme}` |
| L8 | `debrief.complexity` and `debrief.realWorld` are non-empty and contain no placeholder text |
| L9 | `debrief.explain` is answerable: unique ids, every `{id}` has a blank and vice versa, `correctIndex` in range, no duplicate options, `whyWrong` parallel to `options` |

---

## 5. Versioning

| Change | `schemaVersion` | `contentVersion` | Migration |
| --- | --- | --- | --- |
| Fix a typo in a hint | — | patch | none |
| Rewrite a hint's content | — | minor | none |
| Add a hidden test | — | minor | none (but mastery evidence may shift) |
| Change `contract.signature` | — | **major** | none — but `id` must not be reused if semantics changed |
| Add a required field | **+1** | — | migration in `domain/content/migrations/` |
| Change `ErrorCode` set | — | — | version the taxonomy separately |

**The rule that matters:** if a mission's *semantics* change (different function, different
output), it gets a **new `id`**. Players' evidence events reference `id`, and repurposing an id
would silently rewrite their history. `M01` means one thing, forever.

---

## 6. Example record

`content/missions/m01.json` is a complete, valid record. Abbreviated here:

```json
{
  "schemaVersion": 1,
  "id": "M01",
  "contentVersion": "1.0.0",
  "locale": "es",
  "world": "w1",
  "order": 1,
  "title": "El primer diagnóstico",
  "difficulty": 1,
  "estimatedMinutes": 5,
  "concepts": { "primary": "C01", "secondary": ["C02"] },
  "prerequisites": { "missions": [], "concepts": [] },
  "workshop": { "systemId": "sys.sensor", "from": "broken", "to": "working" },
  "briefing": {
    "headline": "Sensor array — turno de noche",
    "body": "...",
    "requirements": [
      "Recibir la lectura y el límite",
      "Devolver si hay que disparar la alarma",
      "Nunca devolver texto"
    ],
    "forbiddenVocabulary": []
  },
  "contract": {
    "entryPoint": "isOverLimit",
    "signature": "isOverLimit(temperature, limit) -> boolean",
    "inputShape": "temperature: number, limit: number",
    "outputShape": "boolean",
    "rules": [
      "true cuando temperature supera estrictamente limit",
      "false en cualquier otro caso, incluido temperature === limit"
    ]
  },
  "constraints": {
    "bannedConstructs": [],
    "allowClosedForm": true,
    "mustNotMutate": false
  },
  "starterCode": "function isOverLimit(temperature, limit) {\n  // your code here\n}\n",
  "tests": {
    "visible": [
      { "id": "v1", "input": [95, 90], "expected": true, "note": "la lectura del turno" },
      { "id": "v2", "input": [85, 90], "expected": false, "note": "por debajo del límite" },
      { "id": "v3", "input": [120, 90], "expected": true, "note": "muy por encima" }
    ],
    "hidden": [
      { "id": "h1", "input": [91, 90], "expected": true },
      { "id": "h2", "input": [89, 90], "expected": false },
      { "id": "h3", "input": [0, 90], "expected": false },
      { "id": "h4", "input": [200, 90], "expected": true }
    ],
    "edge": [
      { "id": "ed1", "input": [90, 90], "expected": false, "edge": true, "edgeKind": "boundary-equal", "note": "justo en el límite" },
      { "id": "ed2", "input": [-5, -10], "expected": true, "edge": true, "edgeKind": "negative", "note": "sensor de frío" },
      { "id": "ed3", "input": [0, 0], "expected": false, "edge": true, "edgeKind": "zero", "note": "cero contra cero" }
    ]
  },
  "hints": [
    { "level": 1, "text": "¿Qué dos cosas tiene que mirar la función para decidir? ¿Y qué pasa cuando las dos son iguales?" },
    { "level": 2, "text": "Ejecuta mentalmente tu código con temperature = 90 y limit = 90. ¿Qué devuelve? ¿Debería?" },
    { "level": 3, "text": "si temperature es ESTRICTAMENTE mayor que limit → true; si no → false. La palabra que importa es 'estrictamente'." },
    { "level": 4, "text": "...", "unlock": { "attempts": 4, "hintsUsed": 3 } }
  ],
  "reward": {
    "systemId": "sys.sensor",
    "effect": "broken → working",
    "narrative": "El sensor del taller vuelve a emitir lecturas."
  }
}
```

The full file includes the complete `diagnostics` array, the `debrief` object, and the level-4
worked variant.

---

## 7. What is deliberately not in the schema

| Not stored | Why |
| --- | --- |
| Mastery thresholds | Global rules in `05`, not per mission |
| Hint *selection* logic | Derived by the classifier; the mission only authors text |
| Test runner configuration | One engine, one behaviour |
| UI layout | Presentation is the feature layer's job |
| Translations | `locale` is a discriminator; a second file is a second record |
| Difficulty as a number for players | Stored for authoring, never rendered |
| Points / XP / rewards beyond `systemId` | There is no currency (D11) |
