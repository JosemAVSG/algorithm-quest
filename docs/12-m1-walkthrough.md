# 12 — M1 Walkthrough (Vertical Slice)

Record of playing M01 end to end in the build produced for M1. This document exists because
`11-delivery-plan.md` §3 M1 replaces the (unavailable) playtest criterion with "a documented solo
walkthrough that records, for every step, either the time taken or the point where outside
knowledge was required".

**Read the evidence class before the walkthrough.**

| Evidence | Class | What it proves |
| --- | --- | --- |
| 6 E2E paths (X1–X6) in `e2e/m01.spec.ts` | **Automatable, repeatable** | The flow works on this build, with real Worker execution |
| 89 unit + integration tests | **Automatable, repeatable** | Domain rules, content pipeline, session reducer, stores |
| This walkthrough | **Designer self-report, A7 unsatisfied** | That the screens exist, in order, with the specified content |
| Playtest with 3–5 target-persona people | **Missing** | Whether the mission teaches anyone anything |

## 1. Timing: not measured

No human timings are recorded here, and none are estimated.

The only person available for this walkthrough wrote the mission, knows the answer, and knows
the hint ladder. Any number produced by that person measures the designer's memory, not the
player's experience. The definition of done in `11` §2 asks for M01 in under 6 minutes *for
someone who has never seen the product*; a stopwatch on the author would be a fabricated
measurement wearing the costume of evidence.

What would produce a real number: 3–5 target-persona people, first contact, screen recording,
no coaching. That is assumption A7, and it is unsatisfied (`11` §6). Until then M1 is
**buildable**, not **validated**, and this document is labelled accordingly.

## 2. Walkthrough, step by step

Columns: **step**, what the player sees, **outside-knowledge risk** — the plausible place a
novice would stall. These risks are design hypotheses from reading the copy, not observations;
they are listed because the milestone asked for them, and they are the only honest substitute
available without testers.

| # | Step | Observed on this build | Outside-knowledge risk (hypothesis) |
| --- | --- | --- | --- |
| 1 | Workshop map | Ten systems listed as *averiado*; the next mission is the only primary button (`Continuar →`); footer says "sin puntos, sin rachas" | Low. The red-broken convention has to be inferred, but the copy states it: "Cada sistema averiado es una función que falta" |
| 2 | Briefing | Headline, narrative, "Lo que necesito", contract box generated from `mission.contract` (`isOverLimit(temperature, limit) -> boolean`, input/output shapes, three rules) | **Medium.** Nothing explains what a "contrato" is to someone who has never written a function. The box is precise for a reader who already knows the word |
| 3 | Strategy gate | One textarea, "No se puntúa", counter to 15 characters, button disabled below it | Low. A player who believes the sentence is graded writes what we want to hear; the copy says twice that it is not graded |
| 4 | Lab | Editor with line numbers, starter stub with `// your code here`, contract signature, `Ejecutar`, visible tests `—` until the first run | **High.** This is the step where JavaScript syntax is assumed. A player who cannot write `return temperature > limit` is stuck, and M1 has no scaffold for that |
| 5 | First run, boundary bug | Visible tests `3/3`, the note "Las pruebas visibles pasan. El sistema todavía tiene casos que no ves.", mentor card `E05` — "La comparación falla justo en el límite." | **Medium.** The card gives the *symptom* and the failing input, never the fix. A player who does not connect "justo en el límite" with `>` vs `>=` needs the hint |
| 6 | Hint 1 | "¿Qué dos cosas tiene que mirar la función para decidir? ¿Y qué pasa cuando las dos son iguales?" — counter reads `pistas 1` | Low. The question is answerable from the contract |
| 7 | Hint 2 | The authored message for this failure: "Con 90 y límite 90, el panel recibe true…". One more click only, never the whole ladder | Low. Level 2 is evidence, level 3 (still gated behind another click) is the mechanism |
| 8 | Fix | `>` instead of `>=`; second run shows "Las pruebas pasan." and a single primary action, `Abrir el informe →` | Low |
| 9 | Debrief | Four numbered blocks: why it works, edge cases, cost (four options, one correct), free-text reasoning | **Medium–High.** The reasoning block can hold completion (`score < 2` shows specific feedback). This is the only gate in the product that judges prose, and it judges it with a lexicon, not comprehension. `docs/04-mentor.md` §6 accepts that limitation; a tester is the only way to know if the feedback lands as help or as rejection |
| 10 | Completion | "Misión completada", attempts / hints / reasoning `3 / 3`, reward narrative, system transition `sys.sensor: broken → working` | Low |
| 11 | Back to the map | `Sensor array: operativo`; the next-mission panel says the rest of the workshop arrives in the next milestone and offers `Repetir M01` | Low, but honest: the slice ends here by design |
| 12 | Reload mid-mission | Phase, attempts, hints, strategy and evaluation survive; the editor buffer resets to the starter code | Low. The docs name this exact trade-off; the UI does not warn about it, which is acceptable because nothing else is lost |

