# 04 — Adaptive Mentor

Covers deliverable A6. Defines what the mentor observes, how it decides, what it may
say, and the hard boundary between deterministic feedback and generated feedback.

---

## 1. Three layers, strictly ordered

```
   ┌──────────────────────────────────────────────────────┐
   │  L0  TEST ENGINE            (source of truth)        │
   │      pass/fail per test, error class, timing, output │
   └───────────────────────┬──────────────────────────────┘
                           │ immutable result
   ┌───────────────────────▼──────────────────────────────┐
   │  L1  DIAGNOSIS              (deterministic rules)    │
   │      error code + evidence + confidence              │
   └───────────────────────┬──────────────────────────────┘
                           │ immutable diagnosis
   ┌───────────────────────▼──────────────────────────────┐
   │  L2  INTERVENTION           (authored hint ladder)   │
   │      which hint, at which level, phrased how         │
   └──────────────────────────────────────────────────────┘
```

**Invariant:** L2 may never alter L0 or L1. The mentor cannot report a test as passing
that did not pass, cannot claim code is correct, and cannot suppress a failing test. It
receives a frozen result object and returns a frozen intervention object.

**Second invariant:** L1 is a pure function. Same attempt + same history ⇒ same
diagnosis. This is what makes the mentor testable, and testability is the only defence
against the mentor becoming a source of confident nonsense.

---

## 2. Error taxonomy

The taxonomy is the mentor. Everything else is phrasing.

`detect` = how the classifier knows. `conf` = how certain it is.

| Code | Meaning | Detected from | Conf | Default level |
| --- | --- | --- | --- | --- |
| `E01` | Syntax error | Parse failure (line, col, message) | certain | 2 |
| `E02` | Runtime throw | Uncaught exception + stack | certain | 2 |
| `E03` | Timeout | Execution exceeded budget, no result | certain | 1 |
| `E04` | Empty-input failure | Only the `empty` test fails | certain | 2 |
| `E05` | Inclusive/exclusive boundary | Fails only when `actual === limit` | certain | 2 |
| `E06` | Loop bounds | Fails only when the match is the last element, or throws on index `length` | certain | 2 |
| `E07` | Premature exit | Output has one element where many expected, **or** a rotation probe changes the verdict | certain | 2 |
| `E08` | Missing post-loop default | Returns `undefined` on the no-match case | certain | 2 |
| `E09` | Accumulator reset | Result equals the last element's contribution, not the sum | certain | 2 |
| `E10` | Accumulator init | `NaN`, or `undefined + number` | certain | 2 |
| `E11` | Input mutation | Deep-equal check of input before/after fails | certain | 2 |
| `E12` | Output shape | Type or structure mismatch, values may be right | certain | 1 |
| `E13` | Hardcoded answer | All visible pass, hidden fail, source has no iteration or index access | likely | 1 |
| `E14` | No progress | Source hash identical to the previous attempt | certain | 3 |
| `E15` | Repeated error | Same code twice consecutively | certain | 3 |
| `E16` | Inefficiency | Correct output, exceeded op/time budget | certain | 2 |
| `E17` | Reasoning weak | Tests pass, reasoning rubric < 2 | certain | 2 |
| `E18` | Non-deterministic | Same input, different output across 3 runs | certain | 2 |
| `E19` | Constraint violation | Source uses a construct the mission explicitly bans (`.some` in M02, `.includes` in M10) | certain | 2 |
| `E20` | Duplicated constant (warning) | The same literal appears in ≥2 independent code paths | certain | 1 |
| `E21` | Incomplete comparison | A declared tie-break or secondary criterion is ignored; result is plausible but not the specified one | certain | 2 |
| `E22` | Loose equality | `==` used where the contract requires `===` | certain | 2 |

### The rotation probe

`E07` and "only looks at index 0" are hard to see in source and easy to see in behaviour.
For any mission whose answer must be invariant under rotation of the input, run the player's
function twice: once on `xs`, once on `rotate(xs, 1)`. If the answers differ, the function
is not examining all elements.

