// 프레임워크 추론 엔진 — 단계 정의(스키마 · 프롬프트)와 Claude 호출.
// webtoon/rough/claude.js와 같은 방식: 공식 SDK(브라우저 번들) + 스트리밍 + JSON 스키마 출력 + 거절 시 서버 측 대체 모델.
// 키는 사용자가 넣고 이 브라우저에만 저장된다(노아와 같은 키).
import Anthropic from './vendor/anthropic-sdk.mjs';

export const MODEL = 'claude-opus-5-5';
const client = apiKey => new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com', dangerouslyAllowBrowser: true, maxRetries: 2 });

/* ───── 스키마 도우미 (structured outputs: 모든 속성 required, additionalProperties false) ───── */
const str = d => ({ type: 'string', description: d });
const int = d => ({ type: 'integer', description: d });
const num = d => ({ type: 'number', description: d });
const bool = d => ({ type: 'boolean', description: d });
const en = (vals, d) => ({ type: 'string', enum: vals, description: d });
const arr = (items, d) => ({ type: 'array', items, description: d });
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const strs = d => arr(str(''), d);

/* ───── 단계 ───── */
export const STAGES = [
  { id: 'idea', name: '아이데이션', desc: '고객과 문제를 이해하고, 아이디어를 넓게 펼친 뒤 셋으로 줄인다' },
  { id: 'product', name: '프로덕트', desc: '셋을 비교해 하나를 고르고, 3C · GTM · 이슈트리 · 경험 · MVP · 단위 경제로 깊게 판다' },
  { id: 'verify', name: '검증', desc: '틀리면 무너지는 가정을 찾아 실험 · 지표 · 리스크로 확인한다' },
  { id: 'debate', name: '토론', desc: '레드팀이 깨 보고, 고친 기획을 기획서 · 보도자료 · 로드맵으로 정리한다' }
];

