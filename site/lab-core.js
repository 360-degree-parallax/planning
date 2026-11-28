/* 도구 계산 엔진 — 6장 실무 도구를 자동화할 때 쓴다(기획 툴에서 재사용 예정). 브라우저(window.LAB)와 node에서 같이 쓴다.
   통계는 외부 라이브러리 없이 구현한다: 정규화 불완전 베타(t·F 분포), 감마(카이제곱), 카플란-마이어, 베타-이항, OLS.
   각 분석 함수는 { rows, summary, notes } 형태로 돌려준다. */
(function (root) {
'use strict';

/* ───── 공통 ───── */
const num = v => { if (v == null || v === '') return NaN; if (typeof v === 'number') return v; const s = String(v).replace(/[,%원\s"]/g, ''); return s === '' ? NaN : Number(s); };
const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => a.length ? sum(a) / a.length : NaN;
const variance = a => { if (a.length < 2) return NaN; const m = mean(a); return sum(a.map(x => (x - m) ** 2)) / (a.length - 1); };
const round = (x, d = 3) => Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x;
const groupBy = (rows, key) => { const m = new Map(); rows.forEach(r => { const k = typeof key === 'function' ? key(r) : r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };

/* CSV 파싱 (따옴표·쉼표·줄바꿈 처리). 첫 줄은 머리글. */
function parseCSV(text) {
  const out = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); out.push(row); }
  const rows = out.filter(r => r.some(x => x.trim() !== ''));
  if (!rows.length) return { header: [], rows: [] };
  const header = rows[0].map(h => h.trim());
  return { header, rows: rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

/* ───── 분포 함수 ───── */
function lgamma(x) { // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function ibeta(x, a, b) { // 정규화 불완전 베타 I_x(a,b)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
const tTwoSidedP = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);
const fUpperP = (F, d1, d2) => F <= 0 ? 1 : ibeta(d2 / (d2 + d1 * F), d2 / 2, d1 / 2);
function gammaincUpper(s, x) { // Q(s,x)
  if (x <= 0) return 1;
  if (x < s + 1) { let ap = s, del = 1 / s, su = del; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; su += del; if (Math.abs(del) < Math.abs(su) * 1e-15) break; } return 1 - su * Math.exp(-x + s * Math.log(x) - lgamma(s)); }
  let b = x + 1 - s, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - s); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break; }
  return Math.exp(-x + s * Math.log(x) - lgamma(s)) * h;
}
const chiUpperP = (x, df) => gammaincUpper(df / 2, x / 2);

/* ───── 검정 ───── */
function welch(a, b) {
  a = a.filter(Number.isFinite); b = b.filter(Number.isFinite);
  const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b);
  const se = Math.sqrt(va / a.length + vb / b.length);
  const t = (mb - ma) / se;
  const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { meanA: ma, meanB: mb, diff: mb - ma, lift: ma ? (mb - ma) / Math.abs(ma) : NaN, t, df, p: tTwoSidedP(t, df), nA: a.length, nB: b.length };
}
function anova(groups) { // groups: {name: [values]}
  const names = Object.keys(groups), all = [].concat(...names.map(n => groups[n]));
  const gm = mean(all); let ssb = 0, ssw = 0;
  names.forEach(n => { const g = groups[n], m = mean(g); ssb += g.length * (m - gm) ** 2; ssw += sum(g.map(x => (x - m) ** 2)); });
  const d1 = names.length - 1, d2 = all.length - names.length, F = (ssb / d1) / (ssw / d2);
  return { F, d1, d2, p: fUpperP(F, d1, d2), means: Object.fromEntries(names.map(n => [n, mean(groups[n])])) };
}

/* ───── 1. 광고 전환 확률 (베이지안: 베타-이항) ───── */
function conversionProbability(rows, { key, trials, successes, prior = 'pooled' }) {
  const g = groupBy(rows, r => key.map(k => r[k]).join(' / '));
  const items = [...g].map(([k, rs]) => ({ key: k, n: sum(rs.map(r => num(r[trials]) || 0)), s: sum(rs.map(r => num(r[successes]) || 0)) })).filter(x => x.n > 0);
  const N = sum(items.map(x => x.n)), S = sum(items.map(x => x.s));
  const p0 = N ? S / N : 0.01, k0 = prior === 'pooled' ? 10 : 2; // 사전 분포: 전체 전환율을 평균으로, 가상 표본 k0
  const a0 = prior === 'pooled' ? Math.max(p0 * k0, 0.01) : 1, b0 = prior === 'pooled' ? Math.max((1 - p0) * k0, 0.01) : 1;
  items.forEach(x => { const a = a0 + x.s, b = b0 + x.n - x.s; x.post = a / (a + b); x.lo = betaQuantile(0.05, a, b); x.hi = betaQuantile(0.95, a, b); x.pBeat = 1 - ibeta(p0, a, b); });
  const totalPost = sum(items.map(x => x.post));
  items.forEach(x => { x.share = x.post / totalPost; x.guide = x.pBeat >= 0.5 ? 'ads cost : raise / similar ads group : create / target : keep / ads content : create' : 'ads cost : keep / similar ads group : update / target : update / ads content : keep'; });
  items.sort((a, b) => b.post - a.post);
  return { rows: items.map(x => ({ '항목': x.key, '시도': x.n, '전환': x.s, '전환 확률(사후 평균)': round(x.post * 100, 2) + '%', '90% 구간': round(x.lo * 100, 2) + '~' + round(x.hi * 100, 2) + '%', '전체 평균을 넘을 확률': round(x.pBeat * 100, 1) + '%', '추천 가이드': x.guide })), summary: { '전체 전환율': round(p0 * 100, 2) + '%', '항목 수': items.length }, raw: items };
}
function betaQuantile(q, a, b) { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ibeta(m, a, b) < q) lo = m; else hi = m; } return (lo + hi) / 2; }

/* ───── 2. 광고 활성화 (생존 분석: 카플란-마이어, 지출=시간, 첫 구매=사건) ───── */
function kaplanMeier(times, events) {
  const d = times.map((t, i) => ({ t, e: events[i] })).sort((a, b) => a.t - b.t);
  let atRisk = d.length, S = 1; const curve = [{ t: 0, S: 1 }];
  const uniq = [...new Set(d.map(x => x.t))];
  uniq.forEach(t => { const at = d.filter(x => x.t === t), ev = at.filter(x => x.e).length; if (ev) S *= (atRisk - ev) / atRisk; curve.push({ t, S, atRisk, events: ev }); atRisk -= at.length; });
  const med = curve.find(p => p.S <= 0.5);
  return { curve, median: med ? med.t : null };
}
function adActivation(rows, { group, spend, purchases }) {
  const g = groupBy(rows, group); const out = [];
  g.forEach((rs, k) => {
    const t = rs.map(r => num(r[spend])), e = rs.map(r => (num(r[purchases]) || 0) > 0);
    const km = kaplanMeier(t, e), totalSpend = sum(t), totalBuy = sum(rs.map(r => num(r[purchases]) || 0));
    out.push({ group: k, n: rs.length, km, totalSpend, totalBuy, cpa: totalBuy ? totalSpend / totalBuy : null });
  });
  out.sort((a, b) => (a.km.median ?? Infinity) - (b.km.median ?? Infinity));
  return { rows: out.map(x => ({ '광고세트·소재': x.group, '광고 수': x.n, '첫 구매까지 지출 중앙값': x.km.median == null ? '도달 안 함' : Math.round(x.km.median), '총 지출': Math.round(x.totalSpend), '총 구매': x.totalBuy, 'CPA': x.cpa ? Math.round(x.cpa) : '-', '판단': x.km.median == null ? '중단 검토 — 지출해도 구매로 이어지지 않음' : '' })), curves: out.map(x => ({ name: x.group, curve: x.km.curve })), raw: out };
}

/* ───── 3. 방문자 스크롤 (깊이별 생존율) ───── */
function scrollRetention(rows, { page, depth, users, minUsers = 30 }) {
  const g = groupBy(rows, page); const out = [];
  g.forEach((rs, k) => {
    rs = rs.map(r => ({ d: num(r[depth]), u: num(r[users]) })).filter(r => Number.isFinite(r.d)).sort((a, b) => a.d - b.d);
    const base = rs[0]?.u || 0; const drops = [];
    rs.forEach((r, i) => { r.ret = base ? r.u / base : 0; r.drop = i ? (rs[i - 1].u - r.u) / (rs[i - 1].u || 1) : 0; if (i) drops.push(r.drop); });
    const avgDrop = mean(drops) || 0;
    rs.forEach((r, i) => { r.label = i === 0 ? '시작' : i === rs.length - 1 ? (r.drop > avgDrop ? '종료/유출' : '종료') : (r.drop > avgDrop ? '활성/유출' : '활성/유지'); });
    const worst = rs.slice(1).reduce((m, r) => r.drop > (m?.drop ?? -1) ? r : m, null);
    out.push({ page: k, start: base, end: rs[rs.length - 1]?.u || 0, finish: base ? (rs[rs.length - 1]?.u || 0) / base : 0, worst, steps: rs });
  });
  const kept = out.filter(x => x.start >= minUsers), avg = kept.length ? sum(kept.map(x => x.end)) / sum(kept.map(x => x.start)) : 0;
  kept.forEach(x => { x.flag = x.finish < avg - 0.1 ? '평균보다 많이 빠짐 — 콘텐츠 점검' : ''; });
  kept.sort((a, b) => b.start - a.start);
  return { summary: { '분석 페이지': kept.length + `개 (시작 사용자 ${minUsers}명 이상)`, '평균 페이지 생존율': round(avg * 100, 1) + '%', '제외(표본 부족)': out.length - kept.length }, rows: kept.map(x => ({ '판단': x.flag, '페이지': x.page, '시작 사용자': x.start, '끝까지 본 사용자': x.end, '페이지 생존율': round(x.finish * 100, 1) + '%', '가장 많이 빠지는 구간': x.worst ? `${x.worst.d}% 지점 (−${round(x.worst.drop * 100, 1)}%)` : '-', '흐름': x.steps.map(s => `${s.d}% ${round(s.ret * 100, 1)}% ${s.label}`).join(' → ') })), raw: kept };
}

/* ───── 4. 프로모션 검정 (전·후 웰치 t검정 / 여러 프로모션 분산분석) ───── */
function promotionTest(rows, { metrics, split, splitAt, alpha = 0.05 }) {
  const before = splitAt != null ? rows.slice(0, splitAt) : rows.filter(r => !String(r[split]).match(/^(1|true|y|예|후|on)$/i));
  const after = splitAt != null ? rows.slice(splitAt) : rows.filter(r => String(r[split]).match(/^(1|true|y|예|후|on)$/i));
  return { rows: metrics.map(m => { const w = welch(before.map(r => num(r[m])), after.map(r => num(r[m]))); const ok = w.p < alpha; return { '지표': m, '전 평균': round(w.meanA, 2), '후 평균': round(w.meanB, 2), '변화': round(w.lift * 100, 1) + '%', 't': round(w.t, 2), 'p값': round(w.p, 4), '가설': ok ? '연구가설 채택' : '연구가설 기각', '권고 방안': ok ? (w.diff > 0 ? `광고/프로모션이 ${m} 항목에 효과가 있으므로, 마케팅을 진행한다` : `광고/프로모션 뒤 ${m}이(가) 유의하게 줄었으므로, 원인을 확인한다`) : `${m} 항목에서는 효과를 확인하지 못했으므로, 프로모션을 수정하거나 표본을 늘린다` }; }), summary: { '전 기간': before.length + '일', '후 기간': after.length + '일', '유의수준': alpha } };
}
function promotionCompare(rows, { columns, alpha = 0.05 }) {
  const groups = Object.fromEntries(columns.map(c => [c, rows.map(r => num(r[c])).filter(Number.isFinite)]));
  const a = anova(groups); const ranked = Object.entries(a.means).sort((x, y) => y[1] - x[1]);
  return { rows: ranked.map(([k, v], i) => ({ '프로모션': k, '평균': round(v, 2), '순위': i + 1 })), summary: { F: round(a.F, 3), 'p값': round(a.p, 4), '판단': a.p < alpha ? `프로모션 간 차이가 유의함 — 1위 "${ranked[0][0]}" 중심으로 운영` : '프로모션 간 차이를 확인하지 못함 — 비용이 낮은 쪽을 고르거나 표본을 늘림' } };
}

/* ───── 5. 매체 기여 (소스 정규화 → 전환·가치 점유율, 파레토) ───── */
const normSource = s => String(s).replace(/["()]/g, '').split(/[,/]/)[0].trim().toLowerCase().replace(/^m\./, '').replace(/^www\./, '') || '(none)';
function mediaContribution(rows, { source, conversions, value }) {
  const g = groupBy(rows, r => normSource(r[source]));
  const items = [...g].map(([k, rs]) => ({ k, c: sum(rs.map(r => num(r[conversions]) || 0)), v: sum(rs.map(r => num(r[value]) || 0)) }));
  const C = sum(items.map(x => x.c)), V = sum(items.map(x => x.v)); items.sort((a, b) => b.v - a.v);
  let cum = 0;
  return { rows: items.map(x => { cum += x.v; return { '매체(정리)': x.k, '전환': x.c, '전환 가치': Math.round(x.v), '가치 점유율': round(x.v / V * 100, 1) + '%', '누적': round(cum / V * 100, 1) + '%', '전환당 가치': x.c ? Math.round(x.v / x.c) : '-', '등급': cum / V <= 0.8 ? 'A (핵심 80%)' : cum / V <= 0.95 ? 'B' : 'C (꼬리)' }; }), summary: { '매체 수': items.length, '총 전환': C, '총 가치': Math.round(V) } };
}

/* ───── 6. 문장 주제 분석 (라벨별 핵심 단어: 로그 오즈) ───── */
const STOP = new Set('이 그 저 것 수 등 더 너무 정말 진짜 좀 잘 안 못 다 또 은 는 이 가 을 를 에 의 도 로 으로 와 과 하고 the a an and or is are to of in it this that for with was very'.split(' '));
const tokens = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map(w => w.replace(/(은|는|이|가|을|를|에|의|도|로|으로|와|과|요|다|고|서|네요|어요|해요|했어요)$/u, '')).filter(w => w.length > 1 && !STOP.has(w));
function topicKeywords(rows, { text, label, top = 8 }) {
  const byLabel = groupBy(rows, label); const total = new Map(); let T = 0; const per = new Map();
  byLabel.forEach((rs, k) => { const m = new Map(); let n = 0; rs.forEach(r => tokens(r[text]).forEach(w => { m.set(w, (m.get(w) || 0) + 1); total.set(w, (total.get(w) || 0) + 1); n++; T++; })); per.set(k, { m, n, docs: rs.length }); });
  const V = total.size;
  return { rows: [...per].map(([k, { m, n, docs }]) => { const scored = [...m].map(([w, c]) => { const rest = (total.get(w) - c), restN = T - n; const lo = Math.log((c + 0.5) / (n - c + 0.5 + V)) - Math.log((rest + 0.5) / (restN - rest + 0.5 + V)); return { w, c, lo }; }).filter(x => x.c >= 2 || docs < 20).sort((a, b) => b.lo - a.lo).slice(0, top); return { '주제(라벨)': k, '문장 수': docs, '비중': round(docs / rows.length * 100, 1) + '%', '이 주제만의 단어': scored.map(x => `${x.w}(${x.c})`).join(', ') }; }).sort((a, b) => b['문장 수'] - a['문장 수']), summary: { '문장 수': rows.length, '주제 수': per.size } };
}

/* ───── 7. 연관 상품 (아프리오리 2개 조합: 지지도·신뢰도·향상도) ───── */
function associationRules(baskets, { minSupport = 0.01, minConfidence = 0.1, top = 30 }) {
  const N = baskets.length, c1 = new Map(), c2 = new Map();
  baskets.forEach(b => { const s = [...new Set(b.filter(Boolean))].sort(); s.forEach(i => c1.set(i, (c1.get(i) || 0) + 1)); for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const k = s[i] + '\u0001' + s[j]; c2.set(k, (c2.get(k) || 0) + 1); } });
  const rules = [];
  c2.forEach((c, k) => { if (c / N < minSupport) return; const [a, b] = k.split('\u0001'); [[a, b], [b, a]].forEach(([x, y]) => { const conf = c / c1.get(x), lift = conf / (c1.get(y) / N); if (conf >= minConfidence) rules.push({ x, y, support: c / N, conf, lift }); }); });
  rules.sort((p, q) => q.lift - p.lift || q.conf - p.conf);
  return { rows: rules.slice(0, top).map(r => ({ '이걸 산 사람은': r.x, '이것도 산다': r.y, '지지도': round(r.support * 100, 2) + '%', '신뢰도': round(r.conf * 100, 1) + '%', '향상도': round(r.lift, 2), '판단': r.lift > 1.2 ? '묶음·추천 후보' : r.lift < 1 ? '함께 안 삼' : '약한 연관' })), summary: { '장바구니 수': N, '상품 수': c1.size, '규칙 수': rules.length } };
}

/* ───── 8. 컨조인트 (속성 수준별 부분가치: 더미 회귀) ───── */
function solve(A, b) { const n = A.length; const M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) { M[i][i] = 1e-12; } for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; } } return M.map((r, i) => r[n] / r[i]); }
function ols(X, y, ridge = 1e-6) { const p = X[0].length; const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => sum(X.map(r => r[i] * r[j])) + (i === j && i > 0 ? ridge : 0))); const Xty = Array.from({ length: p }, (_, i) => sum(X.map((r, k) => r[i] * y[k]))); return solve(XtX, Xty); }
function conjoint(rows, { attributes, outcome }) {
  rows = rows.filter(r => Number.isFinite(num(r[outcome])));
  const levels = attributes.map(a => [...new Set(rows.map(r => String(r[a])))]);
  const X = rows.map(r => [1, ...attributes.flatMap((a, i) => levels[i].slice(1).map(l => String(r[a]) === l ? 1 : 0))]);
  const y = rows.map(r => num(r[outcome]));
  const beta = ols(X, y); let k = 1; const parts = [];
  attributes.forEach((a, i) => { const raw = [0, ...levels[i].slice(1).map(() => beta[k++])]; const m = mean(raw); const pw = raw.map(v => v - m); parts.push({ a, levels: levels[i], pw, range: Math.max(...pw) - Math.min(...pw) }); });
  const R = sum(parts.map(p => p.range));
  return { rows: parts.flatMap(p => p.levels.map((l, j) => ({ '속성': p.a, '수준': l, '부분가치': round(p.pw[j], 1), '속성 중요도': round(p.range / R * 100, 1) + '%' }))).sort((x, y) => x['속성'] === y['속성'] ? y['부분가치'] - x['부분가치'] : 0), summary: { '표본': rows.length, '결과 변수': outcome, '가장 중요한 속성': parts.sort((a, b) => b.range - a.range)[0]?.a } };
}

