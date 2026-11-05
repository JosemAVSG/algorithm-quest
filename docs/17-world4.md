# 17 — World 4: the control tower (M23–M28)

Status: **authored, not playtested** (A7), same caveat as `12`, `15` and `16`.

World 4 covers `C27`–`C32`, in the order D9 asks for: the call-stack mental model (`C30`, M26) comes before
recursion (`C31`, M27), which comes before trees (`C32`, M28). Format and verification are the same as `15`.

| ID | Title | Primary | Secondary | Function | System |
| --- | --- | --- | --- | --- | --- |
| M23 | Las marcas bien cerradas | `C27` stack | `C21` | `isWellClosed(text)` | `sys.stacker` broken → working |
| M24 | La ventanilla del taller | `C28` queue | `C07` | `runDesk(events)` | `sys.queue` broken → working |
| M25 | La cadena de eslabones | `C29` linked list | `C03` | `removeLinks(head, target)` | `sys.chain` broken → working |
| M26 | El monitor de llamadas | `C30` call stack | `C27` | `traceCalls(n)` | `sys.frames` absent → installed |
| M27 | Cajas dentro de cajas | `C31` recursion | `C30` | `totalWeight(box)` | `sys.recurse` absent → installed |
| M28 | El mapa de ramas | `C32` tree traversal | `C31` | `readMap(root)` | `sys.tree` absent → installed |

## Traps each mission is built around

- **M23** — counting brackets instead of remembering their order (`([)]`); a closer with nothing open;
  leftover openers at the end; one generic stack that accepts `(]`.
- **M24** — taking from the same end you add to (a stack in disguise); serving when nobody waits
  (`undefined` leaks into `served`); reversing the order of those still waiting.
- **M25** — removing the first link (nobody points at it); several defective links in a row (advancing
  after a skip). `[`, `.push(` and `Array` are banned so the list cannot be converted to an array.
- **M26** — the exit of a call belongs after everything the call opened; the order of the two inner
  calls; base cases still log `enter`/`exit`.
- **M27** — summing only the top level, or only two levels, or adding a nested array as text; a depth
  that cannot be fixed in advance. `.flat`, `JSON` and `toString` are banned.
- **M28** — pre-order and post-order instead of in-order; visiting only one side; nested lists instead of
  a flat list; sorting by value instead of following the structure.

## Constraints discovered while building it

- **The schema validator overflows the stack on deeply nested test data.** Arrays nest to ~1.500 levels,
  but a 2.000-level box (M27) and a 1.500-zone chain (M28) crashed `content:index` with
  `Maximum call stack size exceeded`. The deep cases are capped at 300 levels. The cap exists because of
  `zod`'s lazy JSON type, not because of the game.
- **Test data is paid for on every mission open.** The browser validates a mission's shape when it is
  loaded, and the cost grows with the number of JSON nodes (M24 with 80.000 events took 2,3 s; the
  existing M12 takes ~2 s). The large cases of M13–M24 were reduced to 3.000–20.000 items, which brought
  the whole-corpus shape validation from 10,1 s to 5,4 s and kept `mission-flow.test.ts` inside its 10 s hook
  timeout. A slow solution is still slower on those cases, but, as in `15` and `16`, it does not fail.

## Deliberate choices

- **Six new workshop systems** (`sys.stacker`, `sys.queue`, `sys.chain`, `sys.frames`, `sys.recurse`,
  `sys.tree`), for the same reason as in `16`.
- **M26 is a trace, not a debugger.** The player produces the `enter`/`exit` sequence of a described function
  (`docs/04` §5's trace table is still not built, `13` §3.2). It is the bridge D9 asks for, not a stepper.
- **M25 is non-mutating-optional**: `mustNotMutate: false`, because rewiring links in place is the point.
  A wrong solution that builds a cycle would make the comparison recurse forever, so the tests only use
  removal, never reversal.
- **World 4 stays `in-progress`**, as in `15`.

## Not covered

- No playtest evidence; difficulty (3–5) and minutes are guesses.
- The trace table and operation-counting efficiency verdicts are still missing, and they are what these
  missions would benefit from most (seeing the stack grow).
