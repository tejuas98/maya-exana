# Maya-Exana — Pitch & Speaker Notes

> **Submission format:** the presentation option — `slides.html` is a 15-slide deck (within the limit)
> with the **live demo embedded inside the slides** (real engine, runs offline). Open it, press `F` for
> fullscreen, navigate with arrow keys / Space, and use **Save PDF** for a portable copy.
>
> These are the speaker notes that mirror the deck.

## The one-liner
**Maya-Exana stops exam cheating by making it pointless — not by spying on students.**

## 30-second hook
"Every anti-cheating tool today points a camera at the student — it's invasive, biased, and getting
banned. We went the other way: what if the *exam itself* couldn't be cheated? Maya-Exana gives every student
a mathematically unique paper from the same blueprint, so leaked answers fit no one. It grades instantly,
explains every mistake, and tells examiners which questions are actually broken. It's live right now —
let me show you."

## Slide flow (mirrors `slides.html`)
1. **Title** — Maya-Exana · Fair exams, by design.
2. **Problem** — leaked papers (NEET 2024) + invasive AI proctoring (bias, bans).
3. **Insight** — don't surveil the student; design out the cheating.
4. **How it works** — `(blueprint, studentID) → unique, reproducible paper`; the seed *is* the exam.
5. **Demo 1** — same blueprint, two students, different papers + keys.
6. **Demo 2** — take an exam → instant grade with misconception feedback.
7. **Demo 3** — examiner analytics: difficulty + discrimination, broken-question flagging.
8. **Demo 4** — Blueprint Studio + a parameterized visual (SVG) question.
9. **Why it's not an AI wrapper** — the trust-critical path is verifiable math, zero API calls.
10. **Integrity** — privacy-first, explainable signals; no webcam; a human decides.
11. **Scalability** — pure stateless function → horizontal scaling; streamed bulk export.
12. **Competitive matrix** — Maya-Exana vs. Proctorio vs. Canvas/LMS.
13. **Judging fit** — mapped to the official criteria.
14. **Roadmap** — Round 2 (Delhi) and Round 3 (Japan) plans.
15. **Close** — recap + repo / demo / video links.

## Key facts to state accurately
- **9 question templates across 7 subjects** (Quantitative Aptitude, Logical Reasoning, Physics,
  Chemistry, English/Vocabulary, Geometry (visual), Computer Science).
- **65 passing tests**, zero dependencies, runs in Node and the browser.
- Trust-critical path (generation, grading, psychometrics) makes **zero API calls**.
- **OMR loop:** `gradeFromOMR` grades already-extracted bubble letters by regenerating each paper from
  its seed — the image-to-letters scan step is a standard, solved problem and is out of scope for Round 1.

## What I can demonstrate live
- Generate two unique papers from one blueprint (different seeds).
- Grade an exam and show the named-misconception feedback.
- Run `node tests/engine.test.js` → 65/65 green.
- `node export.js 50` → 50 unique printable papers + master key.

## Honest scope (say this plainly if asked)
- Integrity signals are a **client-side telemetry proxy** today; production needs a sandboxed Web Worker
  with signed payloads (documented in `DESIGN.md`, ADR-003a).
- "OMR" = grade-from-extracted-letters, not image recognition.
- No real-world pilot yet; impact is argued from the problem's scale, not measured.
