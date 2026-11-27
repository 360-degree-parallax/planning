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
  if (!c.domain_group) errs.push(`${at} 분야 그룹 없음 (db/meta/domains.txt): ${c.domain}`);
  if (c.source_status === 'disputed' && !c.source_note) errs.push(`${at} disputed인데 이유 없음`);
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
  if (!c.saju?.idea) errs.push(`${at} 사주 적용 아이디어 없음`);
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
  if (!c.trade_on) errs.push(`${at} 트레이드온 없음 (db/meta/tradeon.txt)`);
  if (c.depth === 'deep') for (const [k, f] of [['five_why', 'five-why.txt'], ['pest', 'pest.txt'], ['swot', 'swot-so-wo.txt'], ['goal', 'goal.txt'], ['issue_tree', 'issuetree.txt'], ['pareto', 'pareto.txt'], ['deep_why', 'deep-why.txt'], ['key_metrics', 'key-metrics.txt']]) if (!c[k]) errs.push(`${at} deep인데 ${k} 없음 (db/meta/${f})`);
  if (c.depth === 'deep' && c.pareto && !c.pareto.matrix) errs.push(`${at} deep인데 속도·임팩트 선별 없음 (db/meta/speed-impact.txt)`);
  if (c.depth === 'deep' && c.key_metrics && !c.key_metrics.select_method) errs.push(`${at} deep인데 선별 방법 없음 (db/meta/select-method.txt)`);
  if (c.depth === 'deep' && c.deep_why && !c.deep_why.mode) errs.push(`${at} deep인데 의도 방향 없음 (db/meta/intent-mode.txt)`);
  if (c.depth === 'deep' && c.so_what?.conclusion_auto) errs.push(`${at} deep인데 So what 결론 없음 (db/meta/sowhat-conclusion.txt)`);
  if (c.depth === 'deep' && !c.pro_opinion) errs.push(`${at} deep인데 긍정 오피니언 없음 (db/meta/pro.txt)`);
  if (c.depth === 'deep' && !c.anti_opinion) errs.push(`${at} deep인데 안티오피니언 없음 (db/meta/anti.txt)`);
  if (!c.so_what) errs.push(`${at} so what 체인 없음 (db/meta/sowhat.txt)`);
  else if (c.so_what.steps.length < 2) errs.push(`${at} so what 단계가 2개 미만`);
  if (c.depth === 'deep') {
    if (!c.saju?.idea) errs.push(`${at} deep인데 사주 적용 아이디어 없음`);
    if (c.hyps.some(h => h.barrier?.inferred)) errs.push(`${at} deep인데 장벽을 직접 쓰지 않은 가설이 있음`);
    if (!c.hyps.some(h => h.test)) errs.push(`${at} deep인데 검증 실험 없음`);
    if (new Set(c.hyps.map(h => h.perspective)).size < 3) errs.push(`${at} deep인데 가설 관점이 3개 미만`);
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
const RULES_IDS = new Set(JSON.parse(readFileSync(new URL('../db/compliance.json', import.meta.url))).rules.map(r => r.id));
const byId = Object.fromEntries(d.cases.map(c => [c.id, c]));
const histFiles = ['history', 'history.example'].flatMap(d => readdirSync(new URL(`../db/service/${d}/`, import.meta.url)).filter(f => f.endsWith('.json')).map(f => `${d}/${f}`));
for (const name of ['baseline.json', 'baseline.example.json', ...histFiles]) {
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
const EV = JSON.parse(readFileSync(new URL('../db/service/events.json', import.meta.url)));
const evIds = new Set(EV.events.map(e => e.id));
for (const f of Object.values(funnels)) for (const s of f.steps) if (!evIds.has(s.id)) errs.push(`[events] 퍼널 ${f.id} 단계 ${s.id}의 이벤트 정의 없음`);
const PROD = new Set(JSON.parse(readFileSync(new URL('../db/service/products.json', import.meta.url))).products.map(p => p.id));
const CR = JSON.parse(readFileSync(new URL('../db/service/creatives.json', import.meta.url)));
const crIds = new Set(CR.creatives.map(c => c.id));
for (const c of CR.creatives) if (!CR.fields.page.includes(c.page)) errs.push(`[creative ${c.id}] page=${c.page}`);
const ALIAS = {};
for (const line of readFileSync(new URL('../db/meta/aliases.txt', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('//')) continue;
  const [old, now] = t.split('|').map(x => x.trim());
  if (byId[old]) errs.push(`[aliases] ${old}는 아직 쓰이는 id라 별칭이 될 수 없음`);
  if (!byId[now]) errs.push(`[aliases] ${old} → 없는 id ${now}`);
  ALIAS[old] = now;
}
for (const name of ['experiments.json', 'experiments.example.json']) {
  for (const x of JSON.parse(readFileSync(new URL(`../db/service/${name}`, import.meta.url)))) {
    const at = `[${name} ${x.id}]`, c = byId[ALIAS[x.case] || x.case];
    if (x.product && !PROD.has(x.product)) errs.push(`${at} 없는 상품 ${x.product}`);
    for (const k of ['control', 'variant']) if (x.creatives?.[k] && !crIds.has(x.creatives[k])) errs.push(`${at} 없는 소재 ${x.creatives[k]}`);
    for (const r of x.compliance_checked || []) if (!RULES_IDS.has(r)) errs.push(`${at} 없는 규정 ${r}`);
    if (x.planned_split && (x.planned_split.length !== x.arms.length || Math.abs(x.planned_split.reduce((a, b) => a + b, 0) - 1) > 0.02)) errs.push(`${at} planned_split`);
    for (const a of x.arms) if (('revenue_sum' in a) !== ('revenue_sumsq' in a)) errs.push(`${at} revenue_sum과 revenue_sumsq는 함께`);
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

// 우리 아이디어 Why not yet, 경쟁사, 규정
const COMP = JSON.parse(readFileSync(new URL('../db/saju/competitors.json', import.meta.url)));
const RULES = JSON.parse(readFileSync(new URL('../db/compliance.json', import.meta.url)));
const compIds = new Set(COMP.competitors.map(c => c.id)), ruleIds = new Set(RULES.rules.map(r => r.id));
for (const c of COMP.competitors) {
  for (const k of Object.keys(c.has)) if (!COMP.features[k]) errs.push(`[competitor ${c.id}] 없는 기능 ${k}`);
  if (c.case && !byId[c.case]) errs.push(`[competitor ${c.id}] 없는 사례 ${c.case}`);
  if (!c.sources.length || c.sources.some(u => !url(u))) errs.push(`[competitor ${c.id}] 출처는 https 1개 이상`);
}
for (const r of RULES.rules) if (!r.sources.length || r.sources.some(u => !url(u))) errs.push(`[rule ${r.id}] 출처`);
for (const c of d.cases) {
  const f = c.saju?.fit;
  if (c.depth === 'deep' && !f) errs.push(`[${c.id}] deep인데 적합성 검증 없음 (db/saju/fit.txt)`);
  if (f) {
    if (f.support_factors.length < 1) errs.push(`[${c.id}] fit 지원 조건 1개 이상`);
    const no = f.support_factors.filter(x => x.present === 'no').length;
    if (f.verdict === 'transfer' && no) errs.push(`[${c.id}] fit: 없는 조건이 있는데 transfer`);
    if (f.verdict === 'transfer' && f.problem_match === 'different') errs.push(`[${c.id}] fit: 문제 구조가 다른데 transfer`);
    if (f.verdict === 'reject' && c.saju.wny && c.saju.wny.role !== 'skip') errs.push(`[${c.id}] fit reject인데 아이디어 역할이 skip이 아님`);
  }
  const w = c.saju?.wny, at = `[${c.id}] wny`;
  if (c.depth === 'deep' && !w) errs.push(`${at} deep인데 우리 아이디어 Why not yet 없음 (db/saju/ideas.txt)`);
  if (!w) continue;
  const bt = T.barriers[w.barrier];
  if (!bt || !bt.verdicts.includes(w.verdict)) errs.push(`${at} 장벽 ${w.barrier}와 판정 ${w.verdict} 불일치`);
  if (!['table', 'diff', 'risk', 'skip'].includes(w.role)) errs.push(`${at} role=${w.role}`);
  for (const x of w.competitors) if (!compIds.has(x)) errs.push(`${at} 없는 경쟁사 ${x}`);
  for (const x of w.compliance) if (!ruleIds.has(x)) errs.push(`${at} 없는 규정 ${x}`);
  if (w.role === 'risk' && !w.compliance.length) errs.push(`${at} risk인데 규정 id 없음`);
}

const cnt = f => d.cases.reduce((m, c) => { const k = f(c); m[k] = (m[k] || 0) + 1; return m; }, {});
const H = d.cases.flatMap(c => c.hyps);
console.log(`사례 ${d.cases.length}개 · deep ${d.cases.filter(c => c.depth === 'deep').length} · 출처 확인 ${d.cases.filter(c => c.verified).length} · 결과 지표 ${d.cases.reduce((s, c) => s + c.outcomes.length, 0)}건`);
console.log(`가설 ${H.length}개 · 장벽 직접 작성 ${H.filter(h => h.barrier && !h.barrier.inferred).length} · 규칙 추정 ${H.filter(h => h.barrier?.inferred).length}`);
console.log('사주 퍼널 단계', cnt(c => c.saju?.stage));
console.log('가설 관점', H.reduce((m, h) => (m[h.perspective] = (m[h.perspective] || 0) + 1, m), {}));
console.log('분야 그룹', cnt(c => c.domain_group));
console.log('출처 상태', cnt(c => c.source_status));
console.log('문제 지표', cnt(c => c.problem_metric?.id));
console.log('비즈니스 모델', cnt(c => c.business?.model));
if (warns.length) console.log(`경고 ${warns.length}건\n` + warns.join('\n'));
if (errs.length) { console.error(`오류 ${errs.length}건\n` + errs.slice(0, 40).join('\n')); process.exit(1); }
console.log('형식 검사 통과');
