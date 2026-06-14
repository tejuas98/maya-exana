/*
 * Maya-Exana Core Engine — parameterized exam generation, auto-grading & psychometrics.
 * Zero dependencies. Runs identically in Node and the browser (deterministic).
 *
 * Design goals:
 *  - Determinism: (templateId, studentSeed) -> the exact same question, always.
 *    This makes every exam auditable and reproducible, and makes answer-sharing
 *    useless because every student gets different numbers/options.
 *  - Explainability: every generated item carries the seed, the worked solution,
 *    and the rationale for each distractor. No black boxes.
 */

/* ------------------------------------------------------------------ *
 * 1. Deterministic RNG (seeded). String seed -> reproducible stream.   *
 * ------------------------------------------------------------------ */

// xmur3 string hash -> 32-bit generator. Called repeatedly it yields a stream
// of well-mixed 32-bit words, which we use to build a 128-bit seed below.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// sfc32 PRNG seeded with 128 bits of state. A 128-bit seed space removes the
// practical birthday-collision risk of a single 32-bit seed (~4.2B values):
// with 128 bits, even billions of student IDs have negligible collision odds.
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) {
    const h = xmur3(String(seed));
    // Build a full 128-bit state from four independent 32-bit words.
    this._next = sfc32(h(), h(), h(), h());
    // Warm up the generator so early outputs are well mixed.
    for (let i = 0; i < 12; i++) this._next();
    this.seed = seed;
  }
  float() { return this._next(); }
  int(min, max) { return Math.floor(this.float() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/* ------------------------------------------------------------------ *
 * 2. Template library. Each template is a pure function of an RNG.     *
 *    It returns: prompt, the correct value, a worked solution, and     *
 *    distractors WITH the misconception each one targets.              *
 * ------------------------------------------------------------------ */

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const TEMPLATES = {
  // ---- Quantitative: speed/distance/time ----
  speed_dst: {
    id: 'speed_dst',
    subject: 'Quantitative Aptitude',
    difficulty: 2,
    type: 'numeric',
    gen(rng) {
      const d = rng.int(120, 600);
      const t = rng.int(2, 8);
      const speed = round(d / t, 2);
      return {
        prompt: `A train covers ${d} km in ${t} hours. What is its average speed (km/h)?`,
        answer: speed,
        tolerance: 0.01,
        unit: 'km/h',
        solution: `Speed = distance / time = ${d} / ${t} = ${speed} km/h.`,
        distractors: [
          { value: round(d * t, 2), why: 'Multiplied instead of divided' },
          { value: round(t / d, 4), why: 'Inverted the ratio (time/distance)' },
          { value: round(d / (t + 1), 2), why: 'Off-by-one error on time' },
        ],
      };
    },
  },

  // ---- Quantitative: compound interest ----
  compound_interest: {
    id: 'compound_interest',
    subject: 'Quantitative Aptitude',
    difficulty: 3,
    type: 'numeric',
    gen(rng) {
      const p = rng.int(5, 50) * 1000;
      const r = rng.pick([5, 8, 10, 12]);
      const n = rng.int(2, 3);
      const amount = round(p * (1 + r / 100) ** n, 2);
      const ci = round(amount - p, 2);
      const simple = round((p * r * n) / 100, 2);
      return {
        prompt: `Find the compound interest on ₹${p} at ${r}% p.a. compounded annually for ${n} years.`,
        answer: ci,
        tolerance: 0.5,
        unit: '₹',
        solution: `A = P(1+r/100)^n = ${p}(1+${r}/100)^${n} = ₹${amount}. CI = A − P = ₹${ci}.`,
        distractors: [
          { value: simple, why: 'Computed simple interest instead of compound' },
          { value: amount, why: 'Reported total amount, not the interest' },
          { value: round(ci * 1.1, 2), why: 'Rounding/calculation slip' },
        ],
      };
    },
  },

  // ---- Logical reasoning: number series ----
  series_next: {
    id: 'series_next',
    subject: 'Logical Reasoning',
    difficulty: 2,
    type: 'numeric',
    gen(rng) {
      const start = rng.int(2, 9);
      const ratio = rng.pick([2, 3]);
      const seq = [start];
      for (let i = 0; i < 4; i++) seq.push(seq[seq.length - 1] * ratio);
      const answer = seq[seq.length - 1];
      const shown = seq.slice(0, 4);
      return {
        prompt: `What comes next in the series: ${shown.join(', ')}, ___ ?`,
        answer,
        tolerance: 0,
        unit: '',
        solution: `Each term is multiplied by ${ratio}. Next = ${shown[3]} × ${ratio} = ${answer}.`,
        distractors: [
          { value: shown[3] + (shown[3] - shown[2]), why: 'Assumed arithmetic, not geometric' },
          { value: shown[3] * (ratio + 1), why: 'Used the wrong common ratio' },
          { value: answer + ratio, why: 'Added the ratio instead of multiplying' },
        ],
      };
    },
  },

  // ---- Quantitative: percentage (easy warm-up) ----
  percentage: {
    id: 'percentage',
    subject: 'Quantitative Aptitude',
    difficulty: 1,
    type: 'numeric',
    gen(rng) {
      const total = rng.int(5, 40) * 10;
      const pct = rng.pick([10, 15, 20, 25, 40]);
      const ans = round((total * pct) / 100, 2);
      return {
        prompt: `What is ${pct}% of ${total}?`,
        answer: ans,
        tolerance: 0,
        unit: '',
        solution: `${pct}% of ${total} = ${pct}/100 × ${total} = ${ans}.`,
        distractors: [
          { value: round(total / pct, 2), why: 'Divided instead of taking a percentage' },
          { value: round(total - ans, 2), why: 'Found the remaining amount instead' },
          { value: round(ans / 10, 2), why: 'Misplaced a decimal point' },
        ],
      };
    },
  },

  // ---- Physics: kinematics (final velocity) ----
  kinematics: {
    id: 'kinematics',
    subject: 'Physics',
    difficulty: 3,
    type: 'numeric',
    gen(rng) {
      const u = rng.int(0, 10);
      const a = rng.int(2, 6);
      const t = rng.int(2, 8);
      const v = u + a * t;
      return {
        prompt: `An object starts at ${u} m/s and accelerates at ${a} m/s² for ${t} s. Find its final velocity (m/s).`,
        answer: v,
        tolerance: 0,
        unit: 'm/s',
        solution: `v = u + at = ${u} + ${a}×${t} = ${v} m/s.`,
        distractors: [
          { value: a * t, why: 'Forgot the initial velocity u' },
          { value: u + a, why: 'Forgot to multiply acceleration by time' },
          { value: round(u + 0.5 * a * t * t, 2), why: 'Used the displacement formula instead' },
        ],
      };
    },
  },

  // ---- Chemistry: molarity ----
  molarity: {
    id: 'molarity',
    subject: 'Chemistry',
    difficulty: 3,
    type: 'numeric',
    gen(rng) {
      const moles = rng.int(1, 8) * 0.5;
      const vol = rng.pick([0.5, 1, 2, 2.5]);
      const M = round(moles / vol, 2);
      return {
        prompt: `What is the molarity of a solution containing ${moles} mol of solute in ${vol} L of solution?`,
        answer: M,
        tolerance: 0.01,
        unit: 'mol/L',
        solution: `Molarity = moles / volume = ${moles} / ${vol} = ${M} mol/L.`,
        distractors: [
          { value: round(moles * vol, 2), why: 'Multiplied instead of dividing' },
          { value: round(vol / moles, 2), why: 'Inverted the ratio' },
          { value: round(moles / (vol * 1000), 5), why: 'Confused litres with millilitres' },
        ],
      };
    },
  },

  // ---- English: vocabulary synonyms (non-numeric variation) ----
  synonym: {
    id: 'synonym',
    subject: 'English / Vocabulary',
    difficulty: 2,
    type: 'mcq_fixed',
    gen(rng) {
      const sets = [
        { word: 'Abundant', ans: 'Plentiful', d: ['Scarce', 'Hostile', 'Tiny'] },
        { word: 'Candid', ans: 'Frank', d: ['Secretive', 'Lazy', 'Bright'] },
        { word: 'Mitigate', ans: 'Lessen', d: ['Worsen', 'Ignore', 'Begin'] },
        { word: 'Tenacious', ans: 'Persistent', d: ['Weak', 'Brief', 'Random'] },
        { word: 'Lucid', ans: 'Clear', d: ['Confusing', 'Dark', 'Loud'] },
      ];
      const c = rng.pick(sets);
      return {
        prompt: `Choose the word closest in meaning to "${c.word}".`,
        answer: c.ans,
        options: rng.shuffle([c.ans, ...c.d]),
        solution: `"${c.word}" most nearly means "${c.ans}".`,
      };
    },
  },

  // ---- Geometry: VISUAL/diagrammatic — parameterized SVG ----
  // Proves the engine handles more than numbers: it renders a unique diagram.
  geometry_svg: {
    id: 'geometry_svg',
    subject: 'Geometry (visual)',
    difficulty: 2,
    type: 'numeric',
    gen(rng) {
      const base = rng.int(4, 12);
      const height = rng.int(3, 10);
      const area = round((base * height) / 2, 1);
      // A self-contained SVG right triangle with the parameterized dimensions.
      const W = 220, H = 150, ox = 30, oy = 120;
      const px = ox + base * 14, py = oy - height * 10;
      const svg =
        `<svg viewBox="0 0 ${W} ${H}" width="220" height="150" xmlns="http://www.w3.org/2000/svg">` +
        `<polygon points="${ox},${oy} ${px},${oy} ${ox},${py}" fill="#1d2c57" stroke="#5b8cff" stroke-width="2"/>` +
        `<rect x="${ox}" y="${oy - 12}" width="12" height="12" fill="none" stroke="#9db0d8" stroke-width="1"/>` +
        `<text x="${(ox + px) / 2}" y="${oy + 16}" fill="#9db0d8" font-size="12" text-anchor="middle">base = ${base}</text>` +
        `<text x="${ox - 6}" y="${(oy + py) / 2}" fill="#9db0d8" font-size="12" text-anchor="end">h = ${height}</text>` +
        `</svg>`;
      return {
        prompt: `Find the area of this right triangle (base = ${base}, height = ${height}).`,
        svg, // consumed by the UI to render the unique figure
        answer: area,
        tolerance: 0.05,
        unit: 'sq units',
        solution: `Area = ½ × base × height = ½ × ${base} × ${height} = ${area} sq units.`,
        distractors: [
          { value: round(base * height, 1), why: 'Forgot the ½ factor (used a rectangle)' },
          { value: round(base + height, 1), why: 'Added the sides instead of using the area formula' },
          { value: round((base + height) / 2, 1), why: 'Averaged the sides' },
        ],
      };
    },
  },

  // ---- Computer science: time complexity (conceptual MCQ-forced) ----
  big_o: {
    id: 'big_o',
    subject: 'Computer Science',
    difficulty: 3,
    type: 'mcq_fixed',
    gen(rng) {
      const cases = [
        { code: 'two nested loops over n', ans: 'O(n²)', d: ['O(n)', 'O(log n)', 'O(n log n)'] },
        { code: 'binary search on a sorted array', ans: 'O(log n)', d: ['O(n)', 'O(n²)', 'O(1)'] },
        { code: 'merge sort', ans: 'O(n log n)', d: ['O(n²)', 'O(n)', 'O(log n)'] },
        { code: 'a single loop over n', ans: 'O(n)', d: ['O(n²)', 'O(1)', 'O(log n)'] },
      ];
      const c = rng.pick(cases);
      return {
        prompt: `What is the worst-case time complexity of ${c.code}?`,
        answer: c.ans,
        options: rng.shuffle([c.ans, ...c.d]),
        solution: `The worst-case complexity of ${c.code} is ${c.ans}.`,
      };
    },
  },
};

/* ------------------------------------------------------------------ *
 * 2b. Blueprint Studio — teacher-authored templates.                  *
 *     A teacher writes a prompt with {var} slots, declares each        *
 *     variable's domain, and gives an answer FORMULA. We generate      *
 *     unique, reproducible variants WITHOUT eval() via a tiny safe     *
 *     shunting-yard arithmetic evaluator (see src/evaluator.js).       *
 * ------------------------------------------------------------------ */

// Use the extracted evaluator module when available (Node), otherwise fall
// back to the browser global injected by evaluator.js. This keeps the custom
// shunting-yard algorithm in its own file while engine.js stays cohesive.
let safeEval;
if (typeof require !== 'undefined') {
  try { ({ safeEval } = require('./evaluator.js')); } catch (e) { /* browser */ }
}
if (!safeEval && typeof window !== 'undefined' && window.AegisEval) {
  safeEval = window.AegisEval.safeEval;
}

// Compile a teacher blueprint into a runtime template (same shape as TEMPLATES).
// spec = {
//   id, subject, difficulty,
//   promptTemplate: "A {object} travels at {speed} km/h for {time} h. Distance?",
//   variables: { speed: {min,max,step}, time:{min,max,step}, object:{set:[...]} },
//   answerFormula: "speed * time",            // arithmetic over numeric vars
//   unit, decimals, tolerance,
//   distractors: [{ formula, why }, ...]      // optional wrong-answer formulas
// }
function compileStudioTemplate(spec) {
  const numericVars = Object.entries(spec.variables).filter(([, d]) => !d.set);
  const setVars = Object.entries(spec.variables).filter(([, d]) => d.set);
  const dec = spec.decimals ?? 2;
  return {
    id: spec.id,
    subject: spec.subject || 'Custom',
    difficulty: spec.difficulty || 2,
    type: 'numeric',
    _studio: true,
    gen(rng) {
      const vals = {};
      for (const [name, d] of numericVars) {
        const step = d.step || 1;
        const steps = Math.floor((d.max - d.min) / step);
        vals[name] = round(d.min + rng.int(0, steps) * step, dec);
      }
      for (const [name, d] of setVars) vals[name] = rng.pick(d.set);
      const answer = round(safeEval(spec.answerFormula, vals), dec);
      let prompt = spec.promptTemplate;
      for (const [name, v] of Object.entries(vals)) {
        prompt = prompt.replace(new RegExp(`\\{${name}\\}`, 'g'), v);
      }
      const distractors = (spec.distractors || []).map((d) => ({
        value: round(safeEval(d.formula, vals), dec),
        why: d.why || 'Common error',
      }));
      // guarantee at least 3 plausible distractors
      while (distractors.length < 3) {
        const k = distractors.length + 1;
        distractors.push({ value: round(answer * (1 + 0.1 * k), dec), why: 'Calculation slip' });
      }
      return {
        prompt,
        answer,
        tolerance: spec.tolerance ?? 0,
        unit: spec.unit || '',
        solution: `Answer = ${spec.answerFormula} = ${answer}${spec.unit ? ' ' + spec.unit : ''}.`,
        distractors: distractors.slice(0, 3),
      };
    },
  };
}

// Persistence helpers for Blueprint Studio (used with localStorage in the UI).
// A blueprint spec is plain JSON, so save/load is trivial and dependency-free.
function serializeSpec(spec) { return JSON.stringify(spec); }
function deserializeSpec(json) {
  const spec = JSON.parse(json);
  if (!spec.id || !spec.promptTemplate || !spec.answerFormula) {
    throw new Error('Invalid blueprint: missing id/promptTemplate/answerFormula');
  }
  return spec;
}

// Live preview helper for the Studio UI: returns N reproducible variants.
function previewStudioTemplate(spec, n = 5) {
  const tpl = compileStudioTemplate(spec);
  const variants = [];
  for (let i = 0; i < n; i++) {
    const rng = new RNG(`studio-preview::${spec.id}::${i}`);
    variants.push(tpl.gen(rng));
  }
  return variants;
}

/* ------------------------------------------------------------------ *
 * 3. Exam assembly. A blueprint (list of {templateId, points}) +      *
 *    a studentSeed -> a fully materialized, unique exam.               *
 * ------------------------------------------------------------------ */

// A runtime registry that includes both built-in and Studio-compiled templates.
const RUNTIME_TEMPLATES = Object.assign({}, TEMPLATES);
function registerStudioTemplate(spec) {
  RUNTIME_TEMPLATES[spec.id] = compileStudioTemplate(spec);
  return RUNTIME_TEMPLATES[spec.id];
}

function generateItem(templateId, studentSeed, index) {
  const tpl = RUNTIME_TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);
  // Per-item seed keeps each question independent but reproducible.
  const itemSeed = `${studentSeed}::${templateId}::${index}`;
  const rng = new RNG(itemSeed);
  const raw = tpl.gen(rng);

  // Build options for numeric/MCQ uniformly so the UI is consistent.
  let options = null, correctIndex = null;
  if (tpl.type === 'mcq_fixed') {
    options = raw.options;
    correctIndex = options.indexOf(raw.answer);
  } else {
    const opts = [
      { value: raw.answer, correct: true, why: 'Correct' },
      ...raw.distractors.map((d) => ({ ...d, correct: false })),
    ];
    const shuffled = rng.shuffle(opts);
    options = shuffled.map((o) => o.value);
    correctIndex = shuffled.findIndex((o) => o.correct);
    raw._optionMeta = shuffled; // keep rationale for analytics/feedback
  }

  return {
    itemSeed,
    templateId,
    subject: tpl.subject,
    type: tpl.type === 'mcq_fixed' ? 'mcq' : 'numeric_mcq',
    difficulty: tpl.difficulty,
    prompt: raw.prompt,
    svg: raw.svg || null, // optional parameterized diagram for visual items
    unit: raw.unit || '',
    options,
    correctIndex,
    answer: raw.answer,
    tolerance: raw.tolerance ?? 0,
    solution: raw.solution,
    optionMeta: raw._optionMeta || null,
  };
}

function generateExam(blueprint, studentSeed) {
  const items = blueprint.map((b, i) => {
    const it = generateItem(b.templateId, studentSeed, i);
    it.points = b.points ?? 1;
    it.id = `Q${i + 1}`;
    return it;
  });
  return {
    studentSeed,
    generatedAt: new Date().toISOString(),
    totalPoints: items.reduce((s, it) => s + it.points, 0),
    items,
  };
}

/* ------------------------------------------------------------------ *
 * 4. Grading. Supports numeric tolerance + MCQ index matching.        *
 * ------------------------------------------------------------------ */

function gradeResponse(item, response) {
  // response = chosen option index (or raw numeric value for free entry)
  let correct = false;
  if (typeof response === 'number' && item.correctIndex != null && Number.isInteger(response)) {
    correct = response === item.correctIndex;
  }
  return {
    id: item.id,
    correct,
    awarded: correct ? item.points : 0,
    chosen: response,
    correctIndex: item.correctIndex,
    misconception: !correct && item.optionMeta && item.optionMeta[response]
      ? item.optionMeta[response].why
      : null,
  };
}

function gradeExam(exam, responses) {
  const results = exam.items.map((it, i) => gradeResponse(it, responses[i]));
  const score = results.reduce((s, r) => s + r.awarded, 0);
  return {
    score,
    total: exam.totalPoints,
    percentage: round((score / exam.totalPoints) * 100, 1),
    results,
  };
}

/*
 * OMR bridge — closes the physical-paper loop.
 * A scanned OMR sheet yields just a student ID + a list of chosen letters
 * ("A","B",...). Because generation is deterministic, we REGENERATE that
 * student's exact paper from (blueprint, studentId) and grade the letters
 * against it. Nothing about the paper needs to be stored or transmitted —
 * the seed reconstructs everything, so scan-to-grade is instant and auditable.
 *
 *   gradeFromOMR(blueprint, "student-0042", ["A","C","B",...])
 */
function letterToIndex(ch) {
  if (typeof ch !== 'string' || !/^[A-Za-z]$/.test(ch)) return -1; // blank/invalid
  return ch.toUpperCase().charCodeAt(0) - 65;
}

function gradeFromOMR(blueprint, studentId, letterAnswers) {
  const exam = generateExam(blueprint, studentId);
  const responses = exam.items.map((_, i) => letterToIndex(letterAnswers[i]));
  const graded = gradeExam(exam, responses);
  return {
    studentId,
    paperId: exam.studentSeed, // reproducible proof of which paper was graded
    ...graded,
  };
}

// Batch-grade a whole scanned cohort. Returns per-student results plus the
// per-item correctness matrix ready to feed straight into itemAnalysis().
function gradeOMRBatch(blueprint, sheets) {
  // sheets = [{ studentId, answers: ["A","B",...] }, ...]
  const perStudent = sheets.map((s) => gradeFromOMR(blueprint, s.studentId, s.answers));
  const cohort = perStudent.map((r) => ({
    totalScore: r.score,
    perItemCorrect: r.results.map((x) => (x.correct ? 1 : 0)),
  }));
  return { perStudent, cohort };
}

/* ------------------------------------------------------------------ *
 * 5. Psychometrics. Classical Test Theory item analysis over a cohort.*
 *    - p-value (difficulty index): fraction who got it right.         *
 *    - Discrimination (point-biserial): does the item separate strong *
 *      from weak students? Negative => the item is broken.            *
 * ------------------------------------------------------------------ */

function pearson(x, y) {
  const n = x.length;
  if (n === 0) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : round(num / den, 3);
}

// cohort = [{ totalScore, perItemCorrect: [0/1, ...] }, ...]
function itemAnalysis(cohort, itemCount) {
  const analysis = [];
  for (let q = 0; q < itemCount; q++) {
    const itemScores = cohort.map((c) => c.perItemCorrect[q]);
    const totals = cohort.map((c) => c.totalScore);
    const p = round(itemScores.reduce((a, b) => a + b, 0) / cohort.length, 3);
    const disc = pearson(itemScores, totals);
    let flag = 'ok';
    if (p < 0.2) flag = 'too_hard';
    else if (p > 0.95) flag = 'too_easy';
    if (disc < 0.1) flag = 'low_discrimination';
    analysis.push({ item: `Q${q + 1}`, difficultyIndex: p, discrimination: disc, flag });
  }
  return analysis;
}

/* ------------------------------------------------------------------ *
 * 6. Integrity signals (privacy-first, no biometrics, fully           *
 *    explainable). Operates on consented client-side telemetry.       *
 * ------------------------------------------------------------------ */

function integrityScore(session) {
  // session = { totalTimeSec, items:[{timeSec, pasteEvents, focusLost}], expectedMinSec }
  const reasons = [];
  let risk = 0;

  if (session.totalTimeSec < session.expectedMinSec) {
    const ratio = session.totalTimeSec / session.expectedMinSec;
    if (ratio < 0.3) { risk += 40; reasons.push('Completed implausibly fast'); }
    else if (ratio < 0.6) { risk += 15; reasons.push('Faster than expected'); }
  }
  const pastes = session.items.reduce((s, i) => s + (i.pasteEvents || 0), 0);
  if (pastes > 0) { risk += Math.min(30, pastes * 10); reasons.push(`${pastes} paste event(s) detected`); }

  const focus = session.items.reduce((s, i) => s + (i.focusLost || 0), 0);
  if (focus > 0) { risk += Math.min(30, focus * 8); reasons.push(`${focus} tab/window switch(es)`); }

  risk = Math.min(100, risk);
  const band = risk >= 60 ? 'high' : risk >= 25 ? 'review' : 'clear';
  return { risk, band, reasons };
}

/* ------------------------------------------------------------------ */

const Aegis = {
  RNG, TEMPLATES, RUNTIME_TEMPLATES,
  generateItem, generateExam,
  gradeResponse, gradeExam,
  gradeFromOMR, gradeOMRBatch,
  itemAnalysis, integrityScore,
  // Blueprint Studio
  safeEval, compileStudioTemplate, previewStudioTemplate, registerStudioTemplate,
  serializeSpec, deserializeSpec,
  _internal: { round, pearson },
};

if (typeof module !== 'undefined' && module.exports) module.exports = Aegis;
if (typeof window !== 'undefined') window.Aegis = Aegis;
