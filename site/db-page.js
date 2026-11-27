/* 사례 DB 페이지: 업종 탭 + 거르기 + 목록 + 방법론 순서 상세 */
(function(){
'use strict';
const {$, esc, tag, L, STEPS, R, load, theme, href, hashFor, setHash} = window.P;
let all = [], view = [], shown = 60, group = '', sel = null;
const F = ['q', 'fkind', 'fdepth', 'fentry', 'fansoff', 'fbcg', 'fwny', 'fmode'];

const hay = c => [c.title, c.domain, c.what && c.what.problem, c.what && c.what.symptom, c.solution, c.so_what && c.so_what.conclusion, c.lesson, c.id, c.bcg && c.bcg.units.map(u => u.name).join(' ')].join(' ').toLowerCase();

function filter(){
  const v = Object.fromEntries(F.map(k => [k, $('#' + k).value]));
  const q = v.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  view = all.filter(c => {
    if (group && c.domain_group !== group) return false;
    if (v.fkind && c.kind !== v.fkind) return false;
    if (v.fdepth && c.depth !== v.fdepth) return false;
    if (v.fentry && !(c.three_c.entry || []).includes(v.fentry)) return false;
    if (v.fansoff === 'focus' ? !c.ansoff.focus : v.fansoff && c.ansoff.cell !== v.fansoff) return false;
    if (v.fbcg === 'has' && !c.bcg) return false;
    if (v.fbcg === 'q2s' && !(c.bcg && c.bcg.q_to_star)) return false;
    if (v.fbcg === 'exit' && !(c.bcg && (c.bcg.after === 'exit' || c.bcg.after === 'dog'))) return false;
    if (v.fwny && !c.hyps.some(h => h.verdict === v.fwny)) return false;
    if (v.fmode && c.deep_why.mode !== v.fmode) return false;
    if (q.length) { const h = c._h || (c._h = hay(c)); if (!q.every(w => h.includes(w))) return false; }
    return true;
  });
  shown = 60; list();
}

function tabs(){
  const cnt = {}; all.forEach(c => cnt[c.domain_group] = (cnt[c.domain_group] || 0) + 1);
  const gs = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  $('#dbtabs').innerHTML = `<button data-g="" aria-pressed="${!group}">전체<small>${all.length}</small></button>` + gs.map(g => `<button data-g="${esc(g)}" aria-pressed="${group === g}">${esc(g)}<small>${cnt[g]}</small></button>`).join('');
}

function list(){
  $('#cnt').textContent = `${view.length}건`;
  if (!view.length) { $('#list').innerHTML = '<p class="empty" style="padding:24px 16px">조건에 맞는 사례가 없어요</p>'; return; }
  $('#list').innerHTML = view.slice(0, shown).map(c => `<button class="row" data-id="${esc(c.id)}" aria-selected="${sel === c.id}">
    <span><div class="rt">${esc(c.title)}</div><div class="rm">${esc(c.domain)} · ${L.kind[c.kind]}${c.depth === 'deep' ? ' · 핵심' : ''}</div></span>
    <span class="rb">${c.kind === 'failure' ? tag('실패', 'no') : ''}${tag('진입 ' + (c.three_c.entry || []).join('·'))}${tag(L.ansoff[c.ansoff.cell], c.ansoff.focus ? 'on' : '')}${c.bcg ? tag('BCG ' + L.bcg[c.bcg.before] + '→' + L.bcg[c.bcg.after], c.bcg.q_to_star ? 'ok' : '') : ''}</span>
    <span class="rs">${esc((c.so_what && c.so_what.conclusion) || c.solution)}</span></button>`).join('')
    + (view.length > shown ? `<button class="more" id="more">${view.length - shown}건 더 보기</button>` : '');
}

/* 한눈에: 설명하기 어려운 비즈니스를 툴 칸으로 간략하게 */
function glance(c){
  const p = c.pest || {}, f = p.focus || [];
  const surv = c.hyps.filter(h => L.pass[h.verdict]).map(h => L.verdict[h.verdict]);
  return `<dl class="kv">
    <dt>문제</dt><dd>${esc(c.what.problem)}</dd>
    <dt>PEST</dt><dd>${f.length ? f.map(k => `${L.pest[k][1]}: ${esc(p[L.pest[k][0]])}`).join(' / ') : 'P·T 영향 적음'}</dd>
    <dt>3C 진입</dt><dd><b>${esc((c.three_c.entry || []).join('·'))}</b> ${esc(c.three_c.entry_why)}</dd>
    <dt>앤소프</dt><dd><b>${esc(L.ansoff[c.ansoff.cell])}</b>${c.ansoff.focus ? ' (집중)' : ''}</dd>
    ${c.bcg ? `<dt>BCG</dt><dd><b>${esc(c.bcg.target)}</b> ${L.bcg[c.bcg.before]} → ${L.bcg[c.bcg.after]}</dd>` : ''}
    <dt>Why not yet</dt><dd>${surv.length ? [...new Set(surv)].join('·') + '으로 생존' : '생존 가설 없음'}</dd>
    <dt>So what</dt><dd><b>${esc((c.so_what && c.so_what.conclusion) || '-')}</b></dd>
    <dt>해결</dt><dd>${esc(c.solution)}</dd></dl>`;
}

function detail(id){
  const c = all.find(x => x.id === id), side = $('#side');
  if (!c) { side.classList.add('idle'); side.innerHTML = '<p class="empty">사례를 누르면 방법론 순서대로 자세히 보여요</p>'; sel = null; return; }
  sel = id; side.classList.remove('idle');
  document.querySelectorAll('.row').forEach(r => r.setAttribute('aria-selected', r.dataset.id === id));
  const steps = STEPS.filter(s => s.id !== 'bcg' || c.bcg);
  side.innerHTML = `<div class="dhead"><div><div class="rm">${esc(c.domain)} · ${L.kind[c.kind]} · ${L.depth[c.depth]}${c.verified ? ' · 출처 확인' : ''}</div><h2>${esc(c.title)}</h2></div><button class="ib close" id="close" aria-label="닫기"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <nav class="dtoc">${['한눈에'].concat(steps.map(s => s.t)).map((t, i) => `<a href="#d-${i ? steps[i - 1].id : 'glance'}" data-jump>${esc(t)}</a>`).join('')}</nav>
    <section class="dsec" id="d-glance"><h3>한눈에 <a href="${href('theory', 'intro')}">왜 구조화하나</a></h3>${glance(c)}</section>
    ${steps.map(s => `<section class="dsec" id="d-${s.id}"><h3><i>${esc(s.k)}</i>${esc(s.t)} <a href="${href('theory', s.theory || s.id)}">이론 보기</a></h3>${R[s.id](c) || '<p class="muted" style="margin:0">-</p>'}</section>`).join('')}`;
  side.scrollTop = 0;
  $('#close').onclick = () => { setHash('db', ''); detail(null); };
}

function route(){ const id = hashFor('db'); if (id && all.length) detail(id); }

theme();
$('#list').addEventListener('click', e => {
  if (e.target.id === 'more') { shown += 60; list(); return; }
  const r = e.target.closest('.row'); if (!r) return;
  setHash('db', r.dataset.id); detail(r.dataset.id);
});
$('#side').addEventListener('click', e => {
  const a = e.target.closest('[data-jump]'); if (!a) return;
  e.preventDefault(); const t = $(a.getAttribute('href'), $('#side')); if (t) $('#side').scrollTo({top: t.offsetTop - 50, behavior: 'smooth'});
});
$('#dbtabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; group = b.dataset.g; tabs(); filter(); });
F.forEach(k => $('#' + k).addEventListener(k === 'q' ? 'input' : 'change', filter));
$('#freset').onclick = () => { F.forEach(k => $('#' + k).value = ''); group = ''; tabs(); filter(); };
window.addEventListener('hashchange', route);

load().then(cs => {
  all = cs;
  const b = cs.filter(c => c.bcg).length;
  $('#dbdesc').textContent = `사례 ${cs.length}건 · 핵심 ${cs.filter(c => c.depth === 'deep').length}건 · BCG(제품 여러 개) ${b}건. 사례를 누르면 5 Why부터 중요 지표까지 방법론 순서대로 보여요.`;
  tabs(); filter(); route();
}).catch(() => { $('#dbdesc').textContent = '사례 데이터를 불러오지 못했어요.'; });
window.DbPage = {route};
})();
