# 05 — Mastery Model

Covers deliverable A7. Deliberately simple: four dimensions, one formula, one decay rule,
one transfer gate. Anything more complex than this cannot be validated with 12 missions.

---

## 1. The unit of record: an evidence event

Mastery is never awarded. It is **computed from events**, and every event is replayable.
Deleting the derived mastery and recomputing from events must produce identical output —
this is a testable invariant (`10` §2.4, MT4).

```ts
type EvidenceEvent = {
  id: string;
  missionId: string;
  conceptId: string;              // C01..C16
  role: 'primary' | 'secondary' | 'reinforced';
  at: number;                     // epoch ms

  // measured
  visiblePassed: boolean;
  hiddenPassed: number;           // count
  hiddenTotal: number;
  edgePassed: number;
  edgeTotal: number;
  reasoningScore: 0|1|2|3;
  efficiencyRatio: number;        // 1.0 when no budget or within budget

  // behavioural context
  attempts: number;
  hintsUsed: number;
  maxHintLevel: 0|1|2|3|4;
  solutionRevealed: boolean;
  strategySubmitted: boolean;
};
```

One event per `(missionId, conceptId)` pair, emitted at mission completion. Reinforcement
variants emit their own events with `role: 'reinforced'`.

---

## 2. Four dimensions

| Dimension | Formula | Range | Rationale |
| --- | --- | --- | --- |
| **Correctness** | `visiblePassed ? hiddenPassed / hiddenTotal : 0` | 0–1 | Hidden tests are the real gate; a failing visible test zeroes it because the player has been told |
| **Robustness** | `edgeTotal > 0 ? edgePassed / edgeTotal : 1` | 0–1 | Only the subset of tests flagged `edge: true` — empty, singleton, boundary-equal, all-match |
| **Reasoning** | `reasoningScore / 3` | 0–1 | From `04` §6 rubric |
| **Efficiency** | `min(1, budget / actual)` when a budget exists, else `1` | 0–1 | Never punitive for correct code in missions without a budget |

**Why hidden tests drive correctness, not visible ones.** Visible tests are training
wheels; a player who passes visible and fails hidden has a real gap, and the model should
say so. A player who fails visible has been told what is wrong and has not fixed it — that
is not partial credit, that is an unfinished attempt.

---

## 3. Mission score

```
missionScore = 0.40·correctness
             + 0.25·robustness
             + 0.20·reasoning
             + 0.15·efficiency
```

Weights are not arbitrary:

- **Correctness 0.40** — dominant, because a wrong algorithm is not a partially learned
  algorithm.
- **Robustness 0.25** — second, because the brief's whole thesis is edge-case reasoning,
  and it is the dimension most often ignored by exercise sites.
- **Reasoning 0.20** — high enough to matter, low enough that a player who struggles to
  articulate is not blocked from progressing.
- **Efficiency 0.15** — lowest, because correctness must precede optimization
  (principle 6). Efficiency is a tiebreaker, never a gate.

---

## 4. Independence weight

The same passing solution is worth less if it took four hints.

```
w = clamp( 1 − 0.10·min(hintsUsed, 3) − (solutionRevealed ? 0.30 : 0), 0.25, 1.0 )
```

| Hints | Revealed | w |
| --- | --- | --- |
| 0 | no | 1.00 |
| 1 | no | 0.90 |
| 2 | no | 0.80 |
| 3+ | no | 0.70 |
| 2 | yes | 0.50 |
| 3+ | yes | 0.40 |
| 0 | yes | 0.70 |

The floor of `0.25` exists so a heavily-assisted success still counts for something. It
must never reach 0: a player who needed help and finished has learned more than a player
who quit.

`solutionRevealed` also applies a hard cap (§6), because weighting alone would let a
revealed solution reach `proficient` with a perfect score.

---

## 5. Concept mastery

```
conceptEvidence = missionScore · w · roleWeight

roleWeight:  primary 1.0   secondary 0.6   reinforced 0.5
```

Per concept, keep the **last 5** evidence events and aggregate with recency weights:

```
recency = [1.00, 0.85, 0.70, 0.55, 0.40]   // newest first
mastery(C) = Σ(recency_i · evidence_i) / Σ(recency_i)
```

### Why last-5 and not a running average

A player who was bad at `C04` in M02 and good at it in M07 and M12 should be judged on
the recent shape of their ability, not their history. Five is enough to smooth noise and
short enough that improvement is visible within one session. Full history is retained for
analytics; it does not drive the level.

### Decay

No time-based decay in the MVP. Decay without a re-assessment mechanic is a lie — it
lowers a number without new evidence. If we add decay later, it must come with scheduled
re-checks, not before.

---

## 6. Levels and caps

| Level | Condition |
| --- | --- |
| `locked` | No evidence events |
| `introduced` | `mastery < 0.30` |
| `practicing` | `0.30 ≤ mastery < 0.60` |
| `proficient` | `0.60 ≤ mastery < 0.80` |
| `transferable` | `mastery ≥ 0.80` **and** transfer gate (§7) |

### Caps (applied after the level is computed)

| Cap | Condition | Result |
| --- | --- | --- |
| Reveal cap | Most recent evidence has `solutionRevealed` | Level ≤ `practicing` |
| Assistance cap | Most recent evidence has `w < 0.50` | Level ≤ `practicing` |
| Single-source cap | All evidence from one mission | Level ≤ `proficient` |

The single-source cap is the mechanism behind principle 7. Solving M08 perfectly does not
make you good at duplicate detection; it makes you good at *that* problem. The system
refuses to conflate the two.

---

## 7. Transfer gate

