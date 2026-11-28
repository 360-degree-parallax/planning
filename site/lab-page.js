/* 실무 툴 페이지 — 노아 · 데이터 분석 · 실험 · 브랜딩.
   방법 DB(window.METHODS)를 카드로 보여 주고, 계산 엔진(window.LAB)으로 업로드한 데이터를 바로 분석한다.
   데이터는 브라우저 밖으로 나가지 않는다. 표 작업은 localStorage에 저장(실패해도 동작). */
(function(){
const root = document.getElementById('lab'); if (!root || !window.METHODS || !window.LAB) return;
const {GROUPS, TRAITS, ITEMS} = window.METHODS, L = window.LAB;
const P = window.P || {}; if (P.theme) try { P.theme(); } catch (e) {}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (s, el = root) => el.querySelector(s), $$ = (s, el = root) => [...el.querySelectorAll(s)];
const store = { get(k, d) { try { const v = localStorage.getItem('lab-' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('lab-' + k, JSON.stringify(v)); } catch (e) {} } };
const toast = (m, ms = 2200) => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); };
const TABS = [{id:'noah', name:'노아', desc:'논술형 문제 → 토론'}, ...GROUPS.map(g => ({id:g.id, name:g.name}))];
const st = { tab: 'noah', item: {} };
const PRE = window.__BUNDLE ? 'lab:' : '';
const setH = h => history.replaceState(null, '', '#' + PRE + h);
const parseHash = () => { let h = decodeURIComponent(location.hash.slice(1)); if (PRE) { if (!h.startsWith(PRE)) return; h = h.slice(PRE.length); } const [t, i] = h.split('/'); if (TABS.some(x => x.id === t)) { st.tab = t; if (i) st.item[t] = i; } };
parseHash();

/* ───── 가상 예시 데이터 (사주 서비스 기준, 계산 확인용) ───── */
const rng = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(42);
const pick = a => a[Math.floor(rng() * a.length)];
const pois = l => { let k = 0, p = 1; const e = Math.exp(-l); do { k++; p *= rng(); } while (p > e); return k - 1; };
const toCSV = (header, rows) => [header.join(','), ...rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(','))].join('\n');
const SAMPLES = {
  conv_prob: () => { const src = ['meta / 숏폼', 'tiktok / 숏폼', 'naver / 검색', 'google / 검색', 'community / 연애 커뮤니티']; const ad = ['재회 첫 장면', '새벽 2시 연락', '궁합 테스트', '신년운세 할인', '헤어진 그 사람']; const rows = []; src.forEach(s => ad.forEach(a => { const n = 20 + Math.floor(rng() * 400), p = (s.includes('숏폼') ? 0.05 : 0.025) * (a.includes('재회') || a.includes('헤어진') ? 1.8 : 1); rows.push([s, a, n, pois(n * p)]); })); return toCSV(['소스/매체', '광고 콘텐츠', '사용자', '전환수'], rows); },
  promo_test: () => { const rows = []; for (let d = 1; d <= 28; d++) { const after = d > 14 ? 1 : 0; rows.push([d, after, Math.round(300 + rng() * 60 + after * 45), Math.round(180 + rng() * 40 + after * 25), Math.round((2.1 + rng() * 0.4 + after * 0.3) * 100) / 100, Math.round(58 + rng() * 6 - after * 3)]); } return toCSV(['일', '프로모션', '결제 수', '일 매출(만원)', 'ROAS', '끝까지 읽음(%)'], rows); },
  promo_test_alt: () => { const cols = ['신년운세 30% 할인', '궁합 1+1', '첫 결제 쿠폰', '친구 초대 적립']; const rows = []; for (let d = 0; d < 21; d++) rows.push(cols.map((c, i) => pois([1.2, 2.4, 1.5, 0.8][i]))); return toCSV(cols, rows); },
  ad_activation: () => { const sets = {'재회 첫 장면': 0.00009, '새벽 2시 연락': 0.00006, '궁합 테스트': 0.00003, '신년운세 할인': 0.00002, '헤어진 그 사람': 0.00007}; const rows = []; Object.entries(sets).forEach(([k, r]) => { for (let i = 0; i < 8; i++) { const sp = Math.round(2000 + rng() * 120000); rows.push([k, sp, pois(sp * r)]); } }); return toCSV(['광고세트-소재', '지출 금액 (KRW)', '구매'], rows); },
  media_contrib: () => { const src = ['"meta.com"', 'm.tiktok.com', '(direct)', 'naver', '"naver","naver"', 'google', 'theqoo.net', 'instagram.com', 'youtube.com']; return toCSV(['소스', '전환', '전환 가치'], src.map(s => { const c = pois(s.includes('naver') ? 60 : s.includes('tok') || s.includes('meta') ? 90 : 20); return [s, c, c * (9900 + Math.round(rng() * 6000))]; })); },
  assoc: () => { const P = ['재회운', '연애운', '궁합', '결혼운', '신년운세', '재물운', '직업운', '타로 한 장', '이름 풀이']; const rows = []; for (let i = 0; i < 600; i++) { const b = new Set([pick(P)]); if (b.has('재회운') && rng() < 0.45) b.add('연애운'); if (b.has('연애운') && rng() < 0.35) b.add('궁합'); if (b.has('궁합') && rng() < 0.3) b.add('결혼운'); if (b.has('신년운세') && rng() < 0.4) b.add('재물운'); if (rng() < 0.15) b.add(pick(P)); rows.push([...b]); } return rows.map(r => r.join(',')).join('\n'); },
  scroll: () => { const pages = {'1p 재회 스토리': [1, 0.93, 0.88, 0.62, 0.58, 0.55], '1p 궁합 스토리': [1, 0.95, 0.91, 0.88, 0.84, 0.8], '2p 결제 안내': [1, 0.9, 0.71, 0.66, 0.6, 0.41], '결과 화면': [1, 0.96, 0.93, 0.9, 0.86, 0.83]}; const rows = []; Object.entries(pages).forEach(([p, r]) => { const base = 600 + Math.round(rng() * 1500); [10, 25, 40, 60, 80, 100].forEach((d, i) => rows.push([p, d, Math.round(base * r[i])])); }); return toCSV(['페이지', '스크롤 깊이', '사용자'], rows); },
  topic: () => { const T = {'결과 만족': ['내 얘기랑 너무 똑같아서 소름 돋았어요', '결론이 명확해서 마음이 정리됐어요', '이야기처럼 읽혀서 끝까지 봤어요', '새벽에 혼자 보는데 위로가 됐어요', '그래서 어떻게 하면 되는지 알려줘서 좋아요'], '결과 불만': ['너무 일반적인 말만 있어요', '내 상황이랑 안 맞는 내용이에요', '기대보다 결과가 짧았어요', '용어가 어려워서 이해가 안 돼요'], '결제 문의': ['결제했는데 결과가 안 열려요', '두 번 결제된 것 같아요 환불 부탁해요', '카카오페이로 결제가 안 돼요'], '가격 의견': ['가격이 상담보다 훨씬 부담 없어요', '이 가격이면 다른 주제도 볼래요', '조금 비싼 것 같아요']}; const rows = []; Object.entries(T).forEach(([k, a]) => { for (let i = 0; i < 12; i++) rows.push([pick(a) + (rng() < 0.3 ? ' 진짜' : ''), k]); }); return toCSV(['문장', '라벨'], rows); },
  conjoint: () => { const rows = []; for (let i = 0; i < 160; i++) { const price = pick(['9,900', '14,900']), form = pick(['웹툰형', '텍스트형']), len = pick(['짧게(5장)', '길게(12장)']); const v = 9000 + (form === '웹툰형' ? 4200 : 0) + (len === '길게(12장)' ? 1800 : 0) - (price === '14,900' ? 2600 : 0) + (rng() - 0.5) * 6000; rows.push([price, form, len, Math.round(Math.max(0, v))]); } return toCSV(['가격대', '결과 형태', '결과 길이', '방문자당 결제액'], rows); },
  client_map: () => { const rows = []; for (let i = 0; i < 400; i++) { const t = pick(['새벽(0~5시)', '출근길(7~9시)', '점심', '퇴근길(18~20시)', '밤(21~24시)']), m = pick(['meta', 'tiktok', 'naver', 'community']), a = pick(['10대', '20대', '20대', '30대', '40대']); rows.push([t, m, a, (t.startsWith('새벽') || t.startsWith('밤')) && a === '20대' ? 9900 + Math.round(rng() * 9900) : Math.round(rng() * 12000)]); } return toCSV(['시간', 'Source / Medium', '연령', '수익'], rows); },
  offer: () => { const rows = []; ['재회 첫 장면', '새벽 2시 연락', '궁합 테스트', '신년운세 할인', '헤어진 그 사람', '이름 풀이'].forEach(c => ['meta', 'tiktok', 'naver'].forEach(m => { const v = Math.round(rng() * 80), ctr = Math.round(rng() * 400) / 100; rows.push([`[결제] ${c}/${m}`, v, v > 10 && rng() < 0.6 ? pois(v * 0.05) : 0, ctr]); })); return toCSV(['광고 캠페인', '전체방문자', '전환수', '클릭률'], rows); },
  recommend: () => { const media = ['meta/숏폼', 'tiktok/숏폼', 'youtube/쇼츠', 'naver/검색']; const ads = ['재회 첫 장면', '새벽 2시 연락', '궁합 테스트', '신년운세 할인', '헤어진 그 사람', '이름 풀이', '타로 한 장']; const rows = []; media.forEach(m => ads.forEach(a => { if (rng() < 0.6 || m === 'meta/숏폼') rows.push([m, a, pois((a.includes('재회') || a.includes('헤어진') ? 40 : 12) * (m === 'naver/검색' ? 0.5 : 1))]); })); return toCSV(['[UID] 소스/매체', '[IID] 콘텐츠', '[CID] 클릭수'], rows); }
};

