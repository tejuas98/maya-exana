# Maya-Exana — GitHub Setup & Submission Steps

This file gives you exact, copy-paste steps to publish the repo and submit on Unstop.
(This file is fine to keep in the repo, or delete it after setup — your call.)

---

## 0. Before you push — what ships vs. what stays local

**Ships to GitHub (16 files):** the engine, evaluator, demo, slides, export, tests, README,
DESIGN.md, docs/ARCHITECTURE.md, docs/PITCH.md, docs/ROADMAP.md, package.json, LICENSE, CI, .gitignore, .nojekyll

**Stays local (gitignored — never published):**
- `AEGIS_*DOSSIER.md` (AI-review dossiers)
- `docs/WINNING_PLAYBOOK.md`, `docs/VIDEO_SCRIPT.md`, `docs/MAYA_EXANA_PPT_GUIDE.md` (your prep notes)
- `exports/` (generated output)

`.gitignore` already handles all of this. Just confirm with `git status` before the first push.

---

## 1. Create the repo on GitHub
1. Go to github.com → New repository.
2. Name: **`maya-exana`**  ·  Description: *Fair exams, by design — FAR AWAY 2026 (Examinations).*
3. Public. Do NOT initialize with a README (you already have one).

## 2. Push in honest, incremental commits (do NOT fake history)
Run these from inside the project folder. Real commits, real timestamps — that's what judges want.

```bash
git init
git add src/engine.js src/evaluator.js
git commit -m "feat: deterministic 128-bit seeded RNG + question templates"

git add tests/engine.test.js
git commit -m "test: engine, evaluator, RNG and grading test suite"

git add export.js
git commit -m "feat: streamed bulk export + OMR grade-from-seed loop"

git add index.html
git commit -m "feat: interactive offline demo (6 tabs)"

git add slides.html
git commit -m "feat: pitch deck with embedded live engine + PDF export"

git add README.md DESIGN.md docs/ package.json LICENSE .gitignore .nojekyll demo.js
git commit -m "docs: README, design decisions, architecture, CI config"

git add .github/workflows/ci.yml
git commit -m "ci: run test suite on every push"

git branch -M main
git remote add origin https://github.com/<your-username>/maya-exana.git
git push -u origin main
```

> If you prefer one simpler flow, at minimum split into 3–4 logical commits. Just never use a single
> `init` / `upload files` commit — that reads as copied code.

## 3. Enable GitHub Pages (so the demo is one click for judges)
1. Repo → Settings → Pages.
2. Source: **Deploy from a branch** → Branch: **main** → Folder: **/(root)** → Save.
3. Wait ~1 min. Your live demo will be at:
   - `https://<your-username>.github.io/maya-exana/index.html`  (interactive demo)
   - `https://<your-username>.github.io/maya-exana/slides.html`  (pitch deck)

## 4. Put the live links in the README
Edit the top of `README.md` and replace the placeholders:
- Live demo: `https://<your-username>.github.io/maya-exana/index.html`
- (Optional) deck: `https://<your-username>.github.io/maya-exana/slides.html`
Commit + push that one change.

## 5. Verify CI is green
Repo → Actions tab → the "CI" workflow should show a green check (it runs `node tests/engine.test.js`).
Add the live Actions badge to README if you want (optional).

## 6. Build the deck (your PPT) and export a PDF
- Build the slides by hand using `docs/MAYA_EXANA_PPT_GUIDE.md` (kept locally).
- OR open `slides.html` → click **Save PDF** to export the existing deck as a portable PDF.
- Capture the real screenshots listed in the guide's Appendix C (rename is done, so they'll say Maya-Exana).

## 7. Submit on Unstop
- **GitHub repository link:** `https://github.com/<your-username>/maya-exana`
- **Project Submission (Presentation option):** upload the **PDF** of your deck (Unstop may reject `.html`).
  - In the submission text, also paste the live demo link so judges can try the interactive version.

## 8. Final pre-submit checks (2 minutes)
- [ ] Repo is **public** (open it in an incognito window).
- [ ] README shows correctly, live demo link works in incognito.
- [ ] `index.html` and `slides.html` load on GitHub Pages.
- [ ] Deck PDF opens and every slide is readable.
- [ ] Repo has multiple real commits (not one).
- [ ] No leftover "Aegis" anywhere a judge sees (it's already clean — quick scan to be safe).
- [ ] Deadline: **14 June 2026, 11:59 PM IST** — submit a few hours early.
```

Run a final self-test before pushing:
```bash
node tests/engine.test.js   # expect: 65 passed, 0 failed
node demo.js                # expect: MAYA-EXANA banner + unique papers
node export.js 50           # expect: exports/exam_pack.html (51 pages)
```
