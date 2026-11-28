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
  const M = window.METHODS; if (M) M.ITEMS.forEach(m => out.push({id: `m:${m.id}`, group: `실무 · ${M.GROUPS.find(g => g.id === m.g).name}`, name: m.name, ctx: [m.short, m.why && `왜: ${m.why.join(' / ')}`, m.how && `어떻게: ${m.how.join(' / ')}`, m.points && m.points.map(p => p.join(': ')).join(' / '), m.rules && `판단 규칙: ${m.rules.join(' / ')}`, m.saju && `사주 적용: ${m.saju}`].filter(Boolean).join('\n')}));
  return out;
}

async function call(key, system, messages, onText, max = 1400) {
  const r = await fetch(API + '/messages', {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}, body: JSON.stringify({model: MODEL, max_tokens: max, system, messages, stream: true})});
  if (!r.ok) { let m = `요청 실패 (${r.status})`; try { const j = await r.json(); m += ' — ' + (j.error?.message || ''); } catch (e) {} throw new Error(m); }
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
  for (;;) { const {done, value} = await rd.read(); if (done) break; buf += dec.decode(value, {stream: true}); const parts = buf.split('\n\n'); buf = parts.pop(); for (const p of parts) { const line = p.split('\n').find(l => l.startsWith('data: ')); if (!line) continue; try { const ev = JSON.parse(line.slice(6)); if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text += ev.delta.text; onText(text); } if (ev.type === 'error') throw new Error(ev.error?.message || '스트림 오류'); } catch (e) { if (e.message && !e.message.includes('JSON')) throw e; } } }
  return text;
}

