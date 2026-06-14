# DESIGN.md — Architecture Decision Records

This file documents *why* Maya-Exana is built the way it is. It exists primarily to pre-empt the
most common (and most dangerous) judge question: **"Is this just an AI wrapper?"** No — and
here is the deliberate reasoning.

---

## ADR-001 — The trust-critical path makes ZERO API calls

**Status:** Accepted · **Context:** high-stakes assessment.

**Decision.** Paper generation, grading, and psychometric analysis are implemented as pure,
deterministic functions that make **no network or AI calls whatsoever**. They run identically
offline in Node and in the browser.

**Why this is a feature, not an omission:**

1. **Auditability.** A grade that decides a student's future must be explainable and
   reproducible. An LLM in the grading path is non-deterministic and unauditable — the same
   input can produce different outputs, and you cannot prove *why* a mark was given. A seeded
   deterministic function can be replayed and verified by any third party in minutes.
2. **Integrity.** If the logic that assigns marks depends on a remote model, that model (and
   its prompt) becomes an attack surface and a single point of failure. Pure local math removes
   it entirely.
3. **Cost & scale.** Generating 500,000 unique papers must not mean 500,000 API calls. A pure
   function costs effectively nothing and scales horizontally with zero shared state.
4. **Bias & fairness.** LLM grading inherits model bias. Deterministic numeric/MCQ grading with
   declared tolerances is fair by construction.

**Where AI *is* allowed:** strictly as **optional authoring assistance** — e.g. in Blueprint
Studio, an LLM can *suggest* parameter ranges or misconception labels for a topic. A human
reviews and approves before anything reaches a student. AI never touches the path that decides
a grade.

> **One-line rebuttal to the "AI wrapper" charge:** *"Our integrity-critical path makes zero API
> calls by deliberate architectural choice. AI is optional content tooling, fully separated from
> grading. The math is auditable offline in ten minutes."*

---

## ADR-002 — Determinism as the anti-cheating primitive

**Decision.** `(blueprint, studentSeed) → exam` is a pure function over a seeded RNG: a string ID is
expanded by xmur3 into four 32-bit words that seed a **128-bit sfc32 PRNG**. The 128-bit state space
removes the practical birthday-collision risk of a single 32-bit seed (~4.2B values), so even billions
of student IDs have negligible collision odds.

**Consequence.** Papers are simultaneously **reproducible** (re-generate any student's exact
paper for audit/appeal) and **unique** (different students get different numbers and shuffled
options). A leaked answer key is worthless because it doesn't fit anyone else's paper. We stop
cheating by removing the incentive, not by surveilling the student.

---

## ADR-003 — Privacy-first integrity over AI proctoring

**Decision.** No webcam, no biometrics, no eye/face tracking. Integrity uses consented,
explainable behavioural signals (timing, paste events, focus loss), each emitting a
human-readable reason. A human examiner makes the final call.

**Why.** AI proctoring is documented to be biased (esp. against neurodivergent, disabled, and
darker-skinned students) and is increasingly restricted by courts and data-protection law.
Maya-Exana is legally and ethically defensible by construction: it informs a human, it never accuses.

---

## ADR-003a — Client-side telemetry is a conceptual proxy (known limitation)

**Status:** Accepted, with a documented production path.

**Context.** The browser demo detects paste events, focus loss, and timing via DOM events.
A technically capable student could intercept or override these client-side events (e.g. patch
`addEventListener`, spoof the telemetry object). We state this openly rather than overclaim.

**Decision.** The in-browser signals are a **conceptual proxy** that demonstrates the *model*:
explainable, consented, non-biometric integrity. In production, the trustworthy version:
- runs collection in a **sandboxed Web Worker** isolated from page scripts,
- ships **cryptographically signed, append-only event payloads** (tamper-evident),
- treats every signal as advisory input to a **human examiner**, never an automated verdict.

Crucially, even if telemetry is fully defeated, **the core anti-cheating guarantee still holds**:
unique parameterized papers make a leaked answer key worthless regardless of behaviour monitoring.
Integrity signals are defense-in-depth, not the primary control.

## ADR-004 — Zero runtime dependencies

**Decision.** The entire engine is dependency-free vanilla JavaScript.

**Why.** Auditability (anyone can read the whole engine), portability (Node + browser + offline),
supply-chain safety, and trivially fast cold-start tests. For trust-critical software, fewer
moving parts is a feature.

---

## ADR-005 — Safe expression evaluation in Blueprint Studio

**Decision.** Teacher-authored answer formulas are evaluated by a hand-written shunting-yard
parser (`safeEval`) — **not** `eval()` or `new Function()`.

**Why.** Accepting arbitrary user formulas through `eval` is a code-injection vulnerability.
The custom evaluator supports only a fixed whitelist — arithmetic (`+ - * / % ^`), unary `±`,
parentheses, numbers (incl. scientific notation like `6.022e23`), a set of math functions
(`sqrt, sin, cos, tan, abs, log, ln, exp, round, floor, ceil, min, max, pow`) with enforced argument
counts, constants (`pi, e`), and declared variables. It rejects everything else, including unknown
identifiers and malformed calls. (Known limitation: evaluation is synchronous on the main thread;
a pathological formula could block the UI, so production should evaluate in a Web Worker with a timeout.)

## ADR-006 — Scope of the OMR loop (grade-from-letters, not image OCR)

**Decision.** `gradeFromOMR(blueprint, studentId, ["A","C",...])` and `gradeOMRBatch` accept the
*already-extracted* bubble letters from a scanned sheet, not the scanned image itself.

**Why.** Image → bubble-letters is a standard, well-solved optical-mark-recognition problem (and a
hardware/CV concern outside a solo software builder's Round-1 scope). Maya-Exana's actual contribution is
what happens *after* extraction: regenerating each candidate's exact paper from its seed and grading it
**without ever storing or shipping an answer key**. The seed reconstructs the correct answers on demand,
so the grading step is reproducible and auditable. Wiring a mobile/desktop OMR scanner front-end onto
this interface is a Round-2 task, not a change to the trust-critical logic.
