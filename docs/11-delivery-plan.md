# 11 — Delivery Plan

Covers deliverables C13 (scope), C14 (milestones), C15 (acceptance criteria), C16 (risks,
assumptions, decisions).

---

## 1. MVP scope

### In scope

| Area | Included |
| --- | --- |
| Missions | M01–M12, fully authored (narrative, tests, hints, debrief, diagnostics) |
| Worlds | World 1 complete; Transition Arc complete; World 2 **visible but locked** |
| Learning cycle | All 12 steps, with the reasoning gate enforced |
| Mentor | Deterministic rule engine, 22 error codes, 4-level hint ladder, modality switching, trace table |
| Mastery | 16 concepts, 4 dimensions, 5 levels, caps, transfer gate, reinforcement queue |
| Progression | Prerequisite graph, unlock rules, world gate |
| Execution | Web Worker sandbox with hardening, timeouts, budgets, determinism and premature-exit probes |
| Persistence | `localStorage` behind a port, schema versioning, export/import |
| UI | 8 screens, responsive down to 900 px, keyboard-runnable lab |
| Content tooling | Schema, validator, 8 lints, coverage test |
| Tests | Unit, integration, 6 E2E paths, 10 security cases |

### Explicit exclusions

Each of these is a **deliberate no**, not an oversight. Adding one requires a new decision.

| Excluded | Why | Revisit when |
| --- | --- | --- |
| Accounts, auth, sync | Answers no MVP question (D3) | After the learning loop is proven |
| Backend of any kind | See `08`; scenario A needs none | A migration trigger fires |
| AI mentor | The rule engine covers the specified behaviour (D4) | Reasoning scoring is the bottleneck |
| Worlds 2–6 content | Six worlds is a different project | M12 validates the method |
| Sharing / publishing solutions | Would immediately require a real sandbox | Backend exists |
| Leaderboards, streaks, XP | Compete with the real signal (D11) | Never, probably |
| Timed missions | Measures anxiety | Not planned |
| Multi-file missions | Editor complexity without learning value | World 4 at the earliest |
| Mobile lab | A phone code editor damages credibility | Tablet layout at most |
| i18n framework | One locale in the MVP | A second locale is requested |
| 3D / artwork | The schematic *is* the identity | Never for the MVP |
| Graphical problem + result view | Unproven teaching value; per-mission artefact, not a theme (D14) | After M6 playtests, as a one-mission pilot |
| Analytics pipeline | We do not yet know which events matter | After M6 playtesting |
| Certificates / verifiable credentials | Requires server-side execution | Backend exists |

### Scope fence

**Exactly 12 missions.** If a 13th is proposed before M7, it replaces one of the 12 or it waits.
This is the single most important scope rule in the document, because content is the largest
cost (§5 R1) and content is where scope creep is most seductive.

---

## 2. Definition of done for the MVP

The MVP is done when a person who has never seen the product can, unaided:

1. Land on the map and understand what to do in under 30 seconds.
2. Play M01 from briefing to green sensor in under 6 minutes.
3. Make a real mistake, receive a specific diagnosis, take a hint, and fix it — without
   feeling punished.
4. Reach M12 and solve it without being told which structure to use.
5. Look at the dashboard and correctly explain why one concept is not yet `transferable`.

If any of the five fails, the MVP is not done regardless of how many tests are green.

---

## 3. Milestones

Eight milestones. Each is independently demoable and each ends with something a human can look
at.

### M0 — Foundations (content pipeline)

**Status:** ✅ done 2026-10-27. Built one gate early (see §8), now validated by Gate 2 approval.
`npm run check` green: 54 tests, 0 content issues.

**Build:** repo, Vite + React + TS, domain folder skeleton, `MissionSchema`, validator, lints
L1–L8, coverage test, `content/missions/m01.json`, `content/workshop.json`, CI running
typecheck + validate + unit.

**Deviation from the original wording:** the "six deliberately broken fixtures" are mutations
applied to one compact valid fixture in `tests/support/fixtures.ts`, not six separate JSON files.
Each mutation is named after the rule it breaks, so the test name *is* the fixture description.
Six near-identical 200-line JSON files would rot the moment the schema changes.

