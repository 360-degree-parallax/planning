# 트래킹 플랜

`db/service/events.json`에서 생성. 퍼널 단계 id는 모두 여기 정의돼 있어야 한다(검사기가 확인).

- 사람 식별: 비로그인 방문자는 브라우저 식별자, 입력·결제 후에는 회원 id로 이어 붙인다. 기간 내 같은 사람은 단계마다 1번만 센다.
- 트래킹 플랜. 퍼널 설정의 단계 id는 모두 여기 정의돼 있어야 한다. 도달 수는 '사람 수'(기간 내 같은 사람은 1번)로 센다.

| 단계·이벤트 id | 이벤트 이름 | 언제 보내나 | 중복 처리 | 속성 |
|---|---|---|---|---|
| `story` | `story_view` | 1p 첫 컷이 화면에 50% 이상 1초 이상 보였을 때 | 사람 단위 1회 | channel, campaign, creative_id, device, time_band, landing_topic |
| `story_complete` | `story_complete` | 1p 마지막 컷이 화면에 보였을 때 — 1p 안에서 몇 번째 컷에서 떠났는지 보려면 cut_view(컷 번호)를 함께 보낸다 | 사람 단위 1회 | creative_id, scroll_depth |
| `input` | `input_view` | 생년월일 입력 화면이 열렸을 때 | 사람 단위 1회 | position_in_funnel |
| `input_done` | `input_submit` | 필수 항목이 유효하게 제출됐을 때 | 사람 단위 1회 | birth_time_known, calendar_type, age_band, gender, is_minor |
| `marketing` | `marketing_view` | 2p 첫 블록이 화면에 보였을 때 | 사람 단위 1회 | creative_id, price_shown |
| `marketing_block` | `marketing_block_view` | 2p의 각 블록(후기·포함 내용·가격·환불 기준)이 보였을 때 | 블록별 사람 단위 1회 | block |
| `checkout` | `checkout_view` | 결제 페이지가 열렸을 때 | 사람 단위 1회 | product_id, price, discount_id |
| `pay_attempt` | `payment_attempt` | 결제 버튼을 눌러 PG 창·인증이 시작됐을 때 | 사람 단위 1회 (재시도는 attempt_no로) | method, attempt_no |
| `pay_fail` | `payment_fail` | PG가 실패·취소를 돌려줬을 때 | 시도 단위 | method, error_code, user_cancel |
| `paid` | `purchase_paid` | 서버가 PG 승인을 확인했을 때 (클라이언트 이벤트가 아님) | 주문 단위, 사람 수는 별도 집계 | order_id, product_id, amount, discount_id, method, is_repeat |
| `generation_started` | `generation_started` | 리포트 생성 작업 시작 | 주문 단위 | order_id, model |
| `generation_done` | `generation_done` | 리포트 생성 완료 | 주문 단위 | order_id, latency_ms, cost_krw, chapters |
| `generation_failed` | `generation_failed` | 생성 실패(재시도 전) | 시도 단위 | order_id, error |
| `opened` | `result_open` | 결과 첫 장이 화면에 보였을 때 | 주문 단위 1회 | order_id, minutes_since_paid, notified |
| `chapter` | `chapter_view` | 각 장의 제목이 화면에 보였을 때 | 주문·장 단위 1회 | order_id, chapter |
| `read_all` | `result_complete` | 마지막 장 끝까지 스크롤했을 때 | 주문 단위 1회 | order_id |
| `feedback` | `result_feedback` | 리포트 끝 만족도·'맞았다' 문항 응답 | 주문 단위 1회 | score, accurate |
| `followup` | `followup_question` | AI 후속 질문을 보냈을 때 | 질문 단위 | order_id, topic |
| `share` | `share_send` | 공유 카드·궁합 초대를 보냈을 때 | 보낸 건 단위 | type, channel |
| `refund_request` | `refund_request` | 환불 요청 접수 — reason은 interpretation(해석 불만) · expectation(기대 불일치) · mistake(결제 실수) · technical(기술 오류) · other 중 하나 | 주문 단위 | order_id, reason |
| `experiment_exposure` | `experiment_exposure` | 실험 군이 배정되고 해당 화면이 처음 보였을 때 — 배정이 아니라 노출을 기준으로 센다. 군별 노출 수로 배정 비율 이상(SRM)을 확인한다 | 실험·사람 단위 1회 | experiment_id, arm |
