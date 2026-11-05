# 16 — World 3: the sorting floor (M17–M22)

Status: **authored, not playtested** (A7), same caveat as `12` and `15`.

World 3 covers `C21`–`C26`. Format and verification are the same as `15`: expected values come
from a reference solution, and every authored diagnostic that names failing tests was checked
against a deliberately wrong implementation that fails exactly those tests.

| ID | Title | Primary | Secondary | Function | System |
| --- | --- | --- | --- | --- | --- |
| M17 | El depósito que no puede vaciarse | `C21` invariant | `C06` | `firstJam(start, moves)` | `sys.balance` broken → working |
| M18 | Dos registros, un solo orden | `C22` two pointers | `C21` | `joinSortedLists(first, second)` | `sys.merger` broken → working |
| M19 | La mejor racha de producción | `C23` sliding window | `C06` | `bestStreak(output, k)` | `sys.window` broken → working |
| M20 | La cola de tickets | `C24` sorting + comparator | `C08` | `attendOrder(tickets)` | `sys.sorter` broken → working |
| M21 | El primer lote vencido | `C25` binary search | `C21` | `firstValidBatch(dates, today)` | `sys.finder` broken → working |
| M22 | Medir el crecimiento | `C26` growth classes | `C12` | `growthKind(samples)` | `sys.growth` absent → installed |

## Traps each mission is built around

- **M17** — `<` vs `<=` at exactly zero; checking the property before applying the move; returning the last
  breach instead of the first.
- **M18** — forgetting the leftover tail when one list runs out; dropping duplicates on ties; `.sort` is banned.
- **M19** — starting the best total at `0` (all-negative input); jumping `k` at a time instead of one;
  skipping the last window.
- **M20** — comparator direction; a comparator that returns `true`/`false`; ordering the caller's array in place
  (caught by the mutation probe, E11).
- **M21** — `>` vs `>=`; stopping at any match instead of the first (repeated dates); `hi = length - 1`,
  which cannot answer "all expired".
- **M22** — the `0 / 0` case; demanding exact multiples when fixed extra steps exist; comparing the first and
  last sample instead of the last two.

## Deliberate choices

- **Six new workshop systems** (`sys.balance`, `sys.merger`, `sys.window`, `sys.sorter`, `sys.finder`,
  `sys.growth`): every `working → reliable` slot of the original ten was spent by World 2.
- **M21 cannot force a binary search.** Tests are data and `E16` is never produced (`13` §3.3), so a linear
  scan passes. The mission bans `indexOf`/`includes`/`find`/`findIndex`/`filter` and teaches the halving in the
  hints and debrief, but that is guidance, not enforcement. Enforcing it needs an operation counter, which is D12/D13.
- **M22 is closed-form** (`allowClosedForm: true`), like M09: the four growth classes are given and the player
  classifies a measured ratio. It does not ask the player to derive a class from code.
- **World 3 stays `in-progress`**, for the same reason as World 2 (`15`).

## Map fixes made alongside

World 2 exposed two bugs in the workshop map that World 3 would have made worse:

- The map ordered missions by `order`, the position *inside* a world, so M13 (`order: 1`) was replayed before
  M07 and the Dispatch board could show `working` after M13 had made it `reliable`. State and order now come
  from the position in the worlds registry (`src/domain/progression/workshop.ts`, with a regression test).
- The "Sistemas del taller" grid showed every system under World 1 only. Each world now shows the systems its own
  missions touch; World 1 keeps the Transition Arc's systems and any system no mission uses yet.

`nextMission` still breaks ties by `order`. It only matters when two missions are available at once, and in the
current content that happens only inside one world (M15/M16), so it was left alone.

## Not covered

- No playtest evidence; difficulty and minutes are guesses.
- The large hidden cases (up to 50.000 items) make a slow solution slower; they do not make it fail.
