# 사례 DB 스키마 v4

> 목표: **본질 파악**. 모든 필드는 현상 아래의 진짜 문제와 그것이 풀린 이유를 드러내기 위해 있다. 이 저장소는 사례만 모으고 제품 기획은 따로 한다.

목표: 사례를 **결제 지표**와 연결해, "우리 서비스의 이 지표가 문제일 때 어떤 가설이 통했고, 왜 그동안 아무도 안 했는가"를 찾고 추론할 수 있게 한다.

기준 서비스: **AI 사주 웹사이트 · 커머스형(1회 구매로 전체 결과 공개) · 최종 지표 = 결제**

구매 전 화면은 두 장이다: 웹툰형 **스토리 후킹 1p** → **마케팅 후킹 2p** → 결제 페이지. 회차 연재·구독이 아니다.

## 1. 결제 지표 트리

```
결제 매출 (revenue) = 신규 매출 + 재구매 매출
├─ 구매자 수 (buyers)
│   방문자 visitors
│   × 스토리 후킹률 story_hook_rate      ← 1p(웹툰형 스토리) → 2p 이동
│   × 마케팅 후킹률 marketing_hook_rate  ← 2p(마케팅) → 결제 페이지 이동
│   × 결제 완료율 checkout_conv          ← 결제 페이지 → 구매 완료
│   (= 구매 전환율 first_pay_conv)
├─ 객단가 (aov)
│   가격 수준 price_level · 교차·상향 구매 upsell_rate
└─ 재구매 (repeat_revenue)
    재구매율 repeat_pay_rate · 리텐션 d30_retention · 휴면 복귀 reactivation · LTV ltv

가드레일: 환불률 refund_rate · 평점·신뢰 rating · 결과 열람률 consumption_rate
        · 건당 원가 unit_cost(LLM 비용) · 매출총이익률 gross_margin · CAC
```

구독형 사례(넷플릭스·스포티파이 등)의 `sub_conv`는 참고용으로만 남겨 두고, 사주 적용(`saju.idea`)은 모두 단건 구매 기준으로 다시 썼다.

## 2. 사주 퍼널 단계 (`saju.stage`)

| id | 단계 | 사주 서비스에서 |
|---|---|---|
| acquire | 유입 | 검색·SNS·광고·추천으로 들어온다 |
| hook_story | 스토리 후킹 (1p) | 웹툰형 스토리로 '내 이야기'라고 느끼게 한다 |
| hook_marketing | 마케팅 후킹 (2p) | 무엇을 알려 주는지·가격·후기·포함 내용으로 설득한다 |
| checkout | 결제 페이지 | 가격 표시·결제 수단·환불 보장·미리보기 |
| first_pay | 구매 완료 | 결제 직후 전체 결과가 열린다 |
| consume | 결과 열람·만족 | 생성 대기·열람·만족 (환불 방지) |
| repeat_pay | 재구매 | 신년운·다른 주제·연간 상품 |
| expand | 교차·상향 구매 | 궁합·상위 등급·추가 질문 |
| refer | 추천·공유 | 공유 카드·궁합 초대 |
| trust | 신뢰·품질 | 환불·정확도 의심 줄이기 |
| economics | 원가·수익성 | 리포트 1건당 LLM 비용·마진 |
| none | 직접 적용 어려움 | 운영·제조 등 |

## 3. 사례 필드

| 필드 | 내용 | 채움 |
|---|---|---|
| `id` `title` `domain` `kind` `source` | 기본 정보 · kind: real / failure / practice | 전체 |
| `refs` `verified` | 출처 링크 · 링크가 있으면 verified | 일부 |
| `depth` | `deep`(핵심) / `tagged`(분류) | 전체 |
| `business` | `model` `stage` `market` `region` (taxonomy id) | 전체 |
| `problem_metric` | 문제가 된 지표 id + 설명 | 전체 |
| `outcomes[]` | 해결 뒤 지표 변화: `metric` `before` `after` `context` `evidence`(URL) | deep 중 근거 있는 것만 |
| `saju` | `stage`(퍼널 단계) + `idea`(사주 서비스 적용 아이디어) | stage 전체, idea는 deep |
| `what` | `situation` `symptom`(현상) `problem`(다시 정의한 문제) | 전체 |
| `hyps[]` | 아래 참고 | 전체 |
| `solution` `lesson` | 해결 · 배울 점 | 전체 |

### 가설 (`hyps[]`)