**Why first:** if the schema is wrong, every mission written afterwards has to be rewritten. The
schema is the cheapest thing to get right and the most expensive thing to get wrong.

**Done when:**
- `npm run validate:content` passes on M01 and fails, with a specific code, on six deliberately
  broken fixtures (one per structural rule).
- The coverage test fails when a concept is removed from a mission.
- CI is green on an empty app.

---

### M1 — Vertical slice (M01 playable end to end)

**Status:** ✅ done 2026-10-27, as **buildable** — not validated. `npm run check` green (89 tests,
0 content issues); `npm run test:e2e` green (X1–X6). Walkthrough: `12-m1-walkthrough.md`.

**This is the milestone you said you would approve first, and it is the right instinct.**

**Build:** workshop map (one node), briefing, strategy gate, lab (textarea + line numbers), worker
execution, test panel with diffs, diagnosis for `E01/E02/E05/E08/E12`, three hint levels, debrief
with four blocks, evidence emission, map update on completion.

**Not in M1:** mastery dashboard, persistence, levels 4, trace table, other missions, budgets.

**Done when:**
- E2E X1 passes: landing → green sensor, no manual intervention.
- E2E X2 passes: the `>=` bug produces `E05`, the hint says the specific thing, the fix completes
  the mission.
- ⚠️ **Provisional (A7):** the human criterion is replaced until playtesters exist. M1 is accepted
  on E2E X1/X2 green **plus** a documented solo walkthrough that records, for every step, either
  the time taken or the point where outside knowledge was required. That list is the substitute
  for playtest evidence. It is weaker, and M1 is recorded as **buildable**, not **validated**.
- Reloading mid-mission loses nothing except the editor buffer (documented).

**The demo that matters:** record a 3-minute video of the boundary bug being hit, the hint being
read, and the fix landing. With A7 unsatisfied this is a demo of the product working *for its
designer*, which is the weakest possible evidence — but it still catches the failure that matters
most at this stage: a mission that is not even fun to debug when you already know the answer.

---

### M2 — Execution hardening

**Status:** ✅ done 2026-10-29. `npm run check` green (124 tests); `npm run test:e2e` green
(X1–X6, S1–S10). Output cap, probes and the completion gate shipped; calibration, trace table and
E16 were refused with reasons in `13-m2-hardening.md`.

**Build:** worker prelude, per-run worker lifecycle, calibrated timeouts, output caps, mutation
probe, determinism probe, rotation probe, trace table generation, budget plumbing.

**Done when:** S1–S10 pass; a `while(true)` mission attempt recovers in under 2.5 s and the editor
is immediately usable; a 5 MB return value is rejected with a clear message.

---

### M3 — Mentor complete

**Status:** ⚠️ **partial 2026-10-29.** D1–D12 are green and the level-4 guard holds, but E16,
the trace-table modality, two rows of the `04` §5 matrix and `E_UNKNOWN` telemetry are open.
`14-m3-mentor.md` §3 records each one and why it was not faked.

**Build:** all 22 error codes with fixtures, priority ordering, modifiers (`NO_PROGRESS`,
`REPEAT`, `LOW_ATTEMPT`, `STRUGGLING`, `POST_HINT`), modality switching, level-4 guard, the
deterministic reasoning rubric, `E_UNKNOWN` telemetry.

**Done when:** D1–D12 pass; every row of the `04` §5 matrix has a producing test; the level-4
guard cannot be reached by any sequence with fewer than 4 attempts.

**Delivered:** E01–E15 and E17–E22 with fixtures; `E14`/`E15` replacement; four-rung ladder with
the guard; smaller-input modality; reasoning rubric and the AI cap (unwired); `E17`.
**Not delivered:** `E16` (needs D12/D13), trace table (needs a streaming protocol and
instrumentable expressions), pre-run hint, strategy-aware intervention, telemetry.

---

### M4 — Mastery and persistence

