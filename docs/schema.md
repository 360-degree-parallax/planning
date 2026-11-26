# 사례 DB 스키마 v4

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

- "첫 결제 전환율이 낮다" → `problem_metric.id = first_pay_conv` 또는 `saju.stage = paywall/first_pay`인 사례를 모아, 살아남은 가설의 `barrier.type` 분포를 본다.
- "우리 아이디어가 뻔한가?" → 비슷한 가설이 `competition`·`not_core`로 탈락한 사례가 있는지 본다.
- "왜 지금 가능한가?" → `tech_change`(예: LLM 원가 하락)로 살아남은 사례의 `barrier.changed`·`year`를 본다.
