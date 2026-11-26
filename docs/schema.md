# 사례 DB 스키마 v4

목표: 사례를 **결제 지표**와 연결해, "우리 서비스의 이 지표가 문제일 때 어떤 가설이 통했고, 왜 그동안 아무도 안 했는가"를 찾고 추론할 수 있게 한다.

기준 서비스: **AI 사주 웹사이트 · 웹툰형(회차 연재) · 최종 지표 = 결제**

## 1. 결제 지표 트리

```
결제 매출 (revenue)
├─ 결제자 수 (payers)
│  ├─ 신규 결제자 (new_payers)
│  │   방문자 visitors
│  │   × 가입 전환율 signup_rate
│  │   × 첫 가치 도달률 first_value_rate      ← 1화(무료 풀이) 완독
│  │   × 다음 회차 이동률 next_episode_rate   ← 웹툰형 몰입
│  │   × 페이월 도달률 paywall_view_rate
│  │   × 첫 결제 전환율 first_pay_conv
│  └─ 재결제자 (repeat_payers)
│      재결제율 repeat_pay_rate · 리텐션 d30_retention · 구독 전환 sub_conv · 휴면 복귀 reactivation
└─ ARPPU (arppu)
    객단가 aov · 결제 빈도 pay_frequency · 교차·상향 구매 upsell_rate · 가격 수준 price_level

가드레일: 환불률 refund_rate · 평점·신뢰 rating · 건당 원가 unit_cost(LLM 비용) · 매출총이익률 gross_margin · CAC
```

## 2. 사주 퍼널 단계 (`saju.stage`)

| id | 단계 | 사주 서비스에서 |
|---|---|---|
| acquire | 유입 | 검색·SNS·추천으로 들어온다 |
| taste | 무료 맛보기 | 생년월일 입력 → 1화(무료 풀이) |
| binge | 회차 몰입 | 다음 회차로 계속 넘어간다 |
| paywall | 페이월 | 유료 회차·기다리면 무료·이용권 선택 |
| first_pay | 첫 결제 | 이용권·캐시·단건 리포트 첫 결제 |
| repeat_pay | 재결제·구독 | 다시 결제·정기 결제 |
| expand | 확장 구매 | 궁합·신년운·월운·질문 상담 |
| refer | 추천·공유 | 결과 공유·궁합 초대 |
| trust | 신뢰·품질 | 환불·정확도 의심 줄이기 |
| economics | 원가·수익성 | 풀이 1건당 LLM 비용·마진 |
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