export const STEPS = [
  { id: 'opportunity', stage: 'idea', name: '고객 · 기회 이해', theory: ['gtm_icp', 'four_what'], ask: '이 상황에서 고객이 해결하려는 일(JTBD), 페인포인트, 기회 영역을 정리해 줘. 기회 영역은 3~5개, 크기와 근거를 붙인다.',
    schema: obj({ jtbd: arr(obj({ situation: str('상황'), motivation: str('하고 싶은 것'), outcome: str('기대 결과') }), '2~4개'), pains: arr(obj({ pain: str('페인포인트'), evidence: str('근거(제공된 사례·자료 id나 "가정")'), severity: int('1~5') }), '4~6개'), opportunities: arr(obj({ title: str('기회 영역'), why: str('왜 지금 · 왜 우리'), size: en(['큼', '중간', '작음'], '') }), '3~5개'), summary: str('한 문단 요약') }) },
  { id: 'problem', stage: 'idea', name: '문제 정의', theory: ['five_why', 'goal', 'what'], ask: '5 Why로 근본 원인을 찾고, 표면 목표를 재정의해 문제를 한 문장으로 써 줘.',
    schema: obj({ five_why: arr(obj({ q: str('왜?'), a: str('답') }), '3~5단계'), root_cause: str('근본 원인'), surface_goal: str('표면 목표'), redefined_goal: str('재정의한 목표'), problem_statement: str('문제 한 문장'), metric: str('이 문제를 재는 지표 하나') }) },
  { id: 'ideas', stage: 'idea', name: '아이디어 발산', theory: ['hyps', 'trade_on'], cases: true, ask: '제한 없이 아이디어를 12~16개 펼쳐 줘. 제공된 사례를 옮겨 적용하거나, 통념을 뒤집거나(역발상), 둘 중 하나라던 것을 둘 다 잡는(트레이드온) 방식을 섞는다. 사례를 옮긴 경우 source_case에 사례 id를 쓴다.',
    schema: obj({ ideas: arr(obj({ id: str('I1, I2 …'), title: str('아이디어 이름'), summary: str('무엇을 하나 (두 문장)'), mechanism: en(['사례 적용', '역발상', '트레이드온', '기타'], ''), source_case: str('옮긴 사례 id, 없으면 빈 문자열'), why: str('왜 통할 수 있나') }), '12~16개') }) },
  { id: 'wny', stage: 'idea', name: 'Why not yet 필터', theory: ['wny', 'so_what'], ask: '아이디어마다 "왜 아직 아무도 안 했나"를 판정해 줘. 뻔함(이미 경쟁 중)·불가능은 탈락, 통념의 맹점·타이밍(조건 변화)은 생존.',
    schema: obj({ verdicts: arr(obj({ id: str('아이디어 id'), barrier: en(['뻔함', '불가능', '통념의 맹점', '타이밍', '기타'], ''), survive: bool('생존 여부'), why_not_yet: str('왜 아직 아무도 안 했나'), condition_change: str('타이밍이면 무엇이 바뀌었나, 아니면 빈 문자열') }), '모든 아이디어') }) },
  { id: 'ice', stage: 'idea', name: '수렴 (ICE)', theory: ['m_ice', 'pareto'], select: { max: 3, label: '프로덕트로 넘길 아이디어 (최대 3개)' }, ask: '생존한 아이디어마다 ICE 점수(각 1~5)를 매겨 줘. Impact는 재정의한 목표에 가까울수록, Confidence는 근거가 있을수록, Ease는 리소스가 적을수록 높게.',
    schema: obj({ scores: arr(obj({ id: str('아이디어 id'), impact: int('1~5'), confidence: int('1~5'), ease: int('1~5'), reason: str('점수 근거 한 줄') }), '생존 아이디어 전부') }) },

  { id: 'compare', stage: 'product', name: '비교 카드 → 하나 고르기', theory: ['three_c', 'gtm_intro'], pick: { label: '깊게 갈 아이디어 하나' }, ask: '고른 아이디어들(없으면 개요와 있는 데이터에서 후보 2~3개를 추론해서)을 같은 틀로 가볍게 비교해 줘: 3C 진입 칸, 누구에게 · 무엇으로 · 얼마에, 가장 위험한 가정. 그리고 하나를 추천해.',
    schema: obj({ cards: arr(obj({ id: str('아이디어 id (아이디어 단계가 없으면 C1, C2 …)'), title: str('아이디어 이름'), entry_cell: en(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], '3C 겹침 칸'), who: str('누구에게'), what: str('무엇으로 (포지셔닝 한 줄)'), price: str('얼마에'), riskiest_assumption: str('가장 위험한 가정'), strength: str('강점'), weakness: str('약점') }), '아이디어마다'), recommend_id: str('추천 아이디어 id'), reason: str('추천 이유') }) },
  { id: 'three_c', stage: 'product', name: '3C', theory: ['three_c', 'risk_3c'], ask: '고른 아이디어로 3C를 분석해 줘. 고객 · 경쟁사 · 자사를 정리하고, A~H 8칸에 무엇이 있는지 적고, 진입 칸과 이유를 쓴다. 경쟁사는 제공된 경쟁사 자료를 우선 쓴다.',
    schema: obj({ customer: strs('고객 니즈 3~5개'), competitors: arr(obj({ name: str('경쟁사·대안'), strength: str(''), weakness: str('') }), '3~6개'), company: strs('자사 강점·자원 3~5개'), cells: arr(obj({ cell: en(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], ''), meaning: str('이 칸의 뜻'), here: str('여기에 해당하는 것') }), '8칸 전부'), entry_cell: en(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], '진입 칸'), entry_reason: str('왜 이 칸인가'), d_risk: str('성공하면 D로 바뀌는 위험과 대비') }) },
  { id: 'gtm', stage: 'product', name: 'GTM', theory: ['gtm_intro', 'gtm_beachhead', 'gtm_position', 'gtm_pricing', 'gtm_channel'], ask: '5장 GTM의 여섯 질문으로 GTM 한 장을 써 줘. 칸마다 근거 강도를 표시한다.',
    schema: obj({ beachhead: str('처음 이길 좁은 시장 (상황 기준)'), win_metric: str('이겼다는 기준 (숫자)'), icp: obj({ situation: str(''), jtbd: str(''), alternatives: str('지금 쓰는 대안'), pay_moment: str('돈을 내는 순간') }), positioning: obj({ alternatives: str('경쟁 대안'), unique: str('고유한 특성'), value: str('가치'), target: str('타겟'), category: str('시장 카테고리') }), message: obj({ headline: str('헤드라인 약속'), proofs: strs('근거 3개'), cta: str('다음 행동') }), pricing: obj({ value_metric: str('무엇에 돈을 받나'), model: en(['단건', '구독', '묶음', '사용량', '무료+유료', '기타'], ''), price: str('가격'), rationale: str('근거') }), motion: obj({ primary: str('주 모션'), secondary: str('보조 모션') }), channels: arr(obj({ name: str(''), why: str(''), test: str('실험 방법과 성공 기준') }), '실험할 채널 3개'), pmf_signals: strs('PMF 신호 3~4개'), launch: arr(obj({ phase: str(''), goal: str(''), gate: str('넘어갈 기준') }), '3~4단계'), evidence: arr(obj({ part: str('GTM 칸'), strength: en(['강', '중', '약'], ''), note: str('') }), '주요 칸마다') }) },
  { id: 'issue_tree', stage: 'product', name: '이슈트리', theory: ['issue_tree', 'pareto', 'key_metrics', 'met_tree'], ask: '재정의한 목표를 MECE로 쪼갠 이슈트리를 만들어 줘. 하위 이슈마다 속도·임팩트(1~5)를 매기고, 먼저 공략할 것(focus)을 표시하고, 북극성·선행·가드레일 지표를 정한다.',
    schema: obj({ goal: str('최상위 목표'), branches: arr(obj({ issue: str('1단 이슈'), subs: arr(obj({ issue: str('2단 이슈'), speed: int('1~5'), impact: int('1~5'), focus: bool('먼저 공략') }), '2~4개') }), '3~4개 (MECE)'), north_star: str('북극성 지표'), leading: strs('선행 지표 1~3개'), guardrail: str('가드레일 지표') }) },
  { id: 'flow', stage: 'product', name: '핵심 경험 · 퍼널', theory: ['journey', 'gtm_message'], ask: '고객이 처음 만나서 돈을 내고 다시 오기까지의 핵심 흐름을 5~8단계로 설계해 줘. 단계마다 고객의 목표, 화면, 메시지, 이탈 위험, 지표.',
    schema: obj({ steps: arr(obj({ name: str('단계'), user_goal: str('고객의 목표'), screen: str('화면·접점'), message: str('보여 줄 메시지'), drop_risk: str('이탈 위험'), metric: str('지표') }), '5~8단계') }) },
  { id: 'mvp', stage: 'product', name: 'MVP 범위', theory: ['dep_rules', 'spd_wbs'], ask: '처음 내놓을 MVP 범위를 정해 줘: 반드시 / 있으면 좋음 / 이번엔 안 함. 가장 위험한 가정을 확인하는 데 필요한 것만 반드시에 넣는다.',
    schema: obj({ must: arr(obj({ feature: str(''), why: str('') }), ''), nice: arr(obj({ feature: str(''), why: str('') }), ''), not_now: arr(obj({ feature: str(''), why: str('') }), ''), weeks: int('MVP까지 예상 주 수') }) },
  { id: 'unit', stage: 'product', name: '단위 경제', theory: ['gtm_unit', 'm_product_acc', 'met_ltv', 'met_payback'], ask: '결제 한 건 기준 단위 경제를 추정해 줘. 모든 숫자는 가정이며 근거를 단다. 제공된 벤치마크가 있으면 쓴다.',
    schema: obj({ price: num('가격(원)'), costs: arr(obj({ name: str('비용 항목 (수수료·원가·환불 등)'), amount: num('원') }), ''), repeat_rate: num('추가 구매 확률 0~1'), channels: arr(obj({ name: str('채널'), cac: num('결제 1건 획득 비용(원)') }), '채널별'), fixed_monthly: num('월 고정비(원)'), notes: str('가정과 근거') }) },

  { id: 'assumptions', stage: 'verify', name: '위험한 가정', theory: ['gtm_pmf', 'distrust'], ask: '지금까지의 3C · GTM · 이슈트리 · 단위 경제에서 "틀리면 다 무너지는 가정"을 6~10개 뽑아 줘. 유형과 근거 강도, 위험도를 매긴다.',
    schema: obj({ items: arr(obj({ id: str('A1, A2 …'), assumption: str('가정'), type: en(['원하나', '돈이 되나', '만들 수 있나', '해도 되나'], ''), source: str('어느 단계에서 나왔나'), evidence: en(['강', '중', '약', '없음'], ''), risk: int('틀렸을 때 피해 1~5') }), '6~10개') }) },
  { id: 'experiments', stage: 'verify', name: '실험 설계', theory: ['m_ab_concepts', 'm_ab_duration', 'gtm_launch', 'met_sig'], ask: '위험도 높은 가정부터 실험을 설계해 줘. 가짜 버튼·A/B·FGI·설문·사전예약 중 가장 싸고 빠른 방법, 지표, 현재 기준값, MDE, 하루 사용자, 성공·중단 기준, ICE.',
    schema: obj({ items: arr(obj({ assumption_id: str(''), method: en(['가짜 버튼', 'A/B 테스트', 'FGI·인터뷰', '설문', '사전예약', '기타'], ''), hypothesis: str('가설'), metric: str('지표'), baseline: num('현재 기준값(비율 0~1)'), mde: num('MDE(상대 상승률 0~1)'), daily_users: int('하루 사용자'), success: str('성공 기준'), stop: str('중단 기준'), impact: int('1~5'), confidence: int('1~5'), ease: int('1~5') }), '4~6개') }) },
  { id: 'tracking', stage: 'verify', name: '지표 · 트래킹', theory: ['key_metrics', 'm_utm_builder', 'met_event', 'met_tree', 'met_dash'], ask: '핵심 흐름과 실험을 잴 이벤트를 설계해 줘 (이벤트 이름은 snake_case, 언제 발생, 매개변수). 북극성·선행·가드레일 지표와 허영 지표(쓰지 않을 것)도.',
    schema: obj({ events: arr(obj({ name: str('snake_case'), trigger: str('언제 발생'), params: str('매개변수'), step: str('흐름 단계') }), '6~12개'), north_star: str(''), leading: strs(''), guardrail: strs(''), vanity: strs('쓰지 않을 허영 지표') }) },
  { id: 'risks', stage: 'verify', name: '리스크 · 규정', theory: ['risk_wide', 'risk_law', 'mac_lead'], ask: '4장 리스크 깊이(서비스 자체)와 넓이(바깥)로 리스크를 펼치고 대비책을 적어 줘. 제공된 규정이 있으면 해당하는지 점검한다. 법률 자문이 아니라 점검 목록이다.',
    schema: obj({ items: arr(obj({ risk: str(''), kind: en(['서비스 자체', '법·규정', 'CS', '경쟁', '평판', '기타'], ''), likelihood: int('1~5'), impact: int('1~5'), mitigation: str('대비책') }), '6~10개'), compliance: arr(obj({ rule: str('규정'), check: str('확인할 것'), status: en(['해당', '확인 필요', '해당 없음'], '') }), '') }) },
  { id: 'tools', stage: 'verify', name: '도구 추천', theory: ['tool_pick'], toolList: true, ask: '이 기획을 실행·검증할 때 쓸 6장 실무 도구를 4~6개 추천해 줘. 반드시 제공된 도구 목록의 id 중에서 고르고, 언제 · 어떤 데이터로 쓰는지 쓴다.',
    schema: obj({ recs: arr(obj({ tool_id: str('도구 id'), why: str('왜 이 도구'), when: str('언제'), data: str('필요한 데이터') }), '4~6개') }) },
  { id: 'results', stage: 'verify', name: '결과 판정', theory: ['m_ab_result', 'met_sig', 'met_causal'], manual: true, ask: '실험 결과와 판정을 보고 다음 행동을 제안해 줘: 채택한 것은 어떻게 키우고, 기각한 것은 무엇을 바꿔 다시 볼지.',
    schema: obj({ actions: arr(obj({ experiment: str(''), verdict: str(''), next: str('다음 행동') }), ''), summary: str('') }) },

  { id: 'redteam', stage: 'debate', name: '레드팀', theory: ['psy_words', 'mac_lead'], accept: true, ask: '네 명의 레드팀이 이 기획 전체를 깨 봐: 노아(직설적인 시니어 기획자), 결정권자(숫자·리스크를 보는 CFO), 회의적인 고객(실제로 돈 낼 사람), 경쟁사 PM(따라 하거나 막을 사람). 각자 가장 아픈 지적 2~3개, 심각도, 어느 단계를 고쳐야 하는지, 고칠 방향.',
    schema: obj({ critiques: arr(obj({ persona: en(['노아', '결정권자', '회의적인 고객', '경쟁사 PM'], ''), claim: str('지적'), why: str('왜 문제인가'), severity: int('1~5'), target_step: str('고칠 단계 이름'), suggestion: str('고칠 방향') }), '8~12개') }) },
  { id: 'revise', stage: 'debate', name: '수정 반영', theory: ['uturn'], ask: '받아들인 레드팀 지적을 반영한 수정안을 단계별로 써 줘. 무엇이 어떻게 바뀌는지(전 → 후)와 이유.',
    schema: obj({ changes: arr(obj({ step: str('단계'), before: str('전'), after: str('후'), reason: str('이유') }), ''), summary: str('토론으로 바뀐 점 한 문단') }) },
  { id: 'brief', stage: 'debate', name: '기획서', theory: ['m_brief', 'str_use'], ask: '지금까지 만든 내용(확정 · 초안)을 바탕으로 3W1H · 두괄식 전략 기획서를 써 줘. 하지 않은 단계의 내용은 개요와 있는 데이터로 추론해 채우고 "(추론)"을 붙인다. 기대 효과는 숫자로.',
    schema: obj({ slogan: str('메인 슬로건'), summary: str('세 줄 요약'), why: str('왜 — 문제와 목적'), who: str('누구에게'), what: str('무엇을'), how: str('어떻게 — 채널·가격·일정'), expected: arr(obj({ metric: str(''), target: str('') }), '3~4개'), so_what: str('한 줄 결론') }) },
  { id: 'press', stage: 'debate', name: '보도자료', theory: ['gtm_message'], ask: '아마존 Working Backwards 방식으로, 출시일에 고객이 읽을 보도자료 1장과 FAQ를 써 줘. 고객의 언어로.',
    schema: obj({ headline: str(''), subhead: str(''), body: str('3~4문단'), customer_quote: str(''), team_quote: str(''), faq: arr(obj({ q: str(''), a: str('') }), '4~6개') }) },
  { id: 'roadmap', stage: 'debate', name: '4주 로드맵', theory: ['spd_wbs', 'spd_expect'], ask: 'MVP와 실험을 4주 실행 로드맵으로 짜 줘. 주마다 목표와 할 일(담당, 끝났다는 기준).',
    schema: obj({ weeks: arr(obj({ week: int('1~4'), goal: str(''), tasks: arr(obj({ task: str(''), owner: str('역할'), done_when: str('끝났다는 기준') }), '') }), '4주') }) }
];
export const STEP = Object.fromEntries(STEPS.map(s => [s.id, s]));

