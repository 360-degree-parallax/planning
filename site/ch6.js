/* 6장. 실무 도구 — 받은 강의 자료로 만든 방법 DB(window.METHODS · window.TRIGGERS)를 이론 형식으로 풀어 쓴다.
   본문은 methods.js에서 만든다(한 군데만 고치면 이론과 앞으로 만들 기획 툴이 같이 바뀐다).
   CALC은 각 도구를 계산 엔진(lab-core.js)으로 자동화할 때의 계산 방법 — 기획 툴이 도구를 추천·실행할 때 쓴다. */
(function(){
const M = window.METHODS; if (!M) return;
const {GROUPS, TRAITS, ITEMS} = M;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ul = a => a && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';

/* 문제 상황 → 도구 (기획 툴의 추천 규칙 초안) */
const PICK = [
  ['광고 소재·키워드가 너무 많아 무엇에 돈을 더 쓸지 모르겠다', ['conv_prob', 'offer', 'campaign_fw']],
  ['광고비를 얼마까지 써야 하는지 모르겠다', ['ad_activation', 'product_acc', 'media_mix']],
  ['프로모션을 했는데 효과가 있었는지 모르겠다', ['promo_test', 'ab_result']],
  ['클릭은 많은데 결제가 없다', ['offer', 'scroll', 'detail_page', 'landing']],
  ['페이지 중간에서 사람들이 빠진다', ['scroll', 'detail_page', 'funnel_link']],
  ['어떤 유입 경로가 진짜 매출을 만드는지 모르겠다', ['media_contrib', 'utm_builder']],
  ['같이 팔 상품·다음에 추천할 상품을 정하고 싶다', ['assoc', 'recommend', 'crm_target']],
  ['리뷰·문의가 많아 무슨 불만인지 모르겠다', ['topic', 'brand_study']],
  ['우리 고객이 누구인지, 몇 부류인지 모르겠다', ['client_map', 'funnel_link', 'conjoint']],
  ['실험 아이디어가 많아 무엇부터 할지 모르겠다', ['ice', 'ab_duration', 'ab_doc']],
  ['A/B 테스트 결과를 채택할지 모르겠다', ['ab_result', 'ab_concepts']],
  ['가격을 얼마로 정할지, 할인 여지가 있는지 모르겠다', ['pricing', 'product_acc', 'promotion']],
  ['예산을 매체별로 어떻게 나눌지 모르겠다', ['media_mix', 'forecast', 'campaign_fw']],
  ['이탈·휴면 고객을 다시 데려오고 싶다', ['crm_target', 'newsletter']],
  ['광고 소재·카피를 새로 써야 한다', ['meta_ad', 'triggers', 'shortform']],
  ['브랜드다움이 접점마다 제각각이다', ['brand_identity', 'brand_experience']],
  ['새 서비스를 어느 브랜드 아래서 낼지 고민이다', ['brand_relation']],
  ['기능은 좋은데 고객이 가치를 못 느낀다', ['value_story', 'detail_page']],
  ['슬로건·컨셉 후보 중 무엇이 나을지 모르겠다', ['concept_test', 'ab_result']],
  ['기획서를 써야 한다', ['brief', 'brand_study']]
];

/* 자동화할 때의 계산 방법 (lab-core.js 함수와 짝) */
const CALC = {
  conversionProbability: '베타-이항 모형. 전체 전환율을 사전 평균(가상 표본 10)으로 두고 항목별 사후 전환 확률 · 90% 구간 · "전체 평균을 넘을 확률"을 낸다. 넘을 확률 50% 이상이면 raise 가이드.',
  adActivation: '카플란-마이어 생존 곡선. 지출 금액을 시간, 첫 구매를 사건으로 본다. 곡선이 0.5 아래로 내려가는 지출(중앙값)이 적정 예산의 기준선.',
  promotionTest: '웰치 t검정으로 프로모션 전/후 평균을 비교(p < 0.05면 연구가설 채택). 프로모션 여러 개는 일원 분산분석(F검정)으로 순위.',
  mediaContribution: '소스 표기 정리 → 전환 가치 점유율 → 누적 파레토로 A(핵심 80%) · B · C 등급.',
  associationRules: '아프리오리 2개 조합. 지지도 · 신뢰도 · 향상도(우연 대비 배수) — 향상도 1.2 초과면 묶음·추천 후보.',
  scrollRetention: '깊이별 사용자 ÷ 첫 깊이 사용자 = 페이지 생존율. 직전 대비 감소폭이 평균보다 큰 구간을 "유출"로 표시, 표본 적은 페이지는 제외.',
  topicKeywords: '라벨(주제)별로 그 주제에서만 유난히 많이 나오는 단어를 로그 오즈로 뽑는다.',
  conjoint: '속성 수준을 더미 변수로 회귀 → 부분가치, 속성별 부분가치 범위 비중 = 속성 중요도.',
  clientMap: '시간 · 매체 · 성별 · 연령 · 지역 조합별 수익 점유율과 1인당 수익으로 세그먼트를 서열화.',
  offerAcceptance: '4분면: 높은 전환(전환 ≥ 1, 방문자 ≥ 최소 표본) × 높은 유입(클릭률 > 평균) → 운용 확대 / 광고 개선 / 웹사이트 개선 / 종료.',
  recommend: '협업 필터링. 매체 × 콘텐츠 행렬에서 콘텐츠 간 코사인 유사도로 예측(최대 1) + 전체 인기도(최대 1) = 추천 점수(최대 2).',
  ice: 'Impact × Confidence × Ease (변형: (I × C) ÷ E, I + C + E)로 정렬.',
  abTest: '2×2 카이제곱(> 3.84면 신뢰수준 95%) AND 상승률 > MDE → 채택.',
  abDuration: '변형당 표본 = 16 × p(1−p) ÷ (p × MDE)², 기간 = 표본 × 변형 수 ÷ (하루 사용자 × 할당 비율).',
  conceptSurvey: '브랜드 · 목표 · 경쟁 브랜드 · 컨셉 안을 넣으면 01 태도 · 02 컨셉별 의견 · 03 최종 선호 문항을 만든다.',
  pricing: '할인율 = (1 − 상시판매가 ÷ 정상가) × 100, 원가율 = 원가 ÷ 가격 × 100, 정상가 = 원가의 2.5~5배, 9로 끝나게.',
  productAccounting: '이익 = 판매가 − (매입가 + 수수료 + 배송비), 마케팅비 = 이익 × 12%, 최소 ROAS = 판매가 ÷ 이익, 추천 입찰 CPC = 이익 × 추정 전환율.',
  budgetSplit: '목표 매출 × 광고비 비율 → 월(÷12) · 주(÷4) · 일(÷31) → 매체별 비중.',
  forecast: '선형 회귀(엑셀 FORECAST) ± 추정 표준오차(STEYX) = 최소 · 예측 · 최대.',
  kmeans: '특징을 표준화한 뒤 K-means(유클리드 거리)로 군집화, 군집마다 평균 대비 가장 다른 두 특징을 이름으로.',
  utm: '캠페인 = 캠페인 유형_메인 타겟, 콘텐츠 = 소재_버전으로 UTM 매개변수를 만든다.',
  pslp: 'Problem → Solution → Logic → Promotion을 0~3 · 3~8 · 8~12 · 12~15초 대본으로 배치.',
  detailPage: '서론(후기 · 숫자 · 타겟) → 본론(USP · 활용 · 상세) → 결론(프로모션) 순서로 블록 배치.',
  shortform: '20초 이내 · 캡션 300~500자 · 타겟 지칭 · 문단 나누기 점검, 치트키로 타이틀 후보 생성.',
  engagement: '(좋아요 + 댓글 + 저장 + 공유) ÷ 팔로워 × 100, 5% 이상이면 GOOD.',
  triggers: '144개 트리거를 분류 · 검색으로 고르고 예시 카피의 OOO에 상품명을 넣는다.'
};
const LINKS = {
  analysis: [['key_metrics', '1장: 중요 지표 선별'], ['info_primary', '2장: 1차 정보']],
  experiment: [['gtm_launch', '5장: 출시와 실험 규칙'], ['mic_smart', '3장: SMART']],
  brand: [['gtm_position', '5장: 포지셔닝'], ['psy_mistake', '3장: 스펙이 아니라 장면']],
  strategy: [['gtm_pricing', '5장: 가격'], ['gtm_unit', '5장: 단위 경제']],
  content: [['gtm_message', '5장: 메시지'], ['psy_mistake', '3장: 고객의 언어']]
};
const TRY = {
  analysis: '지금 가진 데이터(광고 · 결제 · 페이지) 하나를 골라 이 도구의 독립변수 · 종속변수를 정하고, 결론 한 줄("아! …")을 미리 가설로 써 보자.',
  experiment: '사주 서비스의 실험 후보 하나를 이 도구로 정리하고, 채택 기준(MDE · 기간)을 숫자로 써 보자.',
  brand: '우리 사주 서비스의 접점 하나를 골라 이 도구의 표를 한 줄 채워 보자.',
  strategy: '우리 상품 하나(재회운 9,900원 등)로 이 도구의 표를 채우고, 숫자로 결론 한 줄을 써 보자.',
  content: '이번 주에 낼 콘텐츠 하나를 이 공식대로 다시 써 보자.'
};
const name = id => (ITEMS.find(i => i.id === id) || {}).name || id;

const PARTS = [{p: '서론', d: '', steps: ['서론']}, {p: '도구 고르기', d: '문제 상황에서 맞는 도구 찾기', steps: ['도구 고르기 · 1. 도구 고르기']}];
GROUPS.forEach((g, i) => PARTS.push({p: g.name, d: g.desc, steps: [`${g.name} · ${i + 2}. ${g.name}`]}));
const gOf = g => `${g.name} · ${GROUPS.indexOf(g) + 2}. ${g.name}`;

const T = [
  {g: '서론', id: 'tool_intro', t: '실무 도구 — 생각한 것을 숫자와 표로 옮기는 법', ask: '1~5장으로 무엇을 할지 정했다. 그럼 내일 아침 엑셀을 열면 무엇부터 해야 하나?',
   def: `이론이 "무엇을 왜"라면, 실무 도구는 "그래서 어떻게 확인하고 운영하나"다. 이 장은 받은 강의 자료(그로스 데이터 분석, A/B 테스트, 브랜딩, 마케팅 전략, 콘텐츠 기획)를 ${GROUPS.length}개 묶음 ${ITEMS.length}개 도구로 정리한다. 도구마다 왜 만들었고 · 무엇으로 · 어떻게 쓰는지, 실제 사례, 판단 규칙, 자동화할 때의 계산 방법, 사주 서비스에 대입하는 법을 적었다.`,
   when: '기획한 것을 실행하고 검증할 때. 그리고 "이 상황엔 뭘 써야 하지?" 싶을 때 — 바로 다음 절의 도구 고르기 표부터 본다.',
   how: ['문제 상황을 한 줄로 쓴다(예: 클릭은 많은데 결제가 없다).', '도구 고르기 표에서 맞는 도구 2~3개를 찾는다.', '도구의 판단 규칙과 계산 방법으로 데이터를 정리한다.', '결론을 "아! …" 한 줄과 다음 행동으로 쓴다.'],
   exTitle: '한눈에: 다섯 묶음',
   ex: `<table class="t"><tr><th>묶음</th><th>도구 수</th><th>하는 일</th><th>출처</th></tr>${GROUPS.map(g => `<tr><td><b>${esc(g.name)}</b></td><td>${ITEMS.filter(i => i.g === g.id).length}</td><td>${esc(g.desc)}</td><td>${esc(g.source)}</td></tr>`).join('')}</table>`,
   more: `<h3>앞으로 — 기획 툴과의 관계</h3><p>이 장의 도구들은 이후 따로 만들 기획 툴의 재료가 된다. 기획 툴은 상황을 받아 아래 "도구 고르기" 규칙과 각 도구의 계산 방법으로 어울리는 도구를 추론해 알려 주고, 데이터를 넣으면 계산까지 한다. 그래서 이 장은 사람이 읽는 설명이면서, 도구를 고르는 규칙의 원본이다.</p><h3>읽는 법</h3><p>강의 자료에 있는 것은 자료 그대로(왜 · 무엇으로 · 어떻게 · 사례 · 특징 · 판단 규칙), 해석이나 보충은 "(해석)"으로 표시했다. 사례의 숫자는 강의 실습 자료의 것이고, 사주 적용은 예시다.</p>`,
   links: [['gtm_intro', '5장: GTM의 여섯 질문'], ['str_use', '4장: 구조가 기획서가 된다']],
   try: '지금 가장 막힌 문제를 한 줄로 쓰고, 다음 절 표에서 도구 두 개를 골라 보자.'},
  {g: '도구 고르기 · 1. 도구 고르기', id: 'tool_pick', t: '문제 상황 → 도구', ask: '"결제가 안 나온다"는 같은 고민인데, 광고 문제일까, 페이지 문제일까, 가격 문제일까?',
   def: '도구는 문제 상황에서 고른다. 같은 증상도 원인에 따라 다른 도구가 맞다 — 그래서 한 상황에 도구를 2~3개씩 짝지었다. 첫 도구로 원인을 좁히고, 다음 도구로 고친다.',
   how: ['증상을 1장 5 Why로 한두 번 더 파고든다.', '아래 표에서 가장 가까운 상황을 찾는다.', '첫 번째 도구로 원인이 어디인지(광고 · 페이지 · 가격 · 고객) 좁힌다.', '좁힌 곳에 맞는 다음 도구로 고친다.'],
   exTitle: '문제 상황별 도구 (기획 툴 추천 규칙 초안)',
   ex: `<table class="t"><tr><th>문제 상황</th><th>도구</th></tr>${PICK.map(([q, ids]) => `<tr><td>${esc(q)}</td><td>${ids.map(id => `<a href="${window.P && window.P.href ? window.P.href('ch6', 'm_' + id) : '#m_' + id}">${esc(name(id))}</a>`).join(' → ')}</td></tr>`).join('')}</table>`,
   more: `<h3>변수 특성 — 분석 전에 걸러 낼 것 (정의는 해석)</h3><table class="t">${TRAITS.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</table><p>강의 자료에는 이름(능동/반수동/수동/함정)만 나온다. 데이터 분석 도구의 06단계 "변수의 특성을 고려하여 분석에 적용"할 때 쓴다.</p>`,
   links: [['five_why', '1장: 5 Why'], ['issue_tree', '1장: 이슈트리']],
   try: '최근 막혔던 일 하나를 표의 상황 중 하나에 대입하고, 첫 도구로 무엇을 확인할지 적어 보자.'}
];

ITEMS.forEach(m => {
  const g = GROUPS.find(x => x.id === m.g);
  const def = [m.why ? `왜 만들었나 — ${m.why.join(' / ')}.` : '', m.what ? `무엇으로 — ${m.what.join(' · ')}.` : ''].filter(Boolean).join(' ') || (m.points ? m.points[0].join(': ') : m.short);
  let ex = '', exTitle = '';
  if (m.caseSteps) { exTitle = '우수 활용 사례'; ex = `<table class="t"><tr><td>02 확인할 것</td><td>${esc(m.caseSteps.problem)}</td></tr><tr><td>03 독립변수</td><td>${esc(m.caseSteps.iv)}</td></tr><tr><td>04 종속변수</td><td>${esc(m.caseSteps.dv)}</td></tr><tr class="hi"><td>09 결론</td><td>${esc(m.caseSteps.insight)}</td></tr></table>`; }
  else if (m.points) { exTitle = '핵심'; ex = `<table class="t">${m.points.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</table>`; }
  let more = '';
  if (m.caseSteps && m.points) more += `<h3>핵심</h3><table class="t">${m.points.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</table>`;
  if (m.features) more += `<h3>특징 분석</h3>${ul(m.features)}`;
  if (m.apply) more += `<h3>특징 적용</h3>${ul(m.apply)}`;
  if (m.rules) more += `<h3>판단 규칙</h3>${ul(m.rules)}`;
  if (m.template) more += `<h3>작업 표</h3><table class="t"><tr>${m.template.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${m.template.rows.slice(0, 3).map(r => `<tr>${m.template.cols.map((c, j) => `<td>${esc(r[j] || '')}</td>`).join('')}</tr>`).join('')}</table>`;
  if (m.id === 'triggers' && window.TRIGGERS) { const T2 = window.TRIGGERS; const cats = [...new Set(T2.map(t => t[1]))]; more += `<h3>트리거 ${T2.length}개 — 중분류별 예시</h3><table class="t"><tr><th>분류</th><th>트리거</th><th>예시 카피</th></tr>${cats.map(c => { const x = T2.find(t => t[1] === c); return `<tr><td>${esc(c)}</td><td>${esc(x[2])} — ${esc(x[3])}</td><td>${esc(x[4])}</td></tr>`; }).join('')}</table>`; }
  if (m.tool && CALC[m.tool.fn]) more += `<h3>자동화할 때의 계산</h3><p>${esc(CALC[m.tool.fn])}</p>`;
  if (m.note) more += `<p class="muted">${esc(m.note)}</p>`;
  if (m.saju) more += `<h3>사주 서비스에서</h3><p>${esc(m.saju)}</p>`;
  T.push({g: gOf(g), id: 'm_' + m.id, t: m.name, ask: m.short + (/[?？]$/.test(m.short) ? '' : '?'), def,
    when: m.caseSteps ? m.caseSteps.problem + '을(를) 할 때.' : undefined, how: m.how, exTitle, ex: ex || undefined, more,
    links: LINKS[m.g], try: TRY[m.g]});
});

window.CHAPTERS = window.CHAPTERS || [];
window.CHAPTERS.push({view: 'ch6', no: 6, title: '실무 도구 — 생각을 숫자와 표로 옮기기', desc: `데이터 분석 · 실험 · 브랜딩 · 마케팅 전략 · 콘텐츠, ${ITEMS.length}개 도구를 왜 · 무엇으로 · 어떻게 · 사례 · 판단 규칙 · 계산 방법 · 사주 적용으로 풀어요. 문제 상황에서 도구를 고르는 표가 앞에 있어요.`, PARTS, T});
window.TOOLMAP = {PICK, CALC};
})();
