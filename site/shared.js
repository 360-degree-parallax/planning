/* 이론 페이지와 DB 페이지가 함께 쓰는 것: 데이터 읽기, 이름표, 단계별 그리기, 테마 */
(function(){
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isUrl = s => typeof s === 'string' && /^https?:\/\//.test(s);
const link = (u, t) => isUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t || host(u))}</a>` : esc(t || u);
function host(u){ try { return new URL(u).hostname.replace(/^www\./, ''); } catch(e){ return u; } }

const L = {
  kind: {real:'실제', failure:'실패', practice:'연습'},
  depth: {deep:'핵심', tagged:'일반'},
  verdict: {obvious:'뻔함', impossible:'불가능', blindspot:'통념의 맹점', timing:'타이밍'},
  pass: {obvious:false, impossible:false, blindspot:true, timing:true},
  persp: {customer:'고객', timing:'시점', price:'가격', channel:'채널', competitor:'경쟁', constraint:'제약', belief:'통념'},
  ansoff: {penetration:'시장침투', product_dev:'신제품개발', market_dev:'시장개척', diversify:'다각화'},
  ansoffDesc: {penetration:'기존 제품 × 기존 시장 · 기본기', product_dev:'신제품 × 기존 시장 · 집중 전략', market_dev:'기존 제품 × 신시장 · 집중 전략', diversify:'신제품 × 신시장 · 어렵지만 최종 목표'},
  cell: {A:'고객만', B:'고객∩경쟁', C:'고객∩자사', D:'셋 다', E:'경쟁∩자사', F:'경쟁만', G:'자사만', H:'밖'},
  quad: {quick_win:'퀵윈', big_bet:'큰 베팅', chore:'잡일', drop:'보류'},
  intent: {revenue:'매출', profit:'이익·원가', retention:'유지·재구매', growth:'신규 성장', risk:'법적·규제 위험', trust:'브랜드 신뢰', mission:'공익·사명'},
  mode: {raise:'올리기', hold:'지키기'},
  bcg: {star:'스타', cash_cow:'캐시카우', question:'물음표', dog:'개', exit:'철수'},
  method: {fgi:'FGI', interview:'인터뷰', observation:'관찰', voc:'VOC', quant:'정량 분석', survey:'설문', experiment:'실험', scoring:'스코어링'},
  pest: {P:['political','정치·법'], E:['economic','경제'], S:['social','사회'], T:['technological','기술']}
};

/* 방법론 순서. id는 이론 페이지 앵커와 같다 */
const STEPS = [
  {id:'five_why', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'5 Why'},
  {id:'what', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'현상 → WHAT'},
  {id:'hyps', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'제한없는 가설'},
  {id:'wny', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'의심 = Why not yet'},
  {id:'so_what', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'관습 파괴 → So what'},
  {id:'pro', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'긍정 오피니언'},
  {id:'anti', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'안티오피니언'},
  {id:'trade_on', g:'WHAT · 1. 문제를 발견한다', k:'WHAT 1', t:'트레이드온'},
  {id:'goal', g:'WHAT · 2. 문제를 구조화한다', k:'WHAT 2', t:'목표 재분석'},
  {id:'issue_tree', g:'WHAT · 2. 문제를 구조화한다', k:'WHAT 2', t:'이슈트리'},
  {id:'pareto', g:'WHAT · 3. 우선순위를 정한다', k:'WHAT 3', t:'파레토'},
  {id:'deep_why', g:'WHAT · 3. 우선순위를 정한다', k:'WHAT 3', t:'대체 왜'},
  {id:'key_metrics', g:'WHAT · 3. 우선순위를 정한다', k:'WHAT 3', t:'중요 지표'},
  {id:'pest', g:'WHY · 4. 분석방법을 정하고 분석한다', k:'WHY 4', t:'PEST'},
  {id:'swot', g:'WHY · 4. 분석방법을 정하고 분석한다', k:'WHY 4', t:'SWOT'},
  {id:'three_c', g:'WHY · 4. 분석방법을 정하고 분석한다', k:'WHY 4', t:'3C 겹침'},
  {id:'ansoff', g:'WHY · 4. 분석방법을 정하고 분석한다', k:'WHY 4', t:'앤소프'},
  {id:'bcg', g:'WHY · 4. 분석방법을 정하고 분석한다', k:'WHY 4', t:'BCG 매트릭스'},
  {id:'solution', g:'HOW · 6. 솔루션을 제안한다', k:'HOW 6', t:'해결·교훈', theory:'integrate'}
];

const KEY = g => { const m = /^(\w+) · (\d)/.exec(g || ''); return m ? m[1] + ' ' + m[2] : (g || ''); };
const tag = (t, cls = '') => `<span class="tag ${cls}">${esc(t)}</span>`;
const srcLine = o => o && (isUrl(o.source) ? `<div class="src">출처: ${link(o.source)}</div>` : `<div class="src">${tag('추정', 'warn')} 사례 내용에서 도출한 해석</div>`);

function venn(entry){
  const pos = {A:[100,38], B:[66,90], C:[134,90], D:[100,108], E:[100,146], F:[44,142], G:[156,142], H:[16,18]};
  const on = new Set(entry || []);
  let s = `<svg viewBox="0 0 200 186" role="img" aria-label="3C 겹침 A~H, 진입 ${esc([...on].join('·'))}">
  <circle cx="100" cy="70" r="56" fill="none" stroke="var(--line2)" stroke-width="1.5"/>
  <circle cx="70" cy="122" r="56" fill="none" stroke="var(--line2)" stroke-width="1.5"/>
  <circle cx="130" cy="122" r="56" fill="none" stroke="var(--line2)" stroke-width="1.5"/>
  <text x="100" y="12" text-anchor="middle" style="font-size:10px;fill:var(--t3)">고객</text>
  <text x="6" y="182" style="font-size:10px;fill:var(--t3)">경쟁</text>
  <text x="194" y="182" text-anchor="end" style="font-size:10px;fill:var(--t3)">자사</text>`;
  for (const [k, [x, y]] of Object.entries(pos)) {
    s += on.has(k) ? `<g class="on"><circle cx="${x}" cy="${y}" r="11" fill="var(--accent)"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" style="fill:#fff">${k}</text></g>` : `<text x="${x}" y="${y + 4.5}" text-anchor="middle">${k}</text>`;
  }
  return s + '</svg>';
}

