/* Lightweight test runner — zero dependencies. Run: node tests/engine.test.js */
const Aegis = require('../src/engine.js');

let passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log(`  \u2713 ${name}`); }
  else { failed++; console.log(`  \u2717 ${name}`); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const BLUEPRINT = [
  { templateId: 'speed_dst', points: 1 },
  { templateId: 'compound_interest', points: 2 },
  { templateId: 'series_next', points: 1 },
  { templateId: 'big_o', points: 1 },
];

console.log('\nDeterminism');
{
  const a = Aegis.generateExam(BLUEPRINT, 'student-A');
  const b = Aegis.generateExam(BLUEPRINT, 'student-A');
  assert('same seed -> identical prompts', eq(a.items.map(i => i.prompt), b.items.map(i => i.prompt)));
}

console.log('\nUniqueness across students (anti-cheating)');
{
  const a = Aegis.generateExam(BLUEPRINT, 'student-A');
  const b = Aegis.generateExam(BLUEPRINT, 'student-B');
  const diff = a.items.filter((it, i) => it.prompt !== b.items[i].prompt).length;
  assert('different seeds -> different questions', diff >= 2);
}

console.log('\nGrading correctness');
{
  const exam = Aegis.generateExam(BLUEPRINT, 'grade-test');
  // Answer everything correctly using the known correctIndex.
  const perfect = exam.items.map(it => it.correctIndex);
  const r1 = Aegis.gradeExam(exam, perfect);
  assert('all-correct -> 100%', r1.percentage === 100);

  // Answer everything wrong.
  const wrong = exam.items.map(it => (it.correctIndex + 1) % it.options.length);
  const r2 = Aegis.gradeExam(exam, wrong);
  assert('all-wrong -> 0 score', r2.score === 0);
  assert('wrong answers surface a misconception', r2.results.some(r => r.misconception));
}

console.log('\nNumeric answers actually solve correctly');
{
  // Independently verify the math of the speed question.
  const it = Aegis.generateItem('speed_dst', 'math-check', 0);
  const m = it.prompt.match(/covers (\d+) km in (\d+) hours/);
  const expected = Math.round((Number(m[1]) / Number(m[2])) * 100) / 100;
  assert('engine answer matches independent calc', Math.abs(it.answer - expected) < 0.011);
}

console.log('\nPsychometrics (item analysis)');
{
  // Synthetic cohort: strong students get hard item right, weak get it wrong
  // -> Q1 should show positive discrimination.
  const cohort = [];
  for (let i = 0; i < 50; i++) {
    const strong = i < 25;
    const perItem = [strong ? 1 : 0, strong ? 1 : (i % 2), 1, i % 2];
    cohort.push({ totalScore: perItem.reduce((a, b) => a + b, 0), perItemCorrect: perItem });
  }
  const a = Aegis.itemAnalysis(cohort, 4);
  assert('discriminating item has positive point-biserial', a[0].discrimination > 0.3);
  assert('difficulty index within [0,1]', a.every(x => x.difficultyIndex >= 0 && x.difficultyIndex <= 1));
}

console.log('\nIntegrity scoring (privacy-first, explainable)');
{
  const clean = Aegis.integrityScore({
    totalTimeSec: 600, expectedMinSec: 400,
    items: [{ timeSec: 150, pasteEvents: 0, focusLost: 0 }],
  });
  assert('clean session -> clear band', clean.band === 'clear');

  const sus = Aegis.integrityScore({
    totalTimeSec: 30, expectedMinSec: 400,
    items: [{ timeSec: 5, pasteEvents: 3, focusLost: 4 }],
  });
  assert('suspicious session -> high band', sus.band === 'high');
  assert('every flag has a human-readable reason', sus.reasons.length > 0);
}

console.log('\nExpanded template library');
{
  const ids = ['percentage', 'kinematics', 'molarity', 'synonym', 'big_o', 'speed_dst', 'compound_interest', 'series_next', 'geometry_svg'];
  assert('9 templates registered', ids.every(id => Aegis.TEMPLATES[id]));
  // every template produces a solvable item with a valid correctIndex
  let allValid = true;
  for (const id of ids) {
    const it = Aegis.generateItem(id, 'tpl-check', 0);
    if (it.correctIndex < 0 || it.correctIndex >= it.options.length) allValid = false;
    if (!it.prompt || !it.solution) allValid = false;
  }
  assert('every template yields a valid, solvable item', allValid);

  // verify physics math independently
  const k = Aegis.generateItem('kinematics', 'phys', 0);
  const m = k.prompt.match(/at (\d+) m\/s and accelerates at (\d+) m\/s. for (\d+) s/);
  const expected = Number(m[1]) + Number(m[2]) * Number(m[3]);
  assert('kinematics answer matches v = u + at', k.answer === expected);
}

console.log('\nSafe arithmetic evaluator (no eval)');
{
  const e = Aegis.safeEval;
  assert('respects operator precedence', e('2 + 3 * 4', {}) === 14);
  assert('handles parentheses', e('(2 + 3) * 4', {}) === 20);
  assert('right-associative power', e('2 ^ 3 ^ 2', {}) === 512);
  assert('substitutes variables', e('speed * time', { speed: 60, time: 3 }) === 180);
  let threw = false;
  try { e('a + 1', {}); } catch (_) { threw = true; }
  assert('rejects unknown variables', threw);
}

console.log('\nBlueprint Studio (teacher-authored templates)');
{
  const spec = {
    id: 'studio_distance',
    subject: 'Physics',
    difficulty: 2,
    promptTemplate: 'A {object} travels at {speed} km/h for {time} h. Distance covered (km)?',
    variables: {
      speed: { min: 20, max: 100, step: 10 },
      time: { min: 1, max: 5, step: 1 },
      object: { set: ['car', 'train', 'cyclist'] },
    },
    answerFormula: 'speed * time',
    unit: 'km',
    decimals: 0,
    distractors: [
      { formula: 'speed + time', why: 'Added instead of multiplied' },
      { formula: 'speed / time', why: 'Divided instead of multiplied' },
    ],
  };
  const variants = Aegis.previewStudioTemplate(spec, 5);
  assert('studio preview returns 5 variants', variants.length === 5);
  // verify the generated answer matches speed*time for each variant
  let mathOk = true;
  for (const v of variants) {
    const m = v.prompt.match(/at (\d+) km\/h for (\d+) h/);
    if (Number(m[1]) * Number(m[2]) !== v.answer) mathOk = false;
  }
  assert('studio answers always equal speed × time', mathOk);

  // register and run in a real exam alongside built-ins
  Aegis.registerStudioTemplate(spec);
  const exam = Aegis.generateExam([{ templateId: 'studio_distance', points: 1 }], 'studio-exam');
  assert('studio template runs inside a real exam', exam.items[0].subject === 'Physics');
  const g = Aegis.gradeExam(exam, [exam.items[0].correctIndex]);
  assert('studio item grades correctly', g.percentage === 100);
}

console.log('\nVisual/diagrammatic template (parameterized SVG)');
{
  const it = Aegis.generateItem('geometry_svg', 'geo-1', 0);
  assert('geometry item includes an SVG figure', typeof it.svg === 'string' && it.svg.includes('<svg'));
  // self-contained = no external resource loads (xmlns namespace URL is fine)
  assert('SVG is self-contained (no external loads)', !/xlink:href|<image|url\(http/.test(it.svg));
  // verify area = 1/2 * base * height independently
  const m = it.prompt.match(/base = (\d+), height = (\d+)/);
  const expected = Math.round((Number(m[1]) * Number(m[2])) / 2 * 10) / 10;
  assert('geometry answer matches ½·base·height', it.answer === expected);
  // different students get different diagrams
  const a = Aegis.generateItem('geometry_svg', 'geo-A', 0);
  const b = Aegis.generateItem('geometry_svg', 'geo-B', 0);
  assert('different students get different diagrams', a.svg !== b.svg);
}

console.log('\nExtracted evaluator module (src/evaluator.js)');
{
  const { safeEval } = require('../src/evaluator.js');
  assert('module exports safeEval', typeof safeEval === 'function');
  assert('engine and module agree', Aegis.safeEval('a*b+2', { a: 3, b: 4 }) === safeEval('a*b+2', { a: 3, b: 4 }));
}

console.log('\nEvaluator depth: unary minus, functions, constants');
{
  const e = Aegis.safeEval;
  assert('unary minus at start', e('-5 + 2', {}) === -3);
  assert('unary minus after operator', e('3 * -2', {}) === -6);
  assert('unary minus on variable', e('-x', { x: 7 }) === -7);
  assert('sqrt function', e('sqrt(a^2 + b^2)', { a: 3, b: 4 }) === 5);
  assert('nested functions', e('abs(-floor(3.7))', {}) === 3);
  assert('min/max two-arg', e('max(min(2,9), 1)', {}) === 2);
  assert('pi constant within tolerance', Math.abs(e('pi', {}) - Math.PI) < 1e-9);
  let threw = false;
  try { e('alert(1)', {}); } catch (_) { threw = true; }
  assert('rejects unknown function (injection guard)', threw);
  let threw2 = false;
  try { e('2 + @', {}); } catch (_) { threw2 = true; }
  assert('rejects stray symbols', threw2);
}

console.log('\nEvaluator hardening: scientific notation, variadic args, arity errors');
{
  const e = Aegis.safeEval;
  assert('scientific notation 1.5e-3', Math.abs(e('1.5e-3', {}) - 0.0015) < 1e-12);
  assert("Avogadro 6.022e23", Math.abs(e('6.022e23', {}) - 6.022e23) < 1e9);
  assert('uppercase E exponent', e('2.5E2', {}) === 250);
  assert('variadic max(1,2,3) === 3', e('max(1,2,3)', {}) === 3);
  assert('variadic min(5,2,8,1) === 1', e('min(5,2,8,1)', {}) === 1);
  let a1 = false; try { e('sqrt(1,2)', {}); } catch (_) { a1 = true; }
  assert('fixed-arity function rejects extra args', a1);
  let a2 = false; try { e('max(1)', {}); } catch (_) { a2 = true; }
  assert('variadic function enforces minimum args', a2);
}

console.log('\nExport escaping (XSS / attribute injection guard)');
{
  const e = require('../export.js');
  // esc is internal; test via buildExamPack output not breaking on quote-y ids
  const html = e.buildExamPack(['a"b', "c'd", 'e<f>'], e.DEFAULT_BLUEPRINT);
  assert('double quotes are escaped', html.includes('&quot;') && !/Candidate: <b>a"b/.test(html));
  assert('single quotes are escaped', html.includes('&#39;'));
  assert('angle brackets escaped in ids', html.includes('e&lt;f&gt;'));
}

console.log('\nRNG quality: 128-bit seed, low collision, uniform-ish');
{
  // No collisions across many distinct seeds for the first output.
  const seen = new Set();
  let collisions = 0;
  for (let i = 0; i < 5000; i++) {
    const v = new Aegis.RNG('student-' + i).float();
    const key = Math.floor(v * 1e9);
    if (seen.has(key)) collisions++;
    seen.add(key);
  }
  assert('first-output collisions are rare across 5000 seeds', collisions <= 2);
  // Determinism preserved after the RNG upgrade.
  const a = new Aegis.RNG('seed-X'); const b = new Aegis.RNG('seed-X');
  assert('same seed reproduces same stream', a.float() === b.float() && a.float() === b.float());
  // Rough uniformity: mean of many draws near 0.5.
  let sum = 0; const r = new Aegis.RNG('uniform'); const N = 20000;
  for (let i = 0; i < N; i++) sum += r.float();
  assert('mean of draws ~0.5', Math.abs(sum / N - 0.5) < 0.02);
}

console.log('\nBlueprint persistence (localStorage-ready JSON)');
{
  const spec = {
    id: 'persist_test', subject: 'Physics', difficulty: 2,
    promptTemplate: 'A car at {speed} km/h for {time} h?', 
    variables: { speed: { min: 10, max: 50, step: 10 }, time: { min: 1, max: 4, step: 1 } },
    answerFormula: 'speed * time', unit: 'km', decimals: 0,
  };
  const json = Aegis.serializeSpec(spec);
  const back = Aegis.deserializeSpec(json);
  assert('round-trips through JSON', back.answerFormula === 'speed * time');
  let threw = false;
  try { Aegis.deserializeSpec('{"id":"x"}'); } catch (_) { threw = true; }
  assert('rejects an invalid blueprint', threw);
}

console.log('\nBulk export (printable pack + master key)');
{
  const { buildExamPack } = require('../export.js');
  const ids = Array.from({ length: 10 }, (_, i) => `cand-${i}`);
  const html = buildExamPack(ids);
  assert('produces a single HTML document', html.startsWith('<!DOCTYPE html>'));
  assert('contains one page per student + master key', (html.match(/class="page/g) || []).length === 11);
  assert('includes the master grading key', html.includes('MASTER GRADING KEY'));
  // every candidate id appears as a labelled paper
  assert('every candidate has a paper', ids.every((id) => html.includes('Candidate: <b>' + id)));
  // basic injection safety: no raw <script> from content
  assert('no stray script injection in output', !/<script(?![^>]*onclick)/.test(html));
}

console.log('\nOMR bridge (scan physical sheet -> regenerate -> grade)');
{
  const { DEFAULT_BLUEPRINT } = require('../export.js');
  const bp = DEFAULT_BLUEPRINT;
  const exam = Aegis.generateExam(bp, 'omr-1');
  const correct = exam.items.map((it) => String.fromCharCode(65 + it.correctIndex));
  const r = Aegis.gradeFromOMR(bp, 'omr-1', correct);
  assert('perfect scanned sheet -> 100%', r.percentage === 100);
  assert('result carries reproducible paperId', r.paperId === 'omr-1');
  // a blank/invalid bubble is graded wrong, not crashed
  const withBlank = correct.slice(); withBlank[0] = '';
  const r2 = Aegis.gradeFromOMR(bp, 'omr-1', withBlank);
  assert('blank bubble counts as incorrect (no crash)', r2.percentage < 100 && r2.results[0].correct === false);
  // batch grading produces a cohort matrix ready for itemAnalysis
  const sheets = [
    { studentId: 's1', answers: Aegis.generateExam(bp, 's1').items.map((it) => String.fromCharCode(65 + it.correctIndex)) },
    { studentId: 's2', answers: Aegis.generateExam(bp, 's2').items.map(() => 'A') },
  ];
  const batch = Aegis.gradeOMRBatch(bp, sheets);
  assert('batch grades every sheet', batch.perStudent.length === 2);
  assert('s1 (all correct) scores full', batch.perStudent[0].percentage === 100);
  assert('cohort matrix feeds itemAnalysis', Aegis.itemAnalysis(batch.cohort, exam.items.length).length === exam.items.length);
}

// Final (async) test: streaming export must equal the in-memory build.
(async () => {
  console.log('\nStreaming export equals in-memory export');
  const { buildExamPack, streamExamPack, DEFAULT_BLUEPRINT } = require('../export.js');
  const ids = ['x1', 'x2', 'x3'];
  const mem = buildExamPack(ids, DEFAULT_BLUEPRINT);
  const tmp = require('path').join(require('os').tmpdir(), 'aegis_stream_test.html');
  await streamExamPack(ids, tmp, DEFAULT_BLUEPRINT);
  const streamed = require('fs').readFileSync(tmp, 'utf8');
  assert('streamed output is byte-identical to in-memory', streamed === mem);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