| 필드 | 내용 |
|---|---|
| `text` `perspective` | 가설 · 관점(고객·시점·가격·채널·경쟁·제약·통념) |
| `why_not_yet` `verdict` `reason` | 왜 아직 안 했나 · 판정 · 판정 이유 |
| `barrier.type` | 장벽 유형 (아래) |
| `barrier.holder` | 장벽을 가진 주체 (예: 기존 대여점, 금융 규제 당국, 고객 습관) |
| `barrier.changed` `barrier.year` | 무엇이 장벽을 바꿨나 · 언제 |
| `barrier.evidence` | 근거 URL |
| `barrier.inferred` | true면 규칙으로 추정한 값 (사람이 검토 전) |
| `test.experiment` `test.metric` | 이 가설을 가장 싸게 확인할 실험 · 볼 지표 id (deep만) |
| `test.ice` | 영향·확신·쉬움(1~10)과 평균 점수 (`db/meta/ice.txt`) |
| `test.target` | 채택 기준: `+10%`(상대), `+3%p`(절대), `-20%`(감소). 표본 수 계산에 쓴다 |
| `test.guardrail` | 이 지표가 나빠지면 결과가 좋아도 기각 |

`saju.also`: 보조 퍼널 단계 (`db/meta/also.txt`). 진단 리포트가 주 단계와 함께 검색한다.

`saju.segments`: 이 사례를 먼저 적용할 방문자 세그먼트 (`{축: [값]}`, 빈 객체는 전체 방문자).
- deep 50개는 `db/meta/segments.txt`에 직접 썼다 (`segments_inferred: false`).
- tagged는 규칙으로 추정했다 (`segments_inferred: true`): 퍼널 단계로 방문자 유형(구매 전 단계 → new, 구매 후 단계 → buyer), 본문 키워드로 채널(추천·SNS·검색)·기기(모바일)·나이대(10대·20대·50대 이상).
- 진단 리포트는 전체보다 약한 세그먼트에 대해, 그 세그먼트로 태깅된 핵심 사례를 추천한다.

`outcome_note`: 결과 수치를 넣지 않은 이유 (`db/meta/no-outcome.txt`). 강의용 예시·방법론·가상 사례처럼 측정된 수치가 원래 없는 경우, 또는 1차 출처를 찾지 못한 경우를 구분해 적는다.

### So what 체인 (`so_what`, `db/meta/sowhat.txt`)

모든 사례에 하나씩 있다. 핵심 가설의 Why not yet에서 출발해 "그래서?"를 2~3번 거듭 물어 그 사례가 실제로 한 해결까지 잇는다.

- 형식: `id 가설번호 | 그래서 1 > 그래서 2 > (그래서 3) || 해결`
- 필드: `hyp`(출발 가설 번호), `why_not_yet`(그 가설의 이유를 복사), `steps`(2단계 이상), `solution`(사례가 실제로 한 것)
- 검사기는 체인이 없거나 단계가 2개 미만이면 오류로 본다.
- `mode`: 출발 가설이 통념의 맹점이면 `break`(관습 파괴), 타이밍이면 `shift`(조건 변화)
- 생성 문서: `docs/so-what.md`

### 긍정·안티 오피니언 (`pro_opinion`, `anti_opinion`, deep 사례 필수)

- 원본: `db/meta/pro.txt`, `db/meta/anti.txt`
- 형식: `id | 누가 | 무엇을 말하나(요지) | 드러난 본질 | 출처 URL 또는 추정`
- `inferred: true`(추정)는 사례 내용에서 도출한 해석이고 실제 발언 기록이 아니다. 실제 목소리를 찾으면 URL로 바꾼다.

### 트레이드온 (`trade_on`, 모든 사례 필수)

- 원본: `db/meta/tradeon.txt`
- 형식: `id | A 대 B | 둘 다 잡은 방법` (업계가 둘 중 하나라고 여긴 것을 그 사례가 어떻게 둘 다 잡았나. 실패 사례는 왜 못 잡았나)

### 구조화 단계 (deep 사례 필수)

