/* 노아 — 기획 공부 툴. 이론(1~5장)과 실무 방법 DB에서 주제를 골라 논술형 문제를 받고, 답을 쓰면 토론한다.
   웹툰 러프 툴과 같은 방식: 내 Anthropic API 키를 넣으면 켜지고, 키는 이 브라우저(localStorage)에만 저장된다.
   API는 브라우저에서 직접 호출한다(anthropic-dangerous-direct-browser-access). */
(function(){
const MODEL = 'claude-opus-5-5', API = 'https://api.anthropic.com/v1';
const KEY = 'noah-key', HIST = 'noah-sessions';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const strip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#+\s?(.*)$/gm, '<b>$1</b>').replace(/\n/g, '<br>');

const PERSONA = `너는 "노아"다. 기획 공부를 같이 하는 시니어 기획자이고, 상대를 동등한 프로로 대한다.
말투: 반말. 싸가지 없게 직설적이지만 밑바닥은 다정하다. 빈말 칭찬은 안 한다 — 좋은 건 짧게 인정하고, 약한 건 바로 찌른다. 상대를 깎아내리거나 모욕하지는 않는다. 가르치려 들지 말고 붙어서 토론한다.
토론 방식:
- 상대 답에서 가장 약한 고리 하나를 정확히 짚는다 (근거 없음, 타겟 흐림, 숫자 없음, 반례, 실행 불가 등).
- 반례나 실제 사례를 하나 들어 흔든다. 확실하지 않은 사실은 "내 기억으론"처럼 표시하고, 숫자를 지어내지 않는다.
- 아래 학습 자료의 개념(5 Why, Why not yet, 3C, SMART, 깊이·넓이·구조, GTM, A/B 테스트 등)을 이름으로 불러 연결한다.
- 사주 서비스(AI 사주 웹사이트 · 커머스형 · 결제가 최종 지표)에 대입해 보게 한다.
- 항상 마지막 줄은 상대가 다음에 생각해 올 질문 하나로 끝낸다.
- 길게 늘어놓지 않는다. 300~600자 안팎. 목록은 꼭 필요할 때만.`;

/* 주제 목록: 이론 장 + 실무 방법 DB */
function topics() {
  const out = [], meta = Object.fromEntries(((window.P && window.P.STEPS) || []).map(s => [s.id, s]));
  (window.CHAPTERS || []).forEach(ch => ch.T.forEach(t => out.push({id: `${ch.view}:${t.id}`, group: `${ch.no}장 ${ch.title.split(' — ')[0]}`, name: t.t || meta[t.id]?.t || t.id, ctx: [t.ask && `질문: ${t.ask}`, t.def && `정의: ${t.def}`, t.how && `방법: ${t.how.join(' / ')}`, t.pit && `흔한 실수: ${t.pit.join(' / ')}`, t.more && `보충: ${strip(t.more).slice(0, 900)}`].filter(Boolean).join('\n')})));
  const M = window.METHODS; if (M && !(window.CHAPTERS || []).some(c => c.view === 'ch6')) M.ITEMS.forEach(m => out.push({id: `m:${m.id}`, group: `실무 · ${M.GROUPS.find(g => g.id === m.g).name}`, name: m.name, ctx: [m.short, m.why && `왜: ${m.why.join(' / ')}`, m.how && `어떻게: ${m.how.join(' / ')}`, m.points && m.points.map(p => p.join(': ')).join(' / '), m.rules && `판단 규칙: ${m.rules.join(' / ')}`, m.saju && `사주 적용: ${m.saju}`].filter(Boolean).join('\n')}));
  return out;
}

async function call(key, system, messages, onText, max = 1400) {
  const r = await fetch(API + '/messages', {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}, body: JSON.stringify({model: MODEL, max_tokens: max, system, messages, stream: true})});
  if (!r.ok) { let m = `요청 실패 (${r.status})`; try { const j = await r.json(); m += ' — ' + (j.error?.message || ''); } catch (e) {} throw new Error(m); }
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
  for (;;) { const {done, value} = await rd.read(); if (done) break; buf += dec.decode(value, {stream: true}); const parts = buf.split('\n\n'); buf = parts.pop(); for (const p of parts) { const line = p.split('\n').find(l => l.startsWith('data: ')); if (!line) continue; try { const ev = JSON.parse(line.slice(6)); if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text += ev.delta.text; onText(text); } if (ev.type === 'error') throw new Error(ev.error?.message || '스트림 오류'); } catch (e) { if (e.message && !e.message.includes('JSON')) throw e; } } }
  return text;
}

