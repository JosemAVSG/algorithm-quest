# 14 — M3: Mentor Complete (partial)

What shipped, what changed from the spec, and what is still not true. Written the way
`12` and `13` are written: a claim without a test is not evidence.

Date: 2026-10-29. Evidence class: unit tests only. No playtesters, no telemetry, no
authored mission other than M01.

---

## 1. What shipped

| Area | Behaviour | Evidence |
| --- | --- | --- |
| Coupling | `classify` is a pure function of one attempt; history lives in `applyModifiers` | D1: 100 identical evaluations |
| Priority order | Probes → constraint → all-passing → undefined → NaN → loose equality → empty → hardcoded → authored → shape | D2 and the code fixtures |
| Modifiers | `LOW_ATTEMPT`, `REPEAT`, `NO_PROGRESS`, `STRUGGLING`, `POST_HINT`, in §3 order | D3, D5, D6 |
| E14 | Identical source becomes `E14` at level 3 | D6 |
| E15 | Same primary fault twice becomes `E15`, preserving the specific evidence | D5 |
| Level 4 | `MAX_HINT_LEVEL = 4`, gated by `hints[3].unlock` (default 4 attempts / 3 hints) | D7 |
| Modality | `prose → smaller_input → worked_variant`; the smaller-input panel shows real input/expected/actual | D5, D6 |
| Reasoning | Deterministic rubric table; AI parse + cap; invalid JSON falls back silently | D10, D11, D12 |
| E17 | Produced by `reasoningDiagnosis` when the debrief's rubric is below 2 | `reasoningDiagnosis` fixture |
| Codes | E01–E15, E17–E22 each have at least one fixture | `tests/unit/diagnosis/mentor.test.ts` |
| Unknowns | No match returns `E_UNKNOWN` with `likely` confidence, never a guess | D9 |

Total: 159 tests across 15 files, `npm run check` green.

---

## 2. Decisions that extend docs/04

These are not silent: each one is a case where §3's ten lines do not cover what the
engine can observe.

### 2.1 E19 sits above the all-passing branch, and blocks completion

§3 never places E19. If a mission bans `.some` because the exercise is to write the
loop, a solution that calls `.some` must not be rewarded with CLEAR just because the
tests are green. `evaluateRun` therefore sets:

```ts
passed = report.allPassed && !probes.failed && primary.code !== 'E19'
```

`report.allPassed` stays `true`. The mentor says the tests passed and the mission's rule
was broken; it never claims a passing test failed. E19 is also exempt from the
`NO_PROGRESS`/`REPEAT` replacement, because a constraint is not a learning ladder.

No authored mission uses `bannedConstructs` yet. M02 and M05 will; until then this path
is fixture-tested only.

### 2.2 E22 fires only when a failing case mixes types

A stray `==` in a helper is not evidence about an unrelated boundary bug. The classifier
requires both `usesLooseEquality(source)` and at least one failing case whose input
contains two of string/number/boolean. That is the M08 situation (`['1', 1]`), and it
does not fire on `==` used consistently.

### 2.3 E20 is a last-resort warning

It runs after every specific rule and before `E_UNKNOWN`: the same integer literal
written twice, excluding `0` and `1`. It is a warning by taxonomy and never part of
mastery. It is a heuristic over stripped source, and it says so.

### 2.4 E13 reads authored `edgeKind`, not input shape

`E04` requires every failing case to declare `edgeKind: 'empty'`. Guessing "empty" from
`input.length === 0` would be wrong for functions whose first argument is a scalar and
whose list arrives later.

### 2.5 E01/E02/E03 authored rules are not a catch-all

Found while writing D9: `matchUnconditionalAuthored` treated *any* rule without
`when.failingTestIds` as the fallback, including the author's E01 and E02 sentences. A
mission that listed E01 first would report every unexplained failure as a syntax error.
Those codes are engine facts; their rules now only supply the card's wording. This was a
real defect, not a hypothetical.

### 2.6 `primaryCode` on the evaluation

Once a repeated fault is labelled `E15`, the next attempt cannot compare final codes
without losing the repetition. `RunEvaluation.primaryCode` keeps the pre-modifier code,
and the session uses it for repeat detection.

---

## 3. What is deliberately not implemented

### 3.1 E16 — inefficiency (blocked)

`E16` needs a calibrated operation budget. `08` §6 and D12/D13 still define no reference
workload, no unit and no baseline. Time is not a substitute: `D13` says M12 measures
operations, not time. Producing E16 from uncalibrated milliseconds would be the exact
"confidently wrong" failure this document exists to prevent.

