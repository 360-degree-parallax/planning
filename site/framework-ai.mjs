// 프레임워크 추론 엔진 — 아이데이션 → 프로덕트 → 검증 → 토론, 네 단계.
// 단계마다 사용자가 주관식으로 지시하면 Claude가 문제를 푸는 방향을 스스로 추론해 기획안을 하나 만든다.
// 단계마다 꼭 필요한 핵심(core)만 정해 두고, 나머지 도구(3C, GTM, 이슈트리, ICE …)는 필요할 때만 골라 쓴다.
// webtoon/rough/claude.js와 같은 방식: 공식 SDK(브라우저 번들) + 스트리밍 + JSON 스키마 출력 + 거절 시 서버 측 대체 모델.
// 키는 사용자가 넣고 이 브라우저에만 저장된다(노아와 같은 키).
import Anthropic from './vendor/anthropic-sdk.mjs';

export const MODEL = 'claude-opus-5-5';
const client = apiKey => new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com', dangerouslyAllowBrowser: true, maxRetries: 2 });

/* 스키마 도우미 (structured outputs: 모든 속성 required, additionalProperties false) */
const str = d => ({ type: 'string', description: d });
const int = d => ({ type: 'integer', description: d });
const arr = (items, d) => ({ type: 'array', items, description: d });
const obj = props => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const strs = d => arr(str(''), d);

/* 단계 — core는 아주 핵심적인 것만 */
export const STAGES = [
  { id: 'idea', name: '아이데이션', desc: '문제를 정의하고 풀 방향(아이디어)을 고른다',
    placeholder: '풀고 싶은 문제를 자유롭게 써 주세요. 서비스, 지금 상황, 숫자, 원하는 것, 제약까지.\n예: AI 사주 사이트 1p→결제 전환이 2%인데 석 달 안에 3%로 올리고 싶어. 개발자는 한 명이고 광고비는 월 300만 원.',
    ask: '사용자의 문제를 읽고 진짜 문제를 한 문장으로 정의한 뒤, 풀 방향(아이디어) 3~6개를 내고 하나를 추천한다.',
    core: obj({ problem: str('진짜 문제 한 문장'), goal: str('목표 — 숫자와 기한. 사용자가 안 줬으면 제안하고 (제안) 표시'), ideas: arr(obj({ title: str('아이디어 이름'), summary: str('무엇을 하나 (두 문장)'), why: str('왜 통할 수 있나') }), '3~6개'), pick: str('추천 아이디어 이름'), pick_reason: str('추천 이유') }) },
  { id: 'product', name: '프로덕트', desc: '고른 방향을 제품으로 — 누구에게, 무엇을, 어떤 경험으로',
    placeholder: '어떻게 만들지 지시해 주세요. 비워 두면 앞 단계로 추론해요.\n예: 추천안으로 가자. 20~30대 여성 중심, 가격은 9,900원 근처. GTM도 같이 봐 줘.',
    ask: '채택한 아이데이션을 바탕으로 제품 기획안을 만든다: 컨셉, 타겟, 핵심 가치, 핵심 경험 흐름, MVP 범위, 북극성 지표.',
    core: obj({ concept: str('한 줄 컨셉'), target: str('타겟 — 상황 기준'), value: str('핵심 가치'), flow: strs('핵심 경험 흐름 4~7단계'), mvp: strs('MVP에 반드시 넣을 것'), not_now: strs('이번엔 안 할 것'), north_star: str('북극성 지표와 정의') }) },
  { id: 'verify', name: '검증', desc: '틀리면 무너지는 가정을 찾아 가장 싸게 확인한다',
    placeholder: '무엇을 검증할지 지시해 주세요. 비워 두면 앞 단계로 추론해요.\n예: 돈 낼지가 제일 불안해. 2주 안에 광고비 50만 원으로 확인하고 싶어.',
    ask: '채택한 기획안에서 틀리면 무너지는 가정을 찾고, 위험한 것부터 가장 싸고 빠른 확인 방법을 설계한다.',
    core: obj({ assumptions: arr(obj({ assumption: str('가정'), risk: int('틀렸을 때 피해 1~5'), evidence: str('지금 근거 (없으면 "없음")') }), '3~6개'), experiments: arr(obj({ assumption: str('확인할 가정'), method: str('방법'), metric: str('지표'), success: str('성공 기준 (숫자)'), cost: str('기간 · 비용') }), '2~4개, 위험한 순') }) },
  { id: 'debate', name: '토론', desc: '레드팀이 깨 보고, 고친 기획을 기획서 한 장으로',
    placeholder: '어떤 관점으로 깨 볼지, 무엇을 정리할지 지시해 주세요. 비워 두면 기본 레드팀으로 해요.\n예: CFO랑 회의적인 고객 입장에서 세게 깨 보고 기획서로 정리해 줘.',
    ask: '지금까지의 기획을 레드팀(직설적인 시니어 기획자 노아, 결정권자 CFO, 회의적인 고객, 경쟁사 PM 중 지시에 맞게)이 깨 보고, 반영해 고친 기획을 3W1H 두괄식 기획서로 정리한다.',
    core: obj({ critiques: arr(obj({ persona: str('누가'), claim: str('지적'), fix: str('고칠 방향') }), '4~8개'), changes: strs('반영해서 바뀐 점'), brief: obj({ slogan: str('슬로건'), why: str('왜'), who: str('누구에게'), what: str('무엇을'), how: str('어떻게'), expected: strs('기대 효과 (숫자)'), so_what: str('한 줄 결론') }) }) }
];
export const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));

