/* 이론: 1장 한 페이지(줄글) + 나무위키식 목차 위젯(본문 위 목차 상자, 옆 고정 목차, 모바일 목차 버튼) */
(function(){
'use strict';
const {$, esc, STEPS, R, load, theme, href, hashFor, KEY} = window.P;
const T = window.THEORY, PARTS = window.PARTS, VIZ = window.VIZ || {};
const meta = Object.fromEntries(STEPS.map(s => [s.id, s]));
T.forEach(t => { const m = meta[t.id]; if (m) t.t = t.t || m.t; });
const byId = Object.fromEntries(T.map(t => [t.id, t]));
const NUM = '①②③④⑤⑥⑦⑧⑨';
let cases = null, byCase = {};

/* 번호 매기기: 파트 → 단계 → 항목 */
const toc = [];   // {id, n, t, lv}
const secNo = {}; // 항목 id → 번호
PARTS.forEach((P, pi) => {
  const pn = String(pi + 1);
  const steps = P.steps.map(g => ({g, items: T.filter(t => t.g === g)})).filter(s => s.items.length);
  if (P.p === '서론') { const it = steps[0].items[0]; toc.push({id: it.id, n: pn, t: '서론: ' + it.t, lv: 1}); secNo[it.id] = pn; return; }
  toc.push({id: 'part-' + P.p, n: pn, t: P.p + ' — ' + P.d, lv: 1});
  steps.forEach((S, si) => {
    const sn = pn + '.' + (si + 1), title = S.g.split(' · ')[1].replace(/^\d\.\s*/, '');
    if (S.items.length === 1 && S.items[0].t === title) { toc.push({id: S.items[0].id, n: sn, t: title, lv: 2}); secNo[S.items[0].id] = sn; return; }
    toc.push({id: 'step-' + pn + '-' + (si + 1), n: sn, t: title, lv: 2});
    S.items.forEach((it, ii) => { const n = sn + '.' + (ii + 1); toc.push({id: it.id, n, t: it.t, lv: 3}); secNo[it.id] = n; });
  });
});

const tocList = (cls) => `<ol class="${cls}">${toc.map(x => `<li class="lv${x.lv}"><a href="${href('theory', x.id)}" data-id="${x.id}"><span>${x.n}.</span> ${esc(x.t)}</a></li>`).join('')}</ol>`;

function body(t){
  const no = secNo[t.id], lv = no.split('.').length;
  const h = `h${Math.min(lv + 1, 4)}`;
  const links = (t.links || []).filter(([id]) => byId[id]).map(([id, why]) => `<a href="${href('theory', id)}">${secNo[id]}. ${esc(byId[id].t)}</a>(${esc(why)})`);
  return `<section class="art" id="s-${t.id}">
    ${lv > 1 || t.id !== 'intro' ? `<${h} class="ah"><a class="num" href="${href('theory', t.id)}">${no}.</a> ${esc(t.t)}</${h}>` : ''}
    <p class="q">${esc(t.ask)}</p>
    ${t.def ? `<p class="lead">${esc(t.def)}</p>` : ''}
    ${t.cite ? `<figure class="cite"><blockquote>${esc(t.cite[0])}</blockquote><figcaption>${esc(t.cite[1])}</figcaption></figure>` : ''}
    ${VIZ[t.id] ? VIZ[t.id]() : ''}
    ${t.when ? `<p><b>언제 쓰나.</b> ${esc(t.when)}</p>` : ''}
    ${t.how ? `<p><b>하는 순서.</b> ${t.how.map((x, i) => `<span class="stp">${NUM[i] || i + 1}</span> ${esc(x)}`).join(' ')}</p>` : ''}
    ${t.ex ? `<div class="ex"><div class="ex-h">${esc(t.exTitle || '예시: 치과 대기')}</div>${t.ex}</div>` : ''}
    ${t.more ? `<div class="prose">${t.more}</div>` : ''}
    ${t.pit ? `<p class="pitp"><b>흔한 실수.</b> ${t.pit.map(esc).join(' ')}</p>` : ''}
    ${links.length ? `<p class="linkp"><b>이어서 볼 것.</b> ${links.join(', ')}</p>` : ''}
    ${t.try ? `<div class="try"><b>스스로 해 보기</b>${esc(t.try)}</div>` : ''}
    ${t.cases && R[t.id] ? `<details class="live" open data-sec="${t.id}"><summary>DB 사례로 보기 <small>${t.cases.length}건</small></summary><div class="chips">${t.cases.map(([id], i) => `<button data-c="${esc(id)}" aria-selected="${i === 0}">${esc(id)}</button>`).join('')}</div><div class="live-b"><p class="muted" style="margin:0">사례를 불러오는 중…</p></div></details>` : ''}
  </section>`;
}

function render(){
  let h = `<header class="chead"><div class="eyebrow">1장</div><h1>기획의 여섯 단계 — WHAT · WHY · HOW</h1><p class="desc">문제를 발견하고(WHAT), 근거를 만들고(WHY), 솔루션을 제안하는(HOW) 과정을 한 장에 줄글로 정리했어요. 목차를 누르면 그 위치로 가요.</p></header>
    <nav class="tocbox" aria-label="목차"><b>목차</b>${tocList('toc')}</nav>`;
  PARTS.forEach((P, pi) => {
    const pn = String(pi + 1);
    const steps = P.steps.map(g => ({g, items: T.filter(t => t.g === g)})).filter(s => s.items.length);
    if (P.p === '서론') { h += `<h2 class="ah part" id="s-${steps[0].items[0].id}-h"><a class="num" href="${href('theory', 'intro')}">${pn}.</a> 서론: WHAT · WHY · HOW 전략</h2>` + body(steps[0].items[0]); return; }
    h += `<h2 class="ah part" id="s-part-${P.p}"><a class="num" href="${href('theory', 'part-' + P.p)}">${pn}.</a> ${esc(P.p)} <small>${esc(P.d)}</small></h2>`;
    steps.forEach((S, si) => {
      const sn = pn + '.' + (si + 1), title = S.g.split(' · ')[1].replace(/^\d\.\s*/, '');
      if (S.items.length === 1 && S.items[0].t === title) { h += body(S.items[0]); return; }
      h += `<h3 class="ah step" id="s-step-${pn}-${si + 1}"><a class="num" href="${href('theory', 'step-' + pn + '-' + (si + 1))}">${sn}.</a> ${esc(title)}</h3>` + S.items.map(body).join('');
    });
  });
  h += `<div class="next"><a class="btn" href="${href('theory', 'intro')}">↑ 처음으로</a><span class="grow"></span><a class="btn dark" href="${href('db')}">사례 DB로 →</a></div>`;
  $('#doc').innerHTML = h;
  $('#tocSide').innerHTML = `<b>목차</b>${tocList('toc side')}`;
  $('#tocSheet').innerHTML = `<div class="sheet-h"><b>목차</b><button class="ib" id="tocClose" aria-label="닫기">✕</button></div>${tocList('toc')}`;
}

function fillLive(){
  if (!cases) return;
  document.querySelectorAll('details.live').forEach(d => {
    const t = byId[d.dataset.sec], box = d.querySelector('.chips'), out = d.querySelector('.live-b');
    box.querySelectorAll('button').forEach(b => { const c = byCase[b.dataset.c]; if (c) b.textContent = c.title; });
    const show = id => {
      const c = byCase[id], why = (t.cases.find(x => x[0] === id) || [])[1];
      box.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.c === id));
      out.innerHTML = c ? `<div class="live-t"><b>${esc(why || '')}</b><br><a href="${href('db', c.id)}">${esc(c.title)}</a> · ${esc(c.domain)} · DB에서 전체 보기 →</div>${R[t.id](c)}` : '<p class="muted">사례를 찾지 못했어요.</p>';
    };
    box.onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.c); };
    show(t.cases[0][0]);
  });
}

