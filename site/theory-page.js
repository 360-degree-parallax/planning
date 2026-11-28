/* 장(章) 페이지: 장 하나를 한 페이지 줄글로 + 나무위키식 목차(본문 위 상자, 옆 고정 목차, 모바일 목차 버튼).
   window.CHAPTERS의 장마다 [data-chapter=view] 루트에 그린다. 한 문서에 장이 여러 개 있어도(묶음 미리보기) 겹치지 않게 id에 view를 붙인다. */
(function(){
'use strict';
const {esc, STEPS, R, load, theme, href, hashFor, PAGES, BUNDLE} = window.P;
const VIZ = window.VIZ || {};
const meta = Object.fromEntries(STEPS.map(s => [s.id, s]));
const NUM = '①②③④⑤⑥⑦⑧⑨';
const ALL = {};
let cases = null, byCase = {};
const mounted = [];

(window.CHAPTERS || []).forEach(ch => ch.T.forEach(t => { const m = meta[t.id]; if (m) t.t = t.t || m.t; }));

/* 링크가 가리키는 장과 위치 */
function target(h){
  if (!h) return null;
  if (BUNDLE) { const m = /^#(\w+):(.*)$/.exec(h); return m ? {view: m[1], id: decodeURIComponent(m[2])} : null; }
  const m = /^([^#]*)#?(.*)$/.exec(h); const v = Object.keys(PAGES).find(k => PAGES[k] === m[1]);
  return v ? {view: v, id: decodeURIComponent(m[2])} : null;
}

function number(ch){
  const toc = [], secNo = {};
  const stepsOf = P => P.steps.map(g => ({g, items: ch.T.filter(t => t.g === g)})).filter(s => s.items.length);
  ch.PARTS.forEach((P, pi) => {
    const pn = String(pi + 1), steps = stepsOf(P);
    if (!steps.length) return;
    if (P.p === '서론') { const it = steps[0].items[0]; toc.push({id: it.id, n: pn, t: '서론: ' + it.t, lv: 1}); secNo[it.id] = pn; return; }
    toc.push({id: 'part-' + pi, n: pn, t: P.p + (P.d ? ' — ' + P.d : ''), lv: 1});
    if (steps.length === 1) { steps[0].items.forEach((it, ii) => { const n = pn + '.' + (ii + 1); toc.push({id: it.id, n, t: it.t, lv: 2}); secNo[it.id] = n; }); return; }
    steps.forEach((S, si) => {
      const sn = pn + '.' + (si + 1), title = S.g.split(' · ')[1].replace(/^\d\.\s*/, '');
      if (S.items.length === 1 && S.items[0].t === title) { toc.push({id: S.items[0].id, n: sn, t: title, lv: 2}); secNo[S.items[0].id] = sn; return; }
      toc.push({id: 'step-' + pi + '-' + si, n: sn, t: title, lv: 2});
      S.items.forEach((it, ii) => { const n = sn + '.' + (ii + 1); toc.push({id: it.id, n, t: it.t, lv: 3}); secNo[it.id] = n; });
    });
  });
  return {toc, secNo, stepsOf};
}
const nums = {};
(window.CHAPTERS || []).forEach(ch => { const n = number(ch); nums[ch.view] = n; ch.T.forEach(t => { ALL[t.id] = {t: t.t, view: ch.view, no: ch.no, n: n.secNo[t.id]}; }); });

function mount(ch){
  const root = document.querySelector(`[data-chapter="${ch.view}"]`); if (!root) return;
  const q = s => root.querySelector(s);
  const {toc, secNo, stepsOf} = nums[ch.view];
  const V = ch.view, sid = id => `${V}--${id}`;
  const label = id => { const a = ALL[id]; return (a.view === V ? '' : a.no + '장 ') + a.n + '. ' + esc(a.t); };
  const tocList = cls => `<ol class="${cls}">${toc.map(x => `<li class="lv${x.lv}"><a href="${href(V, x.id)}" data-id="${x.id}"><span>${x.n}.</span> ${esc(x.t)}</a></li>`).join('')}</ol>`;

  function body(t, first){
    const no = secNo[t.id], lv = no.split('.').length, h = `h${Math.min(lv + 1, 4)}`;
    const links = (t.links || []).filter(([id]) => ALL[id]).map(([id, why]) => `<a href="${href(ALL[id].view, id)}">${label(id)}</a>(${esc(why)})`);
    return `<section class="art" id="${sid(t.id)}">
      ${first ? '' : `<${h} class="ah"><a class="num" href="${href(V, t.id)}">${no}.</a> ${esc(t.t)}</${h}>`}
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
    let h = `<header class="chead" id="${sid('top')}"><div class="eyebrow">${ch.no}장</div><h1>${esc(ch.title)}</h1><p class="desc">${esc(ch.desc)}</p></header>
      <nav class="tocbox" aria-label="목차"><b>목차</b>${tocList('toc')}</nav>`;
    ch.PARTS.forEach((P, pi) => {
      const pn = String(pi + 1), steps = stepsOf(P); if (!steps.length) return;
      if (P.p === '서론') { const it = steps[0].items[0]; h += `<h2 class="ah part"><a class="num" href="${href(V, it.id)}">${pn}.</a> 서론: ${esc(it.t)}</h2>` + body(it, true); return; }
      h += `<h2 class="ah part" id="${sid('part-' + pi)}"><a class="num" href="${href(V, 'part-' + pi)}">${pn}.</a> ${esc(P.p)} <small>${esc(P.d || '')}</small></h2>`;
      if (steps.length === 1) { h += steps[0].items.map(t => body(t)).join(''); return; }
      steps.forEach((S, si) => {
        const sn = pn + '.' + (si + 1), title = S.g.split(' · ')[1].replace(/^\d\.\s*/, '');
        if (S.items.length === 1 && S.items[0].t === title) { h += body(S.items[0]); return; }
        h += `<h3 class="ah step" id="${sid('step-' + pi + '-' + si)}"><a class="num" href="${href(V, 'step-' + pi + '-' + si)}">${sn}.</a> ${esc(title)}</h3>` + S.items.map(t => body(t)).join('');
      });
    });
    const next = (window.CHAPTERS || []).find(c => c.no === ch.no + 1);
    h += `<div class="next"><a class="btn" href="${href(V, 'top')}">↑ 처음으로</a><span class="grow"></span>${next ? `<a class="btn dark" href="${href(next.view)}">${next.no}장 ${esc(next.title)} →</a>` : `<a class="btn dark" href="${href('db')}">기획 사례로 →</a>`}</div>`;
    q('.doc').innerHTML = h;
    q('.toc-side').innerHTML = `<b>목차</b>${tocList('toc side')}`;
    q('.toc-sheet').innerHTML = `<div class="sheet-h"><b>목차</b><button class="ib sheet-x" aria-label="닫기">✕</button></div>${tocList('toc')}`;
  }

  function fillLive(){
    if (!cases) return;
    root.querySelectorAll('details.live').forEach(d => {
      const t = ch.T.find(x => x.id === d.dataset.sec), box = d.querySelector('.chips'), out = d.querySelector('.live-b');
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

  function go(id, smooth){
    const el = document.getElementById(sid(id)) || (id === ch.T[0].id ? document.getElementById(sid('top')) : null);
    if (!el) { if (!id) window.scrollTo(0, 0); return; }
    const hd = el.querySelector('.ah') || el;
    window.scrollTo({top: Math.max(0, hd.getBoundingClientRect().top + scrollY - 116), behavior: smooth ? 'smooth' : 'auto'});
  }
  function route(){ const h = hashFor(V); if (h === null || root.closest('[hidden]')) return; q('.toc-sheet').hidden = true; requestAnimationFrame(() => go(h, false)); }
  function spy(){
    let ticking = false;
    const upd = () => {
      ticking = false; if (root.closest('[hidden]')) return;
      let cur = null;
      for (const el of root.querySelectorAll('.doc [id]')) { if (el.getBoundingClientRect().top < 170) cur = el; else break; }
      const id = cur ? cur.id.slice(V.length + 2) : '';
      root.querySelectorAll('.toc a').forEach(a => a.classList.toggle('cur', a.dataset.id === id));
      const a = root.querySelector('.toc.side a.cur'), box = q('.toc-side');
      if (a) { const r = a.offsetTop - box.clientHeight / 2; if (Math.abs(box.scrollTop - r) > box.clientHeight / 3) box.scrollTop = r; }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, {passive: true});
    upd();
  }

  render(); spy();
  q('.toc-fab').onclick = () => { q('.toc-sheet').hidden = false; };
  q('.toc-sheet').addEventListener('click', e => { if (e.target.closest('.sheet-x') || e.target.closest('a')) q('.toc-sheet').hidden = true; });
  /* 같은 위치를 다시 누르면 hashchange가 안 나므로 직접 이동 */
  root.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a) return;
    const tg = target(a.getAttribute('href')); if (!tg || tg.view !== V) return;
    if ((hashFor(V) || '') === tg.id) { e.preventDefault(); go(tg.id, true); }
  });
  mounted.push({route, fillLive});
}

theme();
(window.CHAPTERS || []).forEach(mount);
addEventListener('hashchange', () => mounted.forEach(m => m.route()));
mounted.forEach(m => m.route());
load().then(cs => { cases = cs; byCase = Object.fromEntries(cs.map(c => [c.id, c])); mounted.forEach(m => { m.fillLive(); m.route(); }); })
  .catch(() => document.querySelectorAll('.live-b').forEach(b => b.innerHTML = '<p class="muted">사례 데이터를 불러오지 못했어요.</p>'));
window.TheoryPage = {route: () => mounted.forEach(m => m.route())};
})();