function mount(el) {
  const T = topics(), groups = [...new Set(T.map(t => t.group))];
  let key = ls.get(KEY, ''), sessions = ls.get(HIST, []), cur = null, busy = false;
  const save = () => { if (cur) { const i = sessions.findIndex(s => s.id === cur.id); if (i < 0) sessions.unshift(cur); else sessions[i] = cur; sessions = sessions.slice(0, 30); ls.set(HIST, sessions); } };
  el.innerHTML = `<div class="noah-grid">
    <aside class="noah-side">
      <div class="noah-hero"><div class="noah-av" aria-hidden="true">N</div><div><b>노아</b><span>직설적이고, 결국은 네 편인 시니어 기획자</span></div></div>
      <div class="noah-key"><span data-keyst></span><button class="btn sm" data-keybtn></button></div>
      <form class="noah-keyform" hidden><input type="password" placeholder="sk-ant-…" autocomplete="off" aria-label="Anthropic API 키"><button class="btn sm dark">저장</button><button type="button" class="btn sm" data-keydel>지우기</button><p class="muted">키는 이 브라우저에만 저장되고, Anthropic API로 직접 보내져요. 다른 곳에는 보내지 않아요.</p></form>
      <label class="noah-lb">주제 묶음<select data-group><option value="">전체에서 무작위</option>${groups.map(g => `<option>${esc(g)}</option>`).join('')}</select></label>
      <label class="noah-lb">주제<select data-topic></select></label>
      <button class="btn dark noah-go" data-new>논술 문제 받기</button>
      <h4>지난 토론</h4><div class="noah-hist"></div>
    </aside>
    <section class="noah-main"><div class="noah-log" aria-live="polite"></div>
      <form class="noah-input" hidden><textarea rows="5" placeholder="네 답을 써. 근거랑 숫자 있으면 더 좋고."></textarea><div class="noah-acts"><span class="muted" data-hint>Ctrl+Enter로 보내기</span><span class="grow"></span><button class="btn dark">보내기</button></div></form>
    </section></div>`;
  const q = s => el.querySelector(s);
  const renderKey = () => { q('[data-keyst]').textContent = key ? `API 키 ${key.slice(0, 10)}…${key.slice(-4)}` : 'API 키 없음 — 넣어야 노아가 말해요'; q('[data-keyst]').classList.toggle('on', !!key); q('[data-keybtn]').textContent = key ? '키 변경' : 'API 키 입력'; q('[data-keydel]').hidden = !key; };
  const fillTopics = () => { const g = q('[data-group]').value; q('[data-topic]').innerHTML = `<option value="">무작위</option>` + T.filter(t => !g || t.group === g).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join(''); };
  const renderHist = () => { q('.noah-hist').innerHTML = sessions.length ? sessions.map(s => `<button type="button" data-s="${s.id}" aria-selected="${cur && cur.id === s.id}"><b>${esc(s.topic)}</b><span>${new Date(s.at).toLocaleDateString('ko-KR')} · ${Math.max(0, s.messages.length - 1)}턴</span></button>`).join('') : '<p class="muted">아직 없어요.</p>'; el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cur = sessions.find(s => s.id === b.dataset.s); renderLog(); renderHist(); }); };
  const bubble = (role, text, live) => `<div class="noah-msg ${role}${live ? ' live' : ''}">${role === 'assistant' ? '<i class="noah-av sm">N</i>' : ''}<div>${md(text)}</div></div>`;
  const renderLog = (liveText) => { const log = q('.noah-log'); if (!cur) { log.innerHTML = `<div class="noah-empty"><p><b>뭐부터 할래?</b></p><p>왼쪽에서 주제를 고르고 "논술 문제 받기"를 눌러. 문제 하나 던질 테니까 네 생각을 써. 그다음부터는 토론이야.</p><p class="muted">주제는 이론 1~5장과 실무 툴(데이터 분석 · 실험 · 브랜딩 · 마케팅 전략 · 콘텐츠) 전체에서 나와.</p></div>`; q('.noah-input').hidden = true; return; } log.innerHTML = `<p class="noah-topic">${esc(cur.group)} · <b>${esc(cur.topic)}</b></p>` + cur.messages.map((m, i) => i === 0 ? '' : bubble(m.role, m.content)).join('') + (liveText != null ? bubble('assistant', liveText || '…', true) : ''); q('.noah-input').hidden = false; log.scrollTop = log.scrollHeight; };
  const sys = () => `${PERSONA}\n\n[이번 주제] ${cur.group} — ${cur.topic}\n[학습 자료]\n${cur.ctx}`;
  async function ask(messages) {
    if (!key) { q('.noah-keyform').hidden = false; q('.noah-keyform input').focus(); return null; }
    busy = true; el.classList.add('busy');
    try { return await call(key, sys(), messages, t => renderLog(t)); }
    catch (e) { renderLog(); q('.noah-log').insertAdjacentHTML('beforeend', `<p class="msg">${esc(e.message)}${/401|authentication/i.test(e.message) ? ' — 키를 확인해 줘.' : ''}</p>`); return null; }
    finally { busy = false; el.classList.remove('busy'); }
  }
  q('[data-group]').onchange = fillTopics; fillTopics();
  q('[data-keybtn]').onclick = () => { const f = q('.noah-keyform'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); };
  q('[data-keydel]').onclick = () => { key = ''; ls.del(KEY); renderKey(); };
  q('.noah-keyform').onsubmit = async e => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v) || v.startsWith('sk-ant-admin')) { alert('Claude API 키 형식이 아니에요 (sk-ant-로 시작하는 일반 키)'); return; } try { const r = await fetch(`${API}/models/${MODEL}`, {headers: {'x-api-key': v, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}}); if (!r.ok) throw new Error(r.status); } catch (err) { if (!confirm(`키 확인에 실패했어요(${err.message}). 그래도 저장할까요?`)) return; } key = v; ls.set(KEY, key); e.target.hidden = true; e.target.querySelector('input').value = ''; renderKey(); };
  q('[data-new]').onclick = async () => {
    if (busy) return; const g = q('[data-group]').value, id = q('[data-topic]').value; const pool = T.filter(t => (!g || t.group === g) && (!id || t.id === id)); const t = pool[Math.floor(Math.random() * pool.length)]; if (!t) return;
    cur = {id: 's' + Date.now(), at: Date.now(), topic: t.name, group: t.group, ctx: t.ctx, messages: [{role: 'user', content: `"${t.name}"에 대해 논술형 문제 하나를 내 줘. 형식: 첫 줄에 한 줄 상황 설정(가능하면 AI 사주 웹사이트 같은 실제 기획 상황), 그다음 **문제**, 그다음 답에 꼭 들어가야 할 요구사항 2~3개, 마지막에 "분량: ○○자 안팎". 정답이나 힌트는 주지 마. 노아 말투로 짧게 한마디 붙여도 돼.`}]};
    renderLog(''); renderHist(); const out = await ask(cur.messages); if (out == null) { if (!key) { cur = null; renderLog(); } return; } cur.messages.push({role: 'assistant', content: out}); save(); renderLog(); renderHist(); q('.noah-input textarea').focus();
  };
  q('.noah-input').onsubmit = async e => { e.preventDefault(); if (busy || !cur) return; const ta = e.target.querySelector('textarea'), v = ta.value.trim(); if (!v) return; cur.messages.push({role: 'user', content: v}); ta.value = ''; save(); renderLog(''); const out = await ask(cur.messages.map(m => ({role: m.role, content: m.content}))); if (out == null) { cur.messages.pop(); ta.value = v; renderLog(); return; } cur.messages.push({role: 'assistant', content: out}); save(); renderLog(); renderHist(); };
  q('.noah-input textarea').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) q('.noah-input').requestSubmit(); };
  renderKey(); renderHist(); renderLog();
}
window.NOAH = { mount, topics, PERSONA, MODEL };
})();