- **목표 재분석** (`goal`, `db/meta/goal.txt`): `id | 표면 목표 | 재정의한 목표 | 지표`
- **이슈트리** (`issue_tree`, `db/meta/issuetree.txt`): `id | 루트 질문 | 가지: 하위, 하위 ; *가지: 하위, 하위 ; 가지: 하위, 하위 || 고른 이유`. 가지 2개 이상, 가지마다 하위 이슈 필수, 공략한 가지(`*`)는 정확히 1개.
- **파레토 요약** (`pareto`, `db/meta/pareto.txt`): `id | 핵심 소수 | 그것이 만드는 결과 | 근거 URL 또는 추정`. 실제 비율이 확인된 것만 URL을 단다.
- **속도×임팩트 선별** (`pareto.matrix`, `db/meta/speed-impact.txt`): `id | 속도/임팩트 칸들(가지는 ' ; ', 하위 이슈는 공백, 고른 것은 *) || 선별 이유`. 이슈트리 순서와 같아야 한다. 사분면은 자동 계산(퀵윈·큰 베팅·잡일·보류), 임팩트 4 미만은 고를 수 없다.
- **중요 지표 선별** (`key_metrics`, `db/meta/key-metrics.txt`): `id | 선행 지표(1~3, 쉼표) | 가드레일 | 허영 지표`. 북극성은 `goal.metric`을 그대로 쓴다.

### 장벽 유형 (`barrier.type`)

| 판정 | 장벽 유형 |
|---|---|
| 뻔함 (탈락) | `competition` 이미 경쟁 중 · `not_core` 본질 아님 |
| 불가능 (탈락) | `cost` 비용·자본 · `regulation` 규제 · `technology` 기술 한계 · `structural` 구조적 조건 · `social` 사회적 수용 |
| 통념의 맹점 (생존) | `belief` 통념 · `incentive` 기존 강자 이해관계 · `definition` 문제·고객 정의 |
| 타이밍 (생존) | `tech_change` 기술 변화 · `regulation_change` 규제 변화 · `behavior_change` 행동 변화 · `market_change` 시장 변화 · `shock` 외부 충격 |

## 4. 깊이 기준

- **deep (50개)**: Why not yet을 2~3문장으로 쓰고, 장벽 주체·바뀐 계기·연도·근거 URL, 검증 실험과 지표, 결과 지표(근거가 확인된 수치만), 사주 적용 아이디어를 채운다.
- **tagged (나머지)**: 모델·단계·시장·지역·문제 지표·퍼널 단계는 사람이 태깅한다. 장벽 유형은 규칙 추정(`inferred: true`)이고 주체·연도·근거는 비어 있다.

## 5. 이렇게 쓴다

- "구매 전환율이 낮다" → `problem_metric.id = first_pay_conv` 또는 `saju.stage = checkout/first_pay`인 사례를 모아, 살아남은 가설의 `barrier.type` 분포를 본다.
- "우리 아이디어가 뻔한가?" → 비슷한 가설이 `competition`·`not_core`로 탈락한 사례가 있는지 본다.
- "왜 지금 가능한가?" → `tech_change`(예: LLM 원가 하락)로 살아남은 사례의 `barrier.changed`·`year`를 본다.

## 6. 퍼널 순서 설정 (`db/funnels/*.json`)

단계 정의(`funnel_stages`)는 부품이고, 순서는 퍼널 설정이 정한다. 사례·실험은 단계 id에 연결되므로 순서를 바꿔도 연결이 유지된다.

- `steps[]`: `id`(도달 이벤트) · `label` · `stage`(taxonomy 단계 id) · `metric`(이 단계 → 다음 단계 통과율 지표) · `purchase: true`(결제 성공 단계, 하나)
- 통과율은 항상 **다음 단계 도달 / 이 단계 도달**로 계산한다. 그래서 순서를 바꾸면 같은 지표 id가 새 순서의 통과율을 가리킨다.
- 순서를 바꾸면 `version`을 올린다. 실험 기록이 퍼널 버전을 남기므로, 버전이 다른 실험은 리포트에서 "직접 비교 주의"로 표시된다.
- 예시: `saju-default`(1p → 입력 → 2p → 결제), `saju-input-first`(입력 → 1p → 2p → 결제)

## 7. 우리 서비스 수치 (`db/service`)

| 파일 | 내용 |
|---|---|
| `baseline.json` | 기간, 퍼널 id·버전, **단계별 도달 수**(`reach`), 세그먼트별 도달 수, 수익 구조 입력값, 구매 후 지표 |
| `experiments.json` | 실험 기록: 사례·가설 번호, 지표, 퍼널 버전, 군별 표본·전환, 가드레일, 결과(running·win·lose·flat·stopped) |
| `*.example.json` | 가짜 숫자 예시 (리포트 형태 확인용) |

전환율이 아니라 도달 수를 저장한다. 순서를 바꾸거나 단계를 추가해도 도달 수만 있으면 통과율을 다시 계산할 수 있기 때문이다.