`transferable` requires all three:

1. `mastery ≥ 0.80`
2. Evidence from **≥ 2 distinct `missionId`s**
3. **≥ 1** of those events has `hintsUsed ≤ 1 && !solutionRevealed`

Condition 3 is the one that costs content. It means every concept needs a second,
genuinely independent context. That is the price of the product's central claim, and it
is why the coverage matrix in `03` §4 is an obligation rather than a nice-to-have.

---

## 8. Reinforcement

### Trigger

After a mission completes, for each concept it taught:

```
if mastery(concept) < 0.45 AND (hintsUsed >= 3 OR solutionRevealed) → enqueue reinforcement
```

### Behaviour

- Reinforcement is a **short variant**, not a repeat: different fiction, same concept,
  ~40% of the original mission's length.
- Maximum 3 pending at once; lowest-mastery concept wins.
- It is offered, never forced. The player can continue to the next mission. Declining is
  recorded but never penalised.
- Reinforcement evidence uses `role: 'reinforced'` (weight 0.5) and **cannot alone**
  satisfy the transfer gate — it can raise mastery, but `transferable` still requires two
  distinct full missions.

That last rule matters: otherwise a player could grind three micro-variants of M08 and
appear to have transferred a concept they have only ever seen in one fiction.

### MVP content budget

M12 ships with 4 built-in reinforcement variants covering `C02`, `C04`, `C05`, `C13`.
Other concepts fall back to "replay the mission with hints disabled", which is honest but
weaker — and is the first content gap to fill after the MVP.

> **Update:** all 41 concepts now have a variant, and the screen to practise one exists. See
> `20-reinforcement.md`.

---

## 9. Unlock rules

Two independent gates. Both must pass.

### Gate A — mission prerequisites

A mission is playable when, for every entry in `prerequisites.missions`:

```
missionState(prereq) >= 'completed'
```

where `completed` = all tests pass **and** `reasoningScore ≥ 1`.

### Gate B — concept prerequisites

For every entry in `prerequisites.concepts`:

```
level(concept) >= required
```

`required` is `introduced` for missions inside the same world, and `practicing` for the
first mission of a new world.

### World gate

World *N+1* opens when:

1. Every primary concept of world *N* is ≥ `practicing`, and
2. The world's gate mission is `completed`, and
3. `C16` (strategy selection) is ≥ `introduced`

For World 1, the gate mission is M12. Condition 3 is redundant there but explicit, because
it is the condition that will matter for worlds 2–6.

---

## 10. The five mission states

The brief asks us to distinguish completion from understanding. Five states, in order:

| State | Definition | Shown to player as |
| --- | --- | --- |
| `attempted` | At least one execution | "En progreso" |
| `passed` | All visible + hidden tests pass | "Funciona" |
| `completed` | `passed` + `reasoningScore ≥ 1` | "Completada" |
| `independent` | `completed` + `hintsUsed ≤ 1` + `!solutionRevealed` | "Resuelta por tu cuenta" |
| `transferred` | `independent` on a *different* mission with the same primary concept | "Transferida" |

Only `independent` and `transferred` contribute to the unlock gates at full weight.
`completed` is enough to advance *within* a world; `independent` is required to advance
*between* worlds. That asymmetry is the product's core incentive: you may move forward
with help, but you may not move outward with it.

---

## 11. Worked example

Player finishes **M02 (La inspección completa)**, primary `C04`, secondary `C03`.

Observed: all visible pass, 5/6 hidden pass, 2/3 edge pass, reasoning 2, no budget,
2 attempts, 2 hints (max level 2), no reveal.

```
correctness = 5/6 = 0.833
robustness  = 2/3 = 0.667
reasoning   = 2/3 = 0.667
efficiency  = 1.000

missionScore = 0.40(0.833) + 0.25(0.667) + 0.20(0.667) + 0.15(1.000)
             = 0.333 + 0.167 + 0.133 + 0.150
             = 0.783

w = 1 − 0.10(2) = 0.80

C04 evidence = 0.783 · 0.80 · 1.0 = 0.627   → proficient band (0.60–0.80)
C03 evidence = 0.783 · 0.80 · 0.6 = 0.376   → practicing band (0.30–0.60)
```

`C04` at `0.627` is `proficient` by score, but the single-source cap holds it at
`proficient` (allowed) and the transfer gate blocks `transferable` — correct, because the
player has seen early-exit exactly once.

Reinforcement does **not** trigger: `mastery ≥ 0.45`.

After M07 and M12 both contribute `C04` evidence with ≤1 hint, the gate opens and `C04`
becomes `transferable`. That is the intended path, and it takes three missions — which is
the honest cost of claiming transfer.

---

## 12. What this model deliberately does not do

| Not doing | Why |
| --- | --- |
| XP, levels, coins | A parallel currency competes with the real signal and always wins |
| Streaks | Measures habit, punishes illness |
| Leaderboards | Ranks speed, which is orthogonal to understanding |
| Time-based decay | Lowers a number without new evidence |
| Weighted concept graphs | Prerequisite logic already handles ordering; graph propagation adds complexity with no MVP payoff |
| Per-attempt scoring | Only completion emits evidence; intermediate attempts inform the mentor, not mastery |
| AI-derived mastery | The formula must be inspectable by the player and reproducible by the test suite |

### Player-facing transparency

The dashboard shows, per concept: level, the four dimension bars, the evidence count, and
a plain-language explanation of the cap that applies ("necesitas aplicarlo en otro
contexto"). Hiding the formula would make the caps feel arbitrary; showing it makes the
caps feel like rules of a game.
