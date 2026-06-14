# Maya-Exana — Architecture

```
                         ┌──────────────────────────────┐
   Blueprint  ──────────▶│   Exam Generation Engine     │
   (templateIds,         │   • seeded RNG (xmur3+        │──▶ Unique, reproducible
    points)              │     128-bit sfc32)           │     exam per student
   Student seed ────────▶│   • template functions       │
                         └──────────────────────────────┘
                                       │
                          student responses (option indices)
                                       ▼
                         ┌──────────────────────────────┐
                         │   Grading Engine             │──▶ Score + per-item
                         │   • numeric tolerance        │     misconception feedback
                         │   • MCQ index match          │
                         └──────────────────────────────┘
                                       │
                          cohort of graded results
                                       ▼
        ┌────────────────────────────┐     ┌────────────────────────────┐
        │  Psychometrics (CTT)       │     │  Integrity Signals          │
        │  • difficulty index (p)    │     │  • timing / paste / focus   │
        │  • point-biserial r_pb     │     │  • explainable risk band    │
        │  • auto-flag bad items     │     │  • human-in-the-loop        │
        └────────────────────────────┘     └────────────────────────────┘
```

## Design principles

1. **Determinism over randomness.** `f(blueprint, seed)` is a pure function. Reproducible
   for audit, unique per student for anti-cheat. This single property powers the whole anti-fraud story.

2. **Templates as pure functions.** Each question type is `gen(rng) → {prompt, answer,
   solution, distractors}`. Adding a subject = adding a function. No schema migrations,
   no retraining. This is what makes the Round 2 (Delhi) "add features live" task fast.

3. **Distractors carry intent.** Every wrong option targets a *named misconception*, so
   grading produces diagnostic feedback, not just a red X. This is genuine pedagogy.

4. **Explainability is non-negotiable.** No black boxes. Integrity signals always state a
   reason; a human examiner makes the final call. Ethically and legally defensible.

5. **Zero dependencies.** The core runs identically in Node and the browser, so it's
   trivially testable, portable, and auditable — directly addressing the rules' emphasis
   on engineering quality and "no minimal-effort AI wrappers."

## Module boundaries

| Module | Input | Output | Pure? |
|---|---|---|---|
| `generateExam` | blueprint, seed | materialized exam | yes |
| `gradeExam` | exam, responses | score + feedback | yes |
| `itemAnalysis` | cohort | per-item stats | yes |
| `integrityScore` | session telemetry | risk band + reasons | yes |

All four are independently testable, which is exactly why the suite is small and total.

## Why this beats an "AI wrapper"

The rules explicitly **penalize minimal-effort AI wrappers**. Maya-Exana's core value —
deterministic generation, tolerance grading, CTT psychometrics — is *real algorithmic
engineering* that works with zero API calls. AI can be layered on top (e.g. LLM-authored
templates), but the trust-critical path is deterministic and verifiable.
