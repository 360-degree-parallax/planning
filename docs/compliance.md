# 규정 체크리스트

실험·화면 설계 전에 확인할 국내 규정. 요약은 이해를 돕기 위한 것이며 법률 자문이 아니다. 실제 적용은 법무 검토를 거친다. (확인일 2026-11-27)

## `dark-sequential-price` · 전자상거래법 제21조의2 (시행 2025-02-14)

순차공개 가격책정: 첫 화면에 낮은 가격만 보이고 구매 과정에서 추가 금액을 하나씩 드러내면 안 된다.

- **확인할 것**: 1p·2p·결제 페이지에서 보이는 가격이 최종 결제 금액과 같은가? '하루 n원' 표시에도 총액을 함께 보이는가?
- 관련 단계: hook_marketing, checkout
- 출처: https://news.seoul.go.kr/economy/archives/566114?listPage=1 · https://shinkim.com/kor/media/newsletter/3545?page=1

## `dark-preselect` · 전자상거래법 제21조의2 (시행 2025-02-14)

특정옵션의 사전선택: 사업자에게 유리한 옵션(상위 등급·추가 상품)을 미리 체크해 두면 안 된다.

- **확인할 것**: 묶음·상위 등급·추가 상담 옵션이 기본값으로 선택돼 있지 않은가?
- 관련 단계: checkout, expand
- 출처: https://shinkim.com/kor/media/newsletter/3545?page=1

## `dark-false-hierarchy` · 전자상거래법 제21조의2 (시행 2025-02-14)

잘못된 계층구조: 특정 선택지를 시각적으로 강조해 유일하거나 필수인 것처럼 보이게 하면 안 된다.

- **확인할 것**: 3단 가격표에서 '추천' 강조가 다른 선택지를 숨기거나 필수처럼 보이게 하지 않는가?
- 관련 단계: checkout, expand
- 출처: https://shinkim.com/kor/media/newsletter/3545?page=1

## `dark-hidden-renewal` · 전자상거래법 제13조 제6항 (시행 2025-02-14)

숨은갱신: 정기결제 대금을 올리거나 무료에서 유료로 바꿀 때 별도 동의와 고지가 필요하다.

- **확인할 것**: 연간 이용권·'다음 해 운세 자동 예약' 같은 반복 결제 상품에 갱신 전 동의·고지 절차가 있는가?
- 관련 단계: repeat_pay
- 출처: https://news.seoul.go.kr/economy/archives/566114?listPage=1

## `dark-cancel-obstruction` · 전자상거래법 제21조의2 (시행 2025-02-14)

취소·탈퇴 등의 방해: 취소·해지·탈퇴를 가입보다 복잡하게 하거나 방법을 제한하면 안 된다.

- **확인할 것**: 예약·이용권 해지가 가입과 같은 단계 수로 끝나는가?
- 관련 단계: repeat_pay, trust
- 출처: https://news.seoul.go.kr/economy/archives/566114

## `dark-nagging` · 전자상거래법 제21조의2 (시행 2025-02-14)

반복간섭: 이미 거절한 선택을 팝업 등으로 반복해 요구하면 안 된다.

- **확인할 것**: 업셀·알림 동의 팝업을 거절한 사람에게 같은 화면을 반복해서 띄우지 않는가?
- 관련 단계: expand, repeat_pay
- 출처: https://news.seoul.go.kr/economy/archives/566114

## `false-discount-scarcity` · 전자상거래법 제21조 제1항 제1호(기만적 유인), 공정위 다크패턴 가이드라인

거짓 할인·거짓 희소성: 실제와 다른 할인 기간·남은 수량·카운트다운으로 구매를 서두르게 하면 안 된다.

- **확인할 것**: 카운트다운·'오늘만'·'남은 n개' 문구가 실제 조건과 같은가? 타이머가 새로고침하면 다시 시작하지 않는가?
- 관련 단계: hook_marketing, checkout
- 출처: https://www.lawtimes.co.kr/news/articleView.html?idxno=228371 · https://shinkim.com/kor/media/newsletter/3545?page=1

## `fake-reviews` · 공정위 다크패턴 가이드라인(거짓 추천), 표시광고법·추천보증 심사지침 (시행 2024-12-01)

불리한 후기를 지우거나 유리한 후기를 거짓으로 만들면 안 된다. 대가를 받은 후기·체험단은 제목이나 첫 부분에 경제적 이해관계를 밝혀야 한다.

- **확인할 것**: 2p 후기가 실제 구매자 것인가? 선별 기준을 밝히는가? 대가성 후기·인플루언서 광고에 표시가 있는가?
- 관련 단계: hook_marketing, acquire
- 출처: https://shinkim.com/kor/media/newsletter/3545?page=1 · https://biz.sbs.co.kr/amp/article/20000201807

## `digital-withdrawal` · 전자상거래법 제17조 제2항 제5호, 제6항

디지털 콘텐츠는 제공이 시작되면 청약철회를 제한할 수 있지만, 그러려면 '철회 불가' 사실을 표시하고 시험 사용(맛보기) 등을 제공해야 한다. 표시·광고와 다르면 3개월 안, 안 날부터 30일 안에 철회할 수 있다.

