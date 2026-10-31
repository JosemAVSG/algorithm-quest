# 00 — Open Decisions

Every decision below is either **blocking** (implementation cannot start) or
**shaping** (implementation can start, but reversing later is expensive).

I state a recommendation for each. I do not proceed on any of them without your
answer. Blocking decisions are `D1`, `D2`, `D3`, `D4`, `D11` — of which `D1` and `D2`
are now resolved.

Legend: **B** = blocking, **S** = shaping.

---

## D1 — Code execution boundary (B)

**Recommendation:** Web Worker + hardened prelude + hard timeout + output caps for
the MVP. Documented as sufficient only for the "player runs their own code in their
own browser" threat model. Backend sandbox deferred with explicit migration triggers.

**Why it matters:** it determines whether the MVP needs any infrastructure at all.
Getting it wrong in the "too weak" direction is a security lie; getting it wrong in
the "too strong" direction costs weeks and blocks Milestone 1.

**Full analysis:** `08-code-execution.md`.

**What I need from you:** accept the threat-model framing, or demand backend from day 1.

**Status:** ✅ **resolved 2026-10-27** — Option A accepted. The threat-model framing was accepted
as-is: no backend in the MVP. The migration triggers in `08` §7 are now the only sanctioned path
back to this decision.

---

## D2 — Player code language: plain JavaScript, not TypeScript (B)

**Recommendation:** plain JavaScript (ES2022), no transpilation, no type checker in
the execution path.

**Why:** a transpile step inside the sandbox doubles the failure surface (transpile
errors vs runtime errors must be distinguished for the mentor), adds 300–800ms latency
per run, and adds a dependency we would have to sandbox too. The mission contracts are
small enough that types buy the player nothing.

**Cost:** no type errors as a learning signal. Acceptable — the mentor already
distinguishes syntax from logic, which is the pedagogically important distinction.

**What I need from you:** confirm, or state that TS is a product requirement.

**Status:** ✅ **resolved 2026-10-27** — plain JavaScript confirmed. No transpile step in the
execution path.

---

## D3 — Persistence: local-only for the MVP (B)

**Recommendation:** `localStorage` behind a `ProgressStore` port. No accounts, no
database, no sync. Export/import progress as a JSON file (manual, user-driven).

**Why:** the first question we must answer is "does the learning cycle work", not
"can users log in". Local persistence answers it in one afternoon.

**Migration path:** the port has a single async interface; a `RemoteProgressStore`
replaces it without touching mastery logic. Schema is versioned from day 1 (`schemaVersion`).

**Known limitation to accept explicitly:** clearing browser data destroys progress.
Mitigated only by manual export. This is a real product cost and I am not hiding it.

---

## D4 — Mentor: deterministic-first, AI optional and off by default (B)

**Recommendation:** the mentor is a **rule engine** in the MVP. No AI provider is
required to ship. AI is an optional, feature-flagged, *advisory-only* evaluator of
free-text reasoning, added after the deterministic loop is proven.

**Why:** the entire adaptive behaviour in the brief's table can be implemented with an
error taxonomy + a priority-ordered rule set + authored hint ladders. That is
testable, deterministic, free, and offline. An LLM here adds latency, cost, and a
class of failure (confident wrong feedback) that directly violates principle 9.

**Full design:** `04-mentor.md`.

**What I need from you:** accept "no AI in MVP", or name the specific behaviour that
you believe only an LLM can produce. If the latter, I will evaluate it honestly rather
than defend the rule engine.

---

## D5 — Content language: Spanish player-facing copy, English design docs (S)

**Recommendation:** mission titles, briefings, hints, and debriefs in **Spanish**
(the titles you provided are Spanish; the product reads as Spanish-language).
All structural/metadata fields and all design documents in **English**.

**Why:** mixing languages inside one artifact is how content rot starts. The schema
carries a `locale` field per content bundle so a second language is an additive
change, not a migration.

---

## D6 — Mission 9 has no new algorithm (S)

**Recommendation:** keep it exactly as you framed it — a cost/measurement mission with
no new pattern. It is the hinge that makes Mission 10 feel necessary rather than
arbitrary.

**Consequence:** Mission 9 must still be *code*, not a quiz. Design: the player writes
the function that predicts the comparison count, and the harness verifies the
prediction against a real instrumented run. See `missions/M09.md`.

---

## D7 — The 12 missions span two worlds, not one (S)

**Observation:** your §4 catalog mixes World 1 concepts (M1–M9) with World 2 concepts
(M10 Set, M11 Map, M12 strategy selection).

**Recommendation:** formalize it. World 1 = M1–M9. Then a **Transition Arc** = M10–M12
that belongs to World 1 narratively but teaches World 2 primitives and is the gate into
World 2. This resolves the contradiction without changing your mission list.

**Full treatment:** `02-curriculum-roadmap.md` §3.

---

## D8 — Big-O notation moves from World 6 to end of World 3 (S)

**Recommendation:** revise your roadmap. Complexity *intuition* stays in World 1 (M9).
Complexity *notation* (O, Ω, Θ, growth classes) moves to the end of World 3, immediately
after the player has empirically felt O(n²) vs O(n log n) with sorting.

**Why:** World 6 currently owns complexity *and* dynamic programming. DP is
unreachable without complexity notation, so World 6 becomes a single overloaded world
with two unrelated hard ideas. Splitting them fixes the prerequisite chain.