/* 톡방 UI — 카카오톡 PC 구조(왼쪽 대화 목록 · 오른쪽 방), 색은 사이트 토큰 */
const fmtTime = t => new Date(t).toLocaleTimeString('ko-KR', {hour: 'numeric', minute: '2-digit'});
const fmtDay = t => new Date(t).toLocaleDateString('ko-KR', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'});
const fmtList = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? fmtTime(t) : d.toLocaleDateString('ko-KR', {month: 'numeric', day: 'numeric'}); };
const plain = t => String(t || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const ICON = {
  back: '<svg viewBox="0 0 24 24" class="i"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" class="i"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" class="i"><path d="M4 12l16-8-6 16-3-7-7-1z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" class="i"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  pin: '<svg viewBox="0 0 24 24" class="i"><path d="M12 3l3 6 5 1-4 4 1 6-5-3-5 3 1-6-4-4 5-1z"/></svg>'
};

function mount(el) {
  const T = topics(), groups = [...new Set(T.map(t => t.group))];
  let key = ls.get(KEY, ''), sessions = ls.get(HIST, []), cur = null, busy = false, picking = false;
  const save = () => { if (!cur) return; const i = sessions.findIndex(s => s.id === cur.id); if (i < 0) sessions.unshift(cur); else sessions[i] = cur; sessions.sort((a, b) => (b.last || b.at) - (a.last || a.at)); sessions = sessions.slice(0, 40); ls.set(HIST, sessions); };
  el.innerHTML = `<div class="kt">
    <aside class="kt-list">
      <div class="kt-lh"><b>채팅</b><span class="grow"></span><button class="ib" data-act="new" title="새 토론" aria-label="새 토론">${ICON.plus}</button><button class="ib" data-act="key" title="API 키" aria-label="API 키 설정">${ICON.gear}</button></div>
      <div class="kt-rooms"></div>
    </aside>
    <section class="kt-room">
      <header class="kt-rh"><button class="ib kt-back" data-act="back" aria-label="목록으로">${ICON.back}</button><i class="kt-av">N</i><div class="kt-rt"><b>노아</b><span data-sub>기획 토론 · 1:1</span></div><span class="grow"></span><button class="ib" data-act="new" title="새 주제" aria-label="새 주제">${ICON.plus}</button><button class="ib" data-act="del" title="이 토론 지우기" aria-label="이 토론 지우기">${ICON.trash}</button><button class="ib" data-act="key" title="API 키" aria-label="API 키 설정">${ICON.gear}</button></header>
      <div class="kt-notice" hidden></div>
      <div class="kt-key" hidden><p><b>API 키</b> — 키는 이 브라우저에만 저장되고 Anthropic API로만 보내져요.</p><form><input type="password" placeholder="sk-ant-…" autocomplete="off" aria-label="Anthropic API 키"><button class="btn sm dark">저장</button><button type="button" class="btn sm" data-keydel>지우기</button></form><span class="muted" data-keyst></span></div>
      <div class="kt-log" aria-live="polite"></div>
      <form class="kt-input"><button type="button" class="ib" data-act="new" title="새 주제" aria-label="새 주제">${ICON.plus}</button><textarea rows="1" placeholder="메시지 입력" aria-label="메시지"></textarea><button class="kt-send" aria-label="보내기" disabled>${ICON.send}</button></form>
    </section></div>`;
  const q = s => el.querySelector(s), log = q('.kt-log'), ta = q('.kt-input textarea'), sendBtn = q('.kt-send');
  const keyst = () => { q('[data-keyst]').textContent = key ? `저장된 키 ${key.slice(0, 10)}…${key.slice(-4)}` : '아직 키가 없어요'; q('[data-keydel]').hidden = !key; };
  const showKey = on => { q('.kt-key').hidden = !on; if (on) { keyst(); q('.kt-key input').focus(); } };
  const renderRooms = () => { q('.kt-rooms').innerHTML = sessions.length ? sessions.map(s => { const lastM = [...s.messages].reverse().find(m => m.role === 'assistant' || m !== s.messages[0]); return `<button type="button" data-s="${s.id}" aria-selected="${!!(cur && cur.id === s.id)}"><i class="kt-av">N</i><span class="kt-rmeta"><b>${esc(s.topic)}</b><small>${esc(plain(lastM && lastM !== s.messages[0] ? lastM.content : '문제를 받는 중…')).slice(0, 60)}</small></span><time>${fmtList(s.last || s.at)}</time></button>`; }).join('') : '<p class="kt-empty-l">아직 대화가 없어요.<br>＋를 눌러 주제를 골라 봐.</p>'; el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cur = sessions.find(s => s.id === b.dataset.s); picking = false; el.classList.add('open'); render(); }); };
  const noahBubble = (html, t, first, live) => `<div class="kt-row l${first ? ' first' : ''}">${first ? '<i class="kt-av">N</i>' : '<i class="kt-av sp"></i>'}<div class="kt-col">${first ? '<span class="kt-name">노아</span>' : ''}<div class="kt-line"><div class="kt-b${live ? ' live' : ''}">${html}</div>${t ? `<time>${fmtTime(t)}</time>` : ''}</div></div></div>`;
  const meBubble = (text, t) => `<div class="kt-row r"><div class="kt-line">${t ? `<time>${fmtTime(t)}</time>` : ''}<div class="kt-b">${md(text)}</div></div></div>`;
  const typing = () => noahBubble('<span class="kt-typing"><i></i><i></i><i></i></span>', 0, true, true);
  function pickerHtml() {
    return noahBubble(`<p><b>뭐부터 할래?</b> 주제 하나 고르면 논술 문제 던질게. 답 쓰면 그다음부턴 토론이야.</p>
      <div class="kt-pick"><select data-group aria-label="주제 묶음"><option value="">전체에서 무작위</option>${groups.map(g => `<option>${esc(g)}</option>`).join('')}</select><select data-topic aria-label="주제"></select><button type="button" class="btn sm dark" data-act="start">문제 받기</button></div>
      ${key ? '' : '<p class="kt-warn">먼저 위에서 API 키를 넣어 줘. 키 없으면 나 말 못 해.</p>'}`, Date.now(), true);
  }
  const fillTopics = () => { const g = q('[data-group]'); if (!g) return; q('[data-topic]').innerHTML = '<option value="">무작위</option>' + T.filter(t => !g.value || t.group === g.value).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join(''); };
  function render(liveText) {
    const has = !!cur && !picking;
    q('.kt-notice').hidden = !has; q('[data-sub]').textContent = has ? cur.group : '기획 토론 · 1:1'; q('[data-act="del"]').hidden = !cur || picking;
    if (has) q('.kt-notice').innerHTML = `${ICON.pin}<span><b>공지</b> ${esc(cur.topic)}</span>`;
    let h = '';
    if (!has) { h = `<div class="kt-day"><span>${fmtDay(Date.now())}</span></div>` + pickerHtml(); }
    else {
      let lastDay = '', prevRole = '';
      cur.messages.forEach((m, i) => { if (i === 0) return; const t = m.at || cur.at; const d = fmtDay(t); if (d !== lastDay) { h += `<div class="kt-day"><span>${d}</span></div>`; lastDay = d; prevRole = ''; } h += m.role === 'assistant' ? noahBubble(md(m.content), t, prevRole !== 'assistant') : meBubble(m.content, t); prevRole = m.role; });
      if (liveText != null) h += liveText ? noahBubble(md(liveText), 0, prevRole !== 'assistant', true) : typing();
    }
    log.innerHTML = h; log.scrollTop = log.scrollHeight;
    q('.kt-input').hidden = !has; if (!has) { fillTopics(); q('[data-group]').onchange = fillTopics; }
    renderRooms();
  }
  const sys = () => `${PERSONA}\n\n[이번 주제] ${cur.group} — ${cur.topic}\n[학습 자료]\n${cur.ctx}`;
  async function ask(messages) {
    if (!key) { showKey(true); return null; }
    busy = true; el.classList.add('busy'); sendBtn.disabled = true;
    try { return await call(key, sys(), messages, t => render(t)); }
    catch (e) { render(); log.insertAdjacentHTML('beforeend', `<div class="kt-sys">${esc(e.message)}${/401|authentication/i.test(e.message) ? ' — 키를 확인해 줘.' : ''}</div>`); log.scrollTop = log.scrollHeight; return null; }
    finally { busy = false; el.classList.remove('busy'); sendBtn.disabled = !ta.value.trim(); }
  }
  async function start() {
    if (busy) return; const g = q('[data-group]').value, id = q('[data-topic]').value; const pool = T.filter(t => (!g || t.group === g) && (!id || t.id === id)); const t = pool[Math.floor(Math.random() * pool.length)]; if (!t) return;
    if (!key) { showKey(true); return; }
    const now = Date.now();
    cur = {id: 's' + now, at: now, last: now, topic: t.name, group: t.group, ctx: t.ctx, messages: [{role: 'user', at: now, content: `"${t.name}"에 대해 논술형 문제 하나를 내 줘. 형식: 첫 줄에 한 줄 상황 설정(가능하면 AI 사주 웹사이트 같은 실제 기획 상황), 그다음 **문제**, 그다음 답에 꼭 들어가야 할 요구사항 2~3개, 마지막에 "분량: ○○자 안팎". 정답이나 힌트는 주지 마. 노아 말투로 짧게 한마디 붙여도 돼.`}]};
    picking = false; render(''); const out = await ask(cur.messages.map(({role, content}) => ({role, content})));
    if (out == null) { cur = null; picking = true; render(); return; }
    cur.messages.push({role: 'assistant', at: Date.now(), content: out}); cur.last = Date.now(); save(); render(); ta.focus();
  }
  async function send() {
    const v = ta.value.trim(); if (!v || busy || !cur) return;
    cur.messages.push({role: 'user', at: Date.now(), content: v}); ta.value = ''; grow(); cur.last = Date.now(); save(); render('');
    const out = await ask(cur.messages.map(({role, content}) => ({role, content})));
    if (out == null) { cur.messages.pop(); ta.value = v; grow(); render(); return; }
    cur.messages.push({role: 'assistant', at: Date.now(), content: out}); cur.last = Date.now(); save(); render();
  }
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; sendBtn.disabled = busy || !ta.value.trim(); };
  el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'new') { cur = null; picking = true; el.classList.add('open'); render(); }
    else if (a === 'start') start();
    else if (a === 'key') showKey(q('.kt-key').hidden);
    else if (a === 'back') el.classList.remove('open');
    else if (a === 'del' && cur && confirm('이 토론을 지울까요?')) { sessions = sessions.filter(s => s.id !== cur.id); ls.set(HIST, sessions); cur = null; picking = true; render(); } });
  q('.kt-key form').onsubmit = async e => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v) || v.startsWith('sk-ant-admin')) { alert('Claude API 키 형식이 아니에요 (sk-ant-로 시작하는 일반 키)'); return; } try { const r = await fetch(`${API}/models/${MODEL}`, {headers: {'x-api-key': v, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}}); if (!r.ok) throw new Error(r.status); } catch (err) { if (!confirm(`키 확인에 실패했어요(${err.message}). 그래도 저장할까요?`)) return; } key = v; ls.set(KEY, key); e.target.querySelector('input').value = ''; showKey(false); render(); };
  q('[data-keydel]').onclick = () => { key = ''; ls.del(KEY); keyst(); render(); };
  ta.oninput = grow; ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
  q('.kt-input').onsubmit = e => { e.preventDefault(); send(); };
  picking = true; if (!key) showKey(true); render();
}
window.NOAH = { mount, topics, PERSONA, MODEL };
})();
