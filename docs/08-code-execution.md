# 08 — Code Execution

Covers deliverable B10. Compares the three options honestly, recommends one for the MVP, and
states exactly what the recommendation does **not** protect against.

---

## 1. Threat model first

The right answer depends on who the attacker is, and the brief is right that a Web Worker alone
is not a security boundary. But "not a security boundary" is only alarming if there is someone
to defend against. So:

| Scenario | Who runs the code | Who could be harmed | Risk |
| --- | --- | --- | --- |
| **A. MVP: player writes their own code, in their own browser** | The user | The user | **Low.** A user attacking their own origin gains nothing they did not already have |
| **B. Shared solutions** (player publishes code others run) | Someone else | Every viewer | **Critical.** Same-origin access means one player's code can read another's progress, or act as them |
| **C. Instructor-authored missions** | Trusted author | Players | **Medium.** Trusted but not audited; a compromised content pipeline becomes an XSS vector |
| **D. User-generated missions** | Anyone | Everyone | **Critical.** Same as B, plus content injection |

**The MVP is scenario A only.** That single fact is what makes a browser-side sandbox defensible.
The moment scenario B, C, or D is on the roadmap, the answer changes — and §7 lists the exact
triggers so that decision is made deliberately rather than by drift.

### What we are protecting, even in scenario A

Even a self-attacking user can hurt us in ways that matter:

1. **Tab lockup** — an infinite loop that freezes the product.
2. **Memory exhaustion** — an allocation that crashes the tab, losing unsaved progress.
3. **Accidental origin writes** — a player's buggy code clearing `localStorage` and destroying
   their own progress.
4. **Output injection** — if we ever render a returned string as HTML, a player's own code
   becomes an XSS against themselves, and against anyone who later views a shared result.

Items 1–3 are engineering problems with engineering answers. Item 4 is a discipline problem: we
never render untrusted output as HTML. Ever.

---

## 2. Option A — Web Worker

### What it actually gives you

| Property | Status |
| --- | --- |
| Separate thread from the UI | ✅ — the page stays responsive |
| Preemption via `worker.terminate()` | ✅ — this is the killer feature for infinite loops |
| No DOM access | ✅ — no `document`, no `window`, no rendering |
| No `localStorage` | ✅ — not available in workers at all |
| Same origin as the page | ❌ — this is the problem |

### What it does not give you

- **Same-origin network access.** `fetch('/api/...')` from a worker sends the user's cookies. A
  malicious script can read same-origin responses.
- **Storage access.** `indexedDB` and `caches` are reachable.
- **Script loading.** `importScripts()` can pull remote code into the worker.
- **A memory limit.** There is no per-worker heap cap in the platform. A runaway allocation can
  take down the tab or the browser.
- **Realm isolation.** Player code runs in the same JS realm as your prelude. `Function`
  constructor escapes any lexical shadowing: `(function(){}).constructor('return fetch')()`.
  Deleting or shadowing globals raises the bar; it does not close the door.

### Hardening (raises the bar, does not seal it)

```js
// adapters/execution/worker/prelude.js — runs before any player code
const BLOCKED = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'importScripts', 'indexedDB', 'caches', 'navigator',
  'postMessage', 'BroadcastChannel', 'SharedWorker'
];
for (const name of BLOCKED) {
  try { delete self[name]; } catch { /* non-configurable: shadow below */ }
  try {
    Object.defineProperty(self, name, {
      value: () => { throw new Error(`${name} is not available`); },
      writable: false, configurable: false
    });
  } catch { /* last resort: leave it, and rely on the review checklist */ }
}
```

**Honest assessment:** this defeats curiosity and accident, not intent. A determined attacker in
the same realm will find `Function` and reconstruct a capability. That is acceptable only because
scenario A has no adversary with anything to gain.

### The CSP cost (the part people miss)

Running arbitrary player code requires `eval` or `new Function`. That means the worker's context
needs `'unsafe-eval'` in the Content Security Policy, and workers typically inherit the document's
CSP. So the MVP's CSP looks like:

```
script-src 'self' 'unsafe-eval';
```

That weakens XSS defence for the **entire application**, not just the sandbox. This is a real,
under-appreciated cost of browser-side execution, and it is the strongest argument for Option C
that does not appear in most comparisons.

**Mitigation for the MVP:** serve the app from a separate origin/subdomain from any authenticated
API, and never place secrets or session cookies on the app origin. If the app origin holds nothing
valuable, `unsafe-eval` costs less.