---

## D9 — World 4 needs a recursion bridge mission (S)

**Recommendation:** insert one mission between linked lists and trees whose only job is
building a call-stack mental model (trace a recursive function by hand, then predict
stack depth). Recursion is the single highest-abandonment concept in this curriculum.

---

## D10 — World 3 needs an explicit "invariant" concept (S)

**Recommendation:** two pointers and sliding window are not "loop tricks"; they are
*invariant preservation* arguments. Without a mission that makes the invariant explicit,
players memorize the template and fail the transfer mission.

---

## D11 — Mastery is computed, never awarded (B)

**Recommendation:** no XP, no levels, no points for completion. The dashboard shows
four dimension scores per concept and a mastery level derived by formula (`05-mastery.md`).

**Why:** the brief says "reward understanding, not just passing tests". Points for
completion are the exact mechanism that turns this into a checklist.

**What I need from you:** confirm. If you want a visible numeric score for motivation,
I will add one *derived* from the same formula, never a parallel currency.

---

## D12 — Mission 12 is the only MVP mission with a performance budget (S)

**Recommendation:** exactly one mission (M12) enforces a hard operation/time budget, and
M10 enforces a soft one. Everywhere else, efficiency is assessed through the debrief and
the reasoning rubric, not through a failing test.

**Why:** performance tests that fail correct solutions teach the wrong lesson and generate
the worst kind of frustration. Efficiency should be *observed and discussed* before it is
*enforced*.

---

## D13 — M12's budget measures operations, not wall-clock time (S)

**Recommendation:** M12 enforces an **operation count** (indexed reads and comparisons counted
through a `Proxy`), and uses wall-clock time only as a generous backstop (≥10× the intended cost)
whose sole job is to catch an infinite loop. D12 is unchanged in scope — exactly one mission
enforces a budget — but *what* it enforces changes.

**Why:** `08` §6 currently makes time the primary signal and operation count corroborating. That
ordering is wrong for an enforced budget. Wall-clock time on a laptop under thermal throttling
fails correct solutions, which is the precise failure mode D12 exists to prevent. Operation count
is deterministic and machine-independent. Startup calibration does not rescue it: it measures the
machine three minutes ago, not the machine now.

**Blocks:** M6 (M12). Not M1.

**What I need from you:** confirm the inversion, or keep time primary and accept flakiness.

---

## D14 — Graphical representation of the problem and its result (S, post-MVP)

**Recommendation:** do not build it in the MVP. When playtests exist, pilot it on **one**
mission whose input and output are spatial (M07 search, M08 duplicates, M10 memory, M12 report),
as a 2D canvas.

**What was actually asked for (2026-10-29, corrected twice).** Before solving, show the problem
graphically — the queue of orders, the row of boxes, the list of readings. After solving, animate
the result: how the boxes end up ordered, which duplicate was found, who won the dispatch. The
robot was an example, not the requirement. A graphical idea of what is being worked on, at the
start and at the end.

**What it is not:**

| Not this | Why |
| --- | --- |
| A step-by-step animation of the algorithm running | Not requested, and the expensive version: it needs instrumentation or a new mission contract, and it competes with the debrief's job |
| A hand-authored animation of the correct solution | Turns reasoning into watching; the player feels fluency without earning it |
| A 3D scene with a camera | The schematic is the identity (`06` §1); a camera adds a navigation task and occlusion, and the third axis encodes nothing. If depth is wanted, an isometric 2.5D projection drawn in canvas/SVG gives volume without WebGL |

**How it would work, when it is built:** the mission declares an optional `visualization`
descriptor (what the input represents: a queue, a shelf, a pair matrix), and the app renders
`mission.tests[].input` before the run and `evaluation` output after it. The data is the
player's own — a wrong result is rendered wrong, which is the only reason this is evidence and
not decoration. No proxy, no read log, no new contract, no changes to the test engine.

**Cost:** one renderer per mission shape, plus the descriptor and its copy. It is content work,
which is the dominant cost in this plan (`11` §5 R1), which is why it waits.

**What a pilot must prove:** a tester understands the problem faster, or corrects their own
mistake better, than with today's briefing and diff. If not, it is deleted.

**Status:** ⏸️ recorded 2026-10-29 at the product owner's request. Not scheduled; no work starts
until M6 playtests produce evidence.

---

## Decision log

| ID | Type | Recommendation | Status |
| --- | --- | --- | --- |
| D1 | B | Worker + hardening for MVP | **accepted 2026-10-27** |
| D2 | B | Plain JavaScript | **accepted 2026-10-27** |
| D3 | B | localStorage behind port | open |
| D4 | B | Deterministic mentor, no AI | open |
| D5 | S | ES copy / EN docs | open |
| D6 | S | M9 is measurement-only | open |
| D7 | S | World 1 + Transition Arc | open |
| D8 | S | Big-O notation → World 3 | open |
| D9 | S | Recursion bridge mission | open |
| D10 | S | Invariant concept in World 3 | open |
| D11 | B | Mastery computed, no XP | open |
| D12 | S | One hard perf budget (M12) | open |
| D13 | S | M12 measures operation count, not time | open |
| D14 | S | Post-MVP: 2D representation of problem + result, one-mission pilot | ⏸️ recorded 2026-10-29 (scope settled) |