export const planSchema = stage => obj({
  title: str('이 기획안의 이름 (20자 안팎)'),
  summary: str('세 줄 요약'),
  approach: str('이 문제를 어떤 방향으로 풀었고, 왜 아래 도구들을 골랐는지 (두세 문장)'),
  core: stage.core,
  sections: arr(obj({ heading: str('절 제목'), tool_id: str('쓴 이론 · 도구 id (목록에 없으면 빈 문자열)'), body: str('본문 — 마크다운(목록 · 표 · 굵게) 가능, 구체적으로') }), '문제를 푸는 데 꼭 필요한 분석만 0~4개. 모든 도구를 쓸 필요 없다'),
  open_questions: strs('사용자에게 확인하면 좋을 것 0~3개')
});

const SYSTEM = `너는 시니어 서비스 기획자이자 그로스 전략가다. 사용자가 던진 문제를 함께 실제 기획으로 만든다.
원칙:
- 사용자의 지시를 가장 먼저 따른다. 지시에서 진짜로 풀려는 문제와 원하는 결과물을 추론하고, 그 문제를 푸는 데 필요한 것만 한다.
- 단계마다 정해진 핵심(core)은 반드시 채운다. 그 밖의 분석(3C, GTM, 이슈트리, ICE, 단위 경제, 퍼널, 지표 설계, 리스크 등)은 이 문제에 정말 필요할 때만 sections에 골라 쓴다. 쓸 때는 아래 이론 목록의 id를 tool_id로 단다. 다 쓰려고 하지 않는다.
- 한국어로, 실무자가 바로 쓸 수 있게 구체적으로. 형용사 대신 상황 · 숫자 · 행동.
- 숫자를 지어내지 않는다. 추정한 숫자는 "(가정)"을 붙이고 근거를 쓴다. 제공된 사례·자료를 인용하면 id나 출처를 괄호로 단다.
- 앞 단계에서 채택한 기획안과 일관되게 쓴다. 바꿔야 하면 이유를 쓴다. 앞 단계가 비어 있으면 사용자의 처음 문제로 추론해 채우고 "(추론)"을 붙인다.
- 결과는 주어진 JSON 스키마로만 낸다.`;

/* 이론 목록 (id: 제목) — 시스템 프롬프트에 넣고 캐시한다 */
let _catalog = '';
export function catalog() {
  if (_catalog) return _catalog;
  const meta = Object.fromEntries(((window.P && window.P.STEPS) || []).map(s => [s.id, s]));
  _catalog = (window.CHAPTERS || []).map(ch => `# ${ch.no}장 ${ch.title}\n` + ch.T.map(t => `${t.id}: ${t.t || (meta[t.id] && meta[t.id].t) || t.id}`).join('\n')).join('\n');
  return _catalog;
}

