// 프레임워크 페이지 — 아이데이션 → 프로덕트 → 검증 → 토론을 한 단계씩 Claude와 만든다.
// 단계마다 생성 → 사람이 고치고 → 확정. 확정한 것만 다음 단계의 맥락이 된다. 결과는 사이트 안 보고서로 본다.
import { STAGES, STEPS, STEP, MODEL, runStep, check, parseBrief, BRIEF_SCHEMA } from './framework-ai.mjs';

const P = window.P, LAB = window.LAB;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const KEY = 'noah-key', STORE = 'framework-projects';
const won = n => (Number.isFinite(n) ? Math.round(n).toLocaleString('ko-KR') : '-') + '원';
const pct = n => Number.isFinite(n) ? (n * 100).toFixed(n < 0.1 ? 2 : 1).replace(/\.?0+$/, '') + '%' : '-';
const toast = m => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); };

/* 키 이름 → 한국어 라벨 */
const LABEL = { jtbd: '고객이 해결하려는 일 (JTBD)', situation: '상황', motivation: '하고 싶은 것', outcome: '기대 결과', pains: '페인포인트', pain: '페인포인트', evidence: '근거', severity: '심각도', opportunities: '기회 영역', title: '이름', why: '왜', size: '크기', summary: '요약', five_why: '5 Why', q: '질문', a: '답', root_cause: '근본 원인', surface_goal: '표면 목표', redefined_goal: '재정의한 목표', problem_statement: '문제 한 문장', metric: '지표', ideas: '아이디어', id: 'id', mechanism: '방식', source_case: '옮긴 사례', verdicts: '판정', barrier: '장벽', survive: '생존', why_not_yet: '왜 아직 아무도 안 했나', condition_change: '바뀐 조건', scores: 'ICE 점수', impact: 'Impact', confidence: 'Confidence', ease: 'Ease', reason: '근거', cards: '비교 카드', entry_cell: '3C 진입 칸', who: '누구에게', what: '무엇으로', price: '얼마에', riskiest_assumption: '가장 위험한 가정', strength: '강점', weakness: '약점', recommend_id: '추천', customer: '고객 (Customer)', competitors: '경쟁사 (Competitor)', name: '이름', company: '자사 (Company)', cells: 'A~H 8칸', cell: '칸', meaning: '뜻', here: '여기에 해당하는 것', entry_reason: '진입 이유', d_risk: 'D로 바뀌는 위험', beachhead: '비치헤드', win_metric: '이겼다는 기준', icp: 'ICP', alternatives: '지금 쓰는 대안', pay_moment: '돈을 내는 순간', positioning: '포지셔닝', unique: '고유한 특성', value: '가치', target: '타겟', category: '카테고리', message: '메시지', headline: '헤드라인', proofs: '근거 3개', cta: '다음 행동', pricing: '가격', value_metric: '가치 지표', model: '모델', rationale: '근거', motion: 'GTM 모션', primary: '주', secondary: '보조', channels: '채널 실험', test: '실험 · 성공 기준', pmf_signals: 'PMF 신호', launch: '출시 단계', phase: '단계', goal: '목표', gate: '넘어갈 기준', part: 'GTM 칸', note: '메모', branches: '이슈', issue: '이슈', subs: '하위 이슈', speed: '속도', focus: '먼저', north_star: '북극성 지표', leading: '선행 지표', guardrail: '가드레일', steps: '흐름', user_goal: '고객의 목표', screen: '화면 · 접점', drop_risk: '이탈 위험', must: '반드시', nice: '있으면 좋음', not_now: '이번엔 안 함', feature: '기능', weeks: '주', costs: '비용', amount: '금액', repeat_rate: '추가 구매 확률', cac: 'CAC', fixed_monthly: '월 고정비', notes: '가정과 근거', items: '목록', assumption: '가정', type: '유형', source: '출처 단계', risk: '위험', assumption_id: '가정', method: '방법', hypothesis: '가설', baseline: '기준값', mde: 'MDE', daily_users: '하루 사용자', success: '성공 기준', stop: '중단 기준', events: '이벤트', trigger: '언제', params: '매개변수', step: '단계', vanity: '쓰지 않을 허영 지표', kind: '종류', likelihood: '가능성', mitigation: '대비책', compliance: '규정 점검', rule: '규정', check: '확인할 것', status: '상태', recs: '추천 도구', tool_id: '도구', when: '언제', data: '필요한 데이터', actions: '다음 행동', experiment: '실험', verdict: '판정', next: '다음 행동', critiques: '지적', persona: '누가', claim: '지적', target_step: '고칠 단계', suggestion: '고칠 방향', changes: '바뀐 점', before: '전', after: '후', slogan: '슬로건', how: '어떻게', expected: '기대 효과', so_what: '결론', subhead: '부제', body: '본문', customer_quote: '고객 인용', team_quote: '팀 인용', faq: 'FAQ', week: '주차', tasks: '할 일', task: '할 일', owner: '담당', done_when: '끝났다는 기준' };
const lab = k => LABEL[k] || k;

/* ───── 상태 ───── */
let key = ls.get(KEY, ''), store = ls.get(STORE, { list: [], cur: null }), proj = null, busy = null, ctrl = null;
const DATA = { cases: null, saju: null, context: null };
const save = () => { if (proj) { proj.updated = Date.now(); const i = store.list.findIndex(p => p.id === proj.id); if (i < 0) store.list.unshift(proj); else store.list[i] = proj; store.cur = proj.id; } if (!ls.set(STORE, store)) toast('브라우저 저장 공간이 꽉 찼어요. 오래된 프로젝트를 내보내고 지워 주세요'); };
const newProject = brief => ({ id: 'p' + Date.now(), created: Date.now(), updated: Date.now(), brief, steps: {}, selected: [], picked: '', accepted: [], results: {}, cur: STEPS[0].id });

async function loadData(saju) {
  const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => null);
  if (!DATA.cases) DATA.cases = await (P.load ? P.load().catch(() => null) : j('data/cases.min.json'));
  if (saju && !DATA.context) DATA.context = await j('data/framework-context.min.json');
  if (saju && !DATA.saju) DATA.saju = await j('data/saju-rules.min.json');
}

/* ───── 단계 상태 ───── */
const done = id => !!(proj.steps[id] && proj.steps[id].done);
const stale = id => { const s = proj.steps[id]; if (!s || !s.at) return false; const i = STEPS.findIndex(x => x.id === id); return STEPS.slice(0, i).some(x => proj.steps[x.id] && proj.steps[x.id].doneAt > s.at); };
/* 막지 않는다 — 비어 있는 앞 단계는 Claude가 있는 데이터로 추론한다는 안내만 */
function hint(step) {
  const i = STEPS.indexOf(step), skipped = STEPS.slice(0, i).filter(s => !proj.steps[s.id]?.out).length;
  if (step.id === 'compare' && !proj.selected.length) return '고른 아이디어가 없어요. 생성하면 개요와 지금까지 만든 내용에서 후보를 추론해 비교해요.';
  if (skipped) return `앞 단계 ${skipped}개를 건너뛰었어요. 필요한 내용은 개요와 지금까지 만든 내용으로 추론해 채우고 "(추론)"으로 표시해요.`;
  return '';
}
const ideaName = id => { const it = (proj.steps.ideas?.out?.ideas || []).find(x => x.id === id) || (proj.steps.compare?.out?.cards || []).find(x => x.id === id); return it && it.title ? `${id} ${it.title}` : id; };