/* ───── 9. 추천 (협업 필터링: 매체×콘텐츠 행렬, 콘텐츠 간 코사인 유사도) ───── */
function recommend(rows, { user, item, value, top = 10 }) {
  const users = [...new Set(rows.map(r => r[user]))], items = [...new Set(rows.map(r => r[item]))];
  const R = new Map(users.map(u => [u, new Map()]));
  rows.forEach(r => { const m = R.get(r[user]); m.set(r[item], (m.get(r[item]) || 0) + (num(r[value]) || 0)); });
  const col = i => users.map(u => R.get(u).get(i) || 0);
  const norm = v => Math.sqrt(sum(v.map(x => x * x))) || 1;
  const vecs = new Map(items.map(i => [i, col(i)]));
  const sim = (a, b) => { const x = vecs.get(a), y = vecs.get(b); return sum(x.map((v, k) => v * y[k])) / (norm(x) * norm(y)); };
  const S = new Map(items.map(i => [i, new Map(items.map(j => [j, i === j ? 0 : sim(i, j)]))]));
  const out = [];
  users.forEach(u => {
    const ru = R.get(u), maxR = Math.max(1, ...ru.values());
    const scores = items.map(i => { let numr = 0, den = 0; ru.forEach((v, j) => { const s2 = S.get(i).get(j); if (s2 > 0) { numr += s2 * (v / maxR); den += s2; } }); const pred = den ? numr / den : 0; const pop = sum(vecs.get(i)) / Math.max(1, ...items.map(k => sum(vecs.get(k)))); return { i, score: pred + pop, used: (ru.get(i) || 0) > 0 }; });
    scores.sort((a, b) => b.score - a.score).slice(0, top).forEach(x => out.push({ '광고 매체': u, '광고 콘텐츠': x.i, '추천 점수 (MAX : 2)': round(x.score, 3), '광고 활용': x.used ? '재추천 (이미 집행)' : '신규추천' }));
  });
  return { rows: out, summary: { '매체 수': users.length, '콘텐츠 수': items.length, '점수': '유사 콘텐츠 기반 예측(최대 1) + 전체 인기도(최대 1)' } };
}

