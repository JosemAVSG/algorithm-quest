# 18 — Worlds 5 and 6: the network yard and the archive (M29–M37)

Status: **authored, not playtested** (A7), same caveat as `12`, `15`, `16` and `17`. With these two worlds
every world in `02-curriculum-roadmap.md` has missions; concepts `C01`–`C41` all have at least one.

Format and verification are the same as `15`: expected values come from a reference solution, and every
authored diagnostic that names failing tests was checked against a deliberately wrong implementation.

## World 5 — the network yard (M29–M33)

| ID | Title | Primary | Secondary | Function | System |
| --- | --- | --- | --- | --- | --- |
| M29 | El plano del patio | `C33` graph representation | `C18` | `buildNeighbors(n, tracks)` | `sys.chain` working → reliable |
| M30 | La ruta con menos paradas | `C34` BFS | `C28` | `fewestStops(neighbors, start, goal)` | `sys.queue` working → reliable |
| M31 | Las zonas inundadas | `C35` DFS | `C31` | `countStains(grid)` | `sys.stacker` working → reliable |
| M32 | El pedido que se espera a sí mismo | `C36` visited set / cycle safety | `C35` | `hasCircle(needs)` | `sys.balance` working → reliable |
| M33 | Las combinaciones del pedido | `C37` backtracking | `C31` | `waysToFill(pieces, target)` | `sys.maze` absent → installed |

- **M29** — one direction only; all stations sharing one list (`new Array(n).fill([])`); sorted neighbours instead
  of the order of the tracks; a self-track written twice; removing repeated tracks.
- **M30** — a depth-first route is not the shortest (the shortcut cases); no `-1` for an unreachable goal;
  counting stations instead of tracks. A solution without a visited table does not terminate on the cyclic cases.
- **M31** — diagonals; an island reachable only by going backwards; `mustNotMutate` forbids the "write 0 into the
  grid" trick, so a separate visited table is required.
- **M32** — marking "seen" is not enough: a diamond (`0→1,2` and both `→3`) is not a cycle. The player needs the
  three states (new, on the current path, done). Also: a cycle not reachable from task 0, and a self-need.
- **M33** — saving the list that keeps changing instead of a copy; not undoing the choice; exclude-before-include
  order; deduplicating equal pieces. Capped at 12–14 pieces (2^n leaves).

The Transition-Arc and World 1–4 systems that still had a free `working → reliable` step are reused here on
purpose: BFS repairs the queue, DFS the crane, cycle detection the balance, graph storage the chain.

## World 6 — the archive (M34–M37)

| ID | Title | Primary | Secondary | Function | System |
| --- | --- | --- | --- | --- | --- |
| M34 | La caja que falta | `C38` space complexity | `C06` | `missingBox(arrived)` | `sys.vault` absent → installed |
| M35 | Los días hasta el siguiente pico | `C39` amortized cost | `C27` | `daysUntilHigher(temps)` | `sys.ledger` absent → installed |
| M36 | Las escaleras del almacén | `C40` dynamic programming | `C31` | `ways(n)` | `sys.memo` absent → installed |
| M37 | La auditoría del plan | `C41` trade-off articulation | `C16` | `planOrder(tasks)` | `sys.council` absent → installed |

- **M34** — `[]`, `{}`, `Array`, `Set`, `Map`, `.sort`, `indexOf` and `includes` are banned, so the only
  accepted shape is a handful of loose numbers. Traps: summing to `n - 1` instead of `n`, forgetting the empty list.
- **M35** — a nested loop that is still linear because each index enters and leaves the waiting list once.
  Traps: `>=` instead of `>`, unresolved days left `undefined`, position instead of distance.
- **M36** — the only mission whose slow solution *fails* by design: naive recursion takes ~2 s at `n = 32` and
  ~21 s at `n = 36` (measured), so the hidden cases `n = 40, 50, 55` hit the 2 s timeout. That is reported as E03
  ("did not finish in time"), not as a cost verdict, because E16 is still not produced (`13` §3.3).
- **M37** — a capstone about choosing what to store: per-task counters plus a reverse index, and a queue for
  the order. The queue order is specified exactly (a task becomes ready when its last need is executed and joins
  the back of the queue), and one hidden case separates it from "repeatedly run the first ready task".
  `C41` is "articulation of trade-offs", but no mission can grade prose: the trade-off lives in the
  structured debrief questions (memory paid for time saved), not in a free-text field.

## Not covered

- No playtest evidence; difficulty (3–5) and minutes are guesses.
- `E16`, the trace table and operation counting are still missing. M30 and M32 would benefit most: a solution
  without visited marks simply never ends and shows up as E03.
- `strategyAssessment` is still M12-only; M37 does not use it.
