# Maya-Exana — Roadmap

The MVP (this repo) is intentionally a **solid, extensible core** rather than a wide-but-shallow
demo. That maps directly onto the FAR AWAY structure: Round 1 proves the engine; Round 2
(Delhi, 24h) adds features live; Round 3 (Japan) polishes to industry level.

## ✅ Round 1 — Online MVP (shipped)

- [x] Deterministic, seeded exam generation (unique paper per student)
- [x] 9 question templates across 7 subjects (Quantitative Aptitude, Logical Reasoning, Physics, Chemistry, English/Vocabulary, Geometry (visual), Computer Science)
- [x] Instant auto-grading with misconception-level feedback
- [x] Classical Test Theory item analysis (difficulty + discrimination, auto-flagging broken items)
- [x] Privacy-first, explainable integrity signals (live in the demo — respond to real paste/tab-switch)
- [x] **Blueprint Studio** — teacher authors a question with {slots} + formula → infinite reproducible variants (safe evaluator, no `eval`)
- [x] Scalability narrative + zero-API architecture decision records (`DESIGN.md`)
- [x] Self-contained interactive demo (`index.html`, 6 tabs) + headless demo + 23-assertion test suite

## 🛠️ Round 2 — Delhi (24h, "add features to your MVP")

Because templates are pure functions, these are fast to ship under time pressure:

- [x] **Bulk export** — `node export.js N` → N unique printable papers + master grading key (PDF-ready), **streamed to disk** so it scales without OOM.
- [x] **Closed paper loop (OMR)** — `gradeFromOMR` / `gradeOMRBatch`: grade scanned sheets by regenerating each paper from its seed (no stored key).
- [x] **Blueprint Studio WYSIWYG** — click-to-insert variable chips + Save/Load blueprint (localStorage).
- [x] **Deeper evaluator** — unary minus, functions (sqrt/sin/cos/abs/min/max/…), constants (pi/e).
- [x] **128-bit RNG** — sfc32 seeded from a full 128-bit state to remove birthday-collision risk.
- [ ] **Examiner dashboard** — manage blueprints, set difficulty mix, export results to CSV.
- [ ] **Adaptive testing (IRT-lite)** — next question difficulty adapts to running ability estimate.
- [ ] **Server persistence** — SQLite/Supabase + REST API so cohorts survive across devices.
- [ ] **React shell** — decouple UI from engine into a component-based front end.

## 🚀 Round 3 — Japan (polish to near-industry level)

- [ ] **LLM-assisted template authoring** — examiner writes a question in plain English;
      an LLM proposes a parameterized template + distractors, human approves. (AI as a tool,
      not the trust path.)
- [ ] **Accessibility pass** — screen-reader support, dyslexia-friendly mode, extra-time profiles.
- [ ] **Multi-language papers** (incl. Japanese 🇯🇵 for the finale — nice narrative touch).
- [ ] **Audit log & cryptographic exam manifests** — verifiable that a paper wasn't tampered with.
- [ ] **Pilot** with a real school/coaching cohort and report measured impact.

## Stretch / differentiation

- Question-bank "health" monitoring over time (drift in difficulty as items leak).
- Plagiarism-resistant free-response grading via rubric + structured checks.
