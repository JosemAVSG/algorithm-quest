# 13 — M2 Execution Hardening: what shipped, what was refused

Record of Milestone M2 (`11-delivery-plan.md` §3 M2). Same rule as `12`: the
document states what is verified and what is not, and it does not invent a number
to fill a table.

**Status:** ✅ done 2026-10-29, with three documented refusals (§3).
`npm run check` green (124 tests). `npm run test:e2e` green (16 paths: X1–X6, S1–S10).

## 1. Done-when, honestly

| Criterion (`11` §3 M2) | Evidence | Result |
| --- | --- | --- |
| S1–S10 pass | `e2e/security.spec.ts` (10 paths) + `tests/unit/execution/prelude.test.ts` | ✅ |
| `while(true){}` recovers in < 2.5 s, editor immediately usable | S1 asserts elapsed < 2 500 ms, then runs correct code in the same session | ✅ (2 000 ms hard timeout, measured end-to-end) |
| A 5 MB return value is rejected with a clear message | S7; the cap message is `Tu función devolvió demasiada información…` | ✅ |

The 2 000 ms timeout is unchanged. The tighter 400 ms ceiling exists and is
tested (`timeoutFor`), but no mission declares `enforced` efficiency yet, so it is
plumbing rather than product behaviour.

## 2. What was built

| Piece | Where |
| --- | --- |
| Bounded output estimate (no `JSON.stringify`) | `src/domain/execution/output-cap.ts` |
| Mutation / determinism / rotation probes | `src/domain/execution/probes.ts` |
| Probe wiring and budget sharing | `src/adapters/execution/worker/worker-entry.ts` |
| Protocol with probe config and new outcome kinds | `src/adapters/execution/worker/protocol.ts`, `src/domain/execution/port.ts` |
| Timeout selection (2 000 / 400 ms) | `src/adapters/execution/worker/runner.ts` |
| Probe verdicts and the real completion gate | `src/domain/evaluation/evaluate-run.ts` |
| Diagnosis order incl. E07/E11/E18 and cap-E12 | `src/domain/diagnosis/classify.ts` |
| Preclude property access, not just calls | `src/adapters/execution/worker/prelude.ts` |
| Security suite | `e2e/security.spec.ts` |

### The completion gate moved, and that matters

`report.allPassed` answers "did the tests pass". `evaluation.passed` answers "can
this mission be completed", and folds in the probes. Without that split, a
function that mutates its input would have passed every test, shown
"Las pruebas pasan", and completed the mission — with the E11 card invisible
because the mentor returned before reading the diagnosis. That bug is exactly the
kind M2 exists to prevent, so the gate now uses `passed` in `canOpenDebrief`,
`submit_debrief`, the mentor branch, and evidence emission.

### Two probe bugs found by the security suite

- **`indexedDB` is not a callable global.** The prelude replaced it with a
  thrower function, so `indexedDB.open('x')` died with `TypeError: indexedDB.open
  is not a function` — true, unhelpful, and not the message the doc promises. The
  prelude now installs a proxy that throws `indexedDB is not available` on call,
  construct, property read, write, and `in`.
- **Strict-mode selectors hid duplicates.** S2/S3/S4/S6/S8/S10 stress the same
  message in every failing test row. The suite now asserts on the mentor region,
  not the whole page, which is also closer to what the player reads.

## 3. Refusals (the part worth arguing about)

### 3.1 No calibration

> **Update:** cost is now counted in steps, so there is nothing to calibrate against the clock. See `19-cost-and-trace.md`.

`docs/08` §6 asks for startup calibration with a fixed reference workload. It
never defines the workload, the unit, the baseline, or the scope. D13 further
argues that wall-clock budgets should not be enforced at all, because a throttled
laptop fails a correct solution.

Inventing a reference workload would produce a number that *looks* measured. M2
ships the budget plumbing and the 400 ms rule and defers calibration to the
mission that needs it (M12, after D13 is settled). Recorded here so the gap is
visible rather than forgotten.

### 3.2 No trace table

> **Update:** built by instrumenting the source; the columns are real. See `19-cost-and-trace.md` §3.

`11` lists "trace table generation" in M2, `docs/04` §5 wants columns `i`,
`element`, `condition`, `accumulator`, and `docs/04` §8 wants a trace of the first
50 iterations on timeout.

A `Proxy` over indexed reads yields `(index, value)` and nothing else. `condition`
and `accumulator` are not derivable from it, so rendering those columns would be
fabrication; and a timeout trace requires streaming before `terminate()`, which
the one-message protocol does not have. M2 therefore ships **no** trace, and M3
must choose: add a real stepper (rewrite the function with instrumentation) or
drop the columns. Copying the doc's table shape without the data would be worse
than the gap.

### 3.3 No E16, no operation budgets

> **Update:** E16 is produced and the budgets are calibrated. See `19-cost-and-trace.md` §2.

D12/D13 are open. `budgetMs`/`operationBudget` cross the port so the adapter can
carry them, but nothing enforces a cost verdict and `E16` is never produced. An
efficiency diagnosis that fires on the wrong signal is worse than no efficiency
diagnosis.

## 4. Spec deviations introduced (and why)

| Deviation | Reason |
| --- | --- |
| E07 checked before `CLEAR`, not at step 8a | 8a only runs when a visible test fails. Rotation can invalidate an all-passing run, which is the case E07 is for |
| Probes checked before E08/E12-shape/authored rules | A mutation or nondeterminism is the cause; the failing test is the symptom. E11 outranks E05 on purpose |
| `internal_error` is not `E_UNKNOWN` | `docs/04` §8 and `docs/10` §7 forbid classifying a harness fault as a player error. `evaluateRun` returns `diagnosis: null` instead |
| Mutation detection is opt-in per mission (`mustNotMutate`) | The schema field exists to enable the invariant. A mission that sorts in place is not making a mistake |
| Rotation eligibility is derived, never authored | No schema field exists, and adding one is a schema change. A case is eligible when rotating the first array argument leaves `expected` deep-equal |

## 5. What M2 does not prove

- **That the probes are right about intent.** A legitimate function that
  normalises its input in place will be flagged E11 the moment a mission declares
  `mustNotMutate`. That is the point of the declaration, but no mission uses it
  yet, so the path is unit-tested only, never exercised by real content.
- **That 2 000 ms is the right timeout.** It is a safety valve, not a calibrated
  budget; the only evidence is that one infinite loop recovers under 2.5 s on this
  machine.
- **That the Worker is a sandbox.** It is not, and no copy says so
  (`docs/08` §8). S3–S5 and S8 assert the prelude's behaviour, which is a
  mitigation with a documented residual risk.
- **Anything about a mission with an efficiency budget**, because none exists.

## 6. Reproduce

```bash
npm run check        # 124 tests, typecheck, lint, content
npm run test:e2e     # 16 paths, incl. S1–S10, ~7 s
```
