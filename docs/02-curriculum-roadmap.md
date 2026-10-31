# 02 — Curriculum Roadmap

Covers deliverable A3. Validates the proposed world order against actual concept
dependencies, and revises it where the proposed order does not hold.

---

## 1. Concept registry

The unit of mastery is a **concept**, not a mission and not a world. This registry is
canonical: mastery records, mission tags, and lint vocabulary all use these IDs.

### World 1 — data traversal and decisions

| ID | Concept | Statement of mastery |
| --- | --- | --- |
| `C01` | condition | Produce a boolean from a comparison, including the inclusive/exclusive choice |
| `C02` | boundary | Reason about empty, singleton, exactly-at-limit, and all-match inputs |
| `C03` | traverse | Iterate every element with correct bounds, no skips, no overflow |
| `C04` | early-exit | Return at the first match and supply a correct post-loop default |
| `C05` | collect | Build an output array across the whole input without exiting early |
| `C06` | accumulate | Maintain a running total that survives the loop |
| `C07` | count | Count elements satisfying a predicate |
| `C08` | transform | Map to a new array preserving order and not mutating the input |
| `C09` | linear-search | Find a target by predicate when no ordering is available |
| `C10` | scan-best | Track a best-so-far with an explicit tie-break rule |
| `C11` | duplicate-pairwise | Detect duplicates by comparing pairs, understanding the cost |
| `C12` | complexity-intuition | Predict how operation count grows with input size |

### Transition Arc — remembering instead of re-scanning

| ID | Concept | Statement of mastery |
| --- | --- | --- |
| `C13` | set-membership | Trade memory for time by remembering what has been seen |
| `C14` | map-frequency | Accumulate counts keyed by value |
| `C15` | debug-existing | Locate a defect in code that already looks correct |
| `C16` | strategy-selection | Choose a structure for an unlabeled problem and justify the choice |

`C15` is taught in World 1 (M6) and re-tested in the Transition Arc. It is listed here
because it is the concept that makes M12 possible.

### World 2 — hashing and grouping

| ID | Concept |
| --- | --- |
| `C17` | complement-lookup (two-sum shape without naming it) |
| `C18` | grouping (bucket by key) |
| `C19` | counting-at-scale (why O(n) memory changes the answer) |
| `C20` | key-design (choosing a stable key: case, trim, composite) |

### World 3 — ordered data and invariants

| ID | Concept |
| --- | --- |
| `C21` | invariant (a property that must hold before and after each step) |
| `C22` | two-pointers |
| `C23` | sliding-window |
| `C24` | sorting-and-comparator |
| `C25` | binary-search (search space, not just array) |
| `C26` | complexity-notation (O/Ω/Θ, growth classes) |

### World 4 — structure and self-reference

| ID | Concept |
| --- | --- |
| `C27` | stack (LIFO discipline) |
| `C28` | queue (FIFO discipline) |
| `C29` | linked-list (pointer manipulation, no indexing) |
| `C30` | call-stack (mental model of frames) |
| `C31` | recursion (base case + smaller subproblem) |
| `C32` | tree-traversal |

### World 5 — graphs and search spaces

| ID | Concept |
| --- | --- |
| `C33` | graph-representation |
| `C34` | bfs |
| `C35` | dfs |
| `C36` | visited-set (cycle safety) |
| `C37` | backtracking |

### World 6 — engineering judgement

| ID | Concept |
| --- | --- |
| `C38` | space-complexity |
| `C39` | amortized-cost |
| `C40` | dynamic-programming (overlapping subproblems) |
| `C41` | trade-off articulation |

---

## 2. Dependency graph

Solid arrow = hard prerequisite (mission blocked without it).
Dashed arrow = soft prerequisite (strongly recommended, not enforced).