/* 위치로 가기 + 지금 읽는 곳 표시 */
function go(id, smooth){
  const el = document.getElementById('s-' + id) || document.getElementById('s-' + id + '-h');
  if (el) { const hd = el.querySelector('.ah') || el; window.scrollTo({top: hd.getBoundingClientRect().top + scrollY - 116, behavior: smooth ? 'smooth' : 'auto'}); }
}
function route(){ const h = hashFor('theory'); if (h === null) return; $('#tocSheet').hidden = true; requestAnimationFrame(() => go(h || 'intro', false)); }
function spy(){
  const heads = [...document.querySelectorAll('#doc [id^="s-"]')];
  let ticking = false;
  const upd = () => {
    ticking = false;
    let cur = heads[0];
    for (const el of heads) { if (el.getBoundingClientRect().top < 170) cur = el; else break; }
    const id = cur ? cur.id.replace(/^s-/, '').replace(/-h$/, '') : '';
    document.querySelectorAll('.toc a').forEach(a => a.classList.toggle('cur', a.dataset.id === id));
    const a = document.querySelector('.toc.side a.cur'); if (a) { const box = $('#tocSide'); const r = a.offsetTop - box.clientHeight / 2; if (Math.abs(box.scrollTop - r) > box.clientHeight / 3) box.scrollTop = r; }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, {passive: true});
  upd();
}

theme(); render(); spy();
$('#tocFab').onclick = () => { $('#tocSheet').hidden = false; };
$('#tocSheet').addEventListener('click', e => { if (e.target.id === 'tocClose' || e.target.closest('a')) $('#tocSheet').hidden = true; });
document.addEventListener('click', e => {
  const a = e.target.closest('#v-theory a[href], body[data-page="theory"] a[href]'); if (!a) return;
  const m = /#(?:theory:)?([^#]*)$/.exec(a.getAttribute('href') || ''); if (!m || a.getAttribute('href').includes('db')) return;
  const id = decodeURIComponent(m[1]); if (decodeURIComponent(location.hash.slice(1)).replace(/^theory:/, '') === id) { e.preventDefault(); go(id, true); }
});
addEventListener('hashchange', route);
route();
load().then(cs => { cases = cs; byCase = Object.fromEntries(cs.map(c => [c.id, c])); fillLive(); route(); }).catch(() => document.querySelectorAll('.live-b').forEach(b => b.innerHTML = '<p class="muted">사례 데이터를 불러오지 못했어요.</p>'));
window.TheoryPage = {route};
})();
