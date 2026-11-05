# Algorithm Quest — Specification Package

Status: **Gates 1–3 approved. M0–M2 done; M3 partial. Worlds 2–6 (M13–M37) authored — see `15-world2.md` to `18-worlds5-6.md`. Step cost, E16 and a step-by-step trace — see `19-cost-and-trace.md`.** M1 is *buildable*, not validated:
assumption A7 is still unsatisfied and there is no playtest evidence — see
`11-delivery-plan.md` §6, `12-m1-walkthrough.md`, `13-m2-hardening.md` and
`14-m3-mentor.md`.
Version: `spec-0.1.0` · Date: 2026-10-27

The design documents in `docs/` are the spec. The code is the content pipeline plus a playable
game: **37 missions** in six worlds and the transition arc (`C01`–`C41` all covered), Worker
execution with a 1 MB output cap, mutation/determinism/rotation probes, a mentor that produces
E01–E22 with a four-rung ladder and modality switching, a test panel with the cost of each run
in steps, a step-by-step trace of any visible case, and the four-block debrief. Nothing has been
playtested, and the spaced-review content (`content/reinforcement.json`) is still empty.

```bash
npm install
npm run check       # typecheck + lint + validate:content + unit/integration tests
npx playwright install chromium
npm run test:e2e    # X1–X8, S1–S10 and the lab, cost and trace suites in a real browser
npm run dev         # the lab stacks below 900 px, so it also works on a tablet or phone
```

---

## Review protocol

Three gates. Do not approve a later gate before the earlier one.

| Gate | Question | Documents | Unblocks |
| --- | --- | --- | --- |
| **Gate 1 — Pedagogy & missions** | Do the 12 missions teach what we claim, in a coherent ramp? | `01`, `02`, `03`, `04`, `05`, `missions/*` | Gate 2 review |
| **Gate 2 — Architecture** | Is the technical shape right, and is code execution decided? | `06`, `07`, `08`, `09`, `10` | Milestone M0 (content pipeline) |
| **Gate 3 — Delivery** | Is the MVP scope honest and are the milestones verifiable? | `11` | Milestone M1 onward |

M0 sits after Gate 2 on purpose. It implements the mission schema (`09`) and the lints (`10`),
so the architecture must be agreed before it is written. A schema built on unapproved
architecture is precisely the rewrite the gate exists to prevent.

Gate 1 is the one that matters. A beautiful interface over mediocre missions is the
documented failure mode of this product (see `11-delivery-plan.md` §Risks, R1).

---

## Deliverable map

Every deliverable from the brief maps to exactly one place.

### Phase A — Product definition

| # | Deliverable | File |
| --- | --- | --- |
| A1 | Product vision and target learner | `docs/01-vision-and-pedagogy.md` §1–2 |
| A2 | Core gameplay loop and pedagogical methodology | `docs/01-vision-and-pedagogy.md` §3–5 |
| A3 | Six-world roadmap with concept dependencies | `docs/02-curriculum-roadmap.md` |
| A4 | Complete initial mission catalog | `docs/03-mission-catalog.md` |
| A5 | Detailed specs for the first 12 missions | `docs/missions/M01.md` … `M12.md` |
| A6 | Adaptive mentor rules and hint design | `docs/04-mentor.md` |
| A7 | Mastery model and progression rules | `docs/05-mastery.md` |

### Phase B — UX and architecture

| # | Deliverable | File |
| --- | --- | --- |
| B8 | User flows and textual wireframes | `docs/06-ux-flows.md` |
| B9 | Proposed application architecture | `docs/07-architecture.md` |
| B10 | Code-execution options comparison | `docs/08-code-execution.md` |
| B11 | Mission data model and example records | `docs/09-mission-schema.md`, `content/missions/m01.json` |
| B12 | Testing strategy and security considerations | `docs/10-testing-and-security.md` |

### Phase C — Delivery planning

| # | Deliverable | File |
| --- | --- | --- |
| C13 | MVP scope and explicit exclusions | `docs/11-delivery-plan.md` §1–2 |
| C14 | Small implementation milestones | `docs/11-delivery-plan.md` §3 |
| C15 | Verifiable acceptance criteria per milestone | `docs/11-delivery-plan.md` §4 |
| C16 | Risks, assumptions, decisions requiring approval | `docs/11-delivery-plan.md` §5–7 |
| — | M1 walkthrough and its evidence class | `docs/12-m1-walkthrough.md` |
| — | M2 hardening: shipped, refused, deviated | `docs/13-m2-hardening.md` |
| — | M3 mentor: shipped, deviated, still open | `docs/14-m3-mentor.md` |
| — | World 2 missions M13–M16 | `docs/15-world2.md` |
| — | World 3 missions M17–M22 | `docs/16-world3.md` |
| — | World 4 missions M23–M28 | `docs/17-world4.md` |
| — | Worlds 5–6 missions M29–M37 | `docs/18-worlds5-6.md` |
| — | Step cost, E16 verdict, step-by-step trace | `docs/19-cost-and-trace.md` |

---

## Read in this order

1. `docs/00-open-decisions.md` — the 12 decisions that block or shape implementation.
2. `docs/01-vision-and-pedagogy.md` — what the product is and how learning is enforced.
3. `docs/03-mission-catalog.md` — the ramp at a glance, before reading individual missions.
4. `docs/missions/M01.md`, `M03.md`, `M06.md`, `M12.md` — the four load-bearing missions.
5. Everything else.

If you only have 20 minutes: `00`, `01` §5 (principles → enforcement), `03`, and
`11` §5 (risks). That is where the product either works or does not.

---

## What is deliberately NOT here

- No authentication, database, or AI provider selection.
- No world 2–6 mission content, and no M02–M12 records (roadmap only).
- No streaming trace protocol: the trace is a separate run of one visible case (`19`).
- No playtest evidence (A7) — M1 is buildable, not validated.

## Non-negotiable invariants

These hold across every document and every future milestone. If an implementation
detail contradicts one of these, the implementation is wrong.

1. **The test engine is the only source of truth for correctness.** The mentor reads
   its output; it never writes, overrides, or predicts it.
2. **Mission content is data**, validated against a versioned schema, never hardcoded
   into components.
3. **A mission's briefing may not name its own algorithmic pattern** unless the mission
   explicitly tests knowledge of that pattern. This is lint-enforced (`10` §4).
4. **No complete solution is revealed after a first mistake.** Level-4 help requires
   either explicit request or a documented attempt threshold.
5. **Progress is tracked per concept, not per mission.** Mission completion is a
   side effect of concept evidence, not the unit of progress.