```
                        C01 ──► C02
                         │       │
                         ▼       ▼
                        C03 ──► C04 ──► C09
                         │       │       │
                         ├──► C05 │       │
                         ├──► C06 │       │
                         ├──► C07 │       │
                         ├──► C08 │       │
                         └──► C11 ◄───────┘
                                │
                                ▼
                              C12
                                │
                                ▼
                              C13 ──► C14
                                │       │
                                └──► C16 ◄── C15
                                        │
                    ┌───────────────────┴──────────────┐
                    ▼                                  ▼
                  C17, C18, C19, C20                 C21
                    │                                  │
                    │                          ┌───────┴───────┐
                    │                          ▼               ▼
                    │                        C22             C23
                    │                          └───────┬───────┘
                    │                                  ▼
                    │                                C24 ──► C25
                    │                                  │
                    │                                  ▼
                    │                                C26
                    ▼                                  │
              ┌─────┴─────┐                            │
              ▼           ▼                            │
            C27         C28                            │
              │           │                            │
              ▼           ▼                            │
            C29         C30 ──► C31 ──► C32 ◄─────────┘
                          │       │       │
                          └───────┴───┬───┘
                                      ▼
                              C33 ──► C34 / C35 ──► C36 ──► C37
                                                              │
                                                              ▼
                                                    C38, C39, C40, C41
```

### The three edges that constrain the whole roadmap

1. **`C04 → C09`.** Linear search is early-exit with a predicate. Teaching search before
   early-exit produces players who scan the whole array and return the last match.
2. **`C11 → C12 → C13`.** The Set is only motivated *after* the player has felt the cost
   of pairwise comparison. Introducing Set earlier makes it a syntax lesson; introducing
   it later makes it an unmotivated trick. M9 sits exactly on this edge and is the reason
   the Transition Arc works.
3. **`C30 → C31 → C32`.** Trees are recursive by nature. A player without a call-stack
   model will copy tree traversals without understanding them, and will fail every
   later graph mission.

---

## 3. World 1 + the Transition Arc (MVP)

Your §4 catalog mixes two worlds. I am formalizing it as **World 1 (M1–M9)** plus a
**Transition Arc (M10–M12)** that lives in World 1's fiction and teaches World 2's
primitives. This changes no mission, only the framing — and it makes the gate into
World 2 honest.

### World 1 — "Taller de los datos"

- **Narrative frame:** the workshop's data systems are manual and failing. The player is
  hired to make them work, not to make them fast.
- **Concepts:** `C01–C12`, `C15`
- **Mastery target on exit:** every concept `C01–C12` at ≥ `practicing`; `C04`, `C05`,
  `C09` at ≥ `proficient`.
- **Mission types:** threshold decision, full traversal, collection, accumulation,
  transformation, defect repair, predicate search, best-so-far scan, pairwise comparison,
  cost measurement.
- **Capability unlocked:** the workshop's inspection line runs automatically. The player
  can see the system working without them.
- **Pacing:** 9 missions, ~4–6 hours for the primary persona.

### Transition Arc — "La memoria del sistema"

- **Narrative frame:** the workshop now works, and the volume exposes a new problem: the
  inspection line is too slow because it re-scans everything. The player is asked to make
  it remember.
- **Concepts:** `C13`, `C14`, `C16`, reinforced `C12`, `C15`
- **Mastery target on exit:** `C13`, `C14` at ≥ `practicing`; `C16` at ≥ `introduced`
  (it is fully assessed in World 2).
- **Mission types:** performance-driven rewrite, frequency accumulation, unlabeled
  integrative audit.
- **Capability unlocked:** the workshop gains a **query engine** — the literal gate into
  World 2. The narrative promise: "your workshop can now answer questions about its own
  data".
- **Pacing:** 3 missions, ~1.5–2 hours.

### Why the gate is here and not after M9

If the player enters World 2 after M9, Map and Set arrive as *new syntax* in a world
about hashing, and the connection to the cost problem they just measured is lost.
The Transition Arc converts a measured pain (M9) into a purchased capability (M10, M11)
and then tests whether the player can choose it unprompted (M12). That last step is the
whole point of the product, and it must happen before the world changes.