- **확인할 것**: 결제 전에 철회 제한을 표시하는가? 맛보기(첫 장 미리보기 등)를 주는가? 2p 약속과 실제 결과가 같은가?
- 관련 단계: checkout, consume, trust
- 출처: https://lawinsider.com/ko/contracts/ioQLMj6C2Z7 · https://news.seoul.go.kr/economy/archives/95

## `minor-cancel` · 민법 제5조, 전자상거래법(미성년자 취소 고지)

미성년자가 법정대리인 동의 없이 맺은 계약은 취소할 수 있고, 판매자는 이 사실을 미성년자에게 알려야 한다. 고지하지 않아 공정위 제재를 받은 사례가 있다.

- **확인할 것**: 생년월일로 미성년자임이 드러나면 결제 전에 취소 가능 고지를 보이는가? 휴대폰 소액결제를 열 때 특히 확인.
- 관련 단계: checkout, input
- 출처: https://www.law.go.kr/LSW/ftcInfoP.do?ftcSeq=931 · https://www.law.go.kr/LSW/ftcInfoP.do?ftcSeq=939

## `birth-data-privacy` · 개인정보 보호법 (적용 범위 법무 확인 필요)

생년월일·출생시각·이름은 사주 서비스의 핵심 입력이지만 유출·악용 위험이 지적된다. 수집 목적·보관 기간·제3자 제공을 최소화한다.

- **확인할 것**: 입력 화면에서 수집 목적을 밝히는가? 공유 카드에 생년월일이 노출되지 않는가? 이 항목은 조문을 확인하지 않은 일반 원칙이다.
- 관련 단계: input, refer
- 출처: https://v.daum.net/v/20251211210300627

## `ai-answer-liability` · 판례(캐나다 Moffatt v. Air Canada, 2024) · 국내 전자상거래법상 표시·광고 책임 (법무 확인 필요)

챗봇 답변도 회사가 한 말로 본다. 캐나다 분쟁 재판소는 챗봇의 잘못된 환불 안내에 대해 항공사 책임을 인정했다. 환불·가격·효능을 AI가 약속하면 회사가 지켜야 할 수 있다.

- **확인할 것**: AI 답변이 환불·가격·보장("꼭 이뤄진다")을 말하지 않도록 막았는가? 정책 질문은 고정 문구·약관 링크로 답하는가?
- 관련 단계: ask, trust
- 출처: https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/

## `ai-disclosure` · 인공지능 발전과 신뢰 기반 조성 등에 관한 기본법 (AI 기본법) (시행 2026-01-22)

생성형 AI 결과물에 AI가 만들었다는 표시 의무가 생겼다. 과태료는 최대 3천만 원이며, 정부는 최소 1년 이상 계도 기간을 두겠다고 밝혔다. 의무 범위(이용사업자 해당 여부)는 법무 확인이 필요하다.

- **확인할 것**: 질문 답변·결과 화면에 'AI가 생성한 해석'임을 이용자가 알아볼 수 있게 표시했는가? 사람 상담처럼 보이게 하는 연출(가짜 상담사 이름·사진)이 없는가?
- 관련 단계: ask, consume, trust
- 출처: https://www.newsis.com/view/NISX20260121_0003484769 · https://shinkim.com/kor/media/newsletter/3114

## `minor-ai-usage` · 업계 자율 기준·규제 압력 (법 조항 아님) + 민법상 미성년자 계약 취소(minor-cancel)

AI 채팅 업계가 미성년자 이용을 제한하는 쪽으로 움직였다. Character.AI는 2025년 11월부터 18세 미만 자유 대화를 막았고, 국내 제타는 10대의 하루 이용 시간과 월 결제 한도를 뒀다.

- **확인할 것**: 생년월일 입력으로 미성년자를 알 수 있는데 질문권 결제 한도·민감 주제 차단을 걸었는가? 미성년자 결제 취소에 대비한 환불 절차가 있는가?
- 관련 단계: ask, checkout
- 출처: https://fortune.com/2025/10/29/character-ai-ban-children-teens-chatbots-regulatory-pressure-age-verification-online-harms · https://khan.co.kr/article/202610121608001

## `sensitive-advice` · 의료법·변호사법·자본시장법 등 전문 영역 (조문 미확인, 일반 원칙)

건강·법률·투자·자해 관련 질문에 단정적으로 답하면 위험하다. 섭식장애 상담 챗봇 Tessa는 해로운 다이어트 조언으로 내려졌다.

- **확인할 것**: 민감 주제 질문을 분류해 '운세 관점의 참고'로만 답하고 전문가·상담 기관 안내를 붙이는가? 자해·위기 신호에는 운세 답변 대신 도움 기관을 안내하는가?
- 관련 단계: ask, trust
- 출처: https://www.npr.org/2023/06/08/1180838096/an-eating-disorders-chatbot-offered-dieting-advice-raising-fears-about-ai-in-hea