/* ───── A/B 테스트 (2×2 카이제곱 · MDE 판정 · 기간 추정) ───── */
function abTest({ cUsers, cConv, vUsers, vConv, mde = 0.1, alpha = 0.05 }) {
  const pc = cConv / cUsers, pv = vConv / vUsers, delta = (pv - pc) / pc;
  const N = cUsers + vUsers, C = cConv + vConv, cells = [[cConv, cUsers - cConv], [vConv, vUsers - vConv]];
  let chi = 0; cells.forEach((row, i) => row.forEach((o, j) => { const e = ([cUsers, vUsers][i]) * ([C, N - C][j]) / N; if (e > 0) chi += (o - e) ** 2 / e; }));
  const p = chiUpperP(chi, 1), sig = p < alpha;
  return { pc, pv, delta, chi, p, sig, adopt: sig && delta > mde, verdict: sig && delta > mde ? '채택' : '기각', reason: !sig ? `신뢰수준 ${Math.round((1 - alpha) * 100)}% 미달 (p=${round(p, 4)})` : delta <= mde ? `유의하지만 상승률 ${round(delta * 100, 1)}%가 MDE ${round(mde * 100, 1)}% 이하` : `유의하고 상승률 ${round(delta * 100, 1)}%가 MDE를 넘음` };
}
function abDuration({ baseline, mde, variants = 2, dailyUsers, allocation = 1 }) {
  const perVariant = Math.round(16 * baseline * (1 - baseline) / (baseline * mde) ** 2); // 검정력 80%·유의수준 5% 근사 (템플릿 공식)
  const total = perVariant * variants, days = Math.max(1, Math.round(total / (dailyUsers * allocation)));
  return { perVariant, total, days };
}
function ice(rows, mode = 'multiply') {
  const f = { multiply: (i, c, e) => i * c * e, ratio: (i, c, e) => i * c / e, sum: (i, c, e) => i + c + e }[mode];
  return rows.map(r => ({ ...r, score: f(num(r.impact), num(r.confidence), num(r.ease)) })).sort((a, b) => b.score - a.score);
}

