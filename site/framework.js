// 프레임워크 페이지 — 아이데이션 → 프로덕트 → 검증 → 토론.
// 단계마다 주관식 지시 + 생성. 만든 기획안은 그 자리에 쌓이고, 채택한 안(없으면 최신)이 다음 단계의 맥락이 된다.
// Claude가 문제를 푸는 방향과 쓸 도구를 스스로 고른다. 모바일 우선 화면.
import { STAGES, STAGE, MODEL, generate, check, usedPlan, planSchema } from './framework-ai.mjs';

const P = window.P;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const KEY = 'noah-key', STORE = 'framework-v2';
const toast = m => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); };
const fmt = t => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/* 마크다운 일부 → HTML (노아와 같은 규칙) */
const inl = s => s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n][^\n]*?)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<i>$2</i>');
function md(t) {
  const L = esc(String(t || '').replace(/\r\n?/g, '\n')).split('\n'), out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inl).join('<br>')}</p>`); para = []; } if (list) { out.push(`<${list.tag}>${list.items.map(x => `<li>${inl(x)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (let i = 0; i < L.length; i++) { const l = L[i]; let m;
    if (!l.trim()) { flush(); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out.push('<hr>'); continue; }
    if ((m = /^\s*#{1,6}\s+(.*)$/.exec(l))) { flush(); out.push(`<p class="md-h">${inl(m[1])}</p>`); continue; }
    if ((m = /^\s*&gt;\s?(.*)$/.exec(l))) { flush(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) { flush(); const rows = []; while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) { if (!/^\s*\|[\s:|-]+\|\s*$/.test(L[i])) rows.push(L[i].trim().slice(1, -1).split('|').map(c => inl(c.trim()))); i++; } i--; out.push(`<div class="fw-tbl"><table>${rows.map((r, j) => `<tr>${r.map(c => j ? `<td>${c}</td>` : `<th>${c}</th>`).join('')}</tr>`).join('')}</table></div>`); continue; }
    if ((m = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(l))) { const tag = m[1] ? 'ul' : 'ol'; if (para.length) { out.push(`<p>${para.map(inl).join('<br>')}</p>`); para = []; } if (!list || list.tag !== tag) { if (list) flush(); list = { tag, items: [] }; } list.items.push(m[3]); continue; }
    if (list) flush(); para.push(l); }
  flush(); return out.join('');
}

/* 이론 id → 이름 · 링크 */
const META = Object.fromEntries((P.STEPS || []).map(s => [s.id, s]));
const THEORY = {}; (window.CHAPTERS || []).forEach(ch => ch.T.forEach(t => { THEORY[t.id] = { view: ch.view, no: ch.no, t: t.t || META[t.id]?.t || t.id }; }));
const toolChip = id => { const x = THEORY[id]; return x ? `<a class="fw-chip" href="${esc(P.href(x.view, id))}" target="_blank" rel="noopener">${x.no}장 · ${esc(x.t.split(' — ')[0])}</a>` : ''; };

/* ───── 상태 ───── */
let key = ls.get(KEY, ''), store = ls.get(STORE, { list: [], cur: null }), proj = null, busy = null, ctrl = null, cur = 'idea';
const DATA = { cases: null, context: null };
const blankProject = () => ({ id: 'p' + Date.now(), created: Date.now(), updated: Date.now(), title: '', origin: '', saju: true, cur: 'idea', drafts: {}, stages: Object.fromEntries(STAGES.map(s => [s.id, { plans: [], adopted: null }])) });
const save = () => { if (!proj) return; proj.updated = Date.now(); proj.cur = cur; const i = store.list.findIndex(p => p.id === proj.id); if (i < 0) store.list.unshift(proj); else store.list[i] = proj; store.cur = proj.id; if (!ls.set(STORE, store)) toast('브라우저 저장 공간이 꽉 찼어요. 오래된 프로젝트를 내보내고 지워 주세요'); };
async function loadData(saju) {
  const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => null);
  if (!DATA.cases) DATA.cases = await (P.load ? P.load().catch(() => null) : j('data/cases.min.json'));
  if (saju && !DATA.context) DATA.context = await j('data/framework-context.min.json');
}

/* ───── 핵심(core) 렌더 ───── */
const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
const kv = (k, v) => v ? `<div class="fw-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : '';
function core(stage, c) {
  if (!c) return '';
  if (stage === 'idea') return `${kv('진짜 문제', c.problem)}${kv('목표', c.goal)}<ol class="fw-ideas">${(c.ideas || []).map(x => `<li class="${x.title === c.pick ? 'on' : ''}"><b>${esc(x.title)}${x.title === c.pick ? ' <span class="tag on">추천</span>' : ''}</b><span>${esc(x.summary)}</span><small>${esc(x.why)}</small></li>`).join('')}</ol>${c.pick_reason ? `<p class="fw-note">추천 이유 — ${esc(c.pick_reason)}</p>` : ''}`;
  if (stage === 'product') return `${kv('컨셉', c.concept)}${kv('타겟', c.target)}${kv('핵심 가치', c.value)}${kv('북극성 지표', c.north_star)}${c.flow?.length ? `<div class="fw-sub">핵심 경험</div><ol class="fw-flow">${(c.flow).map((x, i) => `<li><em>${i + 1}</em>${esc(x)}</li>`).join('')}</ol>` : ''}<div class="fw-2col"><div><div class="fw-sub">MVP</div><ul>${li(c.mvp)}</ul></div><div><div class="fw-sub">이번엔 안 함</div><ul>${li(c.not_now)}</ul></div></div>`;
  if (stage === 'verify') return `<div class="fw-sub">위험한 가정</div><ul class="fw-asm">${[...(c.assumptions || [])].sort((a, b) => b.risk - a.risk).map(a => `<li><i class="r${Math.min(Math.max(a.risk, 1), 5)}">${a.risk}</i><span><b>${esc(a.assumption)}</b><small>근거: ${esc(a.evidence)}</small></span></li>`).join('')}</ul><div class="fw-sub">실험</div><div class="fw-exps">${(c.experiments || []).map((e, i) => `<div><em>${i + 1}</em><b>${esc(e.method)}</b><span>${esc(e.assumption)}</span><small>지표 ${esc(e.metric)} · 성공 ${esc(e.success)} · ${esc(e.cost)}</small></div>`).join('')}</div>`;
  if (stage === 'debate') { const b = c.brief || {}; return `<div class="fw-brief1"><p class="fw-slogan">${esc(b.slogan)}</p>${kv('왜', b.why)}${kv('누구에게', b.who)}${kv('무엇을', b.what)}${kv('어떻게', b.how)}${b.expected?.length ? `<div class="fw-kv"><span>기대 효과</span><b><ul>${li(b.expected)}</ul></b></div>` : ''}${b.so_what ? `<p class="fw-note"><b>결론</b> ${esc(b.so_what)}</p>` : ''}</div><details class="fw-red"><summary>레드팀 지적 ${(c.critiques || []).length}개 · 바뀐 점 ${(c.changes || []).length}개</summary><ul class="fw-crit">${(c.critiques || []).map(x => `<li><span class="fw-who">${esc(x.persona)}</span><b>${esc(x.claim)}</b><small>→ ${esc(x.fix)}</small></li>`).join('')}</ul>${c.changes?.length ? `<div class="fw-sub">바뀐 점</div><ul>${li(c.changes)}</ul>` : ''}</details>`; }
  return '';
}
function planBody(stage, p) {
  const o = p.out;
  return `<p class="fw-sum">${esc(o.summary)}</p>${o.approach ? `<p class="fw-appr"><b>이렇게 풀었어요</b> ${esc(o.approach)}</p>` : ''}
    <div class="fw-core">${core(stage, o.core)}</div>
    ${(o.sections || []).map(s => `<section class="fw-sec"><h4>${esc(s.heading)} ${s.tool_id ? toolChip(s.tool_id) : ''}</h4><div class="md">${md(s.body)}</div></section>`).join('')}
    ${o.open_questions?.length ? `<div class="fw-q"><b>확인해 주세요</b><ul>${li(o.open_questions)}</ul></div>` : ''}`;
}
function card(stage, p, n, open) {
  const st = proj.stages[stage], ad = st.adopted === p.id, i = STAGES.findIndex(s => s.id === stage), next = STAGES[i + 1];
  return `<details class="fw-card${ad ? ' ad' : ''}" ${open ? 'open' : ''} data-plan="${p.id}"><summary><span class="fw-v">${n}</span><span class="fw-ct"><b>${esc(p.out.title)}</b><small>${fmt(p.at)}${ad ? ' · 채택' : ''}</small></span><svg class="i fw-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></summary>
    ${p.instruction ? `<p class="fw-instr">지시 · ${esc(p.instruction)}</p>` : ''}${planBody(stage, p)}
    <div class="fw-acts"><button class="btn sm ${ad ? '' : 'dark'}" data-adopt="${p.id}">${ad ? '채택 해제' : '이 안 채택'}</button>${next ? `<button class="btn sm" data-next="${p.id}">이 안으로 ${next.name} →</button>` : `<a class="btn sm" href="#report">결과 보기</a>`}<span class="grow"></span><button class="ib sm" data-del="${p.id}" aria-label="이 기획안 지우기" title="지우기"><svg viewBox="0 0 24 24" class="i"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></div></details>`;
}

/* ───── 화면 ───── */
const root = () => document.getElementById('fw');
const ICON = { gear: '<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>', more: '<svg viewBox="0 0 24 24" class="i"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>' };
function top() {
  const list = store.list;
  return `<div class="fw-top"><select data-proj aria-label="프로젝트"><option value="">+ 새 프로젝트</option>${list.map(p => `<option value="${p.id}"${proj && p.id === proj.id ? ' selected' : ''}>${esc(p.title || p.origin.slice(0, 24) || '제목 없음')}</option>`).join('')}</select>
    ${proj && STAGES.some(s => proj.stages[s.id].plans.length) ? '<a class="btn sm dark" href="#report">결과 보기</a>' : ''}
    <details class="fw-menu"><summary class="ib" aria-label="더 보기">${ICON.more}</summary><div class="fw-pop">
      <button data-act="key">${ICON.gear} API 키${key ? '' : ' (없음)'}</button>
      ${proj ? '<button data-act="export">JSON 내보내기</button>' : ''}<label>JSON 가져오기<input type="file" accept=".json,application/json" data-import hidden></label>
      ${proj ? '<button data-act="delproj" class="no">이 프로젝트 지우기</button>' : ''}</div></details></div>
    <div class="fw-key" ${key ? 'hidden' : ''}><p><b>Claude API 키</b> — 노아와 같은 키예요. 이 브라우저에만 저장되고 Anthropic API로만 보내져요.</p><form data-keyform><input type="password" placeholder="sk-ant-…" autocomplete="off" aria-label="Anthropic API 키"><button class="btn sm dark">저장</button>${key ? '<button type="button" class="btn sm" data-act="keydel">지우기</button>' : ''}</form></div>`;
}
function tabs() {
  return `<nav class="fw-tabs" aria-label="단계">${STAGES.map((s, i) => { const n = proj ? proj.stages[s.id].plans.length : 0; return `<button data-tab="${s.id}" aria-selected="${s.id === cur}"><em>${i + 1}</em><span>${s.name}</span>${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}</nav>`;
}
function composer() {
  const s = STAGE[cur], i = STAGES.indexOf(s), prev = STAGES.slice(0, i).map(x => [x, proj && usedPlan(proj, x.id)]);
  const draft = proj?.drafts?.[cur] || '';
  const ctx = i ? `<div class="fw-ctx">${prev.map(([x, p]) => `<span class="${p ? '' : 'none'}">${x.name}: ${p ? esc(p.out.title) + (proj.stages[x.id].adopted === p.id ? ' (채택)' : ' (최신)') : '없음 → 추론'}</span>`).join('')}</div>` : '';
  const running = busy === cur;
  return `<section class="fw-comp"><p class="fw-desc">${esc(s.desc)}</p>${ctx}
    <textarea data-draft rows="4" placeholder="${esc(s.placeholder)}" aria-label="지시">${esc(draft)}</textarea>
    <div class="fw-crow">${cur === 'idea' && !(proj && proj.origin) ? `<label class="fw-tg"><input type="checkbox" data-saju ${!proj || proj.saju ? 'checked' : ''}> 사주 모드</label>` : (proj?.saju ? '<span class="tag on">사주 모드</span>' : '')}<span class="grow"></span>${running ? '<button class="btn sm" data-act="cancel">멈추기</button>' : `<button class="btn dark fw-gen" data-act="gen">생성</button>`}</div></section>`;
}
function stack() {
  const run = busy === cur ? `<div class="fw-card fw-run"><span class="fw-spin"></span><span data-status>준비 중</span></div>` : '';
  const err = proj?.err?.[cur] ? `<p class="fw-warn">${esc(proj.err[cur])}</p>` : '';
  const plans = proj ? proj.stages[cur].plans : [];
  if (!plans.length && !run) return err + `<p class="fw-empty">${cur === 'idea' ? '문제를 쓰고 생성을 누르면 여기에 기획안이 쌓여요.' : '지시를 쓰거나 비워 둔 채 생성하면 여기에 기획안이 쌓여요.'}</p>`;
  return err + run + plans.map((p, k) => card(cur, p, plans.length - k, k === 0)).join('');
}
function render() {
  const el = root(); if (!el) return;
  if (location.hash === '#report' && proj) { el.innerHTML = report(); return; }
  el.innerHTML = top() + tabs() + composer() + `<div class="fw-stack">${stack()}</div>`;
  grow(el.querySelector('[data-draft]'));
}
const grow = ta => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(Math.max(ta.scrollHeight, 104), Math.round(innerHeight * 0.45)) + 'px'; };

/* ───── 동작 ───── */
async function gen() {
  if (!key) { const k = root().querySelector('.fw-key'); if (k) k.hidden = false; toast('API 키를 먼저 넣어 주세요'); return; }
  if (busy) return;
  const ta = root().querySelector('[data-draft]'), instruction = (ta?.value || '').trim();
  if (!proj) { proj = blankProject(); proj.saju = !!root().querySelector('[data-saju]')?.checked; }
  if (cur === 'idea' && !proj.origin) { if (!instruction) { toast('풀고 싶은 문제를 먼저 써 주세요'); return; } proj.origin = instruction; proj.saju = root().querySelector('[data-saju]') ? !!root().querySelector('[data-saju]').checked : proj.saju; }
  const stage = STAGE[cur]; busy = cur; ctrl = new AbortController(); proj.err = proj.err || {}; delete proj.err[cur]; save(); render();
  try {
    await loadData(proj.saju);
    const { out, usage, model } = await generate(key, proj, stage, DATA, instruction, { signal: ctrl.signal, onStatus: s => { const n = root().querySelector('[data-status]'); if (n) n.textContent = s; } });
    proj.stages[cur].plans.unshift({ id: 'v' + Date.now(), at: Date.now(), instruction, out, usage, model });
    if (!proj.title && cur === 'idea') proj.title = out.title;
    proj.drafts[cur] = '';
  } catch (e) { proj.err[cur] = ctrl.signal.aborted ? '멈췄어요' : (/401|authentication/i.test(e.message) ? 'API 키가 올바르지 않아요. 키를 확인해 주세요' : e.message || String(e)); }
  finally { busy = null; ctrl = null; save(); render(); }
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name.replace(/[\\/:*?"<>|]/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

function bind() {
  const el = root();
  el.addEventListener('input', e => { const t = e.target; if (t.dataset.draft !== undefined) { grow(t); if (proj) { proj.drafts[cur] = t.value; save(); } } });
  el.addEventListener('keydown', e => { if (e.target.dataset.draft !== undefined && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); gen(); } });
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-tab],[data-adopt],[data-next],[data-del],[data-jump]'); if (!t) return;
    if (t.dataset.jump !== undefined) { e.preventDefault(); document.querySelector(t.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (t.dataset.tab) { cur = t.dataset.tab; if (proj) save(); render(); return; }
    if (t.dataset.adopt) { const st = proj.stages[cur]; st.adopted = st.adopted === t.dataset.adopt ? null : t.dataset.adopt; save(); render(); toast(st.adopted ? '채택했어요 — 다음 단계는 이 안을 바탕으로 해요' : '채택을 풀었어요 — 다음 단계는 최신 안을 써요'); return; }
    if (t.dataset.next) { proj.stages[cur].adopted = t.dataset.next; cur = STAGES[STAGES.findIndex(s => s.id === cur) + 1].id; save(); render(); scrollTo({ top: root().offsetTop - 56, behavior: 'smooth' }); root().querySelector('[data-draft]')?.focus({ preventScroll: true }); return; }
    if (t.dataset.del) { if (!confirm('이 기획안을 지울까요?')) return; const st = proj.stages[cur]; st.plans = st.plans.filter(p => p.id !== t.dataset.del); if (st.adopted === t.dataset.del) st.adopted = null; save(); render(); return; }
    const a = t.dataset.act; t.closest('details.fw-menu')?.removeAttribute('open');
    if (a === 'gen') gen();
    else if (a === 'cancel') ctrl?.abort();
    else if (a === 'key') { const k = el.querySelector('.fw-key'); k.hidden = !k.hidden; if (!k.hidden) k.querySelector('input').focus(); }
    else if (a === 'keydel') { key = ''; ls.del(KEY); render(); }
    else if (a === 'export') download(`${proj.title || 'framework'}.json`, JSON.stringify(proj, null, 2), 'application/json');
    else if (a === 'delproj' && confirm('이 프로젝트를 지울까요? 되돌릴 수 없어요')) { store.list = store.list.filter(p => p.id !== proj.id); proj = null; store.cur = null; cur = 'idea'; ls.set(STORE, store); render(); }
    else if (a === 'print') window.print();
    else if (a === 'md') download(`${proj.title || 'framework'}.md`, markdown(), 'text/markdown');
  });
  el.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; if (f.dataset.keyform === undefined) return;
    const v = f.querySelector('input').value.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v) || v.startsWith('sk-ant-admin')) { alert('Claude API 키 형식이 아니에요 (sk-ant-로 시작하는 일반 키)'); return; }
    try { await check(v); } catch (err) { if (!confirm(`키 확인에 실패했어요(${err.status || err.message}). 그래도 저장할까요?`)) return; }
    key = v; ls.set(KEY, key); render(); toast('키를 저장했어요');
  });
  el.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.proj !== undefined) { proj = store.list.find(p => p.id === t.value) || null; store.cur = proj?.id || null; cur = proj?.cur || 'idea'; ls.set(STORE, store); render(); }
    if (t.dataset.saju !== undefined && proj) { proj.saju = t.checked; save(); }
    if (t.dataset.import !== undefined) { const file = t.files[0]; if (!file) return; file.text().then(x => { const p = JSON.parse(x); if (!p.stages || !p.stages.idea) throw new Error('프레임워크 프로젝트 파일이 아니에요'); p.id = 'p' + Date.now(); proj = p; cur = p.cur || 'idea'; save(); render(); toast('가져왔어요'); }).catch(err => alert(err.message)); }
  });
  window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
}

/* ───── 결과 보기 ───── */
function report() {
  const used = Object.fromEntries(STAGES.map(s => [s.id, usedPlan(proj, s.id)])), brief = used.debate?.out.core.brief;
  return `<div class="fw-top noprint"><a class="btn sm" href="#">← 편집으로</a><span class="grow"></span><button class="btn sm" data-act="md">마크다운</button><button class="btn sm dark" data-act="print">인쇄 · PDF</button></div>
  <article class="rp">
    <header class="rp-hero"><span class="muted">기획 프레임워크 · ${new Date(proj.updated).toLocaleDateString('ko-KR')}${proj.saju ? ' · 사주 모드' : ''}</span><h1>${esc(brief?.slogan || proj.title || '기획')}</h1><p class="rp-lead">${esc(used.idea?.out.core.problem || proj.origin)}</p></header>
    <details class="rp-origin"><summary>처음 문제</summary><p>${esc(proj.origin)}</p></details>
    <nav class="rp-toc noprint">${STAGES.map(s => used[s.id] ? `<a href="#rp-${s.id}" data-jump>${s.name}</a>` : '').join('')}</nav>
    ${STAGES.map((s, i) => { const p = used[s.id]; if (!p) return `<section class="rp-sec rp-none"><h2>${i + 1}. ${s.name}</h2><p class="muted">아직 없어요.</p></section>`; return `<section class="rp-sec" id="rp-${s.id}"><h2>${i + 1}. ${s.name} <small>${esc(p.out.title)}${proj.stages[s.id].adopted === p.id ? '' : ' · 최신 안'}</small></h2>${planBody(s.id, p)}</section>`; }).join('')}
  </article>`;
}
function mdCore(stage, c) {
  if (!c) return '';
  const L = a => (a || []).map(x => `- ${x}`).join('\n');
  if (stage === 'idea') return `- 진짜 문제: ${c.problem}\n- 목표: ${c.goal}\n\n${(c.ideas || []).map((x, i) => `${i + 1}. **${x.title}**${x.title === c.pick ? ' (추천)' : ''} — ${x.summary} (${x.why})`).join('\n')}\n\n추천 이유: ${c.pick_reason}`;
  if (stage === 'product') return `- 컨셉: ${c.concept}\n- 타겟: ${c.target}\n- 핵심 가치: ${c.value}\n- 북극성: ${c.north_star}\n\n**핵심 경험**\n${(c.flow || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n**MVP**\n${L(c.mvp)}\n\n**이번엔 안 함**\n${L(c.not_now)}`;
  if (stage === 'verify') return `**위험한 가정**\n${(c.assumptions || []).map(a => `- (${a.risk}) ${a.assumption} — 근거: ${a.evidence}`).join('\n')}\n\n**실험**\n${(c.experiments || []).map((e, i) => `${i + 1}. ${e.method} — ${e.assumption} / 지표 ${e.metric} / 성공 ${e.success} / ${e.cost}`).join('\n')}`;
  if (stage === 'debate') { const b = c.brief || {}; return `**${b.slogan}**\n\n- 왜: ${b.why}\n- 누구에게: ${b.who}\n- 무엇을: ${b.what}\n- 어떻게: ${b.how}\n- 기대 효과: ${(b.expected || []).join(' · ')}\n- 결론: ${b.so_what}\n\n**레드팀**\n${(c.critiques || []).map(x => `- [${x.persona}] ${x.claim} → ${x.fix}`).join('\n')}\n\n**바뀐 점**\n${L(c.changes)}`; }
  return '';
}
function markdown() {
  const out = [`# ${proj.title || '기획'}`, '', `> ${proj.origin.replace(/\n+/g, ' ')}`];
  STAGES.forEach((s, i) => { const p = usedPlan(proj, s.id); if (!p) return; const o = p.out; out.push('', `## ${i + 1}. ${s.name} — ${o.title}`, '', o.summary, '', `_이렇게 풀었어요: ${o.approach}_`, '', mdCore(s.id, o.core)); (o.sections || []).forEach(x => out.push('', `### ${x.heading}${x.tool_id && THEORY[x.tool_id] ? ` (${THEORY[x.tool_id].no}장 ${THEORY[x.tool_id].t})` : ''}`, '', x.body)); if (o.open_questions?.length) out.push('', '확인할 것:', ...o.open_questions.map(q => `- ${q}`)); });
  return out.join('\n') + '\n';
}

/* ───── 시작 ───── */
try { P.theme && P.theme(); } catch (e) {}
proj = store.list.find(p => p.id === store.cur) || null; cur = proj?.cur || 'idea';
document.addEventListener('click', e => { const m = document.querySelector('details.fw-menu[open]'); if (m && !m.contains(e.target)) m.removeAttribute('open'); });
bind(); render();
window.FW = { STAGES, planSchema, markdown: () => proj && markdown(), get project() { return proj; } };
