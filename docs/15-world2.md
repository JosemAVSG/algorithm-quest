# 15 — World 2: the warehouse (M13–M16)

Status: **authored, not playtested.** Same caveat as `12`: buildable, not validated (A7).

World 2 covers `C17`–`C20` (`02` §1). Each mission has one primary concept, one secondary,
the four-rung hint ladder, a structured debrief (`explain`) and 3 visible / 4 hidden / 3–4 edge
tests. Expected values were produced by a reference solution, and every authored diagnostic
that names failing tests was checked against a deliberately wrong implementation that fails
exactly those tests.

| ID | Title | Primary | Secondary | Function | System |
| --- | --- | --- | --- | --- | --- |
| M13 | Las piezas que encajan | `C17` complement-lookup | `C13` | `findMatchingPair(sizes, target)` | `sys.dispatch` working → reliable |
| M14 | El almacén por zonas | `C18` grouping | `C14` | `groupByZone(items)` | `sys.store` working → reliable |
| M15 | El parte de incidencias | `C19` counting-at-scale | `C14` | `codesAtLeast(codes, minCount)` | `sys.log` working → reliable |
| M16 | Las fichas duplicadas | `C20` key-design | `C18` | `duplicateRecords(records)` | `sys.guard` working → reliable |

## What each mission is designed to expose

- **M13** — comparing every pair is the natural first idea and it is slow. Traps: pairing a piece
  with itself (save before check), the position `0` being falsy, overwriting the first
  occurrence of a repeated size, and the "first pair" rule (smallest `j`, then smallest `i`),
  which differs from the double loop's order.
- **M14** — create the list for a zone once, then append. Traps: replacing the list on every
  item, creating it but never appending, and "cleaning" repeated skus.
- **M15** — count in one pass, then decide. Traps: `>` instead of `>=`, returning a code every
  time it reaches the minimum, and sorting by count or alphabetically instead of first
  appearance. Large hidden cases make the per-code re-scan visibly expensive.
- **M16** — decide what makes two records equal *before* grouping. Traps: not cleaning case and
  edge spaces, using the email alone, concatenating fields without a separator
  (`a@b.co`+`m1` = `a@b.com`+`1`), and stripping inner spaces.

## Deliberate choices

- **No new workshop systems.** All four missions use the `working → reliable` step that
  `sys.dispatch`, `sys.store`, `sys.log` and `sys.guard` still had free after World 1.
- **No enforced efficiency budget.** Like M10/M11, the missions declare an unenforced budget and
  an authored `E16` message; `E16` is still never produced (`13` §3.3, D12/D13 open).
- **No briefing illustration.** `briefing.visual` is optional; a new illustration is a UI task.
- **World 2 stays `in-progress`.** `complete` triggers the coverage lint that requires every
  concept to be taught twice, and `C17`, `C19`, `C20` are primary in exactly one mission.
- **`rotationInvariant: false`** on all four: rotating the input legitimately changes the answer.

## Not covered

- No playtest evidence, so the difficulty (4) and the 20–25 minute estimates are guesses.
- The 20.000-item hidden cases do not make a quadratic solution fail; they only run it slowly.