/* ───── 10. 오퍼 수락률 (전환 × 유입 4분면 권고) ───── */
function offerAcceptance(rows, { campaign, visitors, conversions, ctr, minVisitors = 5 }) {
  const cs = rows.map(r => num(r[ctr])).filter(Number.isFinite), mc = mean(cs);
  return { rows: rows.map(r => { const v = num(r[visitors]) || 0, c = num(r[conversions]) || 0, t = num(r[ctr]) || 0; const hc = c >= 1 && v >= minVisitors, hv = t > mc; const rec = hc && hv ? '캠페인 운용 및 유사 광고 콘텐츠 진행' : hc ? '캠페인 수정 및 광고 콘텐츠 개선' : hv ? '웹사이트 콘텐츠 개선' : '캠페인 종료 및 수정 권고'; return { '캠페인': r[campaign], '방문자': v, '전환': c, '클릭률': round(t, 2), '분면': (hc ? '높은 전환' : '낮은 전환') + ' · ' + (hv ? '높은 유입' : '낮은 유입'), '권고 사항': rec }; }), summary: { '높은 유입 기준': `클릭률 > 평균 ${round(mc, 2)}`, '높은 전환 기준': `전환 ≥ 1 이고 방문자 ≥ ${minVisitors}` } };
}

/* ───── 11. 클라이언트 맵 (세그먼트별 수익 집계) ───── */
function clientMap(rows, { dims, revenue }) {
  const g = groupBy(rows, r => dims.map(d => r[d] ?? '-').join(' · ')); const V = sum(rows.map(r => num(r[revenue]) || 0));
  const items = [...g].map(([k, rs]) => ({ k, n: rs.length, v: sum(rs.map(r => num(r[revenue]) || 0)) })).sort((a, b) => b.v - a.v);
  return { rows: items.slice(0, 40).map(x => ({ '세그먼트': x.k, '고객 수': x.n, '수익': Math.round(x.v), '점유율': round(x.v / V * 100, 1) + '%', '1인당 수익': Math.round(x.v / x.n) })), summary: { '기준': dims.join(' × '), '세그먼트 수': items.length, '총 수익': Math.round(V) } };
}