const SYSTEM = `너는 시니어 서비스 기획자이자 그로스 전략가다. 사용자와 함께 아이디어를 실제 제품 기획으로 만든다.
원칙:
- 한국어로, 실무자가 바로 쓸 수 있게 구체적으로 쓴다. 형용사 대신 상황 · 숫자 · 행동.
- 숫자를 지어내지 않는다. 추정한 숫자는 "(가정)"을 붙이고 근거를 쓴다. 제공된 사례·벤치마크·규정을 인용하면 그 id나 출처를 괄호로 단다.
- 다른 단계에서 만든 내용(특히 사용자가 확정한 것)과 일관되게 쓴다. 바꿔야 한다면 바꾸는 이유를 쓴다.
- 사용자는 필요한 단계만 골라서 한다. 비어 있는 단계에 필요한 내용은 개요와 있는 데이터로 추론해 채우고, 그 부분에 "(추론)"을 붙인다.
- 제공된 학습 자료(이론 절)의 방법과 흔한 실수를 지킨다.
- 결과는 주어진 JSON 스키마로만 낸다.`;

/* ───── 맥락 만들기 ───── */
const tok = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1);
export function pickCases(cases, text, n = 5) {
  const q = new Set(tok(text)); if (!cases || !q.size) return [];
  return cases.map(c => { const hay = tok([c.title, c.domain, c.what && c.what.problem, c.solution, c.so_what, c.lesson].map(x => typeof x === 'string' ? x : JSON.stringify(x || '')).join(' ')); let s = 0; hay.forEach(w => { if (q.has(w)) s++; }); return [s, c]; }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, n)
    .map(([, c]) => ({ id: c.id, title: c.title, domain: c.domain, problem: c.what && c.what.problem, solution: typeof c.solution === 'string' ? c.solution : JSON.stringify(c.solution || '').slice(0, 300), so_what: typeof c.so_what === 'string' ? c.so_what : JSON.stringify(c.so_what || '').slice(0, 200) }));
}
export function pickRules(saju, text, n = 6) {
  if (!saju || !saju.rules) return []; const q = new Set(tok(text));
  return saju.rules.map(r => { let s = 0; tok(r.domain.join(' ') + ' ' + r.condition_text + ' ' + r.conclusion).forEach(w => { if (q.has(w)) s++; }); return [s, r]; }).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, r]) => ({ id: r.id, domain: r.domain, condition: r.condition_text, conclusion: r.conclusion, check: r.check && r.check.status }));
}
function theorySnippet(ids) {
  const all = {}; (window.CHAPTERS || []).forEach(ch => ch.T.forEach(t => all[t.id] = { ch: ch.no, t }));
  const meta = Object.fromEntries(((window.P && window.P.STEPS) || []).map(s => [s.id, s]));
  return ids.map(id => all[id]).filter(Boolean).map(({ ch, t }) => `[${ch}장 · ${t.t || (meta[t.id] && meta[t.id].t) || t.id}] ${t.def || ''}${t.how ? ' 하는 순서: ' + t.how.join(' / ') : ''}${t.pit ? ' 흔한 실수: ' + t.pit.join(' / ') : ''}`).join('\n');
}
export function buildContext(project, step, data) {
  const out = [];
  const b = project.brief;
  out.push(`[프로젝트]${b.text ? `\n사용자가 쓴 원문: ${b.text}` : ''}\n상황: ${b.situation}\n목표: ${b.goal}\n제약: ${b.constraints || '-'}\n타겟 짐작: ${b.target || '-'}\n사주 모드: ${b.saju ? '켜짐 — 기준 서비스는 AI 사주 웹사이트(커머스형, 웹툰형 스토리 1p → 마케팅 2p → 결제 → 전체 결과 공개, 최종 지표 = 결제)' : '꺼짐'}`);
  const have = STEPS.filter(s => s !== step && project.steps[s.id] && project.steps[s.id].out);
  if (have.length) out.push('[지금까지 만든 내용 — (확정)은 사용자가 검토해 확정, (초안)은 아직 검토 전]\n' + have.map(s => `## ${s.name} (${project.steps[s.id].done ? '확정' : '초안'})\n${JSON.stringify(project.steps[s.id].out)}`).join('\n'));
  const skipped = STEPS.slice(0, STEPS.indexOf(step)).filter(s => !(project.steps[s.id] && project.steps[s.id].out)).map(s => s.name);
  if (skipped.length) out.push(`[건너뛴 앞 단계] ${skipped.join(', ')} — 이 단계에 필요한 만큼만 개요와 있는 데이터로 추론하고 "(추론)"이라고 표시한다.`);
  if (project.selected && project.selected.length) out.push(`[프로덕트로 넘긴 아이디어] ${project.selected.join(', ')}`);
  if (project.picked) out.push(`[깊게 갈 아이디어] ${project.picked}`);
  if (step.id === 'revise' && project.accepted) out.push('[받아들인 레드팀 지적]\n' + JSON.stringify(project.accepted));
  if (step.id === 'results' && project.results) out.push('[실험 결과와 판정]\n' + JSON.stringify(project.results));
  const th = theorySnippet(step.theory || []); if (th) out.push('[학습 자료]\n' + th);
  const text = [b.text, b.situation, b.goal, b.target, b.domain].join(' ');
  if (step.cases || step.id === 'opportunity') { const cs = pickCases(data.cases, text, step.cases ? 6 : 3); if (cs.length) out.push('[비슷한 사례 (사례 DB)]\n' + JSON.stringify(cs)); }
  if (b.saju && data.context) {
    if (['three_c', 'compare', 'gtm', 'ideas'].includes(step.id)) out.push('[사주 경쟁사 (경쟁사 지도)]\n' + JSON.stringify(data.context.competitors));
    if (['gtm', 'unit', 'experiments'].includes(step.id)) out.push('[외부 벤치마크 — 참고선, 목표 아님]\n' + JSON.stringify(data.context.benchmarks));
    if (['risks', 'gtm', 'flow'].includes(step.id)) out.push('[규정 체크리스트 — 법률 자문 아님]\n' + JSON.stringify(data.context.compliance));
    if (['ideas', 'flow'].includes(step.id) && data.saju) { const rs = pickRules(data.saju, text); if (rs.length) out.push('[사주 해석 규칙 예시 (사주 DB, 콘텐츠 재료)]\n' + JSON.stringify(rs)); }
  }
  if (step.toolList && window.METHODS) out.push('[6장 실무 도구 목록 — id: 이름 · 한 줄]\n' + window.METHODS.ITEMS.map(m => `${m.id}: ${m.name} · ${m.short}`).join('\n') + (window.TOOLMAP ? '\n[문제 상황 → 도구 규칙]\n' + window.TOOLMAP.PICK.map(([q, ids]) => `${q} → ${ids.join(', ')}`).join('\n') : ''));
  return out.join('\n\n');
}

