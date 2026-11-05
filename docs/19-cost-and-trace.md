# 19 — Cost in steps, the E16 verdict and the step-by-step trace

Status: **implemented**, behind the decisions below that you still have to confirm (D12/D13). It lifts
two of the three refusals recorded in `13` §3 (the trace table and E16); the third, calibration against
wall-clock time, is replaced rather than built.

## 1. Cost is counted in steps (D13)

`13` §3.1 refused to ship a calibration constant that would look measured. D13 proposed the way out:
count operations, not milliseconds. This implements it.

**What is a step.** One loop iteration, one function call, and the work the built-in array methods do
inside a call. The player's source is parsed with acorn (`src/domain/execution/instrument.ts`) and text is
*spliced* into it: a tick at the start of every loop body and function body. No newline is inserted, so every
line number in an error message stays true. Source that does not parse runs as written and reports no cost;
a cost of "unknown" is never turned into a verdict.

**Built-ins.** `xs.indexOf(y)` inside a loop is a second loop, and ticks cannot see it. The worker wraps the
methods that scan or move elements (`indexOf`, `includes`, `lastIndexOf`, `slice`, `splice`, `shift`, `unshift`,
`concat`, `join`, `reverse`, `fill`, `flat`, `sort`, `Array.from`) and charges them what a textbook says they
cost, and charges one step to each `Set`/`Map` `add/has/get/set/delete`. Methods that take a callback are not
wrapped: the callback is already instrumented, and charging both would count each element twice, while early
exits (`some`, `find`) are counted exactly. This patches global prototypes, so it is installed only in the
worker, a disposable realm (`src/domain/execution/meter.ts`).

**Limits.** Unmeasured: array spread, `Object.keys`, string methods, `JSON`. A solution can hide work there.
The meter only counts while a case runs, so the harness (cloning, comparing, probes) is never charged.

**A case is stopped at a step limit.** `operationBudget × 20`, or 100 million steps (about 0.6 s) when the
mission declares none. Counting is deterministic, so a runaway loop ends the same way on every machine and
before the 2 s wall-clock timeout, which stays as a backstop. When a case is stopped the rest are reported as
not run, instead of each burning its own limit. This also made `S1` (infinite loop) stable: it used to sit on
the edge of its 2.5 s assertion.

## 2. E16

| Situation | Result |
| --- | --- |
| Correct, within budget | `CLEAR` |
| Correct, over an advisory budget (`enforced: false`) | completes; the mentor shows "Pero el coste se pasa." with what was measured and what is expected |
| Correct, over a budget the mission marks `enforced` | does not complete (`E16`) |
| A case stopped at the limit, mission has a budget | `E16` |
| A case stopped at the limit, mission has no budget | `E03`: not a cost problem, a loop that does not end |

The cost of the largest case is shown under the tests ("Coste del caso más grande: 15.003 pasos · presupuesto
200"). Mastery's efficiency dimension now uses steps instead of wall-clock time.

**Budgets are calibrated, not guessed.** The 21 `operationBudget` values were re-measured against a reference
and a naive solution per mission (`tests/support/calibration-solutions.ts`). The budget is about three times
the reference, and `tests/unit/content/cost-calibration.test.ts` fails if a reference exceeds it or a naive
solution does not. Examples (steps, worst case): M21 16 vs 15.003, M24 8.001 vs 8.009.936, M13 32.001 vs
32.004.001, M10 60.001 vs more than 50 million.

**All budgets stay advisory.** `L3` forbids an enforced budget for a concept no earlier mission taught without
one, and for most of these concepts there is no earlier mission. Making any of them blocking is a content
decision, not a code one.

## 3. Step-by-step trace

`13` §3.2 refused a trace because a read-only `Proxy` yields `(index, value)` and nothing else, so the
`condition` and `accumulator` columns would have been invented. The instrumentation gives the real thing:
at each loop body and function entry, a closure reads the variables of the enclosing functions, each read
guarded so a variable not in scope (or still in its temporal dead zone) is skipped, while one that holds
`undefined` is kept.

- **Domain:** `traceCase` runs one case and records `{line, variables[], changed}` per step, bounded: at most
  400 steps, values previewed with limits (24 items, 12 keys, depth 4, 80 characters; Set and Map shown as
  such; cycles and functions survive) — `src/domain/execution/trace.ts`, `preview.ts`.
- **Port/worker:** `ExecutionPort.trace?` is optional; the worker answers a `trace` message. It only runs a
  case the player can already see, never a hidden one.
- **UI:** a "Paso a paso" panel under the editor. Pick a visible case, step with buttons or a slider, see the
  variables (what changed since the previous step is marked), and see the current line marked in the editor.
  At the last step it says how the run ended: returned, threw (with the line), or was stopped (an endless
  loop shows its first 400 steps, which is what `docs/04` §8 wanted on timeout). Editing the code closes the
  trace, because its lines would no longer match.

The trace decides nothing. The test engine stays the only judge of correctness.

## Decisions you still own

- **D13** (steps instead of time): implemented as proposed. If you prefer time, the meter can be ignored
  without touching the rest, but E16 and the mastery efficiency ratio would lose their signal.
- **D12** (only one hard budget): nothing is enforced, so it holds.

## Not covered

- Spread, `Object.keys`, strings and `JSON` are not metered.
- The trace shows the variables at the *start* of a loop body or call, not after every statement; a program
  that changes a variable at the end of the last iteration shows that change only in the final result.
- There is no visualisation of structures (stack, queue, graph) yet; the trace shows previews as text.
