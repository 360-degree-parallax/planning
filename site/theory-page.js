/* 이론 공부 페이지: 왼쪽 단계 목록, 본문, 'DB 사례로 보기' */
(function(){
'use strict';
const {$, esc, STEPS, R, load, theme, href, hashFor} = window.P;
const T = window.THEORY;
const meta = Object.fromEntries(STEPS.map(s => [s.id, s]));
T.forEach(t => { const m = meta[t.id]; if (m) { t.g = t.g || m.g; t.n = t.n != null ? t.n : m.n; t.t = t.t || m.t; } });
const ORDER = ['시작', '문제 깨닫기', '본질 찾기', '구조화', '결과', '참고'];
let cases = null, cur = null;

function nav(){
  let h = '';
  for (const g of ORDER) {
    const items = T.filter(t => t.g === g); if (!items.length) continue;
    h += `<h4>${esc(g)}</h4>` + items.map(t => `<a href="${href('theory', t.id)}" data-id="${t.id}"><i>${esc(t.n || '·')}</i>${esc(t.t)}</a>`).join('');
  }
  $('#steps').innerHTML = h;
}

/* 이 단계를 잘 보여 주는 사례: 핵심(deep) 우선, BCG는 포트폴리오가 있는 사례만 */
function pool(id){
  if (!cases) return [];
  let p = cases.filter(c => c.depth === 'deep');
  if (id === 'bcg') p = cases.filter(c => c.bcg).sort((a, b) => (b.bcg.q_to_star - a.bcg.q_to_star));
  if (id === 'five_why' || id === 'pest' || id === 'swot') p = p.filter(c => c[id === 'five_why' ? 'five_why' : id]);
  return p.length ? p : cases;
}

function live(t){
  if (!R[t.id]) return '';
  return `<section class="live" id="live"><div class="live-h"><b>DB 사례로 보기</b><span class="grow"></span><select id="lsel" aria-label="사례 고르기"></select><button class="btn sm" id="lrnd">다른 사례</button></div><div class="live-b" id="lbody"><p class="muted" style="margin:0">사례를 불러오는 중…</p></div></section>`;
}

function fillLive(t, pick){
  const sel = $('#lsel'); if (!sel || !cases) return;
  const p = pool(t.id);
  sel.innerHTML = p.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
  const c = p.find(x => x.id === pick) || p[0];
  sel.value = c.id;
  const show = c => {
    $('#lbody').innerHTML = `<div class="live-t"><a href="${href('db', c.id)}">${esc(c.title)}</a> · ${esc(c.domain)}</div>${R[t.id](c)}`;
  };
  show(c);
  sel.onchange = () => show(p.find(x => x.id === sel.value));
  $('#lrnd').onclick = () => { const x = p[Math.floor(Math.random() * p.length)]; sel.value = x.id; show(x); };
}

function render(id){
  const i = Math.max(0, T.findIndex(t => t.id === id));
  const t = T[i]; cur = t;
  document.querySelectorAll('#steps a').forEach(a => a.setAttribute('aria-current', a.dataset.id === t.id ? 'true' : 'false'));
  const prev = T[i - 1], next = T[i + 1];
  $('#tmain').innerHTML = `<div class="eyebrow">${esc(t.g)}${t.n ? ' · ' + esc(t.n) : ''}</div><h1>${esc(t.t)}</h1>
    <div class="ask"><small>묻는 것</small>${esc(t.ask)}</div>
    <div class="prose">${t.body}</div>
    ${t.try ? `<div class="try"><b>스스로 해 보기</b>${esc(t.try)}</div>` : ''}
    ${live(t)}
    <div class="next">${prev ? `<a class="btn" href="${href('theory', prev.id)}">← ${esc(prev.t)}</a>` : ''}<span class="grow"></span>${next ? `<a class="btn dark" href="${href('theory', next.id)}">${esc(next.t)} →</a>` : `<a class="btn dark" href="${href('db')}">사례 DB로 →</a>`}</div>`;
  document.querySelectorAll('[data-flow]').forEach(el => {
    const items = T.filter(x => x.g === el.dataset.flow);
    el.innerHTML = items.map((x, k) => `${k ? '<span class="arr">→</span>' : ''}<a href="${href('theory', x.id)}">${esc(x.t)}</a>`).join('');
  });
  if (cases) fillLive(t);
  const a = document.querySelector(`#steps a[data-id="${t.id}"]`); if (a && a.scrollIntoView) a.scrollIntoView({block: 'nearest', inline: 'center'});
}

function route(){ const h = hashFor('theory'); if (h === null) return; render(h || 'intro'); window.scrollTo(0, 0); }

theme(); nav();
window.addEventListener('hashchange', route);
route();
load().then(cs => { cases = cs; if (cur) fillLive(cur); }).catch(() => { const b = $('#lbody'); if (b) b.innerHTML = '<p class="muted" style="margin:0">사례 데이터를 불러오지 못했어요.</p>'; });
window.TheoryPage = {route};
})();
