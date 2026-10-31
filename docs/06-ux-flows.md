# 06 — UX Flows and Wireframes

Covers deliverable B8. Textual wireframes, flows, and the visual identity constraint:
**the MVP must be buildable without artwork.**

---

## 1. Visual identity

| Token | Value | Rationale |
| --- | --- | --- |
| Background | `#0F1419` (near-black slate) | Reads as instrumentation, not as a game menu |
| Surface | `#1A2129` | Cards, panels |
| Border | `#2A343F` | 1px, low contrast — structure without noise |
| Text primary | `#E6EDF3` | |
| Text secondary | `#8B98A5` | |
| Accent (working) | `#3FB950` | A system that works |
| Accent (broken) | `#F85149` | A system that does not — **used only for world state, never for player errors** |
| Accent (attention) | `#D29922` | Hints, warnings, cost meter |
| Accent (structure) | `#58A6FF` | Links, selection, focus |
| Type — UI | Inter / system sans | |
| Type — code | JetBrains Mono / system mono | |

**The one non-negotiable colour rule:** red is never used to indicate that the player was
wrong. Red belongs to the *workshop*. A failed test is grey with a neutral icon, and the
diagnosis card is amber. This single rule does more for principle 3 ("errors as evidence,
not punishment") than any amount of copywriting.

### Why no artwork

The workshop is a **schematic**, not a scene: nodes, connections, and state. It reads as an
engineering diagram, which is both cheaper and more honest to the product's fiction. A player
who sees a diagram believes they are operating a system; a player who sees placeholder
art believes they are in a prototype.

---

## 2. Screen inventory

| # | Screen | Route | Purpose |
| --- | --- | --- | --- |
| S1 | Workshop map | `/` | Progression, world state, entry point |
| S2 | Mission briefing | `/mission/:id/brief` | Story + objective, no pattern names |
| S3 | Strategy prompt | `/mission/:id/strategy` | Commit to an approach before code |
| S4 | Lab | `/mission/:id/lab` | Editor, run, tests, mentor |
| S5 | Debrief | `/mission/:id/debrief` | Reasoning, edge cases, cost, application |
| S6 | Transfer / reinforcement | `/mission/:id/transfer` | Cross-context challenge |
| S7 | Mastery dashboard | `/progress` | Four dimensions per concept |
| S8 | Settings / data | `/settings` | Export, import, reset |

S2–S6 are a linear stepper with a progress rail. The player can move backwards (to re-read the
briefing) but not skip forward.

**Rail navigation.** Each rail step is a button. Any step already reached is enabled
(`go_to_phase` in the session reducer); future steps are disabled with the title "Aún no llegas
aquí", the strategy cannot be skipped, and the debrief stays locked until the tests pass. Going
back loses nothing (strategy, code, attempts, hints, last evaluation, console). Pressing
"Entendido →" or submitting the strategy again resumes at the furthest step reached instead of
rewinding the lab. A finished mission disables the rail. The furthest step is part of the reload
snapshot; older snapshots default to the current step.

**Illustration placement.** When the mission has a briefing illustration, it sits beside the
content, not under the rail: to the right of the strategy form and the debrief from 48 rem
(stacked below), and compact at the top of the lab's right column. Missions without an
illustration render without an empty column.

---

## 3. S1 — Workshop map

The map is two levels: a zigzag path of **worlds**, and inside a world a zigzag path of its
**missions**. A world node opens its mission path; "← Volver a los mundos" returns.

```
  Level 1 — worlds                    Level 2 — inside a world
  ┌───────────────────────────┐       ┌───────────────────────────┐
  │ Taller de los datos       │       │ World 1 — …   [← mundos]  │
  │                           │       │                           │
  │   (✓) World 1             │       │   (✓) M01 · Sensor        │
  │          (2) Transition   │       │          (●) M02 · …      │
  │   (▣) World 2  se abre …  │       │   (▣) M03  próximamente   │
  │          (▣) World 3      │       │   ── sistemas del taller ─│
  │                           │       │   Sensor · Línea · …      │
  │ ── siguiente ──────────── │       │ ── siguiente ──────────── │
  │ M02 · …      [ Continuar ]│       │ M02 · …      [ Continuar ]│
  └───────────────────────────┘       └───────────────────────────┘
```

### Rules

- **One primary action.** Exactly one mission is highlighted at a time, on both levels. The
  player may open completed missions to replay, but the map never presents a menu of choices.
- **Worlds open in order.** A world is `completed` when all its missions are, `current` when
  it is the first unfinished one, and `locked` otherwise. Only `completed` and `current`
  worlds can be opened.
- **Locked is not hidden.** Locked worlds and missions are visible and dimmed, with the reason
  ("se abre al terminar <mundo>", "próximamente"). Missions listed but not yet authored render
  as locked "próximamente" nodes. Visibility is motivation; opacity is information.
- **State, not score.** Nodes show a state (completed / current / locked), never percentages,
  stars or counters. World 1's view also shows the workshop systems (broken / working) below
  its path; red there means "system broken", never "you were wrong".
- **The next mission is chosen by the engine**, never by the player browsing. This is what
  keeps the curriculum in control of pacing.

---

## 4. S2 — Mission briefing

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Taller          M03 · El lote defectuoso             2 de 12      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   El lote del proveedor                                              │
│   ─────────────────────                                              │
│                                                                      │
│   El jefe de turno cambió de opinión. Ya no quiere saber si hay que  │
│   parar: quiere la lista completa de las unidades defectuosas...     │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────────┐ │
│   │  Lo que necesito                                               │ │
│   │  · Todas las unidades defectuosas                              │ │
│   │  · Con su id y su temperatura                                  │ │
│   │  · En el mismo orden en que llegaron                           │ │
│   │  · La lista original no se puede modificar                     │ │
│   └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│   Función:  collectFaultyDevices(devices, limit)                     │
│                                                                      │
│                                              [ Entendido → ]         │
└──────────────────────────────────────────────────────────────────────┘
```

### Rules

- The contract box is **generated from the mission data**, not written in prose. If the schema
  and the briefing disagree, the briefing is wrong — this prevents the most common content
  bug in educational products.
- No "you will learn X" section. Naming the learning objective is a leak (lint L1).
- No difficulty indicator. Telling a player a mission is hard is a self-fulfilling prophecy.

---

## 5. S3 — Strategy prompt

```
┌──────────────────────────────────────────────────────────────────────┐
│  M03 · El lote defectuoso                    Paso 2 de 5            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Antes de escribir código, dime cómo lo vas a resolver.             │
│                                                                      │
│   No hay respuesta incorrecta aquí. Solo quiero saber qué tienes     │
│   en la cabeza antes de empezar.                                     │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────────┐ │
│   │                                                                │ │
│   │  Voy a recorrer la lista y guardar las que estén por encima... │ │
│   │                                                                │ │
│   └────────────────────────────────────────────────────────────────┘ │
│                                              12 / 15 mínimo          │
│                                                                      │
│                                            [ Empezar a programar ]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Rules

- **Never graded.** The copy says so explicitly. A player who believes their sentence is being
  judged writes what they think we want, which destroys the signal.
- Minimum 15 characters. Enough to force a commitment, short enough not to be a chore.
- Skippable **once per session** after the player has written three statements. A hard gate
  forever becomes a tax on returning players; a hard gate for the first three is a habit.
- The statement is echoed back in the debrief ("empezaste diciendo…"). That callback is the
  cheapest possible "we listened to you" signal.

---

## 6. S4 — Lab

```
┌──────────────────────────────────────────────────────────────────────┐
│  M03 · El lote defectuoso              ⏱ 00:04:12      [ Ejecutar ]  │
├───────────────────────────────────┬──────────────────────────────────┤
│  collectFaultyDevices             │  PRUEBAS                    3/3  │
│  ─────────────────────────────    │  ──────────────────────────────  │
│  1 function collectFaulty(        │  ✓ lista vacía                   │
│  2   const out = [];              │  ✓ una unidad defectuosa         │
│  3   for (let i = 0; ...          │  ✓ dos defectuosas               │
│  4     if (devices[i].temp >      │                                  │
│  5       out.push(devices[i])     │  ──────────────────────────────  │
│  6     }                          │  MENTOR                          │
│  7   }                            │  ┌────────────────────────────┐  │
│  8   return out;                  │  │ Ejecuta para ver el        │  │
│  9 }                              │  │ diagnóstico.               │  │
│                                   │  └────────────────────────────┘  │
│  ─────────────────────────────    │                                  │
│  Consola                          │  [ Ver pista ]  [ Tabla de      │
│  > _                              │                    seguimiento ] │
└───────────────────────────────────┴──────────────────────────────────┘
```

### Rules

- **Left: code. Right: truth.** The test panel is always visible, never a modal. Hiding results
  behind a dialog turns a debugging loop into a slot machine.
- **Test names are descriptive**, never numbered. "una unidad defectuosa" tells the player what
  the case is; "Test 2" tells them nothing.
- **A failed test shows the diff, not a red X**: input, expected, actual. The player is a
  diagnostician, and diagnosticians need evidence.
- **Run is debounced** and shows a spinner with the elapsed ms. Latency honesty matters: if a
  run takes 900 ms, the player should know why.
- **The editor is CodeMirror 6**, loaded on demand (a plain textarea shows while it loads or if
  it fails): JavaScript highlighting, line numbers, auto-indent, bracket matching and
  auto-closing, Tab/Shift+Tab indent. Keyboard users are never trapped: Esc, then Tab, moves
  focus out. Cmd/Ctrl + Enter runs; the editor is read-only while a run is in progress.
- **The console panel ("Consola")** sits between the tests and the mentor. It shows what
  `console.log/info/warn/error/debug` printed in the last run, in call order, each line labelled
  with the visible test that produced it. Output from hidden and edge cases is never shown (only a
  dim "También hubo salida en pruebas ocultas" line). Empty state: "Aquí aparece lo que imprimas
  con console.log". "Limpiar" empties it; each run replaces it. See `08` §6.
- **The mentor panel is empty until the first run.** Pre-emptive advice is noise.
- **Keyboard**: `Cmd/Ctrl+Enter` runs. No other shortcuts in the MVP.

### The trace table (the highest-value affordance)

```
┌──────────────────────────────────────────────────────────┐
│  Tabla de seguimiento — [80, 88, 95]  límite 90          │
├────┬──────────┬───────────────┬────────────┐             │
│ i  │ lectura  │ lectura > 90  │ retorno    │             │
├────┼──────────┼───────────────┼────────────┤             │
│ 0  │ 80       │ false         │ —          │             │
│ 1  │ 88       │ false         │ —          │             │
│ 2  │ 95       │ true          │ true       │             │
└────┴──────────┴───────────────┴────────────┘             │
```

Generated by instrumenting the player's **own** function, not by a model. It is deterministic,
cheap, and it is the single most effective intervention for the "repeats the same error" case.

---

## 7. S5 — Debrief

```
┌──────────────────────────────────────────────────────────────────────┐
│  M03 · Completada                    Paso 4 de 5                    │
├──────────────────────────────────────────────────────────────────────┤
│  Empezaste diciendo: "voy a recorrer la lista y guardar las que..."  │
│  Lo resolviste en 2 intentos, con 1 pista.                           │
│                                                                      │
│  ① Por qué funciona                                                  │
│     La función construye un valor, no responde una pregunta...       │
│                                                                      │
│  ② Casos límite                                                      │
│     ¿Qué devuelve con []?   [ respuesta ]     ✓                      │
│                                                                      │
│  ③ Coste                                                             │
│     ¿Cuántas veces recorre la lista tu solución?                     │
│     ( ) una vez   ( ) dos veces   ( ) n² veces      ✓                │
│                                                                      │
│  ④ Explica con tus palabras                                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                       [ Guardar ]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Rules

- **Four blocks, in order**: why it works, edge cases, cost, reasoning. The reasoning block is
  last because it benefits from the other three.
- **Edge-case and cost questions are deterministic** (multiple choice, numeric, or a trace).
  They are not AI-graded and they are not free text.
- **The reasoning block is free text** and is the only block that can hold up completion.
- **No confetti.** The debrief is a document, not a reward screen. The reward is the workshop,
  which the player sees when they return to the map.

---

## 8. S7 — Mastery dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  Progreso                                           12 conceptos     │
├──────────────────────────────────────────────────────────────────────┤
│  Recorrido de listas                          ●●●●○  proficient     │
│  ├ corrección      ████████░░  0.83                                  │
│  ├ robustez        ██████░░░░  0.67                                  │
│  ├ razonamiento    ███████░░░  0.72                                  │
│  └ eficiencia      ██████████  1.00                                  │
│     Evidencia: 3 misiones · 1 sin ayuda                              │
│     Para "transferible": necesitas resolverlo en otro contexto.      │
│                                                                      │
│  Detección de duplicados                      ●●●○○  practicing     │
│  ├ corrección      ██████░░░░  0.60                                  │
│  ...                                                                 │
│                                                                      │
│  ⚠ Refuerzo pendiente: casos límite (M06)              [ Practicar ] │
└──────────────────────────────────────────────────────────────────────┘
```

### Rules

- **Every cap is explained in plain language.** "Necesitas resolverlo en otro contexto" is the
  difference between a rule and a punishment.
- **No aggregate score.** There is no "you are 73% complete", because that number would become
  the thing players optimize.
- **Reinforcement is offered, never forced.** It appears as a warning row with a button.

---

## 9. Key flows

### First session (the 90 seconds that decide retention)

```
S1 map (one highlighted mission)
  → S2 briefing (short, 4 bullets)
    → S3 strategy (15 chars minimum)
      → S4 lab (starter code, one obvious bug on first run)
        → diagnosis (specific, amber, one next action)
          → fix → all green
            → S5 debrief (4 blocks)
              → S1 map (sensor turns green)
```

Target: **under 6 minutes** from landing to first green sensor. If the first mission takes
longer, the product loses the players who would have loved it.

### The failure loop (the part that must feel good)

```
run → diagnosis card (amber, one action)
    → [ Ver pista ]  or  [ Editar ]
    → if hint: level 1 question, then back to editing
    → if same error again: modality switch (trace table)
```

**No dead ends.** Every diagnosis has exactly one primary action. The player never has to
decide what to do about being wrong — only what to do next.

### Abandonment recovery

Returning after >7 days:

```
S1 map
  → "Volviste. Esto es lo último que hiciste: M05, te faltó explicar el coste."
  → [ Retomar ]
```

No streak guilt, no "you lost your progress". The product's attitude toward a returning player
is that they were always welcome.

---

## 10. Responsive behaviour

| Breakpoint | Behaviour |
| --- | --- |
| ≥1280px | Two-column lab (code + panel) |
| 900–1279px | Two-column, narrower test panel, mentor collapses to a drawer |
| <900px | Lab is **desktop-only** with an honest message: "El laboratorio necesita una pantalla más ancha. El mapa y el progreso funcionan aquí." |

The last row is a decision, not an omission. A code editor on a phone is a bad experience that
would damage the product's credibility. Saying so is better than shipping it badly.

---

## 11. Accessibility floor

- Focus visible on every interactive element; no `outline: none` without a replacement.
- Colour is never the only signal: test state uses icon + text + colour.
- The editor supports keyboard-only navigation; run is `Cmd/Ctrl+Enter`.
- All hint text is real text (selectable, screen-readable), never an image.
- Minimum contrast 4.5:1 for body text against surfaces.
- `prefers-reduced-motion` disables the workshop node transitions.
