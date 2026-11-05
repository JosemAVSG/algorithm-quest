# 20 — Spaced review: reinforcement variants

Status: **implemented and authored, not playtested.** `05` §8 specified the queue and the evidence role and
promised "4 built-in variants"; what existed was the queue only (the registry held bare ids and the progress
screen said the variants "are not available yet"). This builds the rest.

## What a variant is

A short exercise on one concept, in a different fiction from the missions that taught it
(`content/reinforcement.json`, `ReinforcementVariantSchema`): a prompt, a contract (signature and rules), starter
code, 2–3 visible and 2–5 hidden tests, one hint, and optional constraints (banned constructs, no mutation).
It has no briefing, strategy step, debrief, mentor ladder or workshop reward, which is why it is much smaller than
a mission.

**There is one variant per concept: 41, `R-C01-1` … `R-C41-1`.** Every concept can reach the queue (a secondary
concept of a mission produces evidence too), so a gap in coverage would mean "no exercise" for a concept the
player is weak at. Examples of the fiction change: M08's pairwise duplicates become `hasTwinTickets` (cinema
tickets); M31's flood fill becomes `regionSize` (a crop plague map); M36's DP becomes `climb` (a staircase of 1s
and 2s); M37's trade-off capstone becomes `cheaperPlan`, a cost comparison between "sort and search" and
"search each time".

## How it plays

1. A concept enters the queue when a mission is completed with `mastery < 0.45` and (`hints ≥ 3` or the solution
   revealed), as before.
2. **Progress screen → "Refuerzo pendiente".** Each pending concept offers **"Practicar · N min"**; if a concept
   had no variant it would offer **"Repetir {misión}"** instead, the honest fallback the spec describes.
3. A small screen: the prompt and rules, an editor, the test panel (visible cases listed, hidden ones counted),
   one optional hint, and the same Worker, probes and test engine as a mission. A solution that passes every case
   but breaks a constraint (a banned construct, a mutated input, a non-deterministic result) does not count, and
   the screen says why.
4. **"Guardar y volver"** records one evidence event with `role: 'reinforced'` and removes the concept from the
   queue. It is not a decline (nothing is recorded as refused) and not a mission completion (the map is untouched).
   Leaving without solving saves nothing and keeps the offer.

When a concept has several variants the one practised least is offered, so repeated offers rotate.

## What it does to mastery

`reinforced` weighs 0.5 and is excluded from the transfer gate (`05` §8), so a variant can raise a weak concept up
to 0.5 but cannot make it `transferable`. A variant has no explanation step, so its reasoning score is the neutral
2: asking for a justification the exercise never requested would be inventing evidence. Using the hint counts as
`hintsUsed: 1`, like any assistance.

## Validation

`lintVariants` runs with the rest of the content pipeline (`L10_VARIANT`, `REF_VARIANT`): unique ids, the id
carries its concept, the concept exists, the entry point is declared in the starter code, hidden inputs do not
repeat visible ones, no edge tests, no placeholder text, and a mission may only list variants of a concept it
teaches. Every mission now lists the variant of its primary concept. A concept with no variant is a warning, not
an error.

`tests/unit/content/variants.test.ts` runs a **reference solution for every variant** through the real engine
(`tests/support/variant-solutions.json`) and checks that the starter code does not already solve it.

## Fixed on the way

The progress screen listed only the 16 concepts flagged `mvp: true`, so the 25 concepts of Worlds 2–6 had missions
but no card, no level and no way to show evidence. All 41 are listed now, grouped by world.

## Not covered

- One variant per concept, so "rotation" has nothing to rotate yet; the selection logic is tested with two.
- No playtest: difficulty, the 2–10 minute estimates and the hints are guesses.
- Variants are not scheduled by time (no "review in three days"); the trigger is still the weakness rule of `05` §8.