---

## 4. Worlds 2–6

Each world below states what it must prove, what it requires, and what it unlocks. These
are roadmap commitments, not mission specifications.

### World 2 — "Base de datos inteligente"

- **Must prove:** the player reaches for a hash structure *because of the problem*, not
  because the title said so.
- **Requires:** `C13`, `C14`, `C16` at ≥ `practicing`.
- **Concepts:** `C17`, `C18`, `C19`, `C20`.
- **Mission types:** complement lookup, grouping reports, key normalization, dedupe at
  scale with a memory budget.
- **Mastery target:** `C17`, `C18` at ≥ `proficient`; `C20` at ≥ `practicing`.
- **Unlock:** **indexing engine** — the workshop can answer "which records match" without
  scanning. Narratively this is the moment the workshop becomes a database.

### World 3 — "Ciudad del rendimiento"

- **Must prove:** the player can justify why a pointer movement is *safe* (does not skip a
  valid answer). This is the invariant argument, and it is the difference between
  understanding and template recall.
- **Requires:** `C03`, `C09`, `C12`, `C24`(introduced here), `C21`(introduced here).
- **Concepts:** `C21`, `C22`, `C23`, `C24`, `C25`, `C26`.
- **Mission types:** sorted-input exploitation, window maintenance, comparator design,
  search-space halving, growth-class classification.
- **Mastery target:** `C21`, `C22`, `C23` at ≥ `proficient`; `C26` at ≥ `practicing`.
- **Unlock:** **routing and dispatch** — the workshop can process ordered work efficiently.
- **Revision applied (D8):** `C26` (complexity notation) is introduced at the *end* of
  World 3, not in World 6. Rationale in §5.

### World 4 — "Infraestructura"

- **Must prove:** the player can hold a mental model of a structure that is not an array,
  and can reason about a function that calls itself.
- **Requires:** `C05`, `C08`, `C31`(bridge), `C26`.
- **Concepts:** `C27`, `C28`, `C29`, `C30`, `C31`, `C32`.
- **Mission types:** undo stack, job queue, pointer surgery, call-stack tracing, recursive
  traversal, tree queries.
- **Mastery target:** `C30`, `C31` at ≥ `proficient`; `C27`, `C28` at ≥ `practicing`.
- **Unlock:** **persistent state** — the workshop remembers work in progress.
- **Revision applied (D9):** an explicit call-stack bridge mission sits between linked
  lists and trees.

### World 5 — "Redes y exploración"

- **Must prove:** the player recognizes a graph when nobody says "graph", and chooses BFS
  vs DFS from the *question being asked* (shortest vs exhaustive).
- **Requires:** `C28` (queue, for BFS), `C31` (recursion, for DFS), `C13` (visited set).
- **Concepts:** `C33`, `C34`, `C35`, `C36`, `C37`.
- **Mission types:** dependency resolution, reachability, shortest hops, cycle detection,
  constraint search with backtracking.
- **Mastery target:** `C33`, `C34`, `C36` at ≥ `proficient`.
- **Unlock:** **network awareness** — the workshop connects to external systems.

### World 6 — "Ingeniería algorítmica"

- **Must prove:** the player can articulate a trade-off and defend it, which is the actual
  interview skill.
- **Requires:** all prior concepts at ≥ `practicing`; `C26` at ≥ `proficient`.
- **Concepts:** `C38`, `C39`, `C40`, `C41`.
- **Mission types:** space-budgeted rewrites, amortized analysis, overlapping-subproblem
  recognition, unlabeled mixed challenges with no concept tag shown to the player.
- **Mastery target:** `C40` at ≥ `practicing`; `C41` at ≥ `proficient`.
- **Unlock:** terminal — the workshop is fully autonomous; the game's ending is the player
  recognizing problems in the wild.

---

