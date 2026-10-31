# 01 — Product Vision and Pedagogy

Covers deliverables A1 (vision, target learner) and A2 (gameplay loop, methodology).

---

## 1. What this product is

**Algorithm Quest is an engineering simulator with a curriculum inside it.**

The player is a technician in a workshop whose systems are failing under load. Every
mission is a real operational request — a sensor lying, a lot with defective units, an
order queue with duplicates. The player writes JavaScript that makes that system behave
correctly, and the system visibly changes: a gauge turns red, a queue drains, a duplicate
counter stops climbing.

What makes it not-a-quiz:

- **The problem arrives unnamed.** Nothing in the briefing says "use a Set". The player
  must recognize the shape of the problem.
- **The world state is the feedback.** Correct code changes a simulation, not just a
  green checkmark.
- **Progress is concept mastery, not completion.** Finishing a mission with four hints and
  a revealed solution is worth almost nothing, and the system says so honestly.
- **The mentor diagnoses rather than corrects.** It classifies the failure before it
  speaks.

### What it is not

| Not this | Because |
| --- | --- |
| LeetCode with a skin | The pattern is never in the title; the transfer mission has no label at all |
| A typing game for syntax | Syntax errors are the *easiest* failure class and get the least screen time |
| A course with chapters | Missions are operational requests; the curriculum is invisible infrastructure |
| An idle/clicker progression | Unlocks are capabilities (a faster inspection line), not numbers |
| A code-judge with a chatbot | The judge is deterministic; the "chatbot" is a rule engine with authored hints |

---

## 2. Target learner

### Primary persona — "The interview candidate who can code but cannot recognize"

- 6 months to 2 years of programming experience. Writes functions, uses arrays, has
  heard of Big-O and cannot apply it.
- Has solved 40+ exercises on a practice site. Can implement a solution when told
  "this is a sliding window problem". Freezes when the problem is unlabeled.
- **Core pain:** pattern recognition, not syntax. They know *how* to write a loop; they
  do not know *which* structure the problem demands.
- **What they will abandon for:** feeling stupid. A mentor that says "wrong" without a
  next step loses them in two attempts.

### Secondary persona — "The career switcher rebuilding fundamentals"

- Bootcamp graduate. Strong on framework usage, weak on data structures.
- Needs the *why* before the *how*; benefits disproportionately from the cost/debrief
  sections.
- Will tolerate slower pacing if the narrative holds.

### Tertiary persona — "The instructor assigning practice"

- Not a direct user in the MVP. They need missions to be exportable and their expected
  behaviour to be inspectable. This is why content is data, not code.

### Jobs to be done

1. "When I see a new problem, help me decide what to do before I start typing."
2. "When my code fails, tell me *what kind* of failure it is, so I learn to diagnose myself."
3. "When I finish, prove to me I actually understood it — not that I got lucky."
4. "When I come back next week, show me what I am actually weak at."

### Explicit non-goals for the MVP

- Teaching a language. JavaScript is the medium, never the subject.
- Preparing for a specific company's interview loop.
- Competitive ranking, streaks, social features.
- Mobile-first authoring. The lab is desktop-first; the dashboard is responsive.

---

## 3. Core gameplay loop

Two nested loops. The inner loop is minutes, the outer loop is sessions.

### Inner loop — one mission (5–20 min)

```
briefing ──► strategy statement ──► code ──► run ──► diagnosis
   ▲                                                    │
   │                                                    ▼
   └──── debrief ◄── verify ◄── revise ◄────────── hint (if needed)
                          │
                          └──► transfer challenge (unlocks next)
```

Every arrow is a persisted event. The mentor's decision at "diagnosis" is a pure
function of: the attempt source, the normalized test result, the strategy statement,
and the mission's authored hint ladder.

### Outer loop — the workshop (sessions)

```
mission cleared ──► workshop system improves ──► new operational problem appears
       │                     │                            │
       │                     └── visible, permanent ──────┘
       └── concept evidence ──► mastery update ──► reinforcement or unlock
```

The workshop is the progression surface. It is not a menu of levels; it is a diagram of
systems, each in one of three states: **broken**, **working**, **optimized**. A mission
moves one system from broken to working. A transfer challenge moves it to optimized.

This is why the reward for Mission 9 (cost analysis) is a *measurement instrument*
rather than a key: it changes how the player can see the world, not where they can go.

---

## 4. The mandatory learning cycle

Your 12-step cycle, mapped to concrete UI moments and concrete system events. No mission
may skip a step; the schema enforces presence, the runtime enforces order.

| # | Step | UI moment | System event emitted |
| --- | --- | --- | --- |
| 1 | Contextualized story & objective | Mission briefing | `mission_opened` |
| 2 | Player explains strategy | Strategy prompt (free text, required before code) | `strategy_submitted` |
| 3 | Coding attempt | Lab editor | `attempt_submitted` |
| 4 | Execution against tests | Run panel | `execution_completed` |
| 5 | Diagnostic feedback | Mentor panel, diagnosis card | `diagnosis_shown` |
| 6 | Progressive hints | Mentor panel, hint card | `hint_revealed` |
| 7 | Revision and retry | Lab editor | `attempt_submitted` (n) |
| 8 | Explain why it works | Debrief, reasoning prompt | `reasoning_submitted` |
| 9 | Edge-case validation | Debrief, edge-case trace | `edgecase_trace_submitted` |
| 10 | Complexity analysis | Debrief, cost section | `complexity_answer_submitted` |
| 11 | Real-world application | Debrief, application note | `debrief_viewed` |
| 12 | Transfer / reinforcement | Transfer card | `transfer_attempted` |

