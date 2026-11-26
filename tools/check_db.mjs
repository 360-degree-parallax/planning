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
  for (const a of c.saju?.also || []) if (!T.funnel_stages[a]) errs.push(`${at} saju.also=${a}`);
  for (const [dim, vals] of Object.entries(c.saju?.segments || {}))
    for (const v of vals) if (!T.segments[dim]?.values.includes(v)) errs.push(`${at} 세그먼트 ${dim}:${v}`);
  if (c.depth === 'deep' && c.saju?.segments_inferred) errs.push(`${at} deep인데 세그먼트를 직접 쓰지 않음 (db/meta/segments.txt)`);
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
    if (h.test?.guardrail && !T.metrics[h.test.guardrail]) errs.push(`${hat} test.guardrail=${h.test.guardrail}`);
    if (c.depth === 'deep' && h.test && !h.test.ice) errs.push(`${hat} deep 실험에 ICE·목표·가드레일 없음 (db/meta/ice.txt)`);
  });
  if (c.depth === 'deep') {
    if (!c.saju?.idea) errs.push(`${at} deep인데 사주 적용 아이디어 없음`);
    if (c.hyps.some(h => h.barrier?.inferred)) errs.push(`${at} deep인데 장벽을 직접 쓰지 않은 가설이 있음`);
    if (!c.hyps.some(h => h.test)) errs.push(`${at} deep인데 검증 실험 없음`);
    if (!c.outcomes.length && !c.outcome_note) warns.push(`${at} deep인데 결과 지표도, 없는 이유(db/meta/no-outcome.txt)도 없음`);
    if (c.outcomes.length && c.outcome_note) errs.push(`${at} 결과 지표가 있는데 no-outcome 사유도 있음`);
  }
}

// 퍼널 설정 (db/funnels/*.json): 단계 순서는 자유, 단계·지표 id는 taxonomy에 있어야 함
import { readdirSync } from 'node:fs';
const funnels = {};
for (const fn of readdirSync(new URL('../db/funnels/', import.meta.url))) {
  const f = JSON.parse(readFileSync(new URL(`../db/funnels/${fn}`, import.meta.url)));
  const at = `[funnel ${fn}]`;
  funnels[f.id] = f;
  if (!Number.isInteger(f.version)) errs.push(`${at} version은 정수`);
  const sid = new Set();
  f.steps.forEach((s, i) => {
    if (sid.has(s.id)) errs.push(`${at} 단계 id 중복 ${s.id}`); sid.add(s.id);
    if (!T.funnel_stages[s.stage]) errs.push(`${at} stage=${s.stage}`);
    if (s.metric && !T.metrics[s.metric]) errs.push(`${at} metric=${s.metric}`);
    if (s.metric && i === f.steps.length - 1) warns.push(`${at} 마지막 단계의 지표는 계산되지 않음`);
  });
  const pi = f.steps.findIndex(s => s.purchase);
  if (pi < 1 || f.steps.filter(s => s.purchase).length !== 1) errs.push(`${at} 구매 단계(purchase)는 하나, 첫 단계가 아니어야 함`);
  if (f.steps.slice(pi + 1).some(s => ['hook_story', 'hook_marketing', 'input', 'checkout'].includes(s.stage)))
    errs.push(`${at} 구매 전 단계가 구매 뒤에 있음`);
}

// 서비스 수치·실험 기록 (db/service)
const byId = Object.fromEntries(d.cases.map(c => [c.id, c]));
for (const name of ['baseline.json', 'baseline.example.json']) {
  const b = JSON.parse(readFileSync(new URL(`../db/service/${name}`, import.meta.url)));
  const at = `[${name}]`, f = funnels[b.funnel];
  if (!f) { errs.push(`${at} 없는 퍼널 ${b.funnel}`); continue; }
  const ids = f.steps.map(s => s.id);
  for (const k of Object.keys(b.reach)) if (!ids.includes(k)) errs.push(`${at} reach에 퍼널에 없는 단계 ${k}`);
  const chk = (reach, w) => {
    let prev = Infinity;
    for (const id of ids) { const v = reach[id]; if (v == null) continue; if (v > prev) warns.push(`${w} ${id} 도달 수가 앞 단계보다 많음`); prev = v; }
  };
  chk(b.reach, at);
  for (const g of b.segments || []) {
    if (!T.segments[g.dim] || !T.segments[g.dim].values.includes(g.value)) errs.push(`${at} 세그먼트 ${g.dim}:${g.value}`);
    chk(g.reach, `${at} ${g.dim}:${g.value}`);
  }
}
for (const name of ['experiments.json', 'experiments.example.json']) {
  for (const x of JSON.parse(readFileSync(new URL(`../db/service/${name}`, import.meta.url)))) {
    const at = `[${name} ${x.id}]`, c = byId[x.case];
    if (!c || !c.hyps[x.hyp - 1]) errs.push(`${at} 사례·가설 ${x.case} ${x.hyp}`);
    if (!T.metrics[x.metric]) errs.push(`${at} metric=${x.metric}`);
    if (!funnels[x.funnel]) errs.push(`${at} 없는 퍼널 ${x.funnel}`);
    if (!['running', 'win', 'lose', 'flat', 'stopped'].includes(x.result)) errs.push(`${at} result`);
    if (!Array.isArray(x.arms) || x.arms.length < 2 || x.arms.some(a => !(a.n > 0) || a.conv > a.n)) errs.push(`${at} arms`);
    if (x.guardrail?.metric && !T.metrics[x.guardrail.metric]) errs.push(`${at} guardrail.metric`);
  }
}
const B = JSON.parse(readFileSync(new URL('../db/benchmarks.json', import.meta.url)));
for (const b of B.items) {
  if (!T.metrics[b.metric]) errs.push(`[benchmark ${b.id}] metric=${b.metric}`);
  if (!url(b.url)) errs.push(`[benchmark ${b.id}] 출처는 https`);
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