This is deterministic, cheap, and immune to the player disguising the bug. It is the
detection method behind the most common World 1 failure, and it is the reason the mentor
can say "tu función decide con el primer elemento" instead of guessing.

### Why "likely" exists

`E13` is the only inference. A source with no loop can still be correct if the mission
is a pure arithmetic relation (M09's closed form is exactly that). So `E13` is
*downgraded* when the mission declares `closedFormAllowed: true`. Everywhere else it
fires with `likely` confidence and the mentor phrases it as a question, not an accusation:

> "Esta solución no recorre la lista. ¿Funcionaría igual con una lista de 10.000
> elementos que no has visto?"

That sentence is a question the player can answer honestly, and it does not accuse them.

---

## 3. Rule engine

Evaluation order is fixed. First match wins; the rest are recorded but not shown.

```
1. parse failed?                     → E01
2. execution timed out?              → E03
3. execution threw?                  → E02
4. input mutated?                    → E11
5. output shape wrong?               → E12
6. non-deterministic across 3 runs?  → E18
7. all visible pass, some hidden fail?
     7a. no iteration in source      → E13
     7b. diff signature matches edge → E04 / E05 / E06 / E08
     7c. otherwise                   → E12 or E16
8. some visible fail?
     8a. result shorter than expected → E07
     8b. result is undefined          → E08
     8c. NaN in result                → E10
     8d. equals last contribution     → E09
     8e. otherwise                    → E05 / E06 by failing-test identity
9. all pass, reasoning submitted?    → E17 (if rubric < 2) else CLEAR
10. all pass, no reasoning           → request reasoning (not an error)
```

### Post-classification modifiers

Applied after the primary code is chosen, in this order:

| Modifier | Condition | Effect |
| --- | --- | --- |
| `NO_PROGRESS` | Source hash unchanged since last attempt | Replace intervention with E14 at level 3, **and** force a modality switch |
| `REPEAT` | Same error code as previous attempt | Escalate one level, switch modality (`04` §6) |
| `LOW_ATTEMPT` | This is attempt 1 | Cap level at 1 unless `E01`/`E02` (syntax errors are not a learning ladder — fix them immediately) |
| `STRUGGLING` | attempts ≥ 4 | Unlock level 4 eligibility |
| `POST_HINT` | Previous intervention was a hint and code changed | Reset `REPEAT` counter, do not escalate |

### The `LOW_ATTEMPT` exception, and why

Syntax and runtime errors get a *specific, immediate, complete* explanation of the
mechanical fault. Withholding that is not pedagogy, it is hazing — the player cannot
reason their way to "you wrote `lenght`". The progressive ladder applies to **logic**,
where reasoning is possible. This distinction is the whole point of principle 9.

---

## 4. Hint ladder

Four levels. Authored per mission, not generated. `L5` lint enforces shape.

| Level | Form | Contains | Must NOT contain |
| --- | --- | --- | --- |
| **1** | Conceptual question | What to think about | Any reference to their code, any structure name |
| **2** | Concrete observation | A fact about *their* attempt or *this* input | The missing construct |
| **3** | Structural guidance | A pseudocode fragment or a named construct | Complete working lines |
| **4** | Worked variant | A full walkthrough on a **different, isomorphic input** | The mission's own solution |

### Level-4 rules (the anti-reveal guard)

Level 4 is reachable only when **one** of these is true:

- `attempts >= 4 && hintsUsed >= 3`, or
- the player clicks "show me a worked example" explicitly, or
- the player clicks "show me the solution" explicitly.

The third case is different from the second and is handled separately: it reveals the
mission's own solution, sets `solutionRevealed = true`, and permanently caps that
mission's contribution to mastery at `practicing` (`05` §6). It is available, honest, and
expensive. We never hide it, and we never make it cheap.

### Authoring rule for level 4

The worked variant must be **isomorphic but textually different**: same structure, different
domain nouns and different constants. Example for M02 (any faulty device):

> Level 4 is a walkthrough of "does this shipment contain any expired package", not a
> walkthrough of `anyDeviceFaulty`. The player still has to map it.

This is the difference between a hint and an answer key, and it is why level 4 remains
pedagogically useful instead of ending the mission.

---

## 5. Adaptation matrix

Your table, made operational. Each row is a rule with a named trigger.

| Observation | Trigger | Intervention |
| --- | --- | --- |
| Correct strategy, syntax error | `E01` | Point at line/col and name the fault class. No rewrite. Never counts as a hint. |
| Understands goal, logic fails | `E05`,`E06`,`E07`,`E09` + strategy statement mentions the objective | Level 2 question about one concrete input: "¿Qué debería devolver esto: `[80, 95]` con límite 90?" |
| Stuck on design | No run yet, or `E14` | Level 1 conceptual hint about what information must be remembered or compared |
| Repeats the same error | `E15` | Escalate one level **and** switch modality (prose → trace table → smaller example) |
| Correct code, weak explanation | `E17` | Ask for a manual trace of a boundary input, then re-score |
| Correct and well explained | `CLEAR` | Offer the complexity question, then the transfer challenge |
| Succeeds with help | `CLEAR` + `hintsUsed >= 2` | Acknowledge, then schedule reinforcement (`05` §8) |

### Modality switching

When `REPEAT` fires, prose alone has demonstrably failed. The mentor must change the
*representation*, not the volume:

```
prose  →  trace table  →  smaller input  →  worked variant
```

A trace table is a rendered table of `i`, `element`, `condition`, `accumulator` for the
player's own code on a 4-element input. It is generated deterministically by instrumenting
the player's function — not by the model. This is one of the highest-value features in the
product and it is pure engineering, not AI.

---

## 6. Reasoning evaluation

Step 8 of the cycle. Tests passing is necessary, never sufficient.

### Rubric (0–3)

| Score | Criterion |
| --- | --- |
| 0 | Restates the code, or blank, or "it works because the tests pass" |
| 1 | Names the mechanism ("I loop and check each one") without justifying the choice |
| 2 | Justifies the mechanism against the objective, including one boundary case |
| 3 | Justifies mechanism **and** states the cost, or explains why an alternative fails |

### Deterministic first

A keyword-and-structure heuristic covers most of the space and is the MVP default:

- **0** if length < 20 chars, or contains only `porque funciona` / `porque pasa los tests`
  / `no sé` patterns.
- **1** if it contains a mechanism verb from the mission's `reasoningLexicon`
  (`recorro`, `comparo`, `acumulo`, `guardo`, `devuelvo`) but no objective reference.
- **2** if it contains a mechanism verb **and** an objective noun from the mission's
  `objectiveNouns`, **and** ≥ 40 chars.
- **3** requires a cost or alternative marker (`O(`, `complejidad`, `recorrer dos veces`,
  `podría`, `en cambio`) in addition to 2.

This is crude, and it is honest about being crude. It is also deterministic, testable, and
free. Its known weakness: a well-written wrong explanation can score 2. That is acceptable
because **reasoning never gates correctness** — it only gates mission completion and
mastery weighting, both of which are recoverable.

### Optional AI layer

If enabled, the AI receives: the mission's `reasoningPrompt`, the player's text, the
objective, and the rubric. It returns structured JSON:

```json
{ "score": 0|1|2|3, "missing": ["cost"], "followUp": "..." }
```

Hard constraints:

1. Output is schema-validated. Invalid → discard, fall back to the deterministic score.
2. The AI may **not** return a correctness verdict. The field does not exist.
3. The AI's score is capped at `deterministicScore + 1`. It can reward nuance; it cannot
   manufacture understanding from a one-line answer.
4. Every AI call is logged with prompt hash, latency, and score, so drift is observable.
5. Off by default. If the call fails, the deterministic path is used and the player sees
   no error.

Constraint 3 is the one that matters. Without it, an agreeable model becomes a way to
skip the reasoning step, which is the only step that distinguishes this product from a
judge.

---

## 7. Deterministic vs generated — the boundary

| Capability | Deterministic | May be AI | Never AI |
| --- | --- | --- | --- |
| Test pass/fail | ✅ | — | — |
| Error classification | ✅ | — | — |
| Hint selection | ✅ | — | — |
| Hint text | ✅ authored | — | — |
| Trace table | ✅ instrumented | — | — |
| Reasoning score | ✅ heuristic | ✅ advisory, capped | — |
| Complexity answer check | ✅ | — | — |
| "Is this code correct?" | ✅ | — | ❌ |
| "Did the player understand?" | — | ✅ (advisory) | — |
| Final mastery value | ✅ formula | — | — |

---

## 8. Failure modes and fallbacks

| Failure | Behaviour |
| --- | --- |
| Execution times out | `E03`, level-1 hint about termination, plus a trace table of the first 50 iterations |
| Execution throws outside player code (harness bug) | Mark `internal_error`, show neutral message, **do not** classify as player error, log loudly |
| No matching error code | `E_UNKNOWN`, level 1 generic diagnostic prompt, never guess |
| Hint ladder exhausted | Offer level 4 per §4 rules |
| Reasoning heuristic returns 0 on a long answer | Show the rubric to the player and let them revise once, without penalty |
| AI unavailable / invalid JSON | Deterministic path, silently |

`E_UNKNOWN` must be rare. If it exceeds 5% of attempts in telemetry, the taxonomy is
wrong and gets fixed — that is a design defect, not a content problem.

---

## 9. Data contract

```ts
type Diagnosis = {
  code: ErrorCode;                    // E01..E18 | E_UNKNOWN
  confidence: 'certain' | 'likely';
  evidence: {
    failingTestIds: string[];
    actual?: unknown;
    expected?: unknown;
    line?: number;
    column?: number;
    message?: string;
    signature?: string;               // normalized diff signature for repeat detection
  };
  modifiers: Modifier[];              // NO_PROGRESS | REPEAT | LOW_ATTEMPT | STRUGGLING
  hint: { level: 1|2|3|4; hintId: string };
  traceTableAvailable: boolean;
};

type Intervention = {
  diagnosis: Diagnosis;
  headline: string;                   // one neutral sentence
  body: string;                       // the authored hint text for this level
  nextAction: 'edit' | 'trace' | 'answer_reasoning' | 'retry';
  revealSolutionOffered: boolean;     // true only when §4 conditions met
};
```

`nextAction` exists because a hint without a next action is a lecture. The UI must be able
to render exactly one call to action.

---

## 10. Rule index

Other documents reference these rules by id. They are normative.

| Rule | Statement | Defined in |
| --- | --- | --- |
| **M1** | Evaluation order is fixed; the first matching code wins and later matches are recorded but not shown | §3 |
| **M2** | Modifiers apply in the declared order after the primary code | §3 |
| **M3** | Syntax and runtime errors bypass the hint ladder and receive a specific, complete explanation | §3 |
| **M4** | The hint level increases by at most 1 per intervention; level 2+ requires a prior level-1 hint or an explicit request | §4 |
| **M5** | A repeated error forces a modality switch (prose → trace table → smaller input → worked variant) | §5 |
| **M6** | Reasoning never gates correctness — only mission completion and mastery weighting | §6 |
| **M7** | Level 4 requires `attempts ≥ 4 && hintsUsed ≥ 3`, or an explicit request for a worked example or the solution | §4 |
| **M8** | An AI reasoning score is capped at `deterministicScore + 1` | §6 |
| **M9** | The mentor may not emit a correctness verdict; the type has no such field | §1, §9 |