### Two design rules inside the cycle

**Rule A — Step 2 is a hard gate, but a soft one.**
The player cannot run code before submitting a strategy statement, because "propose
before you are told" is the entire pedagogical bet. But the statement is *never graded
as right or wrong*. It is stored, and it is used by the mentor to choose between
"you understood the goal but the logic is off" and "you are stuck on the design".
Minimum viable statement: 15 characters. We are not asking for an essay, we are asking
for a commitment.

**Rule B — Step 8 cannot be satisfied by the code.**
Passing all tests does not complete a mission. The reasoning prompt must be answered.
This is the mechanism that makes "reward understanding, not tests" real rather than
aspirational. If we let passing tests complete a mission, the product is a judge with
extra steps.

---

## 5. Principles → enforcement

A principle that is not enforced by a mechanism is decoration. Each of your ten
principles, with the thing that actually enforces it.

| # | Principle | Enforced by |
| --- | --- | --- |
| 1 | Problem before pattern name | **Content lint L1**: `briefing.copy` may not contain any term from the mission's `conceptTags` vocabulary. Build fails. |
| 2 | Player proposes strategy first | **Runtime gate**: `Run` disabled until `strategy_submitted` exists for this mission. |
| 3 | Errors are evidence, not punishment | **Design**: no red "FAILED", no score decrement, no streak reset. Diagnosis card is neutral, names the failure class, offers exactly one next action. |
| 4 | Smallest useful hint first | **Mentor rule M4**: level increases by at most 1 per intervention, and level 2+ requires a prior level-1 hint or an explicit request. |
| 5 | Max one primary + one secondary skill | **Schema lint L2**: `concepts.primary` length === 1, `concepts.secondary` length ≤ 1. |
| 6 | Correctness before optimization | **Schema lint L3**: a mission with `efficiency.enforced: true` must have at least one earlier mission in the same world with the same `concepts.primary` and `efficiency.enforced: false`. |
| 7 | Concepts reappear in new contexts | **Mastery rule**: a concept cannot reach `transferable` from a single mission id. |
| 8 | Reward understanding | **Runtime gate**: mission completion requires `reasoning_submitted` with rubric score ≥ 1. |
| 9 | Distinguish failure classes | **Mentor**: the error taxonomy (`04` §2) is the first thing computed, before any message is chosen. |
| 10 | Never reveal the full solution after one mistake | **Mentor rule M7**: level 4 is unreachable before `attempts ≥ 4 && hintsUsed ≥ 3`, or an explicit "show me the solution" click. |

### Why linting is the enforcement

Principles 1, 5, 6 are content problems, not code problems. They will be violated by
whoever writes mission 7 at 11pm. A lint that fails the build is the only thing that
survives contact with a content deadline.

---

## 6. Anti-drift lints

The documented failure mode of this product is *becoming a list of exercises with a
story stapled on*. These lints exist specifically to catch that drift, and they run in
CI on every mission file.

| Lint | Check | Fails when |
| --- | --- | --- |
| **L1 — no pattern leakage** | Briefing copy vs `conceptTags` vocabulary | A mission about Sets mentions "Set" in the briefing |
| **L2 — concept budget** | 1 primary, ≤1 secondary | A mission tries to teach four things |
| **L3 — optimization order** | Efficiency enforcement requires a prior functional mission | O(n) is demanded before O(n²) is understood |
| **L4 — narrative consequence** | `reward.worldEffect` must reference an existing workshop system id | Reward is "50 XP" instead of a system change |
| **L5 — hint ladder completeness** | Exactly 4 levels, monotonically more specific, level 4 is a worked *variant* not the answer | A hint jumps from "think about loops" to the solution |
| **L6 — test independence** | No hidden test's input appears in a visible test | The player can hardcode |
| **L7 — edge-case coverage** | Every mission declares ≥2 edge cases drawn from `{empty, singleton, all-match, none-match, boundary-equal, duplicate}` | Missions only test the happy path |
| **L8 — debrief substance** | Debrief must contain a cost statement and a real-world application | "Great job!" |

L4 is the one that keeps the game a game. If a mission's reward cannot be expressed as
a change to a named workshop system, the mission does not belong in the product.

---

## 7. Definition of success, made measurable

Your seven questions become the post-MVP instrument. Each is answerable from stored
events, not from opinion.

| Player question | Measured by | Target for MVP validation |
| --- | --- | --- |
| What problem was I solving? | Strategy statement references the objective's key noun | ≥70% of statements do |
| Why does my strategy work? | Reasoning rubric score ≥2/3 | ≥60% on first attempt after M6 |
| What must I remember or compare? | Concept-specific reasoning anchor | Tracked, no target yet |
| Which edge cases break it? | Edge-case trace correctness | ≥50% after M6 |
| What is its cost? | Complexity answer correctness | ≥60% on M9 |
| When is another strategy better? | M12 strategy-choice rationale | ≥1 of 2 alternatives correctly rejected |
| Can I transfer it untold? | M12 independent pass rate | ≥40% with ≤2 hints, no reveal |

These are **validation targets, not launch requirements**. If M12's independent pass
rate is 10%, the curriculum is wrong and we fix missions, not the metric.