Consequence: `docs/10` §7 says "every E01–E22 has at least one fixture". That criterion
**is not met**, and cannot be met until D12/D13 are decided. It is recorded here instead
of being papered over.

### 3.2 The trace-table modality (blocked by the protocol)

§5 asks for `prose → trace table → smaller input → worked variant`. A table with
`i`, `element`, `condition`, `accumulator` cannot be produced honestly today:

- the one-message worker protocol returns results, not a stream of iterations;
- a read `Proxy` yields `(index, value)` only; `condition` and `accumulator` are not
  observable without instrumenting the player's own expressions.

M3 therefore switches to a **smaller input** as the first representation change, and
shows the real input/expected/actual of the first failing case. A half-empty table would
be a lie with better typography.

### 3.3 Explicit level-4 entrances and solution reveal

§4 lists two explicit entrances (worked example, show solution) besides the
attempts/hints guard. They are not wired: M3 exposes level 4 only through the guard,
which is the stricter reading of `docs/10`'s acceptance ("unreachable below 4 attempts
and 3 hints"). `solutionRevealed` and its mastery cap remain M4 work.

### 3.4 §5 matrix rows that still have no producing test

| Row | Status |
| --- | --- |
| Correct strategy, syntax error → E01, never counts as a hint | ✅ D4 |
| Logic fails → level-2 concrete input | ✅ D3/D5, but the strategy statement is **not read** by the mentor |
| Stuck on design, no run yet → level-1 conceptual hint | ❌ the idle panel still says "ejecuta para ver el diagnóstico" |
| Repeats the same error → E15 + modality | ✅ D5 |
| Correct code, weak explanation → E17 | ✅ `reasoningDiagnosis` |
| Correct and well explained → CLEAR + complexity | ✅ existing debrief |
| Succeeds with help → acknowledge + reinforcement | ❌ reinforcement scheduling is M4 |

So M3 is **partial**, not complete: `docs/11`'s "every row of §5 has a producing test"
is not satisfied while the strategy-aware row and the pre-run hint are missing.

### 3.5 E_UNKNOWN telemetry

The code exists and is testable; there is no collector. The analytics pipeline is
excluded from the MVP (`11` §1). The 5% rule in `04` §8 is therefore unobservable today.

---

## 4. Reasoning: what the AI layer does and does not do

`parseAiReasoning` and `combineReasoningScore` implement §6's schema validation and the
`deterministic + 1` cap. They are tested (D11, D12) and **not wired**: the MVP's
deterministic path remains the only one that runs (D4 open). Writing the cap before the
model is deliberate — it is the part that must not be invented later under deadline.

---

## 5. Files

| File | Change |
| --- | --- |
| `src/domain/diagnosis/classify.ts` | E04, E10, E13, E19, E20, E22; E14/E15 replacement; authored catch-all fix |
| `src/domain/diagnosis/source-scan.ts` | Comment/string stripping; iteration, banned construct, loose equality, duplicated literal |
| `src/domain/diagnosis/hints.ts` | Level 4, guard, modality, `interventionLevel`, `hintAvailable` |
| `src/domain/diagnosis/taxonomy.ts` | `Modality`, evidence `input`, `PRODUCED_CODES` |
| `src/domain/evaluation/evaluate-run.ts` | `source`, `primaryCode`, `previousHadHint`, E19 gate |
| `src/domain/evaluation/test-engine.ts` | `edgeKind` on every result |
| `src/domain/session/mission-session.ts` | Hint context, primary-code repeat detection, snapshot normalisation |
| `src/domain/mastery/ai-reasoning.ts` | Cap + schema validation (unwired) |
| `src/domain/mastery/reasoning.ts` | `reasoningDiagnosis` (E17) |
| `src/features/lab/MentorPanel.tsx`, `src/app/global.css` | Modality label and smaller-input case |
| `tests/unit/diagnosis/mentor.test.ts` | D1–D12 and the code fixtures |

---

## 6. What this document does not claim

- It does not claim M3 is complete. §3.1–§3.5 are open.
- It does not claim the new codes fire in real content. E19/E20/E22 and E13 are
  fixture-tested against cloned missions; no authored mission exercises them yet.
- It does not claim mentorship quality. No playtester has used the new ladder or the
  smaller-input modality. A7 is still unsatisfied.