## 3. What the automated paths actually cover

`npm run test:e2e` (Chromium, Vite dev server, one worker):

| ID | Path | Asserts |
| --- | --- | --- |
| X1 | Happy path | Map → briefing → strategy → lab → green → debrief → completion → map updated, next-mission panel empty |
| X2 | Failure path | `>=` bug → `3/3` visible + hidden-failure note → `E05` card → hint 1 → hint 2 → fix → debrief → completion; debrief echoes "2 intentos, 2 pistas" |
| X3 | Infinite loop | `while (true) {}` → timeout diagnosis inside the 2 s Worker budget → editor still usable → correct code passes |
| X4 | Reload persistence | Completion survives reload; `Sensor array: operativo` and `1 de 12` still shown |
| X5 | Keyboard | Tab reaches the editor, `Cmd/Ctrl+Enter` runs, correct code passes without touching the mouse |
| X6 | Mid-mission reload | Attempt count and diagnosis survive, editor buffer does not (the documented trade-off) |

X2 deserves a note. M01's bug fails **only** `ed1` (90 vs 90) and `ed3` (0 vs 0), both edge
cases, so every visible test passes. That is the mission's lesson — visible tests are not the
spec — and the E2E path asserts the intermediate state instead of skipping over it. The
diagnosis is still `E05`, and hint 2 is the authored sentence for that exact failure, not the
generic code message.

## 4. Deviations from the M1 definition

| Deviation | Why | Consequence |
| --- | --- | --- |
| Minimal `localStorage` persistence (progress + per-mission session) | M1 requires "reloading mid-mission loses nothing except the editor buffer", which is impossible without writing state somewhere | Schema version 1 only; migrations, export/import, and reset UI remain M4. Corrupt or newer blobs fall back to a fresh start rather than crashing |
| Playwright 1.64.1 added as a dev dependency | X1–X5 cannot be verified any other way | CI gained an `e2e` job; Chromium only, per assumption A5 |
| X6 added | X4 checks completion persistence, not the mid-mission promise | One extra path, no new product behaviour |
| Levels 1–3 only (`MAX_HINT_LEVEL = 3`) | M1 explicitly excludes level 4 | M01's authored level 4 stays in the JSON, unreachable until M3 |
| Hint 2 uses the diagnosis evidence message | The authored boundary message is more specific than the code's fallback | Documented in `domain/diagnosis/hints.ts`; no schema change |

## 5. What M1 does not prove

- **That the mission is fun to debug.** This is the failure the 3-minute demo was meant to
  catch, and it cannot be caught by the person who wrote the bug.
- **That the explanation gate helps.** `docs/04-mentor` §6 already argues the rubric is a proxy.
  A tester reacting to the rejection message is the missing evidence.
- **That the lab is usable below 900 px.** It is hidden there by design, with a note. Nothing
  verifies the note is read or that the map/debrief still make sense on a small screen.
- **Anything about the other 11 missions.** Only M01 is authored.

## 6. Reproduce

```bash
npm install
npm run check          # typecheck + lint + content + 89 tests
npx playwright install chromium
npm run test:e2e       # X1–X6, ~6 s
npm run dev            # manual walkthrough at 1280×900 or wider
```