## 5. Roadmap validation — what I changed and why

Your proposed order is largely sound. Four changes are needed; each is a prerequisite
problem, not a preference.

### Change 1 — Complexity *notation* moves from World 6 to end of World 3

**Problem:** World 6 currently owns `C26` (notation) and `C40` (DP). DP is unreachable
without notation — you cannot discuss overlapping subproblems without counting them.
That makes World 6 two unrelated hard ideas with a hidden dependency.

**Fix:** `C12` (intuition, no notation) stays in World 1 as M9. `C26` (notation) lands at
the end of World 3, immediately after the player has empirically felt O(n²) vs O(n log n)
by sorting. World 6 keeps `C38`, `C39`, `C40`, `C41` — space, amortized, DP, judgement.

**Consequence:** World 3 grows by one mission. World 6 becomes coherent.

### Change 2 — An explicit invariant mission in World 3

**Problem:** `C22` and `C23` are presented in the brief as techniques. They are actually
*proof obligations*: "moving the left pointer cannot discard a valid answer, because …".
Without `C21`, players memorize the while-loop and fail every variant.

**Fix:** introduce `C21` as its own mission before two pointers. The mission's transfer
challenge is a case where the naive pointer movement *is* unsafe, so the player must
detect that the invariant does not hold.

### Change 3 — A call-stack bridge in World 4

**Problem:** recursion is the highest-abandonment concept in this curriculum, and the
brief's World 4 order (stacks, queues, linked lists, recursion, trees) gives it no ramp.

**Fix:** one mission whose only job is `C30` — trace a recursive function frame by frame,
predict stack depth, then predict the output of a function the player did not write.
No new data structure. Then `C31`, then `C32`.

### Change 4 — `C16` (strategy selection) must be assessed before World 2, not in World 6

**Problem:** the brief places "mixed interview challenges" in World 6, but the product's
core claim is that players learn to choose strategies. If the first unlabeled choice
happens in World 6, we have no evidence the method works until ~40 missions in.

**Fix:** M12 in the Transition Arc is the first unlabeled integrative mission. World 2
then re-tests `C16` at a higher difficulty. This is why M12 is the MVP's success metric.

### What I did *not* change

- Arrays before hash structures. Correct: hashing is meaningless without traversal.
- Sorting before binary search. Correct: binary search is a search over a *sorted*
  invariant, and the invariant must be visible.
- Trees after linked lists. Correct: a tree is a linked structure with branching.
- Graphs last among structures. Correct: graphs need queues, recursion, and sets
  simultaneously.

---

## 6. Concept introduction schedule

First introduction, first reinforcement, and first transfer for the MVP concepts. Every
concept must appear at least twice in a different context before it can be `transferable`.

| Concept | Introduced | Reinforced | Transferred |
| --- | --- | --- | --- |
| `C01` condition | M1 | M2 | M12 |
| `C02` boundary | M1 | M6 | M10 |
| `C03` traverse | M2 | M4 | M12 |
| `C04` early-exit | M2 | M7 | M12 |
| `C05` collect | M3 | M5 | M12 |
| `C06` accumulate | M4 | M9 | M12 |
| `C07` count | M4 | M11 | M12 |
| `C08` transform | M5 | M11 | M12 |
| `C09` linear-search | M7 | M12 | World 2 |
| `C10` scan-best | M7 | M11 | M12 |
| `C11` duplicate-pairwise | M8 | M9 | M10 |
| `C12` complexity-intuition | M9 | M10 | M12 |
| `C13` set-membership | M10 | M12 | World 2 |
| `C14` map-frequency | M11 | M12 | World 2 |
| `C15` debug-existing | M6 | M12 | World 3 |
| `C16` strategy-selection | M12 | World 2 | World 3 |

The table is a **coverage obligation**, not a suggestion. Lint L7 in `10-testing-and-security.md`
verifies every MVP concept appears in at least two distinct missions before World 2 opens.