**Build:** evidence model, scoring, levels, caps, transfer gate, reinforcement queue, dashboard,
`localStorage` adapter, migrations, export/import.

**Done when:** MT1–MT11 and IT1–IT4 pass; the `05` §11 worked example reproduces exactly; a player can
export, clear storage, import, and see identical mastery.

---

### M5 — World 1 content (M02–M09)

**Build:** eight missions, complete with diagnostics, hint ladders, debriefs.

**This is the largest milestone and the one most likely to overrun.** Budget accordingly.

**Done when:**
- All lints pass; the coverage test passes for `C01–C12`.
- The M02/M03 contrast is validated with 3 playtesters: they can articulate the difference
  between "stop at first" and "collect all" in their own words.
- No mission takes longer than 25 minutes for a target-persona playtester.
- `E_UNKNOWN` rate across M02–M09 playtests is under 5%.

---

### M6 — Transition Arc (M10–M12)

**Build:** three missions, performance budgets, strategy assessment, four reinforcement variants,
World 2 gate.

**Done when:**
- M12 is playable and its strategy assessment scores correctly.
- The World 2 node appears on the map, locked, with a stated requirement.
- At least 40% of playtesters pass M12 with ≤2 hints and no reveal. **If this fails, the
  curriculum is wrong, not the player** — return to M5.

---

### M7 — Polish

**Build:** responsive layout down to 900 px, accessibility floor, empty/error states, onboarding
copy, export reminder, desktop-only message below 900 px.

**Done when:** the `10` §7 acceptance table is fully green.

---

### After M7 — recorded, not scheduled

Ideas that came up during M1–M2 and belong to the product, not to the MVP. They are listed so
they are neither forgotten nor smuggled into a milestone. Each needs its own decision before it
gets a scope.

| Candidate | Shape | Decision |
| --- | --- | --- |
| Graphical problem + result view | 2D canvas showing the mission's input before the run and the player's actual output after it; one mission first (M07 or M10) | D14 — recorded, scope settled |

What this is **not**: a step-by-step animation of the algorithm, a hand-authored animation of
the correct solution, or a 3D scene. The first two compete with the debrief's job; the third
spends the bundle budget on a schematic that already communicates. See D14.

---

## 4. Acceptance criteria per milestone

| Milestone | Verifiable criterion | Blocking? |
| --- | --- | --- |
| M0 | Validator rejects 6 broken fixtures with the right codes; coverage test fails on a dropped concept | ✅ |
| M1 | X1–X6 green in Chromium; solo walkthrough documented (⚠️ provisional — A7 unsatisfied, no human evidence; `12` records no timings by design) | ✅ |
| M2 | S1–S10 green; infinite loop recovers in <2.5 s; 5 MB output rejected (⚠️ calibration, trace table and E16 deferred — see `13` §3) | ✅ |
| M3 | D1–D12 green; level-4 guard unbreakable | ⚠️ partial — green on D1–D12 and the guard; E16 + two §5 rows open (`14` §3) |
| M4 | M1–M11, I1–I4 green; export/import round trip lossless | ✅ |
| M5 | All lints + coverage green; `E_UNKNOWN` <5%; M02/M03 contrast articulated by 3/3 testers | ✅ |
| M6 | M12 playable; ≥40% independent pass | ✅ |
| M7 | `10` §7 table green | ⬜ |

**Blocking** means the next milestone does not start. M6 is blocking in the strongest sense: a
failure there is a product finding, and proceeding to World 2 would build on an unvalidated
premise.

---

## 5. Risks

Ordered by expected damage × likelihood.

### R1 — Content authoring is the real cost (HIGH / HIGH)

Twelve missions with 4 hints, 10 tests, 5+ diagnostics, a debrief, and a worked variant each is
roughly **2–3 days of focused work per mission** once the tooling exists. That is 25–35 days,
more than all the engineering combined.

**Mitigation:** M0's tooling is not bureaucracy; it is what makes the 12th mission cost one day
instead of three. Author M01, M02, M03 by hand, then re-time. If the 4th mission still takes
three days, the schema is wrong and gets fixed before M05 continues.