---

## 3. Option B — Sandboxed iframe

### What it gives you

```html
<iframe sandbox="allow-scripts" src="..."></iframe>
```

Without `allow-same-origin`, the iframe gets an **opaque origin**. That is a genuinely strong
isolation primitive: no access to the parent's cookies, storage, or DOM. Strictly better origin
isolation than a Worker.

### The fatal problem: no preemption

An iframe runs on the page's event loop (or at least under the same process's JS scheduler). A
`sleep`-free infinite loop in the iframe blocks that loop. The parent's `setTimeout` never fires,
so the parent cannot decide to kill it. Removing the iframe from the DOM does not reliably stop
the running script — behaviour varies by browser and is not a contract you can depend on.

**For a product whose most common failure is "the player wrote a loop that never terminates",
an execution sandbox that cannot interrupt a loop is not a sandbox.** This alone disqualifies it.

### The one combination that works

Iframe (opaque origin) **containing** a Worker (preemptible). This is the strongest
browser-only option: origin isolation *and* termination. The cost is three contexts (main →
iframe → worker), a message protocol across each, and a debugging experience that is genuinely
painful. It is roughly 3–4× the adapter code for a threat model the MVP does not have.

**Verdict: correct, over-engineered for scenario A, and worth revisiting only if scenario B
becomes a requirement without a backend.**

---

## 4. Option C — Backend sandbox

### What it gives you

| Property | Mechanism |
| --- | --- |
| Real preemption | Kill the process/container; the client never blocks |
| Real memory limit | cgroups / container limits |
| Real CPU limit | Quotas, wall-clock kill |
| Real isolation | Separate kernel namespace (gVisor/Firecracker) or separate V8 isolate |
| No `unsafe-eval` on the client | Code never runs in the browser |
| Uniform timing | Budgets are measured on hardware you control |
| Auditability | Every submission is logged server-side |

### What it costs

| Cost | Detail |
| --- | --- |
| Infrastructure | A service, a queue, a sandbox runtime, health checks, deploys |
| Latency | Cold start 50 ms (warm V8 isolate) to 800 ms (cold container); plus network RTT |
| Abuse surface | A public endpoint that executes arbitrary code is a DoS magnet. Requires rate limiting, auth, and monitoring **from day one** |
| Money | Per-execution cost, plus idle capacity for responsiveness |
| Complexity | The MVP would need a backend, a deploy pipeline, and an on-call story for a product with zero users |

### Latency is a product decision, not a technical footnote

The lab's feedback loop is the product. At 60 ms per run, a player iterates 20 times in a
minute and stays in flow. At 900 ms, they stop experimenting and start guessing. That difference
is worth more than the security margin for scenario A — and it is exactly the kind of thing that
gets lost in a comparison table.

### Realistic backend options, if chosen

| Runtime | Cold start | Isolation | Notes |
| --- | --- | --- | --- |
| Warm container pool (Docker + seccomp) | ~100–300 ms warm | OS-level | Simplest to build; must cap pool size |
| Firecracker microVM | ~125 ms | Hardware-virtualized | Best isolation per ms; more ops work |
| V8 isolate (`isolated-vm`, Deno) | ~10–50 ms | V8 isolate, not OS | Fast, no OS-level guarantee; escape CVEs are the risk |
| WASM sandbox (QuickJS compiled to WASM) | ~20 ms | WASM linear memory | Strongest *guarantee*, weakest JS compatibility (no full ES2022, no async) |

If we ever need scenario B, **warm Firecracker or a warm container pool** is the answer. WASM is
tempting but breaks the JavaScript contract the curriculum depends on.

---

## 5. Comparison

| Criterion | Worker | Iframe (opaque) | Worker in iframe | Backend |
| --- | --- | --- | --- | --- |
| Stops infinite loops | ✅ terminate | ❌ | ✅ | ✅ |
| Origin isolation | ❌ | ✅ | ✅ | ✅ |
| Memory cap | ❌ | ❌ | ❌ | ✅ |
| Blocks same-origin network | ⚠️ shadow only | ✅ | ✅ | ✅ |
| Client CSP needs `unsafe-eval` | ❌ yes | ❌ yes | ❌ yes | ✅ no |
| Latency | ~10–30 ms | ~10–30 ms | ~30–50 ms | 60–900 ms |
| Infra required | none | none | none | service + queue + limits |
| Adapter complexity | low | low | high | high |
| Safe for scenario A | ✅ | ✅ | ✅ | ✅ |
| Safe for scenario B | ❌ | ✅ | ✅ | ✅ |
| Cost at zero users | 0 | 0 | 0 | > 0 |

