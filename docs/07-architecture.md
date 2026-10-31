# 07 — Application Architecture

Covers deliverable B9. React + TypeScript + Vite, with the domain isolated from the framework.
Code execution is analysed separately in `08-code-execution.md`.

---

## 1. Three architectural rules

Everything else follows from these.

**R1 — The domain does not know React exists.**
Content loading, prerequisite logic, test evaluation, diagnosis, hint selection, and mastery
scoring are plain TypeScript modules with no imports from `react`, no DOM access, and no
`window`. They are testable in Node with no browser. This is what makes the mentor testable,
and testability is the only defence against the mentor becoming a confident guesser.

**R2 — Content is data, validated at the boundary.**
Missions are JSON files validated against a versioned schema at load time. A malformed mission
fails the build, not the player's session. No mission text lives in a component.

**R3 — Side effects live at the edges.**
Execution, persistence, and telemetry are **ports** with adapter implementations. The domain
declares the interface; the composition root injects the adapter. Swapping `localStorage` for a
backend, or a Worker for a remote sandbox, touches one adapter and zero domain code.

---

## 2. Module map

```
┌─────────────────────────────────────────────────────────────────────┐
│  features/          React. Screens, routing, local UI state.        │
│                     Knows about domain *types*. Never domain logic. │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ calls
┌──────────────────────────────▼──────────────────────────────────────┐
│  domain/            Pure TypeScript. No React. No DOM.              │
│                                                                     │
│   content/       schema, assemble (pure), validator, lint           │
│   progression/   prerequisite graph, unlock rules                   │
│   execution/     ExecutionPort (interface only)                     │
│   evaluation/    TestEngine — the source of truth                   │
│   diagnosis/     classifier, hint selector                          │
│   mastery/       evidence events, scoring, levels                   │
│   persistence/   ProgressStore (interface only)                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ implemented by
┌──────────────────────────────▼──────────────────────────────────────┐
│  adapters/          Side effects. The only place with I/O.          │
│                                                                     │
│   execution/worker/     Web Worker sandbox (MVP)                    │
│   execution/http/       Remote sandbox (future, same port)          │
│   content/fs/           Filesystem content loader (build + Node)   │
│   persistence/local/    localStorage + schema migration             │
│   telemetry/            optional, no-op by default                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Dependency rules (enforced by ESLint `no-restricted-imports`)

| From | May import | Must never import |
| --- | --- | --- |
| `features/*` | `domain/*`, `shared/*` | `adapters/*` (except via composition root) |
| `domain/*` | `shared/lib` | `react`, `features/*`, `adapters/*`, `node:*`, any DOM global |
| `adapters/*` | `domain/*` types | `features/*` |
| `shared/*` | — | `domain/*`, `features/*`, `adapters/*` |

A violation is a lint error, not a review comment. Architecture that is not enforced is
architecture that decays in week three.

---

## 3. Directory layout

```
algorithm-quest/
├── content/
│   └── missions/
│       ├── m01.json
│       ├── m02.json
│       └── ...                    ← the curriculum, as data
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   └── composition.ts         ← wires ports to adapters. The only place that does.
│   ├── features/
│   │   ├── workshop-map/
│   │   ├── briefing/
│   │   ├── strategy/
│   │   ├── lab/
│   │   ├── debrief/
│   │   ├── dashboard/
│   │   └── settings/
│   ├── domain/
│   │   ├── content/
│   │   │   ├── schema.ts
│   │   │   ├── loader.ts
│   │   │   ├── validator.ts
│   │   │   └── lint.ts
│   │   ├── progression/
│   │   │   ├── graph.ts
│   │   │   └── unlock.ts
│   │   ├── execution/
│   │   │   └── port.ts
│   │   ├── evaluation/
│   │   │   ├── engine.ts
│   │   │   ├── diff.ts
│   │   │   └── probe.ts           ← rotation probe, determinism check
│   │   ├── diagnosis/
│   │   │   ├── classifier.ts
│   │   │   ├── rules.ts
│   │   │   └── hints.ts
│   │   ├── mastery/
│   │   │   ├── evidence.ts
│   │   │   ├── score.ts
│   │   │   └── levels.ts
│   │   └── persistence/
│   │       └── port.ts
│   ├── adapters/
│   │   ├── execution/worker/
│   │   │   ├── runner.ts
│   │   │   ├── worker-entry.ts
│   │   │   └── prelude.js         ← the hardening script, reviewed line by line
│   │   ├── persistence/local/
│   │   │   ├── store.ts
│   │   │   └── migrations.ts
│   │   └── telemetry/
│   │       └── noop.ts
│   ├── shared/
│   │   ├── ui/                    ← buttons, cards, badges. No domain knowledge.
│   │   └── lib/                   ← pure helpers (deepEqual, clamp, rotate)
│   └── main.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── scripts/
    └── validate-content.ts        ← runs schema + lint over every mission
```

---

## 4. Core ports

```ts
// domain/execution/port.ts
export interface ExecutionPort {
  run(request: ExecutionRequest): Promise<ExecutionResult>;
}

export type ExecutionRequest = {
  source: string;              // player's function body + signature
  entryPoint: string;          // e.g. 'collectFaultyDevices'
  cases: TestCase[];           // resolved inputs
  budgetMs: number;
  operationBudget?: number;    // optional instrumented-op ceiling
};

export type ExecutionResult = {
  status: 'ok' | 'timeout' | 'threw' | 'budget_exceeded';
  cases: CaseResult[];
  durationMs: number;
  operations?: number;
  threw?: { message: string; name: string; line?: number };
  mutatedInput?: boolean;      // set by the harness, not the player
  nondeterministic?: boolean;  // same input, different output across 3 runs
};
```

```ts
// domain/persistence/port.ts
export interface ProgressStore {
  load(): Promise<PlayerProgress | null>;
  save(progress: PlayerProgress): Promise<void>;
  export(): Promise<string>;          // JSON blob for download
  import(blob: string): Promise<PlayerProgress>;
  reset(): Promise<void>;
}
```

Both are async even in the MVP, so a remote implementation is a drop-in replacement rather
than a refactor.

---

## 5. Mission run — data flow

```
   player clicks "Ejecutar"
            │
            ▼
   ┌──────────────────┐
   │ Lab (feature)    │  builds ExecutionRequest from mission + editor state
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │ ExecutionPort    │  adapter: Worker (MVP) or HTTP (future)
   └────────┬─────────┘
            ▼  ExecutionResult (frozen)
   ┌──────────────────┐
   │ TestEngine       │  normalizes: per-case pass/fail, diffs, edge flags,
   │ (domain)         │  mutation + determinism + budget verdicts
   └────────┬─────────┘
            ▼  EvaluationReport (frozen)  ← SOURCE OF TRUTH
   ┌──────────────────┐
   │ Classifier       │  EvaluationReport + attempt history + strategy
   │ (domain)         │  → Diagnosis (pure function)
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │ HintSelector     │  Diagnosis + mission hint ladder + history
   │ (domain)         │  → Intervention
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │ Lab renders      │  diagnosis card + hint + trace-table affordance
   └──────────────────┘
```

### The one-way dependency that matters

`EvaluationReport` flows **into** the mentor and never back out. The mentor's output type has no
field that can express "passed". This is enforced by the type system, not by discipline:

```ts
// Diagnosis has no `passed` field, and cannot construct one.
type Diagnosis = {
  code: ErrorCode;
  confidence: 'certain' | 'likely';
  evidence: Evidence;
  modifiers: Modifier[];
  hint: { level: 1 | 2 | 3 | 4; hintId: string };
  traceTableAvailable: boolean;
};
```

If someone later wants the mentor to "soften" a failure, they must add a field to a type that
the test engine owns. That friction is the design.

---

## 6. State management

No global state library. Three kinds of state, three homes:

| State | Home | Lifetime |
| --- | --- | --- |
| Mission session (editor text, attempts, hints used) | `useReducer` inside the Lab feature | One mission |
| Player progress (evidence, mastery, unlocks) | `ProgressStore` + a thin context | Forever |
| Derived UI state | `useMemo` over the above | Render |

**Why no Redux/Zustand.** The state graph is a straight line (briefing → strategy → lab →
debrief) with one persisted branch. A store library would add a concept the team has to learn
and the reviewer has to check, in exchange for nothing.

**Why `useReducer` and not XState.** The mission session has ~8 states and no parallel regions.
XState would be correct and would double the files. Revisit only if the state machine grows
past 12 states.

### Persistence timing

- Evidence events are appended **on mission completion**, not per attempt.
- `save()` is called after each event and is debounced (250 ms).
- A failed save never blocks the UI; it surfaces a non-blocking banner. Losing progress is bad;
  losing the session because storage is full is worse.

---

## 7. Content pipeline

```
content/missions/*.json
        │
        ▼  scripts/validate-content.ts  (runs in CI and pre-build)
   ┌──────────────────────────────────┐
   │ 1. JSON Schema validation        │  structural correctness
   │ 2. Lint L1–L8                    │  pedagogical correctness (see 10)
   │ 3. Cross-mission checks          │  prerequisites exist, concept coverage,
   │                                  │  no duplicate ids, workshop systems exist
   └──────────────┬───────────────────┘
                  ▼
        build fails on any error
                  │
                  ▼
        domain/content/assemble.ts  (runtime: validates again, cheap)
```

**The loader is split in two, and that split is R3.** `domain/content/assemble.ts` is a pure
function over already-parsed records; `adapters/content/fs.ts` is the only module that touches
the filesystem. The browser reuses `assemble.ts` unchanged and swaps the adapter for
`import.meta.glob`. An earlier draft put a single `domain/content/loader.ts` here; that module
could not have existed without importing `node:fs` from the domain, which R1 and R3 forbid.

Validating twice (build + runtime) is deliberate. The build check protects the developer; the
runtime check protects against a stale cache serving an old bundle with new content.

### Adding a mission without touching code

1. Add `content/missions/m13.json`.
2. Run `npm run validate:content` — it tells you exactly which fields are missing or invalid.
3. Add it to the world's mission order array in `content/worlds.json`.
4. Done. No component changes, no route changes, no type changes.

If step 4 ever becomes false, R2 has been violated and the architecture has regressed.

---

## 8. Why React + TypeScript + Vite

| Choice | Justification | What would change it |
| --- | --- | --- |
| **React** | The UI is a state machine over a linear flow; React's model fits. Largest hiring pool for a solo/small team. | Nothing in the MVP's scope |
| **TypeScript** | The domain has ~15 interacting types (mission, evidence, diagnosis, mastery). Untyped, the mentor and mastery code would be unmaintainable. `strict: true`, no `any` in `domain/`. | Nothing |
| **Vite** | Sub-second HMR matters when authoring 12 missions; the build is a static bundle, deployable to any CDN with zero server cost. | A backend requirement (see `08`) |

### Deliberately not included

| Not used | Why |
| --- | --- |
| Next.js | No SSR need; a static SPA is simpler and cheaper. SSR would add a server for zero benefit. |
| A component library (MUI/Chakra) | The visual identity is custom and small (~12 components). A library would fight the design and add 200 kB. |
| A syntax-highlighting editor framework (Monaco/CodeMirror) | **Revisit at Milestone 3.** For 5–20 line functions, a `<textarea>` with a mono font and line numbers is enough. Monaco is ~2 MB and brings its own worker. Decision deferred with a trigger: add CodeMirror (not Monaco) only if playtesting shows players making avoidable syntax errors caused by the editor. |
| i18n framework | One language in the MVP. The schema has a `locale` field so it is additive later. |
| A backend | See `08` and `11`. |

---

## 9. Testing surface produced by this architecture

| Layer | Testable without a browser | Testable without a network |
| --- | --- | --- |
| `domain/content` | ✅ | ✅ |
| `domain/progression` | ✅ | ✅ |
| `domain/evaluation` | ✅ (with a fake ExecutionPort) | ✅ |
| `domain/diagnosis` | ✅ | ✅ |
| `domain/mastery` | ✅ | ✅ |
| `adapters/execution/worker` | ❌ (needs a browser) | ✅ |
| `adapters/persistence/local` | ❌ | ✅ |
| `features/*` | ❌ | ✅ |

Every domain module is a pure function over plain data. That is the whole point of R1, and it
is why `10-testing-and-security.md` can demand a meaningful test suite for the mentor instead
of a list of manual checks.

---

## 10. Extension points

The architecture must absorb future worlds without rewrites. Four seams:

| Seam | Interface | Adding a world | Adding an execution backend | Adding AI reasoning |
| --- | --- | --- | --- | --- |
| Content | `MissionSchema` | New JSON files | — | New optional field |
| Execution | `ExecutionPort` | — | New adapter, one line in `composition.ts` | — |
| Persistence | `ProgressStore` | — | New adapter | — |
| Reasoning | `ReasoningScorer` | — | — | New adapter behind the existing interface |

`ReasoningScorer` is already an interface in the MVP, with a deterministic implementation. That
is the entire preparation for AI: one more adapter, not a refactor.

```ts
export interface ReasoningScorer {
  score(input: ReasoningInput): Promise<ReasoningScore>;
}
```

---

## 11. What this architecture explicitly does not solve

- **Content authoring speed.** Twelve missions is ~12 hand-written JSON files plus hint copy.
  No architecture fixes that; it is the project's largest cost (see `11` §5, R1).
- **Execution security.** Deliberately out of scope here; see `08`.
- **Analytics.** Telemetry is a no-op adapter. We are not building a data pipeline before
  knowing which events matter.