function paretoPlot(m){
  const X = v => 14 + (v - 1) * 30, Y = v => 136 - (v - 1) * 30;
  let s = `<svg viewBox="0 0 150 150" role="img" aria-label="속도×임팩트">
  <rect x="${X(3.5)}" y="${Y(5.4)}" width="${X(5.4) - X(3.5)}" height="${Y(3.5) - Y(5.4)}" fill="var(--dark)"/>
  <line x1="${X(3.5)}" y1="4" x2="${X(3.5)}" y2="140" stroke="var(--line2)" stroke-dasharray="3 3"/>
  <line x1="10" y1="${Y(3.5)}" x2="148" y2="${Y(3.5)}" stroke="var(--line2)" stroke-dasharray="3 3"/>
  <text x="146" y="148" text-anchor="end">속도 →</text><text x="2" y="10">임팩트</text>
  <text x="${X(4.6)}" y="${Y(5.25)}" text-anchor="middle">퀵윈</text><text x="${X(2.2)}" y="${Y(5.25)}" text-anchor="middle">큰 베팅</text>`;
  const seen = {};
  m.forEach((p, i) => {
    const k = p.speed + ',' + p.impact, o = (seen[k] = (seen[k] || 0) + 1) - 1;
    const x = X(p.speed) + o * 7, y = Y(p.impact) - o * 3;
    s += p.selected ? `<circle cx="${x}" cy="${y}" r="7" fill="var(--accent)"/><text x="${x}" y="${y + 3}" text-anchor="middle" style="fill:#fff;font-weight:800">${i + 1}</text>`
                    : `<circle cx="${x}" cy="${y}" r="7" fill="var(--bg)" stroke="var(--line2)"/><text x="${x}" y="${y + 3}" text-anchor="middle">${i + 1}</text>`;
  });
  return s + '</svg>';
}

