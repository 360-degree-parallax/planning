/* 사주 DB 페이지: 포스텔러 영상 자막에서 뽑은 명리 개념·해석 규칙. 탭 + 거르기 + 목록 + 상세 */
(function(){
'use strict';
const {$, esc, tag, theme, setHash, hashFor} = window.P;
const TABS = [
  ['concepts', '개념'], ['rules', '판단 규칙'], ['pair_rules', '궁합'], ['timing_rules', '운'],
  ['procedures', '추론 절차'], ['cases', '사례 풀이'], ['expressions', '표현']
];
const RULE_TABS = ['rules', 'pair_rules', 'timing_rules'];
/* 같은 종류 안에서는 명리 순서(갑을병정…, 자축인묘…, 목화토금수, 비견…정인)로 */
const SEQ = ['갑', '을', '병', '정', '무', '기', '경', '신(辛', '임', '계', '자', '축', '인', '묘', '진', '사', '오', '미', '신(申', '유', '술', '해',
  '목', '화', '토', '금', '수', '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인', '비겁', '식상', '재성', '관성', '인성'];
const nameOrder = n => { const i = SEQ.findIndex(s => n === s || n.startsWith(s + (s.includes('(') ? '' : '('))); return i < 0 ? 999 : i; };
const TYPE_ORDER = ['천간', '지지', '일주', '오행', '음양', '십성', '궁성', '관계', '신살', '구조', '운', '용어'];
const CHECK_TONE = {'표준일치': 'ok', '표준변형': '', '채널독자': 'on', '오류의심': 'no', '판단불가': ''};
const FLAG = {'표준과다름': '표준과 다름', '사실확인필요': '사실 확인 필요', '자막불확실': '자막 불확실', '시대의존': '시대 의존', '성별버전': '성별 버전', '안전주의': '안전 주의'};
const F = ['q', 'fdomain', 'fcheck', 'forigin', 'fconf', 'fspeaker', 'fnojoke'];
let DB = null, tab = 'concepts', view = [], shown = 60, sel = null;

const fmtT = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const terms = () => $('#q').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
const hay = r => r._h || (r._h = JSON.stringify(r, (k, v) => ['sources', 'id', '_h', '_rel', 'merged_from', 'related'].includes(k) ? undefined : v).toLowerCase());
function hl(s, ts){
  let h = esc(s == null ? '' : s); if (!ts.length) return h;
  const re = new RegExp('(' + ts.map(t => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return h.replace(re, '<mark>$1</mark>');
}
function srcs(list, max){
  if (!list || !list.length) return '<span class="muted">근거 위치 없음</span>';
  const n = max || 8;
  return '<div class="sj-src">' + list.slice(0, n).map(s => {
    const v = DB.videos[s.video] || {};
    const d = v.date ? `${v.date.slice(2, 4)}.${v.date.slice(4, 6)}.${v.date.slice(6, 8)}` : '';
    return `<a href="https://youtu.be/${esc(s.video)}?t=${s.t}" target="_blank" rel="noopener" title="${esc(v.title || '')}"><b>${fmtT(s.t)}</b> ${esc((v.title || s.video).slice(0, 34))}${(v.title || '').length > 34 ? '…' : ''} <i>${d}</i></a>`;
  }).join('') + (list.length > n ? `<span class="muted">외 ${list.length - n}곳</span>` : '') + '</div>';
}
function badges(r){
  const b = [];
  if (r.check && r.check.status) b.push(tag(r.check.status, CHECK_TONE[r.check.status] || ''));
  (r.flags || []).filter(f => f !== '표준과다름' || !(r.check && r.check.status === '오류의심')).forEach(f => b.push(tag(FLAG[f] || f, 'warn')));
  if (r.confidence === '농담' || r.origin === '오락') b.push(tag('농담·오락'));
  if ((r.merged_from || []).length > 1) b.push(tag(`${r.merged_from.length}번 언급`));
  return b.join('');
}

/* 거르기 */
function passes(r){
  const ts = terms();
  if (ts.length && !ts.every(t => hay(r).includes(t))) return false;
  const v = Object.fromEntries(F.map(k => [k, k === 'fnojoke' ? $('#' + k).checked : $('#' + k).value]));
  if (v.fdomain && !(r.domain || []).includes(v.fdomain)) return false;
  if (v.fcheck && !(r.check && r.check.status === v.fcheck)) return false;
  if (v.forigin && r.origin !== v.forigin) return false;
  if (v.fconf && r.confidence !== v.fconf) return false;
  if (v.fspeaker && !(r.speaker || '').split(/,\s*/).includes(v.fspeaker)) return false;
  if (v.fnojoke && (r.confidence === '농담' || r.origin === '오락')) return false;
  return true;
}

/* 목록 줄 */
function rowOf(r){
  const ts = terms();
  if (tab === 'concepts') {
    const rel = related(r), n = rel.rules.length + rel.pairs.length + rel.timing.length;
    return [`${hl(r.name, ts)}`, `${esc(r.type)}${(r.definitions || []).length ? ` · 정의 ${r.definitions.length}` : ''} · 관련 규칙 ${n}`, hl(r.meaning, ts), ''];
  }
  if (tab === 'rules') return [hl(r.condition_text, ts), [...(r.domain || []), r.speaker].filter(Boolean).map(esc).join(' · '), hl(r.conclusion, ts), badges(r)];
  if (tab === 'pair_rules') return [hl(r.condition_text, ts), [r.relation, r.positions, r.effect].filter(Boolean).map(esc).join(' · '), hl(r.conclusion, ts), badges(r)];
  if (tab === 'timing_rules') return [hl([r.layer, r.incoming].filter(Boolean).join(' · '), ts), [r.event_label, r.period, r.natal_condition && '원국: ' + r.natal_condition].filter(Boolean).map(esc).join(' · '), hl(r.conclusion, ts), badges(r)];
  if (tab === 'procedures') return [hl(r.kind, ts), `${esc(r.speaker || '')} · ${(r.steps || []).length}단계`, hl((r.steps || [])[0], ts), ''];
  if (tab === 'cases') return [hl(r.subject, ts), `원국 ${esc(r.chart_certainty || '-')} · ${esc(r.speaker || '')}`, hl(r.conclusion, ts), ''];
  return [hl(r.summary, ts), [r.kind, r.target].filter(Boolean).map(esc).join(' · '), '', ''];
}

function filter(){
  const src = DB[tab];
  if (tab === 'concepts') {
    const ts = terms();
    const ti = t => (TYPE_ORDER.indexOf(t) + 99) % 99;
    view = src.filter(c => !ts.length || ts.every(t => hay(c).includes(t)))
      .sort((a, b) => ti(a.type) - ti(b.type) || nameOrder(a.name) - nameOrder(b.name) || a.name.localeCompare(b.name, 'ko'));
  } else view = src.filter(passes);
  shown = 60; list();
}
function list(){
  $('#cnt').textContent = `${DB[tab].length}개 중 ${view.length}개`;
  if (!view.length) { $('#list').innerHTML = '<p class="empty" style="padding:24px 16px">조건에 맞는 항목이 없어요. 검색어나 거르기를 바꿔 보세요.</p>'; return; }
  let prevType = null;
  $('#list').innerHTML = view.slice(0, shown).map(r => {
    const [t, m, s, b] = rowOf(r);
    const head = tab === 'concepts' && r.type !== prevType ? `<div class="sj-group">${esc(r.type)}</div>` : '';
    prevType = r.type;
    return `${head}<button class="row" data-id="${esc(r.id)}" aria-selected="${sel === r.id}"><span><div class="rt">${t}</div><div class="rm">${m}</div></span><span class="rb">${b}</span>${s ? `<span class="rs">${s}</span>` : ''}</button>`;
  }).join('') + (view.length > shown ? `<button class="more" id="more">${view.length - shown}개 더 보기</button>` : '');
}

/* 개념 ↔ 규칙 연결 */
function related(c){
  if (c._rel) return c._rel;
  const n = c.name, short = n.replace(/\(.+\)/, ''), han = (n.match(/\((.+)\)/) || [])[1];
  const names = [n, ...(c.aliases || [])];
  const hit = r => (r.conditions || []).some(x => names.includes(x.target) || x.target === short) ||
    [r.condition_text, r.relation, r.incoming, r.natal_condition].some(s => s && (names.some(a => s.includes(a)) || (han && s.includes(han)) || (short.length >= 2 && s.includes(short))));
  return (c._rel = {
    rules: DB.rules.filter(hit), pairs: DB.pair_rules.filter(hit), timing: DB.timing_rules.filter(hit),
    expr: DB.expressions.filter(r => r.target && (names.includes(r.target) || r.target === short || (han && r.target.includes(han))))
  });
}
function miniRule(r){
  return `<button class="sj-mini" data-go="${esc(r.id)}"><b>${esc(r.condition_text || [r.layer, r.incoming].filter(Boolean).join(' · '))}</b><span>${esc(r.conclusion)}</span><em>${badges(r)}</em></button>`;
}
const LABEL = {meaning: '의미', imagery: '비유', positive: '잘 쓰면', negative: '과하면'};

function detailHtml(r){
  const ts = terms();
  const sec = (t, body) => body ? `<section class="dsec"><h3>${t}</h3>${body}</section>` : '';
  if (tab === 'concepts') {
    const rel = related(r);
    const kv = Object.keys(LABEL).filter(k => r[k]).map(k => `<dt>${LABEL[k]}</dt><dd>${hl(r[k], ts)}</dd>`).join('');
    const defs = (r.definitions || []).map(d => `<div class="sj-def sj-${esc(d.variant)}">${tag(d.variant, d.variant === '표준' ? 'ok' : d.variant === '채널식' ? 'warn' : '')} ${hl(d.condition, ts)} <span class="muted">${esc(d.speaker || '')}</span>${d.sources && d.sources.length ? srcs(d.sources, 3) : ''}</div>`).join('');
    const notes = (r.notes || []).map(x => `<div class="sj-def"><span class="muted">${esc(LABEL[x.field] || x.field)} · ${esc(x.speaker || '')}</span><br>${hl(x.text, ts)}${srcs(x.sources, 2)}</div>`).join('');
    const group = (t, arr) => arr.length ? sec(`${t} <small class="muted">${arr.length}</small>`, `<div class="sj-minis">${arr.map(miniRule).join('')}</div>`) : '';
    return { meta: `${esc(r.type)}${(r.aliases || []).length ? ' · 다른 이름 ' + r.aliases.map(esc).join(', ') : ''}`, title: esc(r.name),
      body: sec('채널의 해석', `${(r.keywords || []).length ? `<p class="sj-kw">${r.keywords.map(k => tag(k)).join('')}</p>` : ''}<dl class="kv">${kv}</dl>`)
        + sec('성립 조건 (학설별)', defs && `<div class="sj-defs">${defs}</div>`)
        + sec('다른 영상에서 덧붙인 설명', notes && `<div class="sj-defs">${notes}</div>`)
        + group('관련 판단 규칙', rel.rules) + group('관련 궁합 규칙', rel.pairs) + group('관련 운 규칙', rel.timing)
        + sec('표현', rel.expr.map(e => `<p>${esc(e.summary)}</p>`).join(''))
        + sec('근거 영상', srcs(r.sources, 10)) };
  }
  if (RULE_TABS.includes(tab)) {
    const ck = r.check || {};
    const rel = (r.related || []).map(id => DB._byId[id]).filter(Boolean);
    const rows = [
      ['조건', r.condition_text || [r.incoming && '들어오는 것: ' + r.incoming, r.natal_condition && '원국: ' + r.natal_condition].filter(Boolean).join(' · ')],
      ['해석', r.conclusion], ['본인 처방', r.prescription_self], ['상대에게', r.prescription_other],
      ['만난 시점', r.timing_condition], ['자리', r.positions], ['관계', r.relation], ['효과', r.effect], ['사건', r.event_label], ['시기', r.period]
    ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${hl(v, ts)}</dd>`).join('');
    const meta = [['영역', (r.domain || []).join(', ')], ['확신도', r.confidence], ['출처 유형', r.origin], ['보정 기준', r.correction], ['화자', r.speaker], ['한쪽 방향', r.asymmetric ? '예' : '']]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    return { meta: `${esc(TABS.find(t => t[0] === tab)[1])} · ${esc(r.id)}${(r.merged_from || []).length > 1 ? ` · 영상 ${r.merged_from.length}곳에서 반복` : ''}`,
      title: hl(r.condition_text || [r.layer, r.incoming].filter(Boolean).join(' · '), ts),
      body: sec('내용', `<dl class="kv">${rows}</dl>`)
        + sec('표준 명리 이론과 대조', ck.status ? `<p>${tag(ck.status, CHECK_TONE[ck.status] || '')} ${(r.flags || []).map(f => tag(FLAG[f] || f, 'warn')).join(' ')}</p>${ck.note ? `<p class="muted">${esc(ck.note)}</p>` : ''}` : '')
        + sec('분류', `<dl class="kv">${meta}</dl>`)
        + sec('함께 볼 규칙', rel.length ? `<div class="sj-minis">${rel.map(miniRule).join('')}</div>` : '')
        + sec('근거 영상', srcs(r.sources)) };
  }
  if (tab === 'procedures') return { meta: `추론 절차 · ${esc(r.speaker || '')}`, title: esc(r.kind),
    body: sec('단계', `<ol class="chain">${(r.steps || []).map(s => `<li>${hl(s, ts)}</li>`).join('')}</ol>`) + sec('근거 영상', srcs(r.sources)) };
  if (tab === 'cases') return { meta: `사례 풀이 · ${esc(r.speaker || '')}`, title: esc(r.subject),
    body: sec('원국', `<p>${esc(r.chart || '제시되지 않음')} ${tag('원국 ' + (r.chart_certainty || '-'))}</p>`)
      + sec('짚은 근거', (r.evidence || []).length ? `<ul class="sj-ul">${r.evidence.map(e => `<li>${hl(e, ts)}</li>`).join('')}</ul>` : '')
      + sec('결론', `<p>${hl(r.conclusion, ts)}</p>`) + sec('근거 영상', srcs(r.sources)) };
  return { meta: `표현 · ${esc(r.kind)}${r.target ? ' · ' + esc(r.target) : ''}`, title: hl(r.summary, ts),
    body: sec('화자', `<p>${esc(r.speaker || '')}</p>`) + sec('근거 영상', srcs(r.sources)) };
}

function detail(id){
  const side = $('#side');
  const r = id && DB[tab].find(x => x.id === id);
  if (!r) { side.classList.add('idle'); side.innerHTML = '<p class="empty">항목을 누르면 자세한 내용과 근거 영상이 보여요</p>'; sel = null; return; }
  sel = id; side.classList.remove('idle');
  document.querySelectorAll('.row').forEach(x => x.setAttribute('aria-selected', x.dataset.id === id));
  const d = detailHtml(r);
  side.innerHTML = `<div class="dhead"><div><div class="rm">${d.meta}</div><h2>${d.title}</h2></div><button class="ib close" id="close" aria-label="닫기"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>${d.body}`;
  side.scrollTop = 0;
  $('#close').onclick = () => { setHash('saju', ''); detail(null); };
}

function tabs(){
  $('#sjtabs').innerHTML = TABS.map(([k, t]) => `<button data-t="${k}" role="tab" aria-pressed="${tab === k}">${t}<small>${DB[k].length}</small></button>`).join('');
  const ruleTab = RULE_TABS.includes(tab);
  ['fdomain', 'fcheck', 'forigin', 'fconf', 'fspeaker', 'fnojoke'].forEach(k => {
    const el = $('#' + k); (el.closest('label') || el).hidden = !ruleTab;
  });
}
function go(id){
  const t = TABS.find(([k]) => DB[k].some(r => r.id === id));
  if (!t) return;
  if (t[0] !== tab) { tab = t[0]; tabs(); filter(); }
  setHash('saju', id); detail(id);
}
function route(){
  const id = hashFor('saju'); if (!id || !DB) return;
  const k = TABS.find(([key]) => key === id);
  if (k) { tab = id; tabs(); filter(); detail(null); return; }
  go(id);
}

theme();
$('#list').addEventListener('click', e => {
  if (e.target.id === 'more') { shown += 60; list(); return; }
  const r = e.target.closest('.row'); if (!r) return;
  setHash('saju', r.dataset.id); detail(r.dataset.id);
});
$('#side').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
$('#sjtabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  tab = b.dataset.t; tabs(); filter(); setHash('saju', tab); detail(null);
});
F.forEach(k => $('#' + k).addEventListener(k === 'q' ? 'input' : 'change', filter));
$('#freset').onclick = () => { F.forEach(k => { const el = $('#' + k); if (el.type === 'checkbox') el.checked = false; else el.value = ''; }); filter(); };
window.addEventListener('hashchange', route);

fetch('data/saju-rules.min.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
  DB = d; DB._byId = {};
  RULE_TABS.forEach(k => DB[k].forEach(r => DB._byId[r.id] = r));
  const all = RULE_TABS.flatMap(k => DB[k]);
  const opts = (sel, vals) => vals.forEach(v => $(sel).insertAdjacentHTML('beforeend', `<option>${esc(v)}</option>`));
  const uniq = f => [...new Set(all.flatMap(f).filter(Boolean))].sort();
  opts('#fdomain', uniq(r => r.domain || []));
  opts('#fcheck', ['표준일치', '표준변형', '채널독자', '오류의심', '판단불가'].filter(s => all.some(r => r.check && r.check.status === s)));
  opts('#forigin', uniq(r => [r.origin]));
  opts('#fspeaker', uniq(r => (r.speaker || '').split(/,\s*/)));
  const m = DB.meta, n = RULE_TABS.reduce((s, k) => s + DB[k].length, 0);
  $('#sjdesc').textContent = `${m.channel} 영상 ${Object.keys(DB.videos).length}개에서 뽑은 개념 ${DB.concepts.length}개 · 규칙 ${n}개(중복을 합친 수). 규칙마다 표준 명리 이론과 대조한 표시와 근거 영상 시간이 붙어 있어요.`;
  tabs(); filter(); route();
}).catch(() => { $('#sjdesc').textContent = '사주 DB를 불러오지 못했어요. 새로고침해 보세요.'; });
window.SajuPage = {route};
})();