**Leading indicator:** days per mission trending up instead of down.

### R2 — Hints are the product, and they are hard to write (HIGH / MEDIUM)

A vague hint ("think about loops") and a leaked hint ("use `>`") are both failures, and both are
easy to write. Hint quality cannot be linted.

**Mitigation:** every hint is playtested against a real stuck state, not written from the
designer's memory of being stuck. The level-4 worked variant must be isomorphic-but-different
(`04` §4) — that rule alone prevents the most common failure.

**Leading indicator:** players requesting level 3 immediately after level 1.

### R3 — M12 may reveal the thesis is wrong (HIGH / MEDIUM)

If fewer than 40% of players choose the right structure on an unlabeled problem, the product's
central claim does not hold.

**Mitigation:** none, and that is the point. M12 is a deliberate early falsification test. The
correct response to failure is to fix M10/M11 (the ramp), not to lower the threshold or add a hint.

**Leading indicator:** playtesters who pass M08 and M11 but cannot start M12.

### R4 — The sandbox creates false confidence (MEDIUM / MEDIUM)

Someone will eventually read "isolated execution" and propose shared solutions.

**Mitigation:** `08` §8 forbids the word "sandbox" in user-facing copy; the migration triggers in
`08` §7 are written down; the adapter boundary is the only thing that makes the eventual move
cheap.

### R5 — The mentor talks too much (MEDIUM / HIGH)

A mentor with something to say after every run becomes noise, and players learn to ignore it.
This is the most likely way to ruin a good engine.

**Mitigation:** the mentor says nothing when the code is correct and within budget — even if it is
inelegant. Silence is specified behaviour (`M03` §6, `M12` §7), not an absence of behaviour.

**Leading indicator:** hint requests dropping to near zero while failure rates stay constant
(players have stopped reading).

### R6 — Gamification drifts back in (MEDIUM / HIGH)

The first stakeholder request will be "can we add XP?". Once added, it becomes the metric.

**Mitigation:** D11 is a blocking decision, not a preference. The map has three states per node
and no numbers. The dashboard has no aggregate score.

### R7 — Scope creep into worlds 2–6 (HIGH / MEDIUM)

The roadmap in `02` is seductive: it looks like a plan for six games.

**Mitigation:** the scope fence in §1. The map shows World 2 locked, which is the cheapest
possible way to honour the roadmap without building it.

### R8 — Editor choice is wrong (LOW / MEDIUM)

A plain textarea may cause avoidable syntax errors that pollute the diagnosis signal.

**Mitigation:** the decision is deferred to M3 with an explicit trigger: add CodeMirror (not
Monaco) only if playtesting shows avoidable editor-caused errors. CodeMirror 6 is ~150 kB vs
Monaco's ~2 MB.

---

## 6. Assumptions

| # | Assumption | If wrong |
| --- | --- | --- |
| A1 | One experienced developer, full-time | Multiply §7 by the inverse of available capacity |
| A2 | Spanish is the only launch locale | Add a content pass and an i18n layer (+15%) |
| A3 | No accounts in the MVP | D3 reopens; add ~2 weeks |
| A4 | Desktop-first is acceptable | Mobile lab is a redesign, not a responsive tweak |
| A5 | Chromium is the only launch browser | +1 week for Safari/Firefox fixes |
| A6 | The 12 missions are the fixed scope | Content cost grows linearly; the fence in §1 breaks |
| A7 | Playtesters are reachable (3–5 target-persona people) | M1, M5, M6 acceptance criteria become unverifiable — this is a real blocker, not a nice-to-have |

**A7 is the assumption most likely to be quietly violated.** Three of the eight milestone gates
require real humans. If no playtesters are available, the gates degrade into self-assessment and
the product ships on the designer's opinion. Flag it now.

**Status (2026-10-27): not satisfied.** No playtesters are available yet. Consequences are
recorded per milestone rather than papered over:

- **M1** is accepted on a *weaker, explicitly provisional* criterion. See §3 M1. M1 proves the
  thing can be built; it does not prove it works for anyone. The walkthrough in `12` deliberately
  records no timings: a stopwatch on the author would be a fabricated measurement.