/* ───── 호출 ───── */
export async function check(apiKey) { await client(apiKey).models.retrieve(MODEL); return true; }
async function run(apiKey, user, schema, { onStatus, signal } = {}) {
  const stream = client(apiKey).beta.messages.stream({
    model: MODEL, max_tokens: 32000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
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
export async function runStep(apiKey, project, step, data, { instruction = '', onStatus, signal } = {}) {
  onStatus?.('자료를 모으는 중');
  const ctx = buildContext(project, step, data);
  const user = `${ctx}\n\n[이번 단계: ${step.name}]\n${step.ask}${instruction ? `\n\n[사용자 지시]\n${instruction}` : ''}`;
  return run(apiKey, user, step.schema, { onStatus, signal });
}

/* 줄글 → 프로젝트 개요. 쓰여 있지 않은 것은 지어내지 않고 짐작임을 표시한다. */
export const BRIEF_SCHEMA = obj({ title: str('프로젝트 이름 (15자 안팎)'), situation: str('상황 — 어떤 서비스·조직에서 무엇이 문제인지, 글에 있는 숫자 그대로'), goal: str('목표 — 언제까지 무엇을 얼마나. 글에 없으면 합리적으로 제안하고 끝에 "(제안)"'), constraints: str('제약 — 인원·예산·기간·못 바꾸는 것. 없으면 "언급 없음"'), target: str('타겟 — 글에서 읽히는 고객. 짐작이면 "(짐작)"'), domain: str('서비스 · 업종 한 줄'), unknowns: strs('다음 단계 전에 확인하면 좋은, 글에 빠진 정보 2~4개') });
export async function parseBrief(apiKey, text, saju, opts = {}) {
  opts.onStatus?.('글을 읽는 중');
  const user = `[사용자가 쓴 글]\n${text}\n\n[사주 모드] ${saju ? '켜짐 — 기준 서비스는 AI 사주 웹사이트(커머스형, 최종 지표 = 결제). 글이 다른 서비스를 말하면 글을 따른다' : '꺼짐'}\n\n[이번 단계: 개요 파악]\n이 글을 읽고 기획 프로젝트의 개요를 정리해 줘. 글에 있는 사실과 네 추론을 구분한다.`;
  return run(apiKey, user, BRIEF_SCHEMA, opts);
}