/* ───── 편집 가능한 일반 렌더러 ───── */
const getAt = (o, path) => path.reduce((a, k) => a == null ? a : a[k], o);
const setAt = (o, path, v) => { const last = path[path.length - 1]; getAt(o, path.slice(0, -1))[last] = v; };
const blank = sc => sc.type === 'object' ? Object.fromEntries(Object.entries(sc.properties).map(([k, v]) => [k, blank(v)])) : sc.type === 'array' ? [] : sc.type === 'string' ? (sc.enum ? sc.enum[0] : '') : sc.type === 'boolean' ? false : 0;
const isFlat = sc => sc.type === 'object' && Object.values(sc.properties).every(v => v.type !== 'object' && v.type !== 'array');

function field(sc, v, path, ro) {
  const p = esc(JSON.stringify(path));
  if (ro) return sc.type === 'boolean' ? (v ? '<span class="tag ok">예</span>' : '<span class="tag">아니오</span>') : sc.type === 'number' && Math.abs(v) >= 1000 ? esc(Number(v).toLocaleString('ko-KR')) : esc(v);
  if (sc.enum) return `<select class="fw-in" data-p="${p}">${sc.enum.map(e => `<option${e === v ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select>`;
  if (sc.type === 'boolean') return `<input type="checkbox" class="fw-in" data-p="${p}"${v ? ' checked' : ''} aria-label="예/아니오">`;
  if (sc.type === 'number' || sc.type === 'integer') return `<input type="number" class="fw-in fw-num" data-p="${p}" value="${esc(v)}" step="${sc.type === 'integer' ? 1 : 'any'}">`;
  return `<span class="fw-ed" contenteditable="plaintext-only" data-p="${p}">${esc(v)}</span>`;
}
function node(sc, v, path, ro, depth = 0) {
  if (sc.type === 'object') return `<div class="fw-obj">${Object.entries(sc.properties).map(([k, s]) => {
    const inner = node(s, v?.[k], [...path, k], ro, depth + 1), simple = s.type !== 'object' && s.type !== 'array';
    return simple ? `<div class="fw-kv"><span class="fw-k">${esc(lab(k))}</span><div class="fw-v">${inner}</div></div>` : `<section class="fw-sec"><h4>${esc(lab(k))}</h4>${inner}</section>`;
  }).join('')}</div>`;
  if (sc.type === 'array') {
    const it = sc.items, list = Array.isArray(v) ? v : [], P2 = esc(JSON.stringify(path));
    const del = i => ro ? '' : `<button class="ib fw-del" data-del="${esc(JSON.stringify([...path, i]))}" aria-label="행 지우기" title="행 지우기">×</button>`;
    const add = ro ? '' : `<button class="btn sm fw-add" data-add="${P2}">+ 추가</button>`;
    if (it.type !== 'object') return `<ul class="fw-list">${list.map((x, i) => `<li>${field(it, x, [...path, i], ro)}${del(i)}</li>`).join('')}</ul>${add}`;
    if (isFlat(it)) { const cols = Object.keys(it.properties); return `<div class="fw-tbl"><table><thead><tr>${cols.map(c => `<th>${esc(lab(c))}</th>`).join('')}${ro ? '' : '<th></th>'}</tr></thead><tbody>${list.map((row, i) => `<tr>${cols.map(c => `<td class="${it.properties[c].type === 'string' && !it.properties[c].enum ? 'w' : ''}">${field(it.properties[c], row[c], [...path, i, c], ro)}</td>`).join('')}${ro ? '' : `<td>${del(i)}</td>`}</tr>`).join('')}</tbody></table></div>${add}`; }
    return `<div class="fw-cards">${list.map((row, i) => `<div class="fw-card">${del(i)}${node(it, row, [...path, i], ro, depth + 1)}</div>`).join('')}</div>${add}`;
  }
  return field(sc, v, path, ro);
}

/* ───── 단계별 시각화 (일반 렌더러 위에 붙는다) ───── */
const iceRows = () => { const sc = proj.steps.ice?.out?.scores || []; return sc.map(s => ({ ...s, score: s.impact * s.confidence * s.ease })).sort((a, b) => b.score - a.score); };
function unitCalc(u) {
  if (!u) return null; const cost = (u.costs || []).reduce((a, c) => a + (+c.amount || 0), 0), margin = (+u.price || 0) - cost, r = Math.min(Math.max(+u.repeat_rate || 0, 0), 0.95), orders = 1 / (1 - r), ltv = margin * orders;
  return { cost, margin, orders, ltv, mrate: u.price ? margin / u.price : NaN, breakeven: margin > 0 ? Math.ceil((+u.fixed_monthly || 0) / margin) : Infinity, ch: (u.channels || []).map(c => ({ ...c, ratio: c.cac ? ltv / c.cac : Infinity, payback: margin > 0 ? c.cac / margin : Infinity })) };
}
const expRows = () => (proj.steps.experiments?.out?.items || []).map((e, i) => { let d = null; try { if (LAB && e.baseline > 0 && e.mde > 0 && e.daily_users > 0) d = LAB.abDuration({ baseline: e.baseline, mde: e.mde, dailyUsers: e.daily_users }); } catch (err) {} return { ...e, i, ice: e.impact * e.confidence * e.ease, days: d && d.days, per: d && d.perVariant }; }).sort((a, b) => b.ice - a.ice);
const methodById = id => (window.METHODS?.ITEMS || []).find(m => m.id === id);

function extra(step, ro) {
  const o = proj.steps[step.id]?.out; if (!o) return '';
  switch (step.id) {
    case 'ice': { const rows = iceRows(); return `<div class="fw-viz"><h4>ICE 순위 ${ro ? '' : `<span class="muted">· 프로덕트로 넘길 아이디어를 최대 3개 고르세요</span>`}</h4><ol class="fw-rank">${rows.map(r => { const on = proj.selected.includes(r.id); return `<li class="${on ? 'on' : ''}">${ro ? '' : `<input type="checkbox" data-sel="${esc(r.id)}"${on ? ' checked' : ''} aria-label="${esc(r.id)} 고르기">`}<b>${esc(ideaName(r.id))}</b><span class="fw-bar"><i style="width:${r.score / 1.25}%"></i></span><em>${r.score}</em><small>${r.impact}·${r.confidence}·${r.ease}</small></li>`; }).join('')}</ol></div>`; }
    case 'compare': return `<div class="fw-viz"><h4>깊게 갈 아이디어</h4><div class="fw-pick">${(o.cards || []).map(c => `<label class="${proj.picked === c.id ? 'on' : ''}">${ro ? '' : `<input type="radio" name="pick" data-pick="${esc(c.id)}"${proj.picked === c.id ? ' checked' : ''}>`}<b>${esc(ideaName(c.id))}</b>${c.id === o.recommend_id ? '<span class="tag on">추천</span>' : ''}<small>${esc(c.who)} · ${esc(c.price)} · 진입 ${esc(c.entry_cell)}</small></label>`).join('')}</div></div>`;
    case 'three_c': { const cells = Object.fromEntries((o.cells || []).map(c => [c.cell, c])); return `<div class="fw-viz fw-venn"><div class="fw-venn-svg">${P.venn([o.entry_cell])}</div><div class="fw-cells">${'ABCDEFGH'.split('').map(k => `<div class="${k === o.entry_cell ? 'on' : ''}"><b>${k}</b><span>${esc(cells[k]?.meaning || (P.L?.cell?.[k] ?? ''))}</span>${esc(cells[k]?.here || '-')}</div>`).join('')}</div></div>`; }
    case 'issue_tree': return `<div class="fw-viz"><div class="fw-tree"><div class="fw-root">${esc(o.goal)}</div><div class="fw-br">${(o.branches || []).map(b => `<div class="fw-b"><div class="fw-bh">${esc(b.issue)}</div>${(b.subs || []).map(s => `<div class="fw-leaf ${s.focus ? 'on' : ''}"><span>${esc(s.issue)}</span><small>속도 ${s.speed} · 임팩트 ${s.impact}${s.focus ? ' · 먼저' : ''}</small></div>`).join('')}</div>`).join('')}</div></div><div class="fw-metrics"><div><span>북극성</span><b>${esc(o.north_star)}</b></div><div><span>선행</span><b>${esc((o.leading || []).join(' · '))}</b></div><div><span>가드레일</span><b>${esc(o.guardrail)}</b></div></div></div>`;
    case 'flow': return `<div class="fw-viz"><ol class="fw-flow">${(o.steps || []).map((s, i) => `<li><em>${i + 1}</em><b>${esc(s.name)}</b><small>${esc(s.metric)}</small></li>`).join('')}</ol></div>`;
    case 'unit': { const c = unitCalc(o); return `<div class="fw-viz"><h4>계산 <span class="muted">· 숫자를 고치면 바로 다시 계산돼요</span></h4><div class="fw-stats"><div><span>건당 공헌이익</span><b>${won(c.margin)}</b><small>마진율 ${pct(c.mrate)}</small></div><div><span>고객당 기대 결제</span><b>${c.orders.toFixed(2)}건</b><small>추가 구매 ${pct(o.repeat_rate)}</small></div><div><span>LTV (공헌이익 기준)</span><b>${won(c.ltv)}</b></div><div><span>월 손익분기</span><b>${Number.isFinite(c.breakeven) ? c.breakeven.toLocaleString('ko-KR') + '건' : '이익 없음'}</b><small>고정비 ${won(o.fixed_monthly)}</small></div></div><div class="fw-tbl"><table><thead><tr><th>채널</th><th>CAC</th><th>LTV/CAC</th><th>회수 (결제 건수)</th><th>판정</th></tr></thead><tbody>${c.ch.map(x => `<tr><td>${esc(x.name)}</td><td>${won(x.cac)}</td><td>${Number.isFinite(x.ratio) ? x.ratio.toFixed(1) : '-'}</td><td>${Number.isFinite(x.payback) ? x.payback.toFixed(1) : '-'}</td><td>${x.ratio >= 3 ? '<span class="tag ok">키울 만함</span>' : x.ratio >= 1 ? '<span class="tag warn">빠듯함</span>' : '<span class="tag no">손해</span>'}</td></tr>`).join('')}</tbody></table></div><p class="muted">LTV = 건당 공헌이익 × 1/(1−추가 구매 확률). LTV/CAC 3 이상을 키울 만한 기준으로 봤어요 (5장 단위 경제).</p></div>`; }
    case 'experiments': { const rows = expRows(); return `<div class="fw-viz"><h4>실행 순서 (ICE) · 필요 기간</h4><div class="fw-tbl"><table><thead><tr><th>#</th><th>가정</th><th>방법</th><th>지표</th><th>ICE</th><th>그룹당 표본</th><th>기간</th></tr></thead><tbody>${rows.map((r, n) => `<tr><td>${n + 1}</td><td>${esc(r.assumption_id)}</td><td>${esc(r.method)}</td><td>${esc(r.metric)}</td><td>${r.ice}</td><td>${r.per ? r.per.toLocaleString('ko-KR') : '-'}</td><td>${r.days ? r.days + '일' + (r.days > 28 ? ' <span class="tag warn">4주 넘음</span>' : '') : '-'}</td></tr>`).join('')}</tbody></table></div><p class="muted">기간 = 6장 A/B 기간 공식(16·p(1−p)/(p·MDE)², 두 그룹). 4주가 넘으면 MDE를 키우거나 더 싼 방법(가짜 버튼 · 사전예약)으로 바꾸세요.</p></div>`; }
    case 'tools': return `<div class="fw-viz"><div class="fw-tools">${(o.recs || []).map(r => { const m = methodById(r.tool_id); return `<a href="${esc(P.href('ch6', 'm_' + r.tool_id))}">${m ? `<b>${esc(m.name)}</b><small>${esc(m.short)}</small>` : `<b>${esc(r.tool_id)}</b><small>목록에 없는 도구</small>`}<span>${esc(r.why)}</span></a>`; }).join('')}</div></div>`;
    case 'redteam': return `<div class="fw-viz"><h4>레드팀 ${ro ? '' : '<span class="muted">· 받아들일 지적을 고르면 다음 단계에서 반영안을 만들어요</span>'}</h4><div class="fw-red">${(o.critiques || []).map((c, i) => { const on = proj.accepted.some(a => a.i === i); return `<label class="${on ? 'on' : ''}">${ro ? '' : `<input type="checkbox" data-acc="${i}"${on ? ' checked' : ''}>`}<span class="fw-who">${esc(c.persona)}</span><b>${esc(c.claim)}</b><small>${esc(c.why)}</small><small>→ ${esc(c.target_step)}: ${esc(c.suggestion)}</small><em>${'●'.repeat(c.severity)}${'○'.repeat(5 - c.severity)}</em></label>`; }).join('')}</div></div>`;
  }
  return '';
}

