# 03 — Mission Catalog

Covers deliverable A4. The ramp at a glance; individual specs live in `missions/`.

---

## 1. The twelve missions

| # | Title | Primary concept | Secondary | Player writes | Difficulty |
| --- | --- | --- | --- | --- | --- |
| M01 | El primer diagnóstico | `C01` condition | `C02` boundary | `isOverLimit` | 1 |
| M02 | La inspección completa | `C04` early-exit | `C03`, `C02` | `anyDeviceFaulty` | 2 |
| M03 | El lote defectuoso | `C05` collect | `C08`, `C03` | `collectFaultyDevices` | 2 |
| M04 | La auditoría del inventario | `C06` accumulate | `C07` count | `auditInventory` | 2 |
| M05 | El registro de reparaciones | `C08` transform | `C05` | `normalizeRepairs` | 3 |
| M06 | La revisión de límites | `C15` debug-existing | `C02` boundary | fix `averageTemperature` | 3 |
| M07 | La búsqueda urgente | `C10` scan-best | `C09` linear-search | `findMostUrgent` | 3 |
| M08 | Las órdenes repetidas | `C11` duplicate-pairwise | `C03` | `findFirstDuplicatePair` | 4 |
| M09 | El costo de la inspección | `C12` complexity-intuition | `C06` | `worstCaseComparisons` | 4 |
| M10 | La memoria del sistema | `C13` set-membership | `C12` | `findFirstDuplicateWithMemory` | 4 |
| M11 | El contador inteligente | `C14` map-frequency | `C10`, `C08` | `countByCategory` | 4 |
| M12 | La auditoría final | `C16` strategy-selection | all of World 1 | `buildAuditReport` | 5 |

**Difficulty is not "how hard is the algorithm".** It is a composite of: number of
concepts simultaneously required, how far the briefing is from the solution shape, and
how much of the failure is silent (tests pass but semantics are wrong). M09 is difficulty
4 despite having a two-line solution, because the *reasoning* is the hard part.

---

## 2. The ramp, and why this order

```
difficulty
5 │                                              ● M12
4 │                        ● M08  ● M09  ● M10  ● M11
3 │              ● M05  ● M06  ● M07
2 │        ● M02  ● M03  ● M04
1 │  ● M01
  └─────────────────────────────────────────────────────►
     W1: make it work          │  Transition: make it scale
```

Four deliberate rhythm choices:

1. **M01 is almost trivially small.** It exists to establish the *cycle*, not to teach.
   A player must experience briefing → strategy → code → run → diagnosis → debrief with
   near-zero cognitive load before the cycle itself becomes invisible.
2. **M02 and M03 are a matched pair.** Same input shape, opposite loop discipline. This
   is the single most important contrast in World 1.
3. **M06 is a palate cleanser.** After four missions of writing new code, the player is
   handed code that *looks right* and must find the defect. This is the first time the
   product asks them to read instead of write.
4. **M09 is a speed bump, not a hill.** It introduces no algorithm. Its job is to make
   M10 feel like relief.

---

## 3. Contrast pairs — the pedagogical spine

Each pair is intentional. Removing either half breaks the other.

| Pair | What the contrast teaches | Failure mode if only one exists |
| --- | --- | --- |
| **M02 ↔ M03** | Stop at the first match vs. examine everything | Player uses early-return everywhere, or never uses it |
| **M04 ↔ M09** | Doing the work vs. counting the work | Player thinks cost is a label, not a measurement |
| **M07 ↔ M10** | Track one best candidate vs. remember every candidate | Player conflates "best so far" with "seen before" |
| **M08 ↔ M10** | Compare pairs (O(n²)) vs. remember seen (O(n)) | Set becomes syntax instead of a trade |
| **M09 ↔ M10** | Feel the cost, then buy the fix | Performance optimization feels arbitrary |
| **M05 ↔ M11** | Reshape records vs. aggregate records | Player cannot distinguish transform from reduce |

---

## 4. Concept coverage matrix