- **M5 and M6 are blocked.** Their criteria depend on humans in a way that cannot be substituted
  — the M02/M03 contrast test and the M12 40% independent-pass test are both measurements of
  other people. No solo proxy exists for either, and inventing one would be the exact dishonesty
  this plan is written to prevent.
- **The effort estimate assumes A7 holds.** Without playtesters the loop is longer, not shorter,
  because design errors surface later and cost more to fix.

---

## 7. Decisions requiring approval

Five are blocking. Full detail in `00-open-decisions.md`.

| ID | Decision | Recommendation | Blocks | Status |
| --- | --- | --- | --- | --- |
| **D1** | Code execution | Worker + hardening, no backend | M1 | ✅ accepted |
| **D2** | Player language | Plain JavaScript | M1 | ✅ accepted |
| **D3** | Persistence | `localStorage` behind a port | M4 | open |
| **D4** | Mentor | Deterministic, no AI in MVP | M3 | open |
| **D11** | Mastery | Computed, no XP/points | M4 | open |
| D5 | Content language | ES copy / EN docs | M0 | open |
| D6 | M09 | Measurement-only mission | M5 | open |
| D7 | World framing | World 1 + Transition Arc | M0 | open |
| D8 | Big-O placement | Notation at end of World 3 | Roadmap | open |
| D9 | Recursion bridge | Extra mission in World 4 | Roadmap | open |
| D10 | Invariant concept | Extra mission in World 3 | Roadmap | open |
| D12 | Perf budgets | Only M12 enforced, M10 warning | M6 | open |
| D13 | What M12 measures | Operation count; time as backstop | M6 | open |

---

## 8. Sequence after approval

```
Gate 1 (pedagogy + missions)  →  Gate 2 review     ✅ 2026-10-27
Gate 2 (architecture)         →  M0, then Gate 3    ✅ M0 done · D1 + D2 accepted
Gate 3 (delivery)             →  M1 onward          ✅ approved 2026-10-27 (A7 unsatisfied — see §6)
```

Practically: **M0 needs Gate 1 *and* Gate 2.** Gate 1 supplies the missions, the workshop
systems and the coverage rule; Gate 2 supplies the mission schema (`09`) and the lints (`10`).
Because the gates are sequential, M0 starts at Gate 2. M1 needs Gate 3, because `11` is what
defines its scope and its definition of done.

**Correction (2026-10-27).** An earlier version of this section claimed M0 needed only Gate 1,
"the schema follows from the missions". That was wrong: the schema follows from the missions
only in its *fields*. Its *rules* — V1–V12 and L1–L8 — are Gate 2 deliverables, and M0 is
mostly those rules. The build that exists today was therefore started one gate early and is
provisional: if Gate 2 changes `09` or `10`, M0 changes with it. That cost is already paid;
the correction is so it is not paid twice.

**Nothing is built before Gate 1.** That is not caution, it is arithmetic: a schema written
before the missions are agreed will be rewritten twelve times.

---

## 9. Effort estimate

Focused days, one experienced developer, assuming A1 and A7 hold.

| Milestone | Days | Cumulative |
| --- | --- | --- |
| M0 — Foundations | 3–4 | 4 |
| M1 — Vertical slice | 7–9 | 13 |
| M2 — Execution hardening | 4–5 | 18 |
| M3 — Mentor complete | 5–7 | 25 |
| M4 — Mastery + persistence | 4–5 | 30 |
| M5 — World 1 content | 14–18 | 48 |
| M6 — Transition Arc | 9–12 | 60 |
| M7 — Polish | 5–7 | 67 |

**Total: 51–67 focused days (~10–13 weeks full-time).**

Content (M5 + M6) is 45% of the total. Engineering is the smaller half, and any plan that
inverts that ratio is a plan to ship an empty shell.

**The honest checkpoint:** M1 is 13 days in. If the vertical slice does not feel like a product
at day 13, the remaining 50 days will not fix it. That is the cheapest possible place to stop.
