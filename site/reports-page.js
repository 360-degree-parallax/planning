/* 리포트 DB 페이지 — window.REPORTS를 기관·분류·검색으로 걸러 카드로 보여 준다. */
(function(){
const {esc, href, hashFor, setHash, theme} = window.P;
const root = document.querySelector('.rp[data-view=reports]');
if (!root || !window.REPORTS) return;
const {PUBS, R, asof} = window.REPORTS;
const $ = s => root.querySelector(s);
const PUB = Object.fromEntries(PUBS.map(p => [p.id, p]));
const CATS = ['전체', '렙사', '공영', '회계펌', '보너스'];
const CH = {theory: '1장', ch2: '2장', ch3: '3장', ch4: '4장', ch5: '5장', ch6: '6장'};
const st = {cat: '전체', pub: '', q: ''};

$('#rpdesc').textContent = `마케팅·사업개발에서 바로 찾아 쓰는 리포트 ${R.length}개 — 렙사 3곳, 공영 3곳, 회계펌 4곳, 그리고 보너스. 2025년 말~${asof} 발행분.`;
$('#rpnote').innerHTML = `<b>먼저 기억할 것 — 리포트는 2차 정보다.</b> 가설의 씨앗, 시장의 배경 숫자, 회의의 첫 장으로 쓰고, 결정은 1차 정보(고객·현장·우리 데이터)로 확인한다. <a href="${href('ch2', 'info_diff')}">2장 · 1차 정보와 2차 정보</a>
<div class="rp-how"><span><i>렙사</i>타겟·매체·광고 반응 — 누구에게 어디서</span><span><i>공영</i>산업·수출·유통 전망 — 시장이 어디로</span><span><i>회계펌</i>산업 지도·경영진 설문 — 돈과 정책이 어디로</span></div>`;

$('#rpcat').innerHTML = CATS.map(c => `<button type="button" data-c="${c}" aria-pressed="${c === st.cat}">${c}<em>${c === '전체' ? R.length : R.filter(r => PUB[r.pub].cat === c).length}</em></button>`).join('');
const fillPubs = () => {
  const list = PUBS.filter(p => st.cat === '전체' || p.cat === st.cat);
  if (st.pub && !list.some(p => p.id === st.pub)) st.pub = '';
  $('#rppub').innerHTML = `<option value="">기관 전체</option>` + list.map(p => `<option value="${p.id}"${p.id === st.pub ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
};
$('#rppubs').innerHTML = PUBS.map(p => `<article class="rp-pub" data-cat="${esc(p.cat)}"><header><b>${esc(p.name)}</b><span class="tag">${esc(p.cat)}</span></header><p>${esc(p.about)}</p><p><i>대표 리포트</i>${esc(p.best)}</p><p class="memo"><i>고르는 법</i>${esc(p.memo)}</p><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">자료 보러 가기 ↗</a></article>`).join('');

const match = r => {
  const p = PUB[r.pub];
  if (st.cat !== '전체' && p.cat !== st.cat) return false;
  if (st.pub && r.pub !== st.pub) return false;
  if (!st.q) return true;
  const hay = [r.title, r.gist, r.use, r.type, p.name, ...r.tags, ...(r.pts || [])].join(' ').toLowerCase();
  return st.q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
};
const key = d => /^\d{4}/.test(d) ? d.replace('~', '').padEnd(7, '-00') : '0000';
const card = r => {
  const p = PUB[r.pub];
  return `<article class="rp-card" id="r-${r.id}" data-cat="${esc(p.cat)}">
<div class="rp-meta"><span class="tag on">${esc(p.name)}</span><span class="tag">${esc(p.cat)}</span><span class="tag">${esc(r.type)}</span><time>${esc(r.date)}</time></div>
<h3><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a></h3>
<p class="gist">${esc(r.gist)}</p>
${r.pts && r.pts.length ? `<div class="pts"><b>핵심 수치 · 포인트</b><ul>${r.pts.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
<p class="use"><i>이럴 때 쓴다</i>${esc(r.use)}</p>
<div class="rp-foot"><span class="rp-tags">${r.tags.map(t => `<button type="button" class="tag" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}</span>${r.ch.length ? `<span class="rp-ch">${r.ch.map(([v, id, l]) => `<a href="${href(v, id)}">${CH[v]} · ${esc(l)}</a>`).join('')}</span>` : ''}</div>
</article>`;
};
const draw = () => {
  root.querySelectorAll('#rpcat button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === st.cat));
  root.querySelectorAll('.rp-pub').forEach(a => { a.hidden = st.cat !== '전체' && a.dataset.cat !== st.cat; });
  const list = R.filter(match).sort((a, b) => key(b.date).localeCompare(key(a.date)));
  $('#rpcount').textContent = list.length === R.length ? `${list.length}개 · 최신순` : `${list.length}개 찾음 · 최신순`;
  $('#rplist').innerHTML = list.length ? list.map(card).join('') : `<p class="rp-empty">조건에 맞는 리포트가 없어요. 검색어나 분류를 바꿔 보세요.</p>`;
};
$('#rpcat').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.cat = b.dataset.c; fillPubs(); draw(); });
$('#rppub').addEventListener('change', e => { st.pub = e.target.value; draw(); });
$('#rpq').addEventListener('input', e => { st.q = e.target.value.trim(); draw(); });
$('#rplist').addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (!t) return; st.q = t.dataset.t; $('#rpq').value = st.q; draw(); window.scrollTo({top: root.offsetTop, behavior: 'smooth'}); });
fillPubs(); draw();
const route = () => { const h = hashFor('reports'); if (!h) return; const el = document.getElementById('r-' + h); if (el) { el.classList.add('hit'); el.scrollIntoView({block: 'center'}); setTimeout(() => el.classList.remove('hit'), 1600); } };
addEventListener('hashchange', route); route();
if (!window.__BUNDLE && theme) theme();
})();