세그먼트 축(`taxonomy.segments`): 유입 채널 · 고민 주제 · 기기 · 시간대 · 방문자 유형 · 나이대 · 성별.

### 진단 리포트 (`python3 tools/diagnose.py`)

1. 퍼널: 설정 순서대로 도달·통과율·이탈, 출처 있는 참고 기준값
2. 병목 순위: 이 단계 이탈의 절반을 되살리면 늘어나는 구매자·매출
3. 병목 단계별 추천 실험: 그 단계 통과를 직접 재는 실험 먼저, ICE 순. 군당 표본 수(유의수준 5%, 검정력 80%)와 예상 기간
4. 세그먼트: 전체보다 통과율이 20% 이상 낮은 칸 표시
5. 수익 구조: 주문 1건 공헌이익 = 객단가 × (1 − PG 수수료율 − 환불률) − LLM 원가 − 구매자 1명당 CAC, ROAS, 무료 구간 원가, 할인 의존도
6. 재구매 선행 지표: 만족도·'맞았다' 체감·7일 재방문·후속 질문 사용·공유. 매달 기록해 재구매율과 함께 움직이는 지표를 찾는다
7. 실험 기록: 상대 변화, p값, 가드레일 통과 여부, 퍼널 버전 일치 여부

## 8. 참고 기준값 (`db/benchmarks.json`)

출처가 확인된 외부 수치만 둔다(장바구니 이탈률, 온라인 카드 승인률, 랜딩 전환율 중앙값 등). 업종·정의가 우리 퍼널과 같지 않으므로 목표값이 아니라 참고선으로만 쓴다.

## 9. 방법론 순서 (WHAT 단계)

```
사례 → ① 적합성(Fit) 검증 → 우리 가설 → ② Why not yet → ③ 실험 → 실험 기록 → 적합성 조건 갱신
```

| 단계 | 묻는 것 | 거르는 것 | 파일 |
|---|---|---|---|
| ① 적합성 | 원 사례가 통한 **이유(인과 고리)와 그 이유가 작동한 조건**이 우리에게도 있나? | 겉모습만 닮은 유추 | `db/saju/fit.txt` |
| ② Why not yet | 좋은 아이디어라면 **경쟁 사주 서비스는 왜 아직 안 했나?** | 뻔한(이미 흔한) 아이디어, 불가능한 아이디어 | `db/saju/ideas.txt` |
| ③ 실험 | 실제로 움직이나? | 우리 고객에게 안 통하는 아이디어 | `db/meta/ice.txt`, `db/service/experiments.json` |

이론 근거: 적합성은 겐트너의 구조 사상 이론(좋은 유추는 겉모습이 아니라 원인·결과 구조가 닮은 것)과 카트라이트·하디의 지원 조건(거기서 통한 원인이 여기서도 통하려면 그 원인을 작동시킨 조건이 여기에도 있어야 한다)을 따른다.

### 적합성 (`saju.fit`)
| 필드 | 내용 |
|---|---|
| `problem_match` | 문제 구조: `same` 같음 · `similar` 비슷함 · `different` 다름 |
| `mechanism` | 원 사례가 통한 이유 한 줄 |
| `support_factors[]` | 그 이유가 작동하는 데 필요한 조건과 우리에게 있는지: `yes` · `no` · `unknown`(실험에서 먼저 확인) |
| `key_difference` | 업종·상품·상황의 결정적 차이 (구매 빈도·가격대·관여도·신뢰 구조·규정) |
| `verdict` | `transfer` 그대로 옮김 · `adapt` 바꿔서 옮김 · `reject` 버림 |

검사 규칙: 없는 조건(`no`)이 있으면 `transfer` 불가, 문제 구조가 `different`이면 `transfer` 불가, `reject`면 아이디어 역할은 `skip`.

### 우리 아이디어의 Why not yet (`saju.wny`)
| 필드 | 내용 |
|---|---|
| `verdict` · `barrier` | 판정(뻔함·불가능·맹점·타이밍)과 장벽 유형 (사례 가설과 같은 규칙) |
| `role` | `table` 기본기(이미 흔함, 안 하면 손해, 차별은 아님) · `diff` 차별 후보 · `risk` 규정·신뢰 위험 · `skip` 보류 |
| `competitors[]` | 근거가 된 경쟁사 id (`db/saju/competitors.json`) |
| `compliance[]` | 실험 전에 확인할 규정 id (`db/compliance.json`) |

## 10. 참고 데이터