/* 단계별로 한 사례의 칸을 그린다 */
const R = {
  five_why(c){ const f = c.five_why; if (!f) return ''; return `<ol class="chain">${(f.whys || []).map(w => `<li>${esc(w)}</li>`).join('')}<li class="end">근본 원인: ${esc(f.root_cause)}</li></ol>`; },
  what(c){ const w = c.what; return `<dl class="kv"><dt>상황</dt><dd>${esc(w.situation)}</dd><dt>증상</dt><dd>${esc(w.symptom)}</dd><dt>문제(WHAT)</dt><dd><b>${esc(w.problem)}</b></dd></dl>`; },
  pest(c){ const p = c.pest; if (!p) return ''; const f = new Set(p.focus || []);
    return `<div class="grid2">${['P','T','E','S'].map(k => `<div class="cell${f.has(k) ? ' on' : ''}"><b>${k} ${L.pest[k][1]}${f.has(k) ? ' · 결정적' : (k === 'E' || k === 'S' ? ' · 참고' : '')}</b>${esc(p[L.pest[k][0]])}</div>`).join('')}</div>${f.size ? '' : '<div class="src">P·T 영향 적음</div>'}`; },
  swot(c){ const s = c.swot; if (!s) return '';
    return `<div class="grid2" style="grid-template-columns:1fr"><div class="cell"><b>SO · 강점(${esc(s.strength)}) → 기회(${esc(s.opportunity)})</b>${esc(s.so)}</div><div class="cell"><b>WO · 약점(${esc(s.weakness)})을 메워 기회로</b>${esc(s.wo)}</div><div class="cell"><b>ST · 강점으로 위협(${esc(s.threat)}) 막기</b>${esc(s.st)}</div></div>`; },
  three_c(c){ const t = c.three_c; if (!t) return ''; const on = new Set(t.entry || []); const o = t.overlap || {};
    return `<div class="venn">${venn(t.entry)}<div class="ovl">${'ABCDEFGH'.split('').map(k => `<div class="${on.has(k) ? 'on' : ''}"><b>${k}</b><span>${L.cell[k]}</span>${esc(o[k] || '-')}</div>`).join('')}</div></div>
    <div class="concl" style="margin-top:10px">진입 ${esc((t.entry || []).join('·'))} — ${esc(t.entry_why)}</div>
    ${t.customer ? `<dl class="kv" style="margin-top:10px"><dt>고객</dt><dd>${esc(t.customer)}</dd><dt>경쟁</dt><dd>${esc(t.competitor)}</dd><dt>자사</dt><dd>${esc(t.company)}</dd><dt>빈자리</dt><dd>${esc(t.gap)}</dd></dl>` : ''}`; },
  ansoff(c){ const a = c.ansoff; if (!a) return ''; const k = a.cell, cl = x => `cell${k === x ? ' on' : ''}`;
    return `<div class="ansoff"><span></span><span class="ax">기존 제품</span><span class="ax">신제품</span>
      <span class="ax">신시장</span><div class="${cl('market_dev')}"><b>시장개척 · 집중</b>기존 제품으로 새 시장</div><div class="${cl('diversify')}"><b>다각화 · 최종 목표</b>신제품으로 신시장</div>
      <span class="ax">기존 시장</span><div class="${cl('penetration')}"><b>시장침투 · 기본기</b>더 깊이</div><div class="${cl('product_dev')}"><b>신제품개발 · 집중</b>신제품으로 기존 시장</div></div>
      <p class="muted" style="margin:10px 0 0"><b>${esc(L.ansoff[k])}</b>${a.focus ? ' ' + tag('집중 전략', 'on') : ''} — ${esc(a.why)}</p>`; },
  bcg(c){ const b = c.bcg; if (!b) return '<p class="muted" style="margin:0">제품이 하나인 회사라 BCG를 쓰지 않는 사례예요. BCG는 제품·사업이 여러 개일 때 포트폴리오를 정리하는 툴이에요.</p>';
    const box = k => { const us = b.units.filter(u => u.cell === k);
      const after = b.after === k && b.before !== k;
      return `<div class="cell${us.some(u => u.name === b.target) || after ? ' on' : ''}"><b>${L.bcg[k]}</b>${us.map(u => esc(u.name) + (u.name === b.target ? ' ◀ 대상(전)' : '')).join('<br>')}${after ? `${us.length ? '<br>' : ''}${esc(b.target)} ▶ 후` : ''}${!us.length && !after ? '<span class="muted">-</span>' : ''}</div>`; };
    return `<div class="ansoff"><span></span><span class="ax">점유율 낮음</span><span class="ax">점유율 높음</span>
      <span class="ax">성장 빠름</span>${box('question')}${box('star')}
      <span class="ax">성장 느림</span>${box('dog')}${box('cash_cow')}</div>
      <p class="muted" style="margin:10px 0 0"><b>${esc(b.target)}: ${L.bcg[b.before]} → ${L.bcg[b.after]}</b>${b.q_to_star ? ' ' + tag('유망주 → 스타', 'on') : ''}${b.after === 'exit' ? ' ' + tag('철수', 'no') : ''} — ${esc(b.why)}</p>
      ${b.funders.length ? `<p class="muted" style="margin:4px 0 0">돈줄(캐시카우): ${b.funders.map(esc).join(', ')}</p>` : ''}
      <p class="src">칸은 그 시점의 판정이에요. 개·철수도, 스타가 될 것 같은 물음표도 미래는 확답하지 않아요.</p>`; },
  hyps(c){ return (c.hyps || []).map((h, i) => `<div class="hyp"><div class="ht"><span>${i + 1}. ${esc(h.text)}</span>${tag(L.persp[h.perspective] || h.perspective)}</div></div>`).join(''); },
  wny(c){ return (c.hyps || []).map((h, i) => { const ok = L.pass[h.verdict];
    return `<div class="hyp"><div class="ht"><span>${i + 1}. ${esc(h.text)}</span>${tag(L.verdict[h.verdict] || h.verdict, ok ? 'ok' : 'no')}${ok ? tag('생존', 'ok') : ''}</div><p>${esc(h.why_not_yet)}</p></div>`; }).join(''); },
  so_what(c){ const s = c.so_what; if (!s) return '';
    return `<p class="muted" style="margin:0 0 8px">의심: ${esc(s.why_not_yet)}</p><ol class="chain">${(s.steps || []).map(x => `<li>그래서? ${esc(x)}</li>`).join('')}</ol>${s.conclusion ? `<div class="concl">So what: ${esc(s.conclusion)}</div>` : ''}<p class="muted" style="margin:8px 0 0">해결: ${esc(s.solution)}</p>`; },
  pro(c){ const o = c.pro_opinion; if (!o) return ''; return `<blockquote class="quote">“${esc(o.says)}”<small>${esc(o.who)}</small></blockquote><p style="margin:8px 0 0;font-size:14px">드러난 본질: <b>${esc(o.reveals)}</b></p>${srcLine(o)}`; },
  anti(c){ const o = c.anti_opinion; if (!o) return ''; return `<blockquote class="quote">“${esc(o.says)}”<small>${esc(o.who)}</small></blockquote><p style="margin:8px 0 0;font-size:14px">놓친 것: <b>${esc(o.reveals)}</b></p>${srcLine(o)}`; },
  trade_on(c){ const t = c.trade_on; if (!t) return ''; return `<dl class="kv"><dt>트레이드오프</dt><dd>${esc(t.tradeoff)}</dd><dt>둘 다 잡기</dt><dd><b>${esc(t.how)}</b></dd></dl>`; },
  goal(c){ const g = c.goal; if (!g) return ''; return `<dl class="kv"><dt>표면 목표</dt><dd>${esc(g.surface)}</dd><dt>재정의</dt><dd><b>${esc(g.reframed)}</b></dd><dt>지표</dt><dd>${esc(g.metric)}</dd></dl>`; },
  issue_tree(c){ const t = c.issue_tree; if (!t) return '';
    return `<div class="tree"><div class="root">${esc(t.root)}</div>${(t.branches || []).map(b => `<div class="br${b.chosen ? ' on' : ''}">${esc(b.issue)}${b.chosen ? ' ← 공략' : ''}<small>${(b.sub || []).map(esc).join(' · ')}</small></div>`).join('')}</div><p class="muted" style="margin:8px 0 0">고른 이유: ${esc(t.why)}</p>`; },
  pareto(c){ const p = c.pareto; if (!p) return ''; const m = p.matrix || [];
    return `${m.length ? `<div class="pm">${paretoPlot(m)}<div class="tscroll"><table class="t" style="margin:0"><tr><th>#</th><th>하위 이슈</th><th>속도</th><th>임팩트</th><th></th></tr>${m.map((r, i) => `<tr class="${r.selected ? 'hi' : ''}"><td>${i + 1}</td><td>${esc(r.issue)}</td><td>${r.speed}</td><td>${r.impact}</td><td>${esc(L.quad[r.quadrant] || r.quadrant)}</td></tr>`).join('')}</table></div></div>` : ''}
    <p style="margin:10px 0 0;font-size:14px">중요한 소수: <b>${esc(p.vital_few)}</b> → ${esc(p.effect)}</p>${srcLine(p)}`; },
  deep_why(c){ const d = c.deep_why; if (!d) return '';
    return `<ol class="chain">${(d.whys || []).map(w => `<li>${esc(w)}</li>`).join('')}<li class="end">진짜 의도(${esc(L.intent[d.type] || d.type)}): ${esc(d.intent)}</li></ol>
    <dl class="kv"><dt>의도 지표</dt><dd>${esc(d.intent_metric)}</dd><dt>방향</dt><dd>${tag(L.mode[d.mode] || d.mode, d.mode === 'hold' ? 'warn' : 'on')} ${esc(d.criterion || '')}</dd></dl>`; },
  key_metrics(c){ const k = c.key_metrics; if (!k) return ''; const sm = k.select_method || {};
    return `<table class="t" style="margin:0"><tr><th>역할</th><th>지표</th></tr><tr><td>의도</td><td>${esc(k.intent_metric || (c.deep_why || {}).intent_metric)}</td></tr><tr><td>북극성</td><td><b>${esc(k.north_star)}</b></td></tr><tr><td>선행</td><td>${(k.leading || []).map(esc).join(', ')}</td></tr><tr><td>가드레일</td><td>${esc(k.guardrail)}</td></tr><tr><td>허영(쫓지 않음)</td><td><s>${esc(k.vanity)}</s></td></tr></table>
    ${sm.methods ? `<p class="muted" style="margin:8px 0 0">고른 방법: ${sm.methods.map(m => tag(L.method[m] || m)).join(' ')} ${esc(sm.how || '')}</p>${srcLine(sm)}` : ''}`; },
  /* ⑤ 근거 만들기: 사례에서 설문(고른 방법)·숫자·고객 상황을 꺼내 보여 준다 */
  survey(c){ const k = c.key_metrics || {}, sm = k.select_method || {};
    return `${sm.methods ? `<p style="margin:0 0 8px">고른 방법: ${sm.methods.map(m => tag(L.method[m] || m, m === 'survey' ? 'on' : '')).join(' ')}</p><p class="muted" style="margin:0 0 8px">${esc(sm.how || '')}</p>${srcLine(sm)}` : ''}
    <dl class="kv" style="margin-top:10px"><dt>확인한 것</dt><dd><b>${esc(k.north_star)}</b></dd><dt>선행 지표</dt><dd>${(k.leading || []).map(esc).join(', ')}</dd>${c.pro_opinion ? `<dt>고객의 말</dt><dd>“${esc(c.pro_opinion.says)}”</dd>` : ''}${c.anti_opinion ? `<dt>반대의 말</dt><dd>“${esc(c.anti_opinion.says)}”</dd>` : ''}</dl>`; },
  numbers(c){ const o = (c.outcomes || []).filter(x => x.after);
    return `<p style="margin:0 0 8px">주장: <b>${esc((c.so_what && c.so_what.conclusion) || c.solution)}</b></p>
    ${o.length ? `<table class="t" style="margin:0"><tr><th>전</th><th>후</th><th>출처</th></tr>${o.map(x => `<tr><td>${esc(x.before)}</td><td><b>${esc(x.after)}</b>${x.context ? `<br><span class="muted">${esc(x.context)}</span>` : ''}</td><td>${isUrl(x.evidence) ? link(x.evidence) : tag('추정', 'warn')}</td></tr>`).join('')}</table>` : '<p class="muted">숫자 근거 없음</p>'}
    ${(c.pest && (c.pest.focus || []).length) ? `<p class="muted" style="margin:8px 0 0">왜 지금: ${c.pest.focus.map(k => `${L.pest[k][1]} — ${esc(c.pest[L.pest[k][0]])}`).join(' / ')}</p>` : ''}`; },
  journey(c){ const w = c.what || {}, f = c.five_why || {};
    return `<div class="ex" style="margin-bottom:10px"><p>${esc(w.situation)}</p></div>
    <table class="t" style="margin:0"><tr><th>단계</th><th>이 사례에서</th></tr><tr><td>겉으로 보이는 불편</td><td>${esc(w.symptom)}</td></tr>${(f.whys || []).length ? `<tr><td>속마음(왜?)</td><td>${f.whys.map(esc).join('<br>')}</td></tr>` : ''}<tr><td>감정이 가장 낮은 순간</td><td><b>${esc(w.problem)}</b></td></tr><tr><td>우리가 끼어드는 순간</td><td>${esc(c.solution)}</td></tr>${c.pro_opinion ? `<tr><td>쓰고 난 뒤</td><td>“${esc(c.pro_opinion.says)}” <span class="muted">— ${esc(c.pro_opinion.who)}</span></td></tr>` : ''}</table>`; },
  integrate(c){ const p = c.pest || {}, f = p.focus || [], dw = c.deep_why || {}, km = c.key_metrics || {};
    const sel = ((c.pareto || {}).matrix || []).filter(x => x.selected).map(x => x.issue);
    return `<table class="t" style="margin:0"><tr class="hi"><td>결론</td><td><b>${esc((c.so_what && c.so_what.conclusion) || c.solution)}</b></td></tr>
    <tr><td>문제</td><td>${esc(c.what.problem)}</td></tr>${sel.length ? `<tr><td>우선순위</td><td>${sel.map(esc).join(', ')}</td></tr>` : ''}
    <tr><td>왜 지금</td><td>${f.length ? f.map(k => `${L.pest[k][1]}: ${esc(p[L.pest[k][0]])}`).join(' / ') : 'P·T 영향 적음'}</td></tr>
    <tr><td>어디서</td><td>3C 진입 ${esc((c.three_c.entry || []).join('·'))} — ${esc(c.three_c.entry_why)}</td></tr>
    <tr><td>무엇을 잴까</td><td>${esc(km.north_star || '')}${dw.intent_metric ? ` · 의도 ${esc(dw.intent_metric)}(${esc(L.mode[dw.mode] || '')})` : ''}</td></tr>
    <tr><td>해결</td><td>${esc(c.solution)}</td></tr>${c.lesson ? `<tr><td>교훈</td><td>${esc(c.lesson)}</td></tr>` : ''}</table>`; },
  solution(c){ const o = (c.outcomes || []).filter(x => x.after);
    return `<p style="margin:0;font-size:15px"><b>${esc(c.solution)}</b></p>${o.map(x => `<p class="muted" style="margin:8px 0 0">결과: ${esc(x.before)} → <b>${esc(x.after)}</b>${x.context ? ' (' + esc(x.context) + ')' : ''}${isUrl(x.evidence) ? ' · ' + link(x.evidence) : ''}</p>`).join('')}
    ${c.lesson ? `<div class="note" style="margin-bottom:0">교훈: ${esc(c.lesson)}</div>` : ''}
    ${(c.refs || []).length ? `<ul class="refs">${c.refs.map(u => `<li>${link(u)}</li>`).join('')}</ul>` : `<div class="src">${esc(c.source || '')}</div>`}`; }
};

/* 데이터: 묶음 페이지는 window.__CASES, 사이트는 data/cases.min.json */
let _p;
function load(){
  if (window.__CASES) return Promise.resolve(window.__CASES);
  return _p || (_p = fetch('data/cases.min.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
}

function theme(){
  const r = document.documentElement;
  try { const t = localStorage.getItem('plan-theme'); if (t) r.dataset.theme = t; } catch(e){}
  const b = $('#theme'); if (!b) return;
  b.onclick = () => {
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('plan-theme', r.dataset.theme); } catch(e){}
  };
}

/* 묶음(한 파일) 페이지에서는 이론↔DB 링크를 같은 파일 안의 보기 전환으로 바꾼다 */
const BUNDLE = !!window.__BUNDLE;
const PAGES = {theory:'index.html', db:'db.html'};
/* 링크 주소: 사이트는 page.html#id, 한 파일 묶음은 #view:id */
const href = (view, id) => BUNDLE ? `#${view}:${id ? encodeURIComponent(id) : ''}` : `${PAGES[view]}${id ? '#' + encodeURIComponent(id) : ''}`;
const hashFor = view => { const h = decodeURIComponent(location.hash.slice(1)); if (!BUNDLE) return h; return h.startsWith(view + ':') ? h.slice(view.length + 1) : null; };
const setHash = (view, id) => history.replaceState(null, '', BUNDLE ? `#${view}:${encodeURIComponent(id || '')}` : (id ? '#' + encodeURIComponent(id) : location.pathname + location.search));

window.P = {KEY, $, esc, link, tag, L, STEPS, R, load, theme, PAGES, isUrl, href, hashFor, setHash, BUNDLE};
})();
