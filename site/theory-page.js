/* 이론 공부 페이지: 서론 → WHAT(1~3) → WHY(4~5) → HOW(6, 다음에) 목록 + 같은 틀의 본문 + 단계별로 고른 DB 사례 */
(function(){
'use strict';
const {$, esc, STEPS, R, load, theme, href, hashFor, KEY} = window.P;
const T = window.THEORY, PARTS = window.PARTS;
const meta = Object.fromEntries(STEPS.map(s => [s.id, s]));
T.forEach(t => { const m = meta[t.id]; if (m) t.t = t.t || m.t; });
const byId = Object.fromEntries(T.map(t => [t.id, t]));
let cases = null, byCase = {}, cur = null;

function nav(){
  $('#steps').innerHTML = PARTS.map(P => {
    const head = `<h4 class="part">${esc(P.p)}${P.d ? `<small>${esc(P.d)}</small>` : ''}</h4>`;
    return head + P.steps.map(g => {
      const sub = g.includes(' · ') ? `<h5>${esc(g.split(' · ')[1])}</h5>` : '';
      if (P.soon) return sub + '<span class="soon">다음에 정리</span>';
      return sub + T.filter(t => t.g === g).map((t, i) => `<a href="${href('theory', t.id)}" data-id="${t.id}"><i><em>${esc(g.includes(' · ') ? KEY(g) + '-' : '')}</em>${g.includes(' · ') ? i + 1 : '·'}</i>${esc(t.t)}</a>`).join('');
    }).join('');
  }).join('');
}

function sec(title, html){ return html ? `<section class="tsec"><h2>${esc(title)}</h2>${html}</section>` : ''; }

/* DB 사례 상자: 이 단계용으로 고른 3~5개를 칩으로 */
function live(t){
  if (!R[t.id] || !t.cases) return '';
  return `<section class="tsec"><h2>DB 사례로 보기 <small>${t.cases.length}건</small></h2><div class="live"><div class="chips" id="lchips" role="tablist">${t.cases.map(([id], i) => `<button role="tab" data-c="${esc(id)}" aria-selected="${i === 0}">${esc(id)}</button>`).join('')}</div><div class="live-b" id="lbody"><p class="muted" style="margin:0">사례를 불러오는 중…</p></div></div></section>`;
}
function fillLive(t){
  const box = $('#lchips'); if (!box || !cases) return;
  box.querySelectorAll('button').forEach(b => { const c = byCase[b.dataset.c]; if (c) b.textContent = c.title; });
  const show = id => {
    const c = byCase[id], why = (t.cases.find(x => x[0] === id) || [])[1];
    box.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.c === id));
    $('#lbody').innerHTML = c ? `<div class="live-t"><b>${esc(why || '')}</b><br><a href="${href('db', c.id)}">${esc(c.title)}</a> · ${esc(c.domain)} · DB에서 전체 보기 →</div>${R[t.id](c)}` : '<p class="muted">사례를 찾지 못했어요.</p>';
  };
  box.onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.c); };
  show(t.cases[0][0]);
}

function render(id){
  const i = Math.max(0, T.findIndex(t => t.id === id));
  const t = T[i]; cur = t;
  document.querySelectorAll('#steps a').forEach(a => a.setAttribute('aria-current', a.dataset.id === t.id ? 'true' : 'false'));
  const prev = T[i - 1], next = T[i + 1];
  $('#tmain').innerHTML = `<div class="eyebrow">${esc(t.g)}</div><h1>${esc(t.t)}</h1>
    ${t.def ? `<p class="lead">${esc(t.def)}</p>` : ''}
    <div class="ask"><small>묻는 것</small>${esc(t.ask)}</div>
    ${t.cite ? `<figure class="cite"><blockquote>${esc(t.cite[0])}</blockquote><figcaption>${esc(t.cite[1])}</figcaption></figure>` : ''}
    ${sec('언제 쓰나', t.when ? `<p>${esc(t.when)}</p>` : '')}
    ${sec('하는 순서', t.how ? `<ol class="how">${t.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '')}
    ${sec(t.exTitle || '예시: 치과 대기', t.ex ? `<div class="ex">${t.ex}</div>` : '')}
    ${sec('더 알아보기', t.more ? `<div class="prose">${t.more}</div>` : '')}
    ${sec('흔한 실수', t.pit ? `<ul class="pit">${t.pit.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '')}
    ${sec('이어지는 툴', t.links ? `<ul class="links">${t.links.map(([lid, why]) => byId[lid] ? `<li><a href="${href('theory', lid)}">${esc(KEY(byId[lid].g))} · ${esc(byId[lid].t)}</a><span>${esc(why)}</span></li>` : '').join('')}</ul>` : '')}
    ${t.try ? `<div class="try"><b>스스로 해 보기</b>${esc(t.try)}</div>` : ''}
    ${live(t)}
    <div class="next">${prev ? `<a class="btn" href="${href('theory', prev.id)}">← ${esc(prev.t)}</a>` : ''}<span class="grow"></span>${next ? `<a class="btn dark" href="${href('theory', next.id)}">${esc(next.t)} →</a>` : `<a class="btn dark" href="${href('db')}">사례 DB로 →</a>`}</div>`;
  if (cases) fillLive(t);
  const a = document.querySelector(`#steps a[data-id="${t.id}"]`); if (a && a.scrollIntoView) a.scrollIntoView({block: 'nearest', inline: 'center'});
}

function route(){ const h = hashFor('theory'); if (h === null) return; render(h || 'intro'); window.scrollTo(0, 0); }

theme(); nav();
window.addEventListener('hashchange', route);
route();
load().then(cs => { cases = cs; byCase = Object.fromEntries(cs.map(c => [c.id, c])); if (cur) fillLive(cur); }).catch(() => { const b = $('#lbody'); if (b) b.innerHTML = '<p class="muted" style="margin:0">사례 데이터를 불러오지 못했어요.</p>'; });
window.TheoryPage = {route};
})();