| 파일 | 내용 | 문서 |
|---|---|---|
| `db/saju/competitors.json` | 국내 운세·사주 경쟁사 기능 지도 (확인된 것만 ✓, 모르면 빈칸) | `docs/competitors.md` |
| `db/compliance.json` | 다크패턴 6유형·거짓 할인·후기·디지털 콘텐츠 청약철회·미성년자 취소·생년월일 정보 | `docs/compliance.md` |
| `db/service/events.json` | 트래킹 플랜: 단계별 이벤트, 보내는 조건, 중복 처리, 속성 | `docs/tracking-plan.md` |
| `db/service/products.json` | 상품 목록 (가격·장 수·원가) | |
| `db/service/creatives.json` | 1p·2p·광고·결제 소재 목록 (실험이 id로 참조) | |
| `db/service/history/*.json` | 월별 baseline (추세·선행 지표 상관) | |
| `db/service/cohorts.json` | 첫 구매 월별 재구매 코호트 | |
| `db/service/calendar.json` | 사주 수요 시즌 (실험·기간 겹침 표시) | |
| `docs/experiment-rules.md` | 실험 운영 규칙 (SRM, 최소 7일, 중간 확인 금지, 본페로니, 방문자당 매출) | |

## 11. 데이터 품질 필드

| 필드 | 내용 |
|---|---|
| `domain_group` | 분야 그룹 (`db/meta/domains.txt`, 14개). 원래 `domain`은 그대로 둔다 |
| `source_status` | `verified` 출처 링크 있음 · `unverified` 없음 · `disputed` 널리 퍼졌지만 사실 여부 논란 (`db/meta/disputed.txt`, 이유 필수) |
| `saju.idea_level` | `draft`: 분류 사례의 사주 적용 초안 (적합성·Why not yet 검증 전) |
| `barrier.reviewed` | 규칙 추정 장벽을 사람이 검토함 (`db/meta/barrier-review.txt`) |
| 가설 관점 | 핵심 사례는 관점 3개 이상 필수 (검사기) |
| id | 한 번 정하면 바꾸지 않는다. 바꾸면 `db/meta/aliases.txt`에 옛 id를 남긴다. 공식 구조는 `schema/cases.schema.json` |

## 12. 질문권 Q&A (질문 1회 → 답변 1회)
리포트를 산 뒤 궁금한 점을 한 번 묻고 한 번 답을 받는 추가 상품. 질문권은 1·5·10회 묶음으로 판다(`db/service/products.json`의 `qa-*`).

- 단계: `ask` (`db/taxonomy.json` funnel_stages). AI 채팅·Q&A 업계 사례(캐릭터 채팅·서브컬처 포함)는 대부분 이 단계에 연결된다. 규정 probability-event: 질문권·운세 이벤트에 유료 확률형(뽑기) 장치를 넣지 않는다.
- 퍼널: `db/funnels/saju-qa.json` — 결과 화면 → 질문 입력창 → 질문 제출(질문권 없음 → 결제 화면) → 질문권 결제 → 답변 열람 → 24시간 내 다음 질문.
- 지표 (`group: qa`): question_entry_rate · question_submit_rate · ticket_purchase_rate · free_question_use_rate · free_to_paid_question_rate · questions_per_buyer · pack_mix · ticket_breakage · answer_read_rate · answer_satisfaction · next_question_rate · answer_refund_rate · sensitive_question_share, 원가는 cost_per_answer.
- 이벤트: result_view · q_open · q_submit · ticket_paid · answer_read · next_question · answer_feedback (`db/service/events.json`).
- 규정: ai-answer-liability(챗봇 답변도 회사의 약속) · ai-disclosure(AI 기본법 생성물 표시, 2026-01-22 시행) · minor-ai-usage(미성년자 한도) · sensitive-advice(건강·법률·투자·위기 질문).
- 새 사례를 처음부터 깊게 쓸 때는 `# 머리줄` 아래에 `D: deep` 한 줄을 넣는다.

## 13. 질문권 단위 경제 (`tools/unit_econ.py`)
- 입력: `db/service/unit-econ.json` (없으면 `unit-econ.example.json`, 모든 값은 가정). 모델 단가·토큰 수·라우팅 비중·결제 채널 수수료·환불률·검수 비율·무료 질문 비율·묶음 가격.
- 출력: 묶음별 질문 1회 순매출·모델 원가·검수·무료 배분·수수료·환불·공헌이익·공헌이익률, 손익분기 판매가.
- 근거 사례: crack-pricing, wrtn-pnl (docs/crack-deep-dive.md 10장).