/* ───── 마케팅 전략: 가격 · 회계 · 예산 · 예측 · 군집 · UTM ───── */
function pricing({ cost, list, sale }) { // 강의 실습 공식: 할인율 = (1 − 상시판매가/정상가)×100, 원가율 = 원가/가격×100
  const disc = (1 - sale / list) * 100, crList = cost / list * 100, crSale = cost / sale * 100, margin = 100 - disc - crList;
  const ninePrice = p => { const r = Math.round(p / 100) * 100; return r - 10 >= 0 ? r - 10 : p; };
  return { disc, crList, crSale, margin, markup: list / cost, inRange: list / cost >= 2.5 && list / cost <= 5, discOk: disc <= 10, nineSale: ninePrice(sale) };
}
function productAccounting(rows, { name, price, costRate = 0.3, feeRate = 0.04, shipSell = 0, shipBuy = 3300, mktRate = 0.12, cvr = 0.07 }) {
  // 「전체 상품 회계 설계서」 공식 그대로: 매입가=판매가×30%, 수수료=판매가×4%, 이익=판매가−(매입가+수수료+매입배송비+판매배송비),
  // 마케팅비=이익×12%, ROI=이익/(매입가+수수료+판매배송비+매입배송비+마케팅비), 최소ROAS=판매가/이익, 최대ROAS=판매가/마케팅비,
  // 추천 입찰 CPC=이익×추정전환율, 고정비 계산 최소 판매 수=((판매가−이익)/(판매가−마케팅비))×100
  return { rows: rows.map(r => { const C = num(r[price]); if (!Number.isFinite(C)) return null; const D = C * costRate, E = C * feeRate, F = num(r.shipSell ?? shipSell) || shipSell, G = shipBuy, H = C - (D + E + G + F), J = H * mktRate;
    return { '제품명': r[name], '판매가': Math.round(C), '매입가': Math.round(D), '수수료': Math.round(E), '이익': Math.round(H), '이익율': round(H / C * 100, 1) + '%', '판매당 마케팅비': Math.round(J), 'ROI': round(H / (D + E + F + G + J), 2), '최소 ROAS': round(C / H * 100) + '%', '최대 ROAS': round(C / J * 100) + '%', '추천 입찰 CPC': Math.round(H * cvr), '최소 판매 수(고정비)': round((C - H) / (C - J) * 100, 1) }; }).filter(Boolean), summary: { '매입 원가율': costRate * 100 + '%', '수수료': feeRate * 100 + '%', '마케팅비(이익 대비)': mktRate * 100 + '%', '추정 전환율': cvr * 100 + '%', '판단': '최소 ROAS 아래로 떨어지면 팔수록 손해 — 광고 ROAS 목표의 바닥선' } };
}
function budgetSplit({ revenue, adShare = 0.2, months = 12, weights }) {
  const year = revenue * adShare, month = year / months, week = month / 4, day = month / 31; const W = sum(Object.values(weights)) || 1;
  return { year, month, week, day, rows: Object.entries(weights).map(([k, w]) => ({ '매체': k, '비중': round(w / W * 100, 1) + '%', '월 예산': Math.round(month * w / W), '주 예산': Math.round(week * w / W), '일 예산': Math.round(day * w / W) })) };
}
function forecast(rows, { x, y, targets }) { // 엑셀 FORECAST(선형 회귀) ± STEYX(추정 표준오차) — 「주요 성과 예측표」
  const P = rows.map(r => [num(r[x]), num(r[y])]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)); const n = P.length;
  const mx = mean(P.map(p => p[0])), my = mean(P.map(p => p[1])); const sxx = sum(P.map(p => (p[0] - mx) ** 2)), sxy = sum(P.map(p => (p[0] - mx) * (p[1] - my)));
  const b = sxy / sxx, a = my - b * mx, steyx = Math.sqrt(sum(P.map(p => (p[1] - (a + b * p[0])) ** 2)) / (n - 2)); const r2 = 1 - sum(P.map(p => (p[1] - (a + b * p[0])) ** 2)) / sum(P.map(p => (p[1] - my) ** 2));
  return { rows: targets.map(t => ({ [x]: t, '예상 (최소)': Math.round(a + b * t - steyx), '예상 (예측)': Math.round(a + b * t), '예상 (최대)': Math.round(a + b * t + steyx) })), summary: { '데이터': n + '일', '기울기': round(b, 2), 'R²': round(r2, 3), '오차(STEYX)': Math.round(steyx) } };
}
function kmeans(rows, { features, k = 3, iters = 50 }) { // 「퍼널링크」 ③ 집단 분류 군집화 · ④ 특징 추출 (유클리드 거리)
  const X0 = rows.map(r => features.map(f => num(r[f]))).filter(v => v.every(Number.isFinite));
  const mu = features.map((_, j) => mean(X0.map(v => v[j]))), sd = features.map((_, j) => Math.sqrt(variance(X0.map(v => v[j]))) || 1);
  const X = X0.map(v => v.map((x, j) => (x - mu[j]) / sd[j])); const d2 = (a, b) => sum(a.map((x, j) => (x - b[j]) ** 2));
  let C = [X[0]]; while (C.length < k) { const far = X.reduce((m, v) => { const d = Math.min(...C.map(c => d2(v, c))); return d > m.d ? { v, d } : m; }, { d: -1 }); C.push(far.v); }
  let lab = [];
  for (let it = 0; it < iters; it++) { lab = X.map(v => C.reduce((m, c, i) => d2(v, c) < d2(v, C[m]) ? i : m, 0)); C = C.map((c, i) => { const m = X.filter((_, n) => lab[n] === i); return m.length ? features.map((_, j) => mean(m.map(v => v[j]))) : c; }); }
  return { rows: C.map((_, i) => { const m = X0.filter((_, n) => lab[n] === i); const o = { '군집': i + 1, '고객 수': m.length, '비중': round(m.length / X0.length * 100, 1) + '%' }; features.forEach((f, j) => { const v = mean(m.map(x => x[j])); o[f] = round(v, 2); }); const z = features.map((f, j) => [f, (mean(m.map(x => x[j])) - mu[j]) / sd[j]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2); o['특징'] = z.map(([f, v]) => `${f} ${v > 0 ? '높음' : '낮음'}`).join(' · '); return o; }), summary: { '고객 수': X0.length, '군집 수': k, '기준': features.join(', ') } };
}
function utm({ url, source, medium, campaignType, target, content, term, id }) { // 「② UTM 설계」: 캠페인 = 캠페인유형_메인타겟
  const camp = [campaignType, target].filter(Boolean).join('_'); const q = [['utm_id', id || source], ['utm_source', source], ['utm_medium', medium], ['utm_campaign', camp], ['utm_term', term], ['utm_content', content]].filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return (url || '') + (String(url).includes('?') ? '&' : '?') + q;
}
function engagement({ likes = 0, comments = 0, saves = 0, shares = 0, followers }) { const e = (likes + comments + saves + shares) / followers * 100; return { rate: e, good: e >= 5 }; }

const API = { parseCSV, num, mean, variance, welch, anova, ibeta, tTwoSidedP, fUpperP, chiUpperP, kaplanMeier, betaQuantile, ols, normSource, tokens,
  conversionProbability, adActivation, abTest, abDuration, ice, pricing, productAccounting, budgetSplit, forecast, kmeans, utm, engagement, scrollRetention, promotionTest, promotionCompare, mediaContribution, topicKeywords, associationRules, conjoint, recommend, offerAcceptance, clientMap };
if (typeof module !== 'undefined') module.exports = API; else root.LAB = API;
})(typeof window !== 'undefined' ? window : globalThis);