---

## 6. Recommendation

**Use a Web Worker with the hardening prelude, a hard timeout, output caps, and no HTML
rendering of output. Ship the MVP on it. Do not claim it is a security sandbox.**

The reasoning, in one sentence: *for a single-player product where the player runs their own code,
the only real threats are lockups, memory blowups, and self-inflicted storage damage — and the
Worker solves the first completely, the third by removing storage access, and the second
partially. The threat that would demand a backend does not exist yet.*

### Concrete configuration

| Control | Value |
| --- | --- |
| Worker lifetime | One worker per run; `terminate()` after every result |
| Timeout | 2 000 ms default, 400 ms for budgeted missions |
| Output size cap | 1 MB serialized; larger → `E12` with "your function returned too much data" |
| Output rendering | Text only. Never `dangerouslySetInnerHTML`, never `innerHTML` |
| Global hardening | Prelude per §2 |
| CSP | `script-src 'self' 'unsafe-eval'` — documented as a known cost |
| App origin | Separate from any authenticated API origin |

### Time budgets without flakiness

Wall-clock budgets are machine-dependent and will fail a correct solution on a slow laptop. Two
mitigations, both cheap:

1. **Calibration.** At startup, run a fixed reference workload and measure it. Express budgets in
   *calibrated units*, not raw milliseconds. A machine twice as slow gets a budget twice as large.
2. **Generous margins.** A budget should be at least 10× the expected cost of the intended
   solution, so that only a genuinely wrong complexity class fails.

For operation counting, wrap the input array in a `Proxy` that counts indexed reads. It is not
tamper-proof, but it is deterministic and it correlates with comparisons closely enough for
M09/M10 to be honest. Time remains the primary signal; operation count is corroborating evidence.

**Open question (D13).** For an *enforced* budget this ordering may be inverted: wall-clock time
fails correct solutions on a throttled machine, which is exactly what D12 exists to prevent. See
`00-open-decisions.md` D13. Not settled here, and it does not block M1.

### The instrumentation approach for the trace table

Wrap the player's function call in a stepper: call it once with a recording `Proxy` that logs
`(index, value)` per read, and reconstruct the table from the read sequence. Deterministic,
cheap, no model involved.

---

## 7. Migration triggers

Move execution to a backend when **any** of these becomes true. Not before.

| Trigger | Why it forces the move |
| --- | --- |
| Players can share or publish solutions | Scenario B — critical |
| Instructors author missions in-product | Scenario C — content becomes executable |
| Missions become user-generated | Scenario D |
| A mission needs >2 s of legitimate compute | Worker timeouts become product friction |
| Progress moves to accounts | The app origin now holds value, so `unsafe-eval` becomes unacceptable |
| Cheating becomes meaningful (certificates, rankings) | Client-side results are unverifiable |

The adapter boundary (`ExecutionPort`) means the migration is: write `adapters/execution/http/`,
change one line in `composition.ts`, add a service. No domain code changes. That is the payoff
for R3 in `07-architecture.md`.

---

## 8. What we will not claim

This section exists because the brief explicitly warned about it, and because the failure mode is
usually marketing rather than engineering.

- We will **not** describe the Worker as "sandboxed" in user-facing copy or documentation. It is
  "isolated from the page", which is true and narrower.
- We will **not** say player code "cannot access the network". It can, in principle. We block the
  obvious paths and we accept the residual risk under scenario A.
- We will **not** ship shared solutions on this architecture, and we will not quietly add the
  feature "because the adapter makes it easy".
- We will **not** treat the `E13`/`E19` static checks as security controls. They are pedagogical
  lint, trivially bypassable, and they only affect scoring.

---

## 9. Decision required

| Option | Recommendation |
| --- | --- |
| **A. Worker + hardening for MVP** | ✅ **Recommended** (D1) |
| B. Iframe (or worker-in-iframe) | Only if sharing arrives before a backend |
| C. Backend from day one | Only if you decide scenario B/C/D is in the MVP |

If you choose C, the MVP's milestone plan changes substantially: a service, a deploy pipeline,
rate limiting, and an auth story all move into Milestone 1, and the first playable mission slips
by an estimated 2–3 weeks. I do not recommend that trade for a product whose central risk is
pedagogical, not infrastructural.
