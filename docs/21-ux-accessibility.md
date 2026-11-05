# 21 — UX and accessibility review

Status: **done on the screens that exist**; not validated with players or assistive-technology users.

A review of the whole game on a desktop (1280×900) and a phone (390×844), with an automated accessibility scan
(axe, WCAG 2 A/AA, 2.1 AA and best practices) and a sweep of **all 37 missions** for layout problems. A first round
(lab usable below 900 px, mentor under the tests, no font ligatures, Spanish names, next mission first) shipped
earlier; this is the second.

## Found and fixed

| Problem | Where | Fix |
| --- | --- | --- |
| Text dimmed with `opacity` fell to a 2.6:1 contrast (4.5:1 required) | 123 elements on the progress screen, the "not installed" systems on the map | Quiet states use the muted colour token and a faded border/dot instead of fading the whole element |
| The map, progress and review screens had no `<main>` landmark | map, progress, review | They are `<main>` now |
| The debrief screen was 20 px wider than a phone | the debrief sentence's `<select>` options pushed the grid column wide | `.split` has an explicit shrinking column; blanks cap at 100% |
| Long lines forced sideways scrolling while typing code on a phone | the editor | Lines wrap below 900 px (it follows the screen when a tablet rotates) |
| Controls around 28 px tall on a phone (the step rail, link buttons, the trace picker) | mission screens | At least 44 px on touch or narrow screens |
| The reward moment showed `sys.sensor` and `broken → working` | mission complete | Shows the system's Spanish name and `averiado → operativo`, the same words as the map |

## A mission that "could not be loaded" never recovered

Found from a production report ("No se pudo cargar la misión" on the deployed site). The retry button asked the
loader again, but a browser **caches a failed dynamic `import()` for the life of the page**: after the first
failure, the second attempt fails at once without a request, even when the server is back. The experiment is
three lines: import a URL that 404s, make the server healthy, import it again: no request is made and it fails;
a fresh page succeeds. The loader's comment claimed the opposite, and the e2e that tested the retry had been
failing on every run, which was filed as environment noise.

This is also what a player meets after every deployment: the open tab asks for chunks whose hashed names no
longer exist (every merge to the deployed branch replaces them) and stays stuck until the tab is reloaded.

Fix: the button is now **"Recargar y reintentar"**. It marks the mission in `sessionStorage` and reloads; the app
reads the mark once and reopens that mission (`src/app/reopen.ts`). The message names both causes (connection, or
a new version while the tab was open). Covered by unit tests of the helper and by the e2e that failed before.

Not verified: the live deployment itself. The environment this was written in cannot reach it, so the cause there
is inferred from the behaviour above, not observed.

## What keeps it fixed

`e2e/accessibility.spec.ts` scans the map, a world, progress, briefing, strategy, lab (after a passing run) and
debrief on both sizes and fails on any violation, on any sideways scroll, and on a touch target under 40 px. It
was checked against the old CSS: it fails there, on exactly the contrast and the sideways scroll above.
A sweep of the 37 missions (briefing, strategy and lab at 390 px) found no overflow.

## Also changed

`vitest.config.ts` raises the default hook and test timeouts (60 s / 30 s). Several suites validate the whole
content corpus, which no longer fits in vitest's 10 s default on a slow machine; `mission-flow.test.ts` was failing
for that reason alone.

## Not covered

- No screen-reader walkthrough, no keyboard-only walkthrough beyond what axe checks, no reduced-motion review of the
  briefing animations, no light theme.
- The 3D world gems on the map are decorative and were not audited for performance on low-end phones.
- axe finds roughly a third of accessibility problems. A scan with no violations is the floor, not a verdict.
