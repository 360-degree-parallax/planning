// node tools/check_db.mjs — 사례 DB 형식·분류 검사 (스키마 v4)
import { readFileSync } from 'node:fs';

const d = JSON.parse(readFileSync(new URL('../db/cases.json', import.meta.url)));
const T = JSON.parse(readFileSync(new URL('../db/taxonomy.json', import.meta.url)));
const V = ['obvious', 'impossible', 'blindspot', 'timing'];
const PASS = { obvious: false, impossible: false, blindspot: true, timing: true };
const P = ['customer', 'timing', 'price', 'channel', 'competitor', 'constraint', 'belief'];
const errs = [], warns = [];
const ids = new Set();
const url = u => /^https:\/\//.test(u);

for (const c of d.cases) {
  const at = `[${c.id}]`;
  if (ids.has(c.id)) errs.push(`${at} id 중복`); ids.add(c.id);
  if (!['real', 'failure', 'practice'].includes(c.kind)) errs.push(`${at} kind`);
  for (const k of ['situation', 'symptom', 'problem']) if (!c.what?.[k]) errs.push(`${at} what.${k} 비어 있음`);
  if (c.verified !== c.refs.length > 0) errs.push(`${at} verified와 refs 불일치`);
  if (c.refs.some(u => !url(u))) errs.push(`${at} refs는 https`);
  if (c.hyps.length < 3) errs.push(`${at} 가설 3개 이상`);
  const pass = c.hyps.filter(h => PASS[h.verdict]).length;
  if (!pass && c.kind !== 'failure') errs.push(`${at} 생존 가설이 없음`);
  if (pass === c.hyps.length) errs.push(`${at} 탈락 가설이 없음`);
  const b = c.business;
  if (!b) errs.push(`${at} business 없음`);
  else {
    if (!T.business_models[b.model]) errs.push(`${at} model=${b.model}`);
    if (!T.stages[b.stage]) errs.push(`${at} stage=${b.stage}`);
    if (!T.markets[b.market]) errs.push(`${at} market=${b.market}`);
  }
  if (!c.problem_metric || !T.metrics[c.problem_metric.id]) errs.push(`${at} problem_metric=${c.problem_metric?.id}`);
  if (!c.saju || !T.funnel_stages[c.saju.stage]) errs.push(`${at} saju.stage=${c.saju?.stage}`);
  for (const o of c.outcomes) {
    if (!T.metrics[o.metric]) errs.push(`${at} outcome metric=${o.metric}`);
    if (!url(o.evidence)) errs.push(`${at} outcome 근거는 https`);
  }
  c.hyps.forEach((h, i) => {
    const hat = `${at} 가설 ${i + 1}`;
    if (!V.includes(h.verdict)) errs.push(`${hat} verdict`);
    if (!P.includes(h.perspective)) errs.push(`${hat} perspective`);
    for (const k of ['text', 'why_not_yet', 'reason']) if (!h[k]) errs.push(`${hat} ${k} 비어 있음`);
    const bt = T.barriers[h.barrier?.type];
    if (!bt) errs.push(`${hat} barrier=${h.barrier?.type}`);
    else if (!bt.verdicts.includes(h.verdict)) errs.push(`${hat} 장벽 ${h.barrier.type}는 ${h.verdict}와 맞지 않음`);
    if (h.barrier?.evidence && !url(h.barrier.evidence)) errs.push(`${hat} barrier 근거는 https`);
    if (h.test && h.test.metric && !T.metrics[h.test.metric]) errs.push(`${hat} test.metric=${h.test.metric}`);
  });
  if (c.depth === 'deep') {
    if (!c.saju?.idea) errs.push(`${at} deep인데 사주 적용 아이디어 없음`);
    if (c.hyps.some(h => h.barrier?.inferred)) errs.push(`${at} deep인데 장벽을 직접 쓰지 않은 가설이 있음`);
    if (!c.hyps.some(h => h.test)) errs.push(`${at} deep인데 검증 실험 없음`);
    if (!c.outcomes.length) warns.push(`${at} deep인데 근거 있는 결과 지표 없음`);
  }
}

const cnt = f => d.cases.reduce((m, c) => { const k = f(c); m[k] = (m[k] || 0) + 1; return m; }, {});
const H = d.cases.flatMap(c => c.hyps);
console.log(`사례 ${d.cases.length}개 · deep ${d.cases.filter(c => c.depth === 'deep').length} · 출처 확인 ${d.cases.filter(c => c.verified).length} · 결과 지표 ${d.cases.reduce((s, c) => s + c.outcomes.length, 0)}건`);
console.log(`가설 ${H.length}개 · 장벽 직접 작성 ${H.filter(h => h.barrier && !h.barrier.inferred).length} · 규칙 추정 ${H.filter(h => h.barrier?.inferred).length}`);
console.log('사주 퍼널 단계', cnt(c => c.saju?.stage));
console.log('문제 지표', cnt(c => c.problem_metric?.id));
console.log('비즈니스 모델', cnt(c => c.business?.model));
if (warns.length) console.log(`경고 ${warns.length}건\n` + warns.join('\n'));
if (errs.length) { console.error(`오류 ${errs.length}건\n` + errs.slice(0, 40).join('\n')); process.exit(1); }
console.log('형식 검사 통과');