/* 결과 판정: 실험별 결과 입력 → LAB.abTest */
function resultsForm() {
  const rows = expRows(); if (!rows.length) return '<p class="muted">실험 설계 단계를 먼저 확정해 주세요.</p>';
  return `<div class="fw-viz"><h4>실험 결과 입력 <span class="muted">· A/B 형태(대조군·실험군)로 넣으면 6장 결과 시트 기준으로 판정해요</span></h4><div class="fw-tbl"><table><thead><tr><th>실험</th><th>대조 사용자</th><th>대조 전환</th><th>실험 사용자</th><th>실험 전환</th><th>상승률</th><th>χ²</th><th>판정</th></tr></thead><tbody>${rows.map(r => { const k = 'e' + r.i, v = proj.results[k] || {}, t = v.verdict; return `<tr><td class="w">${esc(r.assumption_id)} · ${esc(r.hypothesis)}</td>${['cUsers', 'cConv', 'vUsers', 'vConv'].map(f => `<td><input type="number" class="fw-num" min="0" data-res="${k}" data-f="${f}" value="${esc(v[f] ?? '')}"></td>`).join('')}<td>${t ? pct(t.delta) : '-'}</td><td>${t ? t.chi.toFixed(2) : '-'}</td><td>${t ? `<span class="tag ${t.verdict === '채택' ? 'ok' : 'no'}">${esc(t.verdict)}</span>` : '-'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
function judge(k) {
  const v = proj.results[k], e = expRows().find(r => 'e' + r.i === k);
  if (!v || !LAB || ['cUsers', 'cConv', 'vUsers', 'vConv'].some(f => !(v[f] >= 0) || v[f] === '')) { if (v) delete v.verdict; return; }
  try { const r = LAB.abTest({ cUsers: +v.cUsers, cConv: +v.cConv, vUsers: +v.vUsers, vConv: +v.vConv, mde: e?.mde || 0.1 }); v.verdict = { delta: r.delta, chi: r.chi, verdict: r.verdict }; v.experiment = e ? `${e.assumption_id} ${e.hypothesis}` : k; } catch (err) { delete v.verdict; }
}

/* ───── 화면 ───── */
const root = () => document.getElementById('fw');
const ICON = { gear: '<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>' };

function keyBox(show) {
  return `<div class="fw-key" ${show ? '' : 'hidden'}><p><b>Claude API 키</b> — 노아와 같은 키를 써요. 이 브라우저에만 저장되고 Anthropic API로만 보내져요.</p><form data-keyform><input type="password" placeholder="sk-ant-…" autocomplete="off" aria-label="Anthropic API 키"><button class="btn sm dark">저장</button>${key ? '<button type="button" class="btn sm" data-act="keydel">지우기</button>' : ''}</form><span class="muted">${key ? '저장된 키 있음 · ' + key.slice(0, 10) + '…' : '키가 없어요'}</span></div>`;
}
function bar() {
  return `<div class="fw-bar0"><select data-proj aria-label="프로젝트">${store.list.map(p => `<option value="${p.id}"${proj && p.id === proj.id ? ' selected' : ''}>${esc(p.brief.title || (p.brief.text || p.brief.situation || '').slice(0, 30))}</option>`).join('')}<option value="">+ 새 프로젝트</option></select><span class="grow"></span>${proj ? `<a class="btn sm" href="#report">결과 보기</a><button class="btn sm" data-act="export">JSON 내보내기</button>` : ''}<label class="btn sm">JSON 가져오기<input type="file" accept=".json,application/json" data-import hidden></label>${proj ? '<button class="btn sm" data-act="delproj">삭제</button>' : ''}<button class="ib" data-act="key" aria-label="API 키" title="API 키">${ICON.gear}</button></div>${keyBox(!key)}`;
}
function briefForm() {
  return `<form class="fw-brief" data-brief><h2>새 프로젝트</h2><p class="muted">생각나는 대로 줄글로 쭉 써 주세요. 어떤 서비스인지, 뭐가 문제인지, 뭘 원하는지, 숫자·기한·제약이 있으면 그것까지. 상황 · 목표 · 제약 · 타겟은 Claude가 읽고 정리해요.</p>
  <textarea name="text" rows="12" required placeholder="예: 우리는 AI 사주 웹사이트를 운영 중이고, 웹툰처럼 1페이지에서 사주 이야기를 보여 준 뒤 2페이지에서 결제를 유도해. 요즘 1페이지 방문은 하루 3천 명 정도인데 결제까지 가는 건 2% 남짓이야. 석 달 안에 3%까지 올리고 싶은데 개발자는 한 명뿐이고 광고비는 월 300만 원 정도 쓸 수 있어. 20~30대 여성이 주로 오는 것 같긴 한데 확실하진 않아."></textarea>
  <label class="fw-check"><input type="checkbox" name="saju" checked> 사주 모드 — 사주 DB · 경쟁사 지도 · 벤치마크 · 규정 체크리스트를 맥락으로 씀</label>
  <div><button class="btn dark">시작하기</button></div></form>`;
}
const parsed = () => !!proj.brief.parsedAt;
function briefSum() {
  const b = proj.brief;
  if (busy === 'brief') return `<div class="fw-brief-sum"><div class="fw-run"><span class="fw-spin"></span><span data-status>글을 읽는 중</span></div></div>`;
  if (!parsed()) return `<div class="fw-brief-sum"><p class="fw-warn">${b.err ? esc(b.err) : '아직 글을 파악하지 못했어요. API 키를 넣고 파악하기를 눌러 주세요.'}</p><textarea class="fw-btext" data-btext rows="5">${esc(b.text)}</textarea><div><button class="btn sm dark" data-act="understand">파악하기</button></div></div>`;
  const f = ['situation', 'goal', 'constraints', 'target', 'domain'], L2 = { situation: '상황', goal: '목표', constraints: '제약', target: '타겟', domain: '서비스' };
  return `<details class="fw-brief-sum"${proj.cur === STEPS[0].id && !proj.steps[STEPS[0].id] ? ' open' : ''}><summary><b>${esc(b.title || '프로젝트')}</b><span>${esc(b.goal)}</span>${b.saju ? '<span class="tag on">사주 모드</span>' : ''}<span class="muted fw-more">Claude가 파악한 개요 ▾</span></summary>
    <div class="fw-bgrid">${f.map(k => `<div class="fw-kv"><span class="fw-k">${L2[k]}</span><div class="fw-v"><span class="fw-ed" contenteditable="plaintext-only" data-bp="${k}">${esc(b[k])}</span></div></div>`).join('')}
    ${(b.unknowns || []).length ? `<div class="fw-kv"><span class="fw-k">빠진 정보</span><div class="fw-v"><ul class="fw-list">${b.unknowns.map(u => `<li>${esc(u)}</li>`).join('')}</ul><span class="muted">아래 원문에 덧붙이고 다시 파악하면 반영돼요.</span></div></div>` : ''}</div>
    <details class="fw-orig"><summary>원문 보기 · 고치기</summary><textarea class="fw-btext" data-btext rows="6">${esc(b.text)}</textarea><button class="btn sm" data-act="understand">원문으로 다시 파악</button></details></details>`;
}
function stepper() {
  const cur = proj.cur;
  return `<nav class="fw-steps" aria-label="단계"><button class="btn sm dark fw-quick" data-act="quickbrief" title="지금까지 만든 내용으로 기획서를 바로 만들어요">기획서 바로 만들기</button><p class="muted fw-tip">필요한 단계만 골라서 해요. 순서는 자유예요.</p>${STAGES.map((st, n) => `<div class="fw-stage"><div class="fw-sn"><em>${n + 1}</em>${st.name}</div>${STEPS.filter(s => s.stage === st.id).map(s => { const d = done(s.id), sl = stale(s.id), has = !!proj.steps[s.id]?.out; return `<button data-go="${s.id}" aria-current="${s.id === cur}" class="${d ? 'done' : has ? 'has' : ''}"><i class="fw-dot"></i>${esc(s.name)}${sl ? ' <span class="tag warn">앞이 바뀜</span>' : ''}</button>`; }).join('')}</div>`).join('')}</nav>`;
}
function panel() {
  const step = STEP[proj.cur], st = proj.steps[step.id] || {}, b = hint(step), stage = STAGES.find(s => s.id === step.stage);
  const running = busy === step.id;
  const head = `<header class="fw-ph"><span class="muted">${stage.name} · ${STEPS.filter(s => s.stage === step.stage).indexOf(step) + 1}/${STEPS.filter(s => s.stage === step.stage).length}</span><h2>${esc(step.name)}</h2><p>${esc(step.ask)}</p>${stale(step.id) ? '<p class="fw-warn">이 단계를 만든 뒤에 앞 단계를 다시 확정했어요. 다시 생성하면 바뀐 내용이 반영돼요.</p>' : ''}</header>`;
  let body = '';
  if (step.id === 'results') body += resultsForm();
  if (running) body += `<div class="fw-run"><span class="fw-spin"></span><span data-status>준비 중</span><button class="btn sm" data-act="cancel">멈추기</button></div>`;
  else if (st.err) body += `<p class="fw-warn">${esc(st.err)}</p>`;
  if (st.out && !running) body += extra(step, false) + `<details class="fw-raw" ${['ice', 'compare', 'unit', 'experiments', 'redteam', 'issue_tree', 'three_c'].includes(step.id) ? '' : 'open'}><summary>내용 고치기</summary>${node(step.schema, st.out, [], false)}</details>`;
  const gen = st.out ? '다시 생성' : '생성';
  const foot = running ? '' : `<footer class="fw-foot">${b ? `<p class="muted">${esc(b)}</p>` : ''}<textarea data-instr rows="2" placeholder="지시를 덧붙일 수 있어요 (예: 20대 여성 직장인에 집중해 줘, 가격은 9,900원 고정)">${esc(st.instr || '')}</textarea><div class="fw-btns"><button class="btn ${st.out ? '' : 'dark'}" data-act="gen">${gen}</button>${st.out ? `<button class="btn dark" data-act="confirm">${done(step.id) ? '다시 확정' : '확정'}</button>` : ''}${step.id === 'brief' && st.out ? '<a class="btn" href="#report">결과 보기</a>' : ''}<span class="grow"></span>${st.usage ? `<span class="muted">입력 ${st.usage.input_tokens?.toLocaleString()} · 출력 ${st.usage.output_tokens?.toLocaleString()} 토큰${st.model && st.model !== MODEL ? ' · ' + esc(st.model) : ''}</span>` : ''}</div></footer>`;
  return `<section class="fw-panel">${head}${body}${foot}</section>`;
}

function render() {
  const el = root(); if (!el) return;
  if (location.hash === '#report' && proj) { el.innerHTML = report(); document.body.classList.add('fw-printable'); return; }
  document.body.classList.remove('fw-printable');
  el.innerHTML = bar() + (proj ? `${briefSum()}<div class="fw-main">${stepper()}${panel()}</div>` : briefForm());
}

/* ───── 이벤트 ───── */
function onInput(e) {
  const t = e.target, p = t.dataset.p;
  if (p && proj) { const step = STEP[proj.cur], st = proj.steps[step.id]; if (!st?.out) return; const path = JSON.parse(p); const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? 0 : +t.value) : t.tagName === 'SELECT' ? t.value : t.textContent; setAt(st.out, path, v); st.edited = true; save(); if (['unit', 'experiments', 'ice'].includes(step.id) && e.type === 'change') rerenderViz(step); return; }
  if (t.dataset.res && proj) { const k = t.dataset.res; proj.results[k] = proj.results[k] || {}; proj.results[k][t.dataset.f] = t.value === '' ? '' : +t.value; judge(k); save(); const v = proj.results[k].verdict, td = t.closest('tr').children; td[5].innerHTML = v ? pct(v.delta) : '-'; td[6].innerHTML = v ? v.chi.toFixed(2) : '-'; td[7].innerHTML = v ? `<span class="tag ${v.verdict === '채택' ? 'ok' : 'no'}">${esc(v.verdict)}</span>` : '-'; return; }
  if (t.dataset.bp && proj) { proj.brief[t.dataset.bp] = t.textContent; save(); return; }
  if (t.dataset.btext !== undefined && proj) { proj.brief.text = t.value; save(); return; }
  if (t.dataset.instr !== undefined && proj) { (proj.steps[proj.cur] = proj.steps[proj.cur] || {}).instr = t.value; save(); }
}
function rerenderViz(step) { const v = root().querySelector('.fw-viz'); if (v) v.outerHTML = extra(step, false); }

async function understand() {
  if (!key) { render(); toast('API 키를 먼저 넣어 주세요'); return false; }
  if (busy) return false; const b = proj.brief; busy = 'brief'; ctrl = new AbortController(); delete b.err; render();
  try { const { out } = await parseBrief(key, b.text, b.saju, { signal: ctrl.signal, onStatus: st => { const n = root().querySelector('[data-status]'); if (n) n.textContent = st; } }); Object.keys(BRIEF_SCHEMA.properties).forEach(k => b[k] = out[k]); b.parsedAt = Date.now(); return true; }
  catch (e) { b.err = ctrl.signal.aborted ? '멈췄어요' : (/401|authentication/i.test(e.message) ? 'API 키가 올바르지 않아요. 키를 확인해 주세요' : e.message || String(e)); return false; }
  finally { busy = null; ctrl = null; save(); render(); }
}
async function generate() {
  if (!parsed() && !(await understand())) return;
  const step = STEP[proj.cur]; if (!key) { render(); toast('API 키를 먼저 넣어 주세요'); return; }
  if (busy) return; const st = proj.steps[step.id] = proj.steps[step.id] || {};
  busy = step.id; ctrl = new AbortController(); delete st.err; render();
  try {
    await loadData(proj.brief.saju);
    const { out, usage, model } = await runStep(key, proj, step, DATA, { instruction: st.instr || '', signal: ctrl.signal, onStatus: s => { const n = root().querySelector('[data-status]'); if (n) n.textContent = s; } });
    Object.assign(st, { out, usage, model, at: Date.now(), done: false, edited: false });
    if (step.id === 'ice') proj.selected = iceRows().slice(0, 3).map(r => r.id);
    if (step.id === 'compare') { const ids = (out.cards || []).map(c => c.id); proj.picked = ids.includes(out.recommend_id) ? out.recommend_id : ids[0] || ''; }
    if (step.id === 'redteam') proj.accepted = [];
  } catch (e) { st.err = ctrl.signal.aborted ? '멈췄어요' : (/401|authentication/i.test(e.message) ? 'API 키가 올바르지 않아요. 키를 확인해 주세요' : e.message || String(e)); }
  finally { busy = null; ctrl = null; save(); render(); }
}
function confirmStep() {
  const step = STEP[proj.cur], st = proj.steps[step.id]; if (!st?.out) return;
  if (step.id === 'ice' && !proj.selected.length) { toast('아이디어를 하나 이상 골라 주세요'); return; }
  if (step.id === 'compare' && !proj.picked) { toast('깊게 갈 아이디어를 골라 주세요'); return; }
  st.done = true; st.doneAt = Date.now(); save(); render(); toast(`${step.name} 확정 — 다음에 할 단계를 왼쪽에서 골라요`);
}

function bind() {
  const el = root();
  el.addEventListener('input', onInput); el.addEventListener('change', onInput);
  el.addEventListener('focusout', e => { if (e.target.dataset.p && proj && ['unit', 'ice'].includes(proj.cur)) rerenderViz(STEP[proj.cur]); });
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-go],[data-del],[data-add],[data-sel],[data-pick],[data-acc]'); if (!t) return;
    if (t.dataset.go) { proj.cur = t.dataset.go; save(); render(); return; }
    if (t.dataset.sel) { const id = t.dataset.sel; if (t.checked) { if (proj.selected.length >= 3) { t.checked = false; toast('최대 3개까지 고를 수 있어요'); return; } proj.selected.push(id); } else proj.selected = proj.selected.filter(x => x !== id); save(); rerenderViz(STEP.ice); return; }
    if (t.dataset.pick) { proj.picked = t.dataset.pick; save(); rerenderViz(STEP.compare); return; }
    if (t.dataset.acc) { const i = +t.dataset.acc, c = proj.steps.redteam.out.critiques[i]; if (t.checked) proj.accepted.push({ i, ...c }); else proj.accepted = proj.accepted.filter(a => a.i !== i); save(); t.closest('label').classList.toggle('on', t.checked); return; }
    if (t.dataset.del) { const path = JSON.parse(t.dataset.del), i = path.pop(), st = proj.steps[proj.cur]; getAt(st.out, path).splice(i, 1); save(); render(); return; }
    if (t.dataset.add) { const path = JSON.parse(t.dataset.add), st = proj.steps[proj.cur]; let sc = STEP[proj.cur].schema; path.forEach(k => { sc = typeof k === 'number' ? sc.items : sc.properties[k]; }); getAt(st.out, path).push(blank(sc.items)); save(); render(); return; }
    const a = t.dataset.act;
    if (a === 'gen') generate();
    else if (a === 'understand') understand();
    else if (a === 'cancel') ctrl?.abort();
    else if (a === 'confirm') confirmStep();
    else if (a === 'quickbrief') { proj.cur = 'brief'; save(); generate(); }
    else if (a === 'key') { const k = el.querySelector('.fw-key'); k.hidden = !k.hidden; }
    else if (a === 'keydel') { key = ''; ls.del(KEY); render(); }
    else if (a === 'export') download(`${proj.brief.title || 'framework'}.json`, JSON.stringify(proj, null, 2), 'application/json');
    else if (a === 'delproj' && confirm('이 프로젝트를 지울까요? 되돌릴 수 없어요')) { store.list = store.list.filter(p => p.id !== proj.id); proj = store.list[0] || null; store.cur = proj?.id || null; ls.set(STORE, store); render(); }
    else if (a === 'print') window.print();
    else if (a === 'md') download(`${proj.brief.title || 'framework'}.md`, markdown(), 'text/markdown');
  });
  el.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    if (f.dataset.brief !== undefined) { const d = new FormData(f), text = String(d.get('text') || '').trim(); if (!text) return; proj = newProject({ text, saju: !!d.get('saju'), title: '', situation: '', goal: '', constraints: '', target: '', domain: '', unknowns: [] }); save(); render(); if (key) understand(); else toast('API 키를 넣으면 글을 파악해요'); return; }
    if (f.dataset.keyform !== undefined) { const v = f.querySelector('input').value.trim(); if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v) || v.startsWith('sk-ant-admin')) { alert('Claude API 키 형식이 아니에요 (sk-ant-로 시작하는 일반 키)'); return; } try { await check(v); } catch (err) { if (!confirm(`키 확인에 실패했어요(${err.status || err.message}). 그래도 저장할까요?`)) return; } key = v; ls.set(KEY, key); render(); toast('키를 저장했어요'); }
  });
  el.addEventListener('change', e => {
    if (e.target.dataset.proj !== undefined) { const id = e.target.value; proj = id ? store.list.find(p => p.id === id) : null; store.cur = proj?.id || null; ls.set(STORE, store); render(); }
    if (e.target.dataset.import !== undefined) { const file = e.target.files[0]; if (!file) return; file.text().then(t => { const p = JSON.parse(t); if (!p.brief || !p.steps) throw new Error('프레임워크 프로젝트 파일이 아니에요'); p.id = 'p' + Date.now(); proj = p; save(); render(); toast('가져왔어요'); }).catch(err => alert(err.message)); }
  });
  window.addEventListener('hashchange', render);
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name.replace(/[\\/:*?"<>|]/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

/* ───── 결과 보기 ───── */
const O = id => proj.steps[id]?.out;
const sec = (id, title, html) => html ? `<section class="rp-sec" id="rp-${id}"><h2>${title}</h2>${html}</section>` : '';
const ro = id => O(id) ? node(STEP[id].schema, O(id), [], true) : '';
function report() {
  const b = proj.brief, brief = O('brief'), prob = O('problem'), pick = proj.picked, cmp = O('compare'), u = O('unit'), c = unitCalc(u), it = O('issue_tree'), gtm = O('gtm'), rev = O('revise');
  const doneN = STEPS.filter(s => done(s.id)).length, madeN = STEPS.filter(s => O(s.id)).length;
  const toc = [['summary', '요약'], ['problem', '문제'], ['idea', '아이디어'], ['three_c', '3C'], ['gtm', 'GTM'], ['issue_tree', '이슈트리'], ['product', '경험 · MVP · 단위 경제'], ['verify', '검증 계획'], ['debate', '토론'], ['press', '보도자료'], ['roadmap', '로드맵']];
  const kv = (k, v) => v ? `<div class="rp-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : '';
  return `<div class="fw-bar0 noprint"><a class="btn sm" href="#">← 편집으로</a><span class="grow"></span><span class="muted">만든 단계 ${madeN}개 · 확정 ${doneN}개</span><button class="btn sm" data-act="md">마크다운 내려받기</button><button class="btn sm dark" data-act="print">인쇄 · PDF</button></div>
  <article class="rp">
    <header class="rp-hero"><span class="muted">기획 프레임워크 · ${new Date(proj.updated).toLocaleDateString('ko-KR')}${b.saju ? ' · 사주 모드' : ''}</span><h1>${esc(brief?.slogan || b.title || '기획')}</h1>${brief ? `<p class="rp-lead">${esc(brief.summary)}</p>` : `<p class="rp-lead">${esc(b.goal)}</p>`}${madeN > doneN ? `<p class="fw-warn noprint">확정하지 않은 단계 ${madeN - doneN}개는 초안 그대로 실려요. 하지 않은 단계는 비어 있어요 — 기획서에는 Claude가 추론해 채운 내용이 들어가요.</p>` : ''}</header>
    <nav class="rp-toc noprint">${toc.map(([id, t]) => `<a href="#rp-${id}" data-jump>${t}</a>`).join('')}</nav>
    ${sec('summary', '요약', brief ? `<div class="rp-grid">${kv('왜', brief.why)}${kv('누구에게', brief.who)}${kv('무엇을', brief.what)}${kv('어떻게', brief.how)}</div><div class="rp-kpis">${(brief.expected || []).map(e => `<div><span>${esc(e.metric)}</span><b>${esc(e.target)}</b></div>`).join('')}</div><p class="rp-sowhat">${esc(brief.so_what)}</p>` : `<div class="rp-grid">${kv('상황', b.situation)}${kv('목표', b.goal)}${kv('제약', b.constraints)}</div>`)}
    ${sec('problem', '문제', prob ? `<p class="rp-big">${esc(prob.problem_statement)}</p><div class="rp-grid">${kv('표면 목표', prob.surface_goal)}${kv('재정의한 목표', prob.redefined_goal)}${kv('근본 원인', prob.root_cause)}${kv('지표', prob.metric)}</div><ol class="rp-why">${(prob.five_why || []).map(w => `<li><b>${esc(w.q)}</b> ${esc(w.a)}</li>`).join('')}</ol>` : '')}
    ${sec('idea', '고른 아이디어', cmp ? `<p class="rp-big">${esc(ideaName(pick))}</p><p>${esc((O('ideas')?.ideas || []).find(i => i.id === pick)?.summary || '')}</p><div class="fw-tbl"><table><thead><tr><th>아이디어</th><th>ICE</th><th>진입</th><th>누구에게</th><th>얼마에</th><th>가장 위험한 가정</th></tr></thead><tbody>${(cmp.cards || []).map(cd => `<tr class="${cd.id === pick ? 'on' : ''}"><td>${esc(ideaName(cd.id))}${cd.id === pick ? ' <span class="tag on">선택</span>' : ''}</td><td>${iceRows().find(r => r.id === cd.id)?.score ?? '-'}</td><td>${esc(cd.entry_cell)}</td><td>${esc(cd.who)}</td><td>${esc(cd.price)}</td><td>${esc(cd.riskiest_assumption)}</td></tr>`).join('')}</tbody></table></div><p class="muted">고른 이유: ${esc(cmp.reason)}</p>` : '')}
    ${sec('three_c', '3C', O('three_c') ? extra(STEP.three_c, true) + `<div class="rp-3">${['customer', 'company'].map(k => `<div><h4>${lab(k)}</h4><ul>${(O('three_c')[k] || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}<div><h4>경쟁사</h4><ul>${(O('three_c').competitors || []).map(x => `<li><b>${esc(x.name)}</b> — ${esc(x.strength)} / ${esc(x.weakness)}</li>`).join('')}</ul></div></div><p><b>진입 ${esc(O('three_c').entry_cell)}</b> — ${esc(O('three_c').entry_reason)}</p><p class="muted">D로 바뀌는 위험: ${esc(O('three_c').d_risk)}</p>` : '')}
    ${sec('gtm', 'GTM 한 장', gtm ? `<div class="rp-gtm"><div><span>비치헤드</span><b>${esc(gtm.beachhead)}</b><small>이긴 기준: ${esc(gtm.win_metric)}</small></div><div><span>ICP</span><b>${esc(gtm.icp.situation)}</b><small>JTBD ${esc(gtm.icp.jtbd)} · 대안 ${esc(gtm.icp.alternatives)} · 지불 순간 ${esc(gtm.icp.pay_moment)}</small></div><div><span>포지셔닝</span><b>${esc(gtm.positioning.category)} 중 ${esc(gtm.positioning.unique)}</b><small>${esc(gtm.positioning.target)}에게 ${esc(gtm.positioning.value)} · 대안 ${esc(gtm.positioning.alternatives)}</small></div><div><span>메시지</span><b>${esc(gtm.message.headline)}</b><small>${(gtm.message.proofs || []).map(esc).join(' · ')} → ${esc(gtm.message.cta)}</small></div><div><span>가격</span><b>${esc(gtm.pricing.price)} · ${esc(gtm.pricing.model)}</b><small>${esc(gtm.pricing.value_metric)} — ${esc(gtm.pricing.rationale)}</small></div><div><span>모션 · 채널</span><b>${esc(gtm.motion.primary)}</b><small>${(gtm.channels || []).map(ch => esc(ch.name)).join(' · ')}</small></div></div><h4>출시 단계</h4><ol class="fw-flow">${(gtm.launch || []).map((l, i) => `<li><em>${i + 1}</em><b>${esc(l.phase)}</b><small>${esc(l.gate)}</small></li>`).join('')}</ol><h4>PMF 신호</h4><ul>${(gtm.pmf_signals || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="rp-ev">${(gtm.evidence || []).map(e => `<span class="tag ${e.strength === '강' ? 'ok' : e.strength === '약' ? 'no' : 'warn'}">${esc(e.part)} ${esc(e.strength)}</span>`).join('')}</div>` : '')}
    ${sec('issue_tree', '이슈트리', it ? extra(STEP.issue_tree, true) : '')}
    ${sec('product', '핵심 경험 · MVP · 단위 경제', (O('flow') ? `<h4>핵심 흐름</h4>${extra(STEP.flow, true)}` : '') + (O('mvp') ? `<h4>MVP 범위 (${O('mvp').weeks}주)</h4><div class="rp-3">${['must', 'nice', 'not_now'].map(k => `<div><h4>${lab(k)}</h4><ul>${(O('mvp')[k] || []).map(x => `<li><b>${esc(x.feature)}</b> — ${esc(x.why)}</li>`).join('')}</ul></div>`).join('')}</div>` : '') + (c ? `<h4>단위 경제</h4>${extra(STEP.unit, true).replace(' <span class="muted">· 숫자를 고치면 바로 다시 계산돼요</span>', '')}<p class="muted">${esc(u.notes)}</p>` : ''))}
    ${sec('verify', '검증 계획', (O('assumptions') ? `<h4>위험한 가정</h4>${ro('assumptions')}` : '') + (O('experiments') ? extra(STEP.experiments, true) : '') + (Object.values(proj.results).some(r => r.verdict) ? `<h4>결과</h4><ul>${Object.values(proj.results).filter(r => r.verdict).map(r => `<li>${esc(r.experiment)} — <b>${esc(r.verdict.verdict)}</b> (상승 ${pct(r.verdict.delta)}, χ² ${r.verdict.chi.toFixed(2)})</li>`).join('')}</ul>` : '') + (O('results') ? ro('results') : '') + (O('tracking') ? `<h4>지표 · 이벤트</h4>${ro('tracking')}` : '') + (O('risks') ? `<h4>리스크 · 규정</h4>${ro('risks')}` : '') + (O('tools') ? `<h4>쓸 도구</h4>${extra(STEP.tools, true)}` : ''))}
    ${sec('debate', '토론에서 바뀐 점', (rev ? `<p>${esc(rev.summary)}</p>${ro('revise').replace(/<div class="fw-kv"><span class="fw-k">요약<\/span>.*?<\/div><\/div>/s, '')}` : '') + (O('redteam') ? `<details><summary>레드팀 지적 전체 (${O('redteam').critiques.length}개, 받아들인 것 ${proj.accepted.length}개)</summary>${extra(STEP.redteam, true)}</details>` : ''))}
    ${sec('press', '보도자료', O('press') ? `<div class="rp-press"><h3>${esc(O('press').headline)}</h3><p class="rp-lead">${esc(O('press').subhead)}</p>${String(O('press').body).split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}<blockquote>${esc(O('press').customer_quote)}</blockquote><blockquote>${esc(O('press').team_quote)}</blockquote><h4>FAQ</h4><dl>${(O('press').faq || []).map(f => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div>` : '')}
    ${sec('roadmap', '4주 로드맵', O('roadmap') ? `<div class="rp-weeks">${(O('roadmap').weeks || []).map(w => `<div><span>${w.week}주차</span><b>${esc(w.goal)}</b><ul>${(w.tasks || []).map(t => `<li>${esc(t.task)} <small>${esc(t.owner)} · ${esc(t.done_when)}</small></li>`).join('')}</ul></div>`).join('')}</div>` : '')}
  </article>`;
}

/* 마크다운: 확정한 단계를 순서대로 */
function mdNode(sc, v, depth) {
  if (v == null || v === '') return '';
  if (sc.type === 'object') return Object.entries(sc.properties).map(([k, s]) => { const x = v[k]; if (s.type === 'object' || (s.type === 'array' && s.items.type === 'object')) return `\n${'#'.repeat(Math.min(depth + 3, 6))} ${lab(k)}\n\n${mdNode(s, x, depth + 1)}`; if (s.type === 'array') return `- **${lab(k)}**: ${(x || []).join(' · ')}`; return `- **${lab(k)}**: ${String(x).replace(/\n/g, ' ')}`; }).join('\n');
  if (sc.type === 'array') { const it = sc.items; if (it.type !== 'object') return v.map(x => `- ${x}`).join('\n'); if (isFlat(it)) { const cols = Object.keys(it.properties), cell = x => String(x ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); return `| ${cols.map(lab).join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n` + v.map(r => `| ${cols.map(c => cell(r[c])).join(' | ')} |`).join('\n'); } return v.map((r, i) => `\n**${i + 1}.**\n\n${mdNode(it, r, depth + 1)}`).join('\n'); }
  return String(v);
}
function markdown() {
  const b = proj.brief, out = [`# ${b.title || '기획'}`, '', b.text && `> ${b.text.replace(/\n+/g, ' ')}`, b.text && '', `- 상황: ${b.situation}`, `- 목표: ${b.goal}`, b.constraints && `- 제약: ${b.constraints}`, b.target && `- 타겟 짐작: ${b.target}`, `- 사주 모드: ${b.saju ? '켜짐' : '꺼짐'}`, proj.selected.length && `- 프로덕트로 넘긴 아이디어: ${proj.selected.map(ideaName).join(', ')}`, proj.picked && `- 깊게 간 아이디어: ${ideaName(proj.picked)}`].filter(Boolean);
  STAGES.forEach(st => { out.push('', `## ${st.name}`); STEPS.filter(s => s.stage === st.id && O(s.id)).forEach(s => { out.push('', `### ${s.name}${done(s.id) ? '' : ' (초안)'}`, '', mdNode(s.schema, O(s.id), 1)); if (s.id === 'unit') { const c = unitCalc(O('unit')); out.push('', `- 건당 공헌이익 ${won(c.margin)} · LTV ${won(c.ltv)} · 월 손익분기 ${Number.isFinite(c.breakeven) ? c.breakeven + '건' : '-'}`, ...c.ch.map(x => `- ${x.name}: LTV/CAC ${Number.isFinite(x.ratio) ? x.ratio.toFixed(1) : '-'}`)); } if (s.id === 'experiments') out.push('', ...expRows().map((r, n) => `${n + 1}. ${r.assumption_id} ${r.method} — ICE ${r.ice}${r.days ? `, ${r.days}일` : ''}`)); }); });
  const res = Object.values(proj.results).filter(r => r.verdict); if (res.length) out.push('', '## 실험 결과', '', ...res.map(r => `- ${r.experiment}: ${r.verdict.verdict} (상승 ${pct(r.verdict.delta)}, χ² ${r.verdict.chi.toFixed(2)})`));
  if (proj.accepted.length) out.push('', '## 받아들인 레드팀 지적', '', ...proj.accepted.map(a => `- [${a.persona}] ${a.claim} → ${a.suggestion}`));
  return out.join('\n') + '\n';
}

/* ───── 시작 ───── */
try { P.theme && P.theme(); } catch (e) {}
proj = store.list.find(p => p.id === store.cur) || null;
document.addEventListener('click', e => { const a = e.target.closest('[data-jump]'); if (a) { e.preventDefault(); document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); } });
bind(); render();
window.FW = { STEPS, BRIEF_SCHEMA, markdown: () => proj && markdown(), get project() { return proj; } };