Every concept appears at least twice before the world gate. `P` = primary, `s` = secondary,
`r` = reinforced (tested but not the mission's teaching target).

| | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `C01` | P | r | | | | | | | | | | r |
| `C02` | s | s | | | | P | | | | r | | |
| `C03` | | s | s | r | r | | r | s | | | | r |
| `C04` | | P | | | | | r | | | | | r |
| `C05` | | | P | | s | | | | | | | r |
| `C06` | | | | P | | | | | s | | | r |
| `C07` | | | | s | | | | | | | r | r |
| `C08` | | | s | | P | | | | | | s | r |
| `C09` | | | | | | | s | | | | | r |
| `C10` | | | | | | | P | | | | s | r |
| `C11` | | | | | | | | P | r | r | | |
| `C12` | | | | | | | | | P | s | | r |
| `C13` | | | | | | | | | | P | | r |
| `C14` | | | | | | | | | | | P | r |
| `C15` | | | | | | P | | | | | | r |
| `C16` | | | | | | | | | | | | P |

Lint L7 (`10-testing-and-security.md` §4) fails the build if any `C01–C16` has fewer than
two non-`r` appearances.

---

## 5. Transfer and reinforcement map

Where a concept is re-tested in a *different context* — the only evidence that can promote
it to `transferable`.

| Concept | Transfer target | Why it is a genuinely different context |
| --- | --- | --- |
| `C01` | M12 (report flags) | Same comparison, now buried inside a report builder |
| `C02` | M10 (empty input) | Boundary reasoning applied to a performance-sensitive path |
| `C03` | M12 (three passes over one dataset) | Traversal as a component, not the whole task |
| `C04` | M12 (first-match short-circuit) | Early exit inside a larger pipeline |
| `C05` | M12 (collect duplicate ids) | Collection as one field of a composite output |
| `C06` | M12 (total counts) | Accumulation feeding an aggregate |
| `C07` | M11 (frequency) | Counting keyed rather than scalar |
| `C08` | M11 (record → category) | Transformation as a projection into a key |
| `C09` | World 2 | Search replaced by lookup |
| `C10` | M12 (highest priority) | Best-so-far with a different tie-break |
| `C11` | M10 | Same problem, deliberately worse solution, to feel the cost |
| `C12` | M12 (perf budget) | Cost enforced rather than discussed |
| `C13` | M12 (dedupe field) | Set as one tool among three |
| `C14` | M12 (category counts) | Map as one field of a report |
| `C15` | World 3 | Debugging a *correct-looking* invariant violation |
| `C16` | World 2 | Untagged choice with a new structure set |

### Reinforcement triggers

A concept is scheduled for reinforcement when, after the mission that teaches it, its
mastery is below `0.45` **and** the player used a level-3 or level-4 hint. The
reinforcement is not a repeat of the mission — it is a short variant tagged with the same
concept in a different fiction. M12 contains four built-in reinforcement variants so the
MVP does not need extra content for the common case.

---

## 6. Narrative spine

The workshop has six named systems. Each mission moves one of them. This is what makes
rewards mean something (lint L4 enforces the reference).

| System id | Name | Initial state | Moved by |
| --- | --- | --- | --- |
| `sys.sensor` | Sensor array | broken | M01, M02 |
| `sys.line` | Inspection line | broken | M03, M08 |
| `sys.store` | Parts inventory | broken | M04 |
| `sys.log` | Repair log | broken | M05 |
| `sys.guard` | Safety guard | broken | M06 |
| `sys.dispatch` | Dispatch board | broken | M07 |
| `sys.meter` | Cost meter | absent | M09 |
| `sys.memory` | Memory core | absent | M10 |
| `sys.index` | Category index | absent | M11 |
| `sys.audit` | Audit console | absent | M12 |

Note the pattern: missions 1–7 *repair* existing systems; mission 9 *adds* an instrument;
missions 10–12 *add* new capability. The world moves from "fixing someone else's mess" to
"building something of your own" — which is the emotional arc from technician to engineer,
and the reason World 2's unlock is called a query engine rather than a new map.

---

## 7. What is deliberately absent from the MVP

| Absent | Why | When |
| --- | --- | --- |
| Any mission with `Map` as primary | M11 introduces it; mastery is World 2's job | World 2 |
| Any mission requiring recursion | No call-stack model yet | World 4 |
| Any mission requiring sorting | No ordering invariant yet | World 3 |
| A boss mission | The MVP's boss is M12, which is a report, not a fight | — |
| Timed missions | Time pressure measures anxiety, not skill | Not planned |
| Multi-file missions | Editor complexity without learning value | Not planned |
