/* Headless demo: proves the engine end-to-end. Run: node demo.js */
const Aegis = require('./src/engine.js');
const BP = [
  { templateId: 'percentage', points: 1 },
  { templateId: 'speed_dst', points: 1 },
  { templateId: 'compound_interest', points: 2 },
  { templateId: 'kinematics', points: 2 },
  { templateId: 'synonym', points: 1 },
  { templateId: 'big_o', points: 1 },
];
const line = '─'.repeat(70);
console.log('\nMAYA-EXANA — unique-paper demo\n' + line);
for (const id of ['student-1001', 'student-1002']) {
  const ex = Aegis.generateExam(BP, id);
  console.log(`\n${id}:`);
  ex.items.forEach(it =>
    console.log(`  ${it.id} [${it.subject}] ${it.prompt}\n      key: ${String.fromCharCode(65 + it.correctIndex)}`));
}
console.log('\n' + line + '\nSame blueprint, different papers => answer-sharing is useless.\n');

const ex = Aegis.generateExam(BP, 'student-1001');
const g = Aegis.gradeExam(ex, ex.items.map(i => i.correctIndex));
console.log(`Perfect submission scores: ${g.percentage}% (${g.score}/${g.total})`);

console.log('\n' + line + '\nBLUEPRINT STUDIO — teacher authors one question -> infinite variants\n' + line);
const spec = {
  id: 'studio_distance', subject: 'Physics', difficulty: 2,
  promptTemplate: 'A {object} travels at {speed} km/h for {time} hours. Distance (km)?',
  variables: {
    speed: { min: 20, max: 100, step: 10 },
    time: { min: 1, max: 6, step: 1 },
    object: { set: ['car', 'train', 'cyclist', 'bus'] },
  },
  answerFormula: 'speed * time', unit: 'km', decimals: 0,
};
Aegis.previewStudioTemplate(spec, 5).forEach((v, i) =>
  console.log(`  Variant ${i + 1}: ${v.prompt}  ->  ${v.answer} km`));

console.log('\n' + line + '\nITEM ANALYSIS (n=300, with one deliberately broken item)\n' + line);
const cohort = [];
for (let i = 0; i < 300; i++) {
  const a = Math.random();
  const per = BP.map(b => {
    const d = Aegis.RUNTIME_TEMPLATES[b.templateId].difficulty;
    return Math.random() < Math.max(0.05, Math.min(0.97, a - (d - 2) * 0.18 + 0.25)) ? 1 : 0;
  });
  // Q6 is genuinely broken: weak students get it right, strong students get it wrong
  per[5] = (a < 0.5 ? 0.85 : 0.2) > Math.random() ? 1 : 0;
  cohort.push({ totalScore: per.reduce((x, y) => x + y, 0), perItemCorrect: per });
}
Aegis.itemAnalysis(cohort, BP.length).forEach(x =>
  console.log(`  ${x.item}: difficulty=${x.difficultyIndex} discrimination=${x.discrimination} [${x.flag}]`));
console.log();