/* ───── 공통 렌더 ───── */
const list = (a) => a && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
const sec = (h, body) => body ? `<section class="lab-sec"><h3>${h}</h3>${body}</section>` : '';
const table = (rows, max = 200) => { if (!rows || !rows.length) return '<p class="muted">결과가 없어요.</p>'; const cols = Object.keys(rows[0]); return `<div class="tscroll"><table class="t lab-t"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, max).map(r => `<tr>${cols.map(c => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > max ? `<p class="muted">처음 ${max}행만 표시 — 전체는 CSV로 받기</p>` : ''}`; };
const kv = o => o ? `<div class="lab-kv">${Object.entries(o).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : '';
const download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], {type: type + ';charset=utf-8'})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const rowsToCSV = rows => { const cols = Object.keys(rows[0] || {}); return toCSV(cols, rows.map(r => cols.map(c => r[c] ?? ''))); };

function methodCard(m) {
  const g = GROUPS.find(x => x.id === m.g);
  const caseHtml = m.caseSteps ? `<table class="t"><tr><td>02 확인할 것</td><td>${esc(m.caseSteps.problem)}</td></tr><tr><td>03 독립변수</td><td>${esc(m.caseSteps.iv)}</td></tr><tr><td>04 종속변수</td><td>${esc(m.caseSteps.dv)}</td></tr><tr class="hi"><td>09 결론</td><td>${esc(m.caseSteps.insight)}</td></tr></table>` : '';
  const pts = m.points ? `<table class="t">${m.points.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</table>` : '';
  return `<header class="lab-h"><p class="eyebrow">${esc(g.name)}</p><h2>${esc(m.name)}</h2><p class="lead">${esc(m.short)}</p></header>
  ${m.why ? `<div class="lab-3">${[['왜 만들었나', m.why], ['무엇으로', m.what], ['어떻게 썼나', m.how]].map(([h, a]) => `<div><h4>${h}</h4>${list(a)}</div>`).join('')}</div>` : ''}
  ${sec('핵심', pts)}${sec('우수 활용 사례', caseHtml)}${sec('특징 분석', list(m.features))}${sec('특징 적용', list(m.apply))}${sec('판단 규칙', list(m.rules))}
  ${m.note ? `<p class="note lab-note">${esc(m.note)}</p>` : ''}
  ${m.saju ? `<p class="lab-saju"><b>사주 서비스에서</b> ${esc(m.saju)}</p>` : ''}`;
}

/* ───── 데이터 분석 툴 ───── */
let XLSX_P = null;
const loadXLSX = () => XLSX_P || (XLSX_P = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => ok(window.XLSX); s.onerror = () => no(new Error('엑셀 읽기 모듈을 못 불러왔어요 — CSV로 저장해 올려 주세요')); document.head.appendChild(s); }));
async function readFile(file) {
  if (/\.(xlsx|xls)$/i.test(file.name)) { const X = await loadXLSX(); const wb = X.read(await file.arrayBuffer(), {type: 'array'}); return wb.SheetNames.map(n => ({name: n, csv: X.utils.sheet_to_csv(wb.Sheets[n])})); }
  return [{name: file.name, csv: await file.text()}];
}
const guessCol = (header, aliases, used) => header.find(h => !used.has(h) && aliases.some(a => h.toLowerCase().includes(a.toLowerCase()))) || '';