/* 맥락 */
const tok = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1);
export function pickCases(cases, text, n = 4) {
  const q = new Set(tok(text)); if (!cases || !q.size) return [];
  const s2 = x => typeof x === 'string' ? x : JSON.stringify(x || '');
  return cases.map(c => { let s = 0; tok([c.title, c.domain, c.what && c.what.problem, s2(c.solution), s2(c.so_what)].join(' ')).forEach(w => { if (q.has(w)) s++; }); return [s, c]; }).filter(([s]) => s > 1).sort((a, b) => b[0] - a[0]).slice(0, n)
    .map(([, c]) => ({ id: c.id, title: c.title, problem: c.what && c.what.problem, solution: s2(c.solution).slice(0, 300), so_what: s2(c.so_what).slice(0, 200) }));
}
export const usedPlan = (project, id) => { const st = project.stages[id]; if (!st || !st.plans.length) return null; return st.plans.find(p => p.id === st.adopted) || st.plans[0]; };
export function buildContext(project, stage, data, instruction) {
  const out = [], i = STAGES.indexOf(stage);
  out.push(`[처음 문제]\n${project.origin || instruction}`);
  out.push(`[사주 모드] ${project.saju ? '켜짐 — 기준 서비스 예시는 AI 사주 웹사이트(커머스형, 웹툰형 스토리 1p → 마케팅 2p → 결제 → 전체 결과 공개, 최종 지표 = 결제). 사용자의 문제가 다른 서비스면 사용자를 따른다' : '꺼짐'}`);
  STAGES.slice(0, i).forEach(s => { const p = usedPlan(project, s.id); out.push(p ? `[${s.name} — ${project.stages[s.id].adopted === p.id ? '채택한' : '가장 최근'} 기획안]\n지시: ${p.instruction || '-'}\n${JSON.stringify(p.out)}` : `[${s.name}] 아직 없음`); });
  const mine = project.stages[stage.id]?.plans || [];
  if (mine.length) { const u = usedPlan(project, stage.id); out.push(`[이 단계에서 이미 만든 기획안 — 새 지시가 "고쳐 줘" 류면 채택안(없으면 최신)을 바탕으로, 아니면 새 각도로]\n` + mine.slice(0, 4).map(p => `- ${p.out.title}: ${p.out.summary}${project.stages[stage.id].adopted === p.id ? ' (채택)' : ''}`).join('\n') + `\n채택/최신 전체: ${JSON.stringify(u.out)}`); }
  const text = [project.origin, instruction].join(' ');
  if (['idea', 'product'].includes(stage.id)) { const cs = pickCases(data.cases, text); if (cs.length) out.push('[비슷한 사례 (사례 DB) — 쓸모 있을 때만]\n' + JSON.stringify(cs)); }
  if (project.saju && data.context) {
    if (['idea', 'product'].includes(stage.id)) out.push('[사주 경쟁사 지도 — 필요할 때만]\n' + JSON.stringify(data.context.competitors));
    if (['product', 'verify'].includes(stage.id)) out.push('[외부 벤치마크 — 참고선, 목표 아님]\n' + JSON.stringify(data.context.benchmarks));
    if (['verify', 'debate'].includes(stage.id)) out.push('[규정 체크리스트 — 법률 자문 아님, 해당할 때만]\n' + data.context.compliance);
  }
  return out.join('\n\n');
}

async function run(apiKey, user, schema, { onStatus, signal } = {}) {
  const stream = client(apiKey).beta.messages.stream({
    model: MODEL, max_tokens: 32000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: [{ type: 'text', text: `${SYSTEM}\n\n[이론 · 도구 목록 (id: 제목) — 이 사이트의 이론 장]\n${catalog()}`, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }]
  }, signal ? { signal } : undefined);
  onStatus?.('Claude가 생각하는 중');
  let chars = 0; stream.on('text', t => { chars += t.length; onStatus?.(`Claude가 쓰는 중 · ${chars.toLocaleString()}자`); });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude가 이 요청을 거절했어요. 내용을 바꿔 다시 시도해 주세요');
  if (msg.stop_reason === 'max_tokens') throw new Error('응답이 길어 잘렸어요. 다시 생성해 주세요');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { out: JSON.parse(text), usage: msg.usage, model: msg.model };
}

export async function check(apiKey) { await client(apiKey).models.retrieve(MODEL); return true; }
export async function generate(apiKey, project, stage, data, instruction, opts = {}) {
  opts.onStatus?.('자료를 모으는 중');
  const user = `${buildContext(project, stage, data, instruction)}\n\n[이번 단계: ${stage.name}]\n${stage.ask}\n\n[사용자 지시]\n${instruction || '(지시 없음 — 앞 단계와 처음 문제로 추론해서 진행)'}`;
  return run(apiKey, user, planSchema(stage), opts);
}