function analysisTool(m, box) {
  const T = m.tool; if (!T) return;
  const state = { sheets: null, data: null, alt: false };
  box.innerHTML = `<section class="lab-tool"><div class="lab-tool-h"><h3>분석 실행</h3><span class="grow"></span>
    <label class="btn sm">파일 올리기 (CSV · 엑셀)<input type="file" accept=".csv,.xlsx,.xls,.txt" hidden data-file></label>
    <button class="btn sm" data-sample>예시 데이터로 해 보기</button></div>
    ${T.alt ? `<div class="dbtabs" data-mode><button aria-pressed="true" data-m="0">${esc(m.name)}</button><button aria-pressed="false" data-m="1">${esc(T.alt.label)}</button></div>` : ''}
    <div data-src class="muted">${T.basket ? '한 줄에 장바구니 하나, 상품은 쉼표로 구분한 파일을 올려 주세요.' : '첫 줄이 열 이름인 표를 올리면 열을 자동으로 짝지어요.'}</div>
    <div data-map></div><div data-out></div></section>`;
  const $b = s => box.querySelector(s);
  const setData = (sheets, label) => { state.sheets = sheets; const pickSheet = i => { state.raw = sheets[i].csv; state.data = T.basket ? null : L.parseCSV(sheets[i].csv); renderMap(); }; $b('[data-src]').innerHTML = `불러온 데이터: <b>${esc(label)}</b>${sheets.length > 1 ? ` · 시트 <select data-sheet>${sheets.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('')}</select>` : ''}`; const sel = $b('[data-sheet]'); if (sel) sel.onchange = () => pickSheet(+sel.value); pickSheet(0); };
  const fields = () => state.alt ? [{k: 'columns', label: '비교할 프로모션 열', multi: true, guess: []}] : T.fields;
  function renderMap() {
    if (T.basket) { $b('[data-map]').innerHTML = `<div class="lab-opts"><label>최소 지지도 <input type="number" step="0.005" value="0.01" data-o="minSupport"></label><label>최소 신뢰도 <input type="number" step="0.05" value="0.2" data-o="minConfidence"></label><button class="btn sm dark" data-run>분석</button></div>`; $b('[data-run]').onclick = run; run(); return; }
    const H = state.data.header, used = new Set();
    $b('[data-map]').innerHTML = `<div class="lab-map">${fields().map(f => { if (f.multi) { const g = H.filter(h => f.guess.length ? f.guess.some(a => h.toLowerCase().includes(a.toLowerCase())) : true); return `<fieldset><legend>${esc(f.label)}</legend>${H.map(h => `<label class="lab-ck"><input type="checkbox" data-f="${f.k}" value="${esc(h)}"${g.includes(h) ? ' checked' : ''}> ${esc(h)}</label>`).join('')}</fieldset>`; } const v = guessCol(H, f.guess, used); used.add(v); return `<label>${esc(f.label)} <select data-f="${f.k}"><option value="">—</option>${H.map(h => `<option${h === v ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`; }).join('')}
      ${m.id === 'promo_test' && !state.alt ? '<label>또는 앞에서부터 N행을 "전"으로 <input type="number" min="0" placeholder="비우면 구분 열 사용" data-o="splitAt"></label>' : ''}
      ${m.id === 'offer' ? '<label>높은 전환 최소 방문자 <input type="number" value="5" data-o="minVisitors"></label>' : ''}
      ${m.id === 'scroll' ? '<label>최소 시작 사용자 <input type="number" value="30" data-o="minUsers"></label>' : ''}
      <button class="btn sm dark" data-run>분석</button></div><p class="muted lab-n">${state.data.rows.length.toLocaleString()}행 · 열 ${H.length}개</p>`;
    $b('[data-run]').onclick = run; run();
  }
  function opts() {
    const o = {};
    fields().forEach(f => { if (f.multi) o[f.k] = $$(`input[data-f="${f.k}"]:checked`, box).map(x => x.value); else o[f.k] = $b(`select[data-f="${f.k}"]`)?.value; });
    $$('[data-o]', box).forEach(x => { if (x.value !== '') o[x.dataset.o] = +x.value; });
    if (m.id === 'conv_prob' && o.key && !o.key.length) o.key = [];
    return o;
  }
  function run() {
    const out = $b('[data-out]');
    try {
      let r;
      if (T.basket) { const baskets = state.raw.split(/\r?\n/).map(l => l.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)).filter(b => b.length); if (baskets.length && /product|상품/i.test(baskets[0][0])) baskets.shift(); r = L.associationRules(baskets, opts()); }
      else { const o = opts(); const fn = state.alt ? T.alt.fn : T.fn; const miss = fields().filter(f => f.multi ? !(o[f.k] || []).length : !o[f.k] && !(m.id === 'promo_test' && f.k === 'split' && o.splitAt != null)); if (miss.length) { out.innerHTML = `<p class="muted">열을 짝지어 주세요: ${miss.map(f => esc(f.label)).join(', ')}</p>`; return; } r = L[fn](state.data.rows, o); }
      out.innerHTML = `${kv(r.summary)}${r.curves ? kmChart(r.curves) : ''}${table(r.rows)}<div class="lab-acts"><button class="btn sm" data-csv>결과 CSV로 받기</button></div>`;
      out.querySelector('[data-csv]').onclick = () => download(`${m.id}-결과.csv`, rowsToCSV(r.rows));
    } catch (e) { out.innerHTML = `<p class="msg">계산하지 못했어요: ${esc(e.message)}</p>`; }
  }
  $b('[data-file]').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { setData(await readFile(f), f.name); } catch (err) { toast(err.message, 3500); } };
  $b('[data-sample]').onclick = () => { const k = state.alt ? m.id + '_alt' : m.id; setData([{name: '예시', csv: SAMPLES[k]()}], '예시 데이터 (가상 · 사주 서비스 기준)'); };
  const mode = $b('[data-mode]'); if (mode) mode.onclick = e => { const b = e.target.closest('button'); if (!b) return; state.alt = b.dataset.m === '1'; $$('button', mode).forEach(x => x.setAttribute('aria-pressed', x === b)); if (state.data) renderMap(); };
}
function kmChart(curves) {
  const W = 640, H = 220, pad = 34, maxT = Math.max(1, ...curves.flatMap(c => c.curve.map(p => p.t)));
  const X = t => pad + t / maxT * (W - pad - 10), Y = s => 10 + (1 - s) * (H - pad - 10);
  const cols = ['var(--accent)', '#e8833a', '#2fa36b', '#9b59b6', '#d64545', '#3a8ee8', '#8a6d3b', '#555'];
  return `<figure class="lab-km"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="지출 금액에 따른 생존율"><line x1="${pad}" y1="${H - pad}" x2="${W - 10}" y2="${H - pad}" stroke="var(--line2)"/><line x1="${pad}" y1="10" x2="${pad}" y2="${H - pad}" stroke="var(--line2)"/><text x="${pad - 6}" y="16" text-anchor="end" font-size="11" fill="var(--t3)">1</text><text x="${pad - 6}" y="${H - pad}" text-anchor="end" font-size="11" fill="var(--t3)">0</text><text x="${W - 10}" y="${H - 12}" text-anchor="end" font-size="11" fill="var(--t3)">지출 ${Math.round(maxT).toLocaleString()}원</text>${curves.slice(0, 8).map((c, i) => { let d = `M${X(0)},${Y(1)}`; c.curve.forEach((p, j) => { if (j) d += ` H${X(p.t)} V${Y(p.S)}`; }); return `<path d="${d}" fill="none" stroke="${cols[i]}" stroke-width="2"/>`; }).join('')}</svg><figcaption>${curves.slice(0, 8).map((c, i) => `<span><i style="background:${cols[i]}"></i>${esc(c.name)}</span>`).join('')}</figcaption></figure>`;
}

/* ───── 실험 툴 ───── */
function iceTool(box) {
  let rows = store.get('ice', [{title: '2p 헤드라인 "내 이야기" vs "끝까지"', impact: 4, confidence: 3, ease: 5, done: '대기'}, {title: '가격 9,900 vs 12,900', impact: 5, confidence: 2, ease: 4, done: '대기'}, {title: '생년월일 입력을 1p 앞으로', impact: 3, confidence: 3, ease: 2, done: '대기'}]);
  let mode = store.get('ice-mode', 'multiply');
  const draw = () => { const ranked = L.ice(rows.map((r, i) => ({...r, _i: i})), mode); box.innerHTML = `<section class="lab-tool"><div class="lab-tool-h"><h3>ICE 보드</h3><span class="grow"></span><select data-mode aria-label="점수 방식"><option value="multiply"${mode === 'multiply' ? ' selected' : ''}>I × C × E (템플릿)</option><option value="ratio"${mode === 'ratio' ? ' selected' : ''}>(I × C) ÷ E</option><option value="sum"${mode === 'sum' ? ' selected' : ''}>I + C + E</option></select><button class="btn sm" data-add>실험 추가</button><button class="btn sm" data-csv>CSV</button></div>
    <div class="tscroll"><table class="t lab-t lab-edit"><thead><tr><th>순위</th><th>실험 제목</th><th>Impact</th><th>Confidence</th><th>Ease</th><th>Score</th><th>상태</th><th></th></tr></thead><tbody>${ranked.map((r, i) => { return `<tr data-i="${r._i}"><td>${i + 1}</td><td><input data-k="title" value="${esc(r.title)}"></td>${['impact', 'confidence', 'ease'].map(c => `<td><input type="number" min="1" max="5" data-k="${c}" value="${esc(r[c])}"></td>`).join('')}<td><b>${Math.round(r.score * 100) / 100}</b></td><td><select data-k="done">${['대기', '진행 중', '실험완료'].map(o => `<option${o === r.done ? ' selected' : ''}>${o}</option>`).join('')}</select></td><td><button class="btn sm" data-del>삭제</button></td></tr>`; }).join('')}</tbody></table></div>
    <p class="muted">Impact: 비즈니스 목표(매출)에 가까울수록 · Confidence: 성공 가능성(가장 주관적) · Ease: 1~2 개발팀 협업, 3 비개발부서 협업, 4~5 담당자 혼자</p></section>`;
    box.querySelector('[data-mode]').onchange = e => { mode = e.target.value; store.set('ice-mode', mode); draw(); };
    box.querySelector('[data-add]').onclick = () => { rows.push({title: '새 실험', impact: 3, confidence: 3, ease: 3, done: '대기'}); store.set('ice', rows); draw(); };
    box.querySelector('[data-csv]').onclick = () => download('ICE.csv', rowsToCSV(L.ice(rows, mode).map(r => ({실험: r.title, Impact: r.impact, Confidence: r.confidence, Ease: r.ease, Score: r.score, 상태: r.done}))));
    $$('tbody tr', box).forEach(tr => { const i = +tr.dataset.i; $$('[data-k]', tr).forEach(inp => inp.onchange = () => { rows[i][inp.dataset.k] = inp.type === 'number' ? Math.max(1, Math.min(5, +inp.value)) : inp.value; store.set('ice', rows); draw(); }); tr.querySelector('[data-del]').onclick = () => { rows.splice(i, 1); store.set('ice', rows); draw(); }; }); };
  draw();
}
function abTool(box) {
  const v = store.get('ab', {cUsers: 5000, cConv: 120, vUsers: 5000, vConv: 150, mde: 10});
  box.innerHTML = `<section class="lab-tool"><div class="lab-tool-h"><h3>결과 판정</h3></div><div class="lab-opts lab-grid">
    <label>대조군 유저 <input type="number" data-v="cUsers" value="${v.cUsers}"></label><label>대조군 전환 <input type="number" data-v="cConv" value="${v.cConv}"></label>
    <label>실험군 유저 <input type="number" data-v="vUsers" value="${v.vUsers}"></label><label>실험군 전환 <input type="number" data-v="vConv" value="${v.vConv}"></label>
    <label>MDE (%) <input type="number" step="0.5" data-v="mde" value="${v.mde}"></label></div><div data-out></div></section>`;
  const go = () => { $$('[data-v]', box).forEach(x => v[x.dataset.v] = +x.value); store.set('ab', v); const r = L.abTest({...v, mde: v.mde / 100}); box.querySelector('[data-out]').innerHTML = kv({'대조군 전환율': (r.pc * 100).toFixed(2) + '%', '실험군 전환율': (r.pv * 100).toFixed(2) + '%', '상승률(Delta)': (r.delta * 100).toFixed(1) + '%', '카이제곱': r.chi.toFixed(3), 'p값': r.p.toFixed(4), '신뢰수준': r.chi > 3.84 ? '95% 이상' : '95% 이하'}) + `<p class="lab-verdict ${r.adopt ? 'ok' : 'no'}"><b>${r.verdict}</b> — ${esc(r.reason)}</p>`; };
  $$('[data-v]', box).forEach(x => x.oninput = go); go();
}
function durTool(box) {
  const v = store.get('dur', {baseline: 2.5, mde: 10, variants: 2, dailyUsers: 3000, allocation: 100});
  box.innerHTML = `<section class="lab-tool"><div class="lab-tool-h"><h3>실험 기간 계산</h3></div><div class="lab-opts lab-grid">
    <label>현재 전환율 (%) <input type="number" step="0.1" data-v="baseline" value="${v.baseline}"></label><label>MDE (%) <input type="number" step="0.5" data-v="mde" value="${v.mde}"></label>
    <label>변형 수(대조군 포함) <input type="number" data-v="variants" value="${v.variants}"></label><label>하루 사용자 <input type="number" data-v="dailyUsers" value="${v.dailyUsers}"></label><label>실험 할당 (%) <input type="number" data-v="allocation" value="${v.allocation}"></label></div>
    <div data-out></div><details class="lab-more"><summary>MDE를 손익분기로 정하기</summary><div class="lab-opts lab-grid"><label>개선 비용(원) <input type="number" data-b="cost" value="50000000"></label><label>건당 이익(원) <input type="number" data-b="profit" value="10000"></label><label>연간 구매 수 <input type="number" data-b="yearly" value="365000"></label></div><p data-be></p></details></section>`;
  const go = () => { $$('[data-v]', box).forEach(x => v[x.dataset.v] = +x.value); store.set('dur', v); const r = L.abDuration({baseline: v.baseline / 100, mde: v.mde / 100, variants: v.variants, dailyUsers: v.dailyUsers, allocation: v.allocation / 100}); box.querySelector('[data-out]').innerHTML = kv({'변형당 표본': r.perVariant.toLocaleString() + '명', '전체 표본': r.total.toLocaleString() + '명', '필요 기간': r.days + '일'}) + `<p class="muted">검정력 80% · 유의수준 5% 근사(템플릿 공식). 7일보다 짧게 나와도 요일 효과를 피하려면 최소 1~2주 돌린다(해석).</p>`; const b = Object.fromEntries($$('[data-b]', box).map(x => [x.dataset.b, +x.value])); const need = b.cost / b.profit; box.querySelector('[data-be]').innerHTML = `손익분기 = ${Math.round(need).toLocaleString()}건 ÷ 연 ${b.yearly.toLocaleString()}건 = <b>${(need / b.yearly * 100).toFixed(2)}%</b> — 이 상승률보다 작은 효과는 찾아도 남는 게 없다.`; };
  $$('input', box).forEach(x => x.oninput = go); go();
}

/* ───── 표 템플릿 (실험 설계 문서 · 브랜딩) ───── */
function templateTool(m, box) {
  const key = 'tpl-' + m.id; let data = store.get(key, m.template.rows.map(r => [...r]));
  const draw = () => { box.innerHTML = `<section class="lab-tool"><div class="lab-tool-h"><h3>작업 표</h3><span class="grow"></span><button class="btn sm" data-add>행 추가</button><button class="btn sm" data-md>마크다운 복사</button><button class="btn sm" data-csv>CSV</button><button class="btn sm" data-reset>예시로 되돌리기</button></div>
    <div class="tscroll"><table class="t lab-t lab-edit"><thead><tr>${m.template.cols.map(c => `<th>${esc(c)}</th>`).join('')}<th></th></tr></thead><tbody>${data.map((r, i) => `<tr>${m.template.cols.map((c, j) => `<td><textarea rows="2" data-c="${i},${j}" aria-label="${esc(c)}">${esc(r[j] || '')}</textarea></td>`).join('')}<td><button class="btn sm" data-del="${i}">삭제</button></td></tr>`).join('')}</tbody></table></div><p class="muted">이 브라우저에 자동 저장돼요.</p></section>`;
    $$('[data-c]', box).forEach(t => t.oninput = () => { const [i, j] = t.dataset.c.split(',').map(Number); data[i][j] = t.value; store.set(key, data); });
    $$('[data-del]', box).forEach(b => b.onclick = () => { data.splice(+b.dataset.del, 1); store.set(key, data); draw(); });
    box.querySelector('[data-add]').onclick = () => { data.push(m.template.cols.map(() => '')); store.set(key, data); draw(); };
    box.querySelector('[data-reset]').onclick = () => { data = m.template.rows.map(r => [...r]); store.set(key, data); draw(); };
    box.querySelector('[data-csv]').onclick = () => download(`${m.id}.csv`, toCSV(m.template.cols, data));
    box.querySelector('[data-md]').onclick = () => { const md = `| ${m.template.cols.join(' | ')} |\n|${m.template.cols.map(() => '---').join('|')}|\n` + data.map(r => `| ${r.map(x => String(x || '').replace(/\n/g, ' ')).join(' | ')} |`).join('\n'); navigator.clipboard?.writeText(md).then(() => toast('마크다운으로 복사했어요'), () => download(`${m.id}.md`, md, 'text/markdown')); }; };
  draw();
}
function conceptTool(box) {
  const v = store.get('concept', {brand: '우리 사주', concepts: '내 이야기를 끝까지 풀어 주는 사주\n상담보다 부담 없는 한 편의 사주\n새벽에도 바로, 나만을 위한 이야기', goal: '"내 얘기 같다"는 느낌', rivals: '무료 운세 앱, 타로 상담'});
  box.innerHTML = `<section class="lab-tool"><div class="lab-tool-h"><h3>컨셉 테스트 문항 만들기</h3></div><div class="lab-opts lab-grid"><label>브랜드 <input data-v="brand" value="${esc(v.brand)}"></label><label>브랜드의 목표 <input data-v="goal" value="${esc(v.goal)}"></label><label>경쟁 브랜드(쉼표) <input data-v="rivals" value="${esc(v.rivals)}"></label><label class="wide">컨셉 안(한 줄에 하나) <textarea rows="3" data-v="concepts">${esc(v.concepts)}</textarea></label></div><div data-out></div></section>`;
  const go = () => { $$('[data-v]', box).forEach(x => v[x.dataset.v] = x.value); store.set('concept', v); const cs = v.concepts.split('\n').map(s => s.trim()).filter(Boolean), brands = [v.brand, ...v.rivals.split(',').map(s => s.trim()).filter(Boolean)].join(' / ');
    const q1 = [`알고 있는 브랜드를 모두 선택해 주세요: ${brands}`, '사용한 경험이 있는 브랜드를 모두 선택해 주세요.', '가장 주로 사용하는 브랜드는 무엇인가요?', '가장 선호하는 브랜드는 무엇인가요? 그 이유는?', '최근 주로 사용하는/선호하는 브랜드가 바뀌셨나요? 이전 브랜드는?', '이 서비스를 고를 때 가장 중요하게 고려하는 것은?', '이 서비스가 나에게 주는 가장 큰 혜택은 무엇인가요?'];
    const q2 = cs.flatMap((c, i) => [`[안 ${i + 1}] "${c}" — 잘 이해가 되시나요?`, `[안 ${i + 1}] 얼마나 마음에 드시나요? 그 이유는?`, `[안 ${i + 1}] ${v.brand}에 잘 어울린다고 느껴지시나요?`, `[안 ${i + 1}] 이용하고 싶은 마음이 드시나요?`, `[안 ${i + 1}] 다른 브랜드와 차별화된다고 생각하시나요?`, `[안 ${i + 1}] ${v.goal}이(가) 잘 느껴지시나요?`]);
    const q3 = ['전체 안 중 가장 선호하는 안은 무엇입니까?', '처음 이용한다면, 어떤 안을 보고 들어오시겠어요?', `${v.goal}을(를) 가장 크게 이끌어 내는 안은 무엇입니까?`];
    const all = [['01 브랜드 태도 · 인식', q1], ['02 컨셉별 의견', q2], ['03 최종 선호', q3]];
    box.querySelector('[data-out]').innerHTML = all.map(([h, qs]) => `<h4>${h}</h4><ol>${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ol>`).join('') + '<p class="muted">01의 응답(자사 선호자 / 경쟁사 주사용자 / 중시 가치)으로 02 · 03을 교차 분석해요.</p><button class="btn sm" data-csv>문항 CSV</button>';
    box.querySelector('[data-csv]').onclick = () => download('컨셉테스트-문항.csv', toCSV(['구분', '문항'], all.flatMap(([h, qs]) => qs.map(q => [h, q])))); };
  $$('[data-v]', box).forEach(x => x.oninput = go); go();
}

/* ───── 화면 ───── */
function drawTabs() { $('.lab-tabs').innerHTML = TABS.map(t => `<button type="button" role="tab" data-t="${t.id}" aria-pressed="${t.id === st.tab}">${esc(t.name)}${t.id === 'noah' ? '' : `<small>${ITEMS.filter(i => i.g === t.id).length}</small>`}</button>`).join(''); $$('.lab-tabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; setH(st.tab + (st.item[st.tab] ? '/' + st.item[st.tab] : '')); draw(); }); }
function draw() {
  drawTabs(); const body = $('.lab-body');
  if (st.tab === 'noah') { body.innerHTML = '<div class="noah" id="noah"></div>'; if (window.NOAH) window.NOAH.mount(document.getElementById('noah')); else body.innerHTML = '<p class="muted">노아를 불러오지 못했어요.</p>'; return; }
  const g = GROUPS.find(x => x.id === st.tab), items = ITEMS.filter(i => i.g === g.id); const cur = items.find(i => i.id === st.item[g.id]) || items[0]; st.item[g.id] = cur.id;
  body.innerHTML = `<div class="lab-grid2"><aside class="lab-side"><p class="lab-gdesc">${esc(g.desc)}</p><div class="lab-list">${items.map(i => `<button type="button" data-i="${i.id}" aria-selected="${i.id === cur.id}"><b>${esc(i.name)}</b><span>${esc(i.short)}</span></button>`).join('')}</div>
    <details class="lab-more"><summary>이 묶음의 원칙 · 출처</summary>${list(g.principles)}${g.common ? '<h4>공통 분석 단계</h4>' + list(g.common) : ''}${g.id === 'analysis' ? `<h4>변수 특성 (정의는 해석)</h4><table class="t">${TRAITS.map(([a, b, c]) => `<tr><td><b>${a}</b></td><td>${esc(b)}<br><small class="muted">${esc(c)}</small></td></tr>`).join('')}</table>` : ''}<p class="muted">출처: ${esc(g.source)}</p></details></aside>
    <article class="lab-main">${methodCard(cur)}<div data-tool></div></article></div>`;
  $$('.lab-list button').forEach(b => b.onclick = () => { st.item[g.id] = b.dataset.i; setH(g.id + '/' + b.dataset.i); draw(); window.scrollTo({top: 0}); });
  const box = $('[data-tool]');
  if (cur.g === 'analysis') analysisTool(cur, box);
  else if (cur.id === 'ice') iceTool(box); else if (cur.id === 'ab_result') abTool(box); else if (cur.id === 'ab_duration') durTool(box); else if (cur.id === 'concept_test') conceptTool(box);
  else if (cur.template) templateTool(cur, box);
}
addEventListener('hashchange', () => { parseHash(); draw(); });
draw();
window.LABPAGE = { SAMPLES };
})();
