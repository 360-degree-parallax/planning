# 크랙 · 캬라푸 · OOC 딥다이브 (질문권 Q&A 관점)

확인일 2026-11-27. 수치는 회사 발표·공시·보도 기준이며 각 줄에 출처를 단다. 사례 DB의 하위 사례 id를 괄호로 표시한다.

## 1. 한 장 요약
- 뤼튼은 무료 범용 AI로 사람을 모은 뒤, 서브컬처 팬이 오래 읽는 '이야기'에 종량형으로 돈을 받는 구조로 바꿨다.
- 돈을 낸 순간은 '더 많이'가 아니라 '더 잘'(상위 모델)이었다. 이용자가 먼저 요청한 품질 차이를 유료로 열었다 (crack-paywall).
- 국내 MAU는 줄었는데 매출은 늘었다. 결제자 밀도가 핵심이었다 (crack-spinoff).
- 같은 엔진을 일본 '캬라푸', 북미 'OOC'로 현지 브랜드화했고, 북미에서는 범주 이름을 '플레이 가능한 애니'로 바꿨다 (kyarapu, ooc-na).
- 매출이 커질수록 모델 호출비·수수료·광고비도 커져 아직 적자다. 단위 경제가 숙제다 (wrtn-pnl).
- 뤼튼은 운세 앱 '플롯'도 운영한다. 같은 엔진을 가진 회사가 운세에 들어온 신호다 (competitors.json `wrtn-plot`).

## 2. 타임라인
| 시점 | 사건 | 출처 |
|---|---|---|
| 2023년 1월 | 뤼튼 서비스 시작, 이후 GPT-4 무료화로 MAU 확대 | https://www.inews24.com/view/1925963 |
| 2024년 3월 | 뤼튼 앱 안에 '캐릭터 챗' 시작 | https://www.ddaily.co.kr/page/view/2025033014465765582 |
| 2024년 10월 말 | 부분 유료화(슈퍼챗 등 상위 모델). 1개월 만에 월 매출 10억 원 | https://www.inews24.com/view/1789057 |
| 2024년 12월 | 월 매출 20억 원 | https://www.hankyung.com/article/202503310073i |
| 2025년 4월 3일 | 별도 앱 '크랙' 출시. 4월 MAU 192만 명 | https://news.mtn.co.kr/news-detail/2025061715142744765 |
| 2025년 | 일본 '캬라푸' 출시 | https://v.daum.net/v/20260414102924902 |
| 2025년 말 | 크랙 연환산 매출 7000만 달러(약 1000억 원) | https://dealsite.co.kr/articles/167500 |
| 2026년 2월 | 국내 MAU 크랙 98만 명, 제타 402만 명 | https://dealsite.co.kr/articles/167500 |
| 2026년 4월 | 2025년 매출 약 471억 원(전년 약 31억 원) 공시, 영업손실 약 588억 원 | https://www.koreatimes.co.kr/business/tech-science/20260414/wrtn-posts-15-fold-revenue-growth-in-1st-regulatory-filing |
| 2026년 4월 15일 | 북미 'OOC: The Playable Anime' 앱스토어 출시 | https://adapty.io/paywall-library/ooc/ |
| 2026년 7월 | 창작자 보상 현금화 발표(9월 시행), 8월 '크랙 온리' 독점작 정산 상향 | https://news.mtn.co.kr/news-detail/2026073108283754407 |
| 2026년 8월 | OOC 출시 3개월 만에 월 매출 100억 원, 해외 매출이 국내 추월. 시리즈C 1000억 원, 기업가치 1조 원 이상 | https://news.mtn.co.kr/news-detail/2026082606521087869 |
| 2026년 8월 | 확률형 이벤트 사행성 검토 보도, 지스타 메인스폰서 논란 | https://www.mt.co.kr/article/2026081709444987700 |
| 2026년 9월 | 청소년 하루 3시간·월 10만 원 상한 발표(2027년 초 시행) | https://news.mtn.co.kr/news-detail/2026090808564087580 |
| 2026년 11월 | 정산 창작자 5500명, 최고 연 7억 원 이상 | https://zdnet.co.kr/view/?no=20261119122756 |

## 3. 수익 구조
- 재화: 국내 '크래커'(웹에서 1개 1원), 일본 '골드', 북미 '크레딧'. 대화·이미지 생성에 쓴다. https://www.mt.co.kr/article/2026081709444987700
- 품질 등급: 기본 채팅과 상위 채팅(슈퍼챗·울트라챗)을 나눠 상위 모드에 재화를 더 쓴다. https://apps.apple.com/jp/app/id6744629457
- 북미 크레딧 가격: 2000개 2.89달러 ~ 10만 개 142.99달러, 시즌 팩(할로윈 캔디 팩 111.99달러) 판매. https://adapty.io/paywall-library/ooc/
- 신규 보상: 일본은 가입만 하면 채팅 최대 100회분 골드. https://apps.apple.com/app/id6744629457
- 결제자 유지율 70% 이상, 일반 이용자 하루 평균 약 2시간(회사 공개, 로이터 인용). https://www.woshipm.com/operate/6441577.html

## 4. 원가 구조 (wrtn-pnl)
- 2025년 영업비용 약 1060억 원 중 광고선전비 약 294억 원, 지급수수료 약 611억 원. 지급수수료에는 외부 모델 호출비와 앱 마켓 수수료가 섞여 있을 것으로 보이나 내역은 공개되지 않았다. https://v.daum.net/v/20260414102924902
- 회사는 여러 모델을 상황에 맞게 조합해 품질·속도·비용을 함께 맞춘다고 설명한다. https://www.inews24.com/view/1925963

## 5. 공급(창작자) 구조 (crack-creator)
- 보상 캐시 9월부터 1만 원 단위 현금 전환, 단일 IP 시리즈 누적 10억 원 정산 한도, 독점 공개작 정산 상향(크랙 온리). https://news.mtn.co.kr/news-detail/2026073108283754407
- 크랙에서 반응이 검증된 IP를 게임·웹툰·애니로 넓히겠다는 계획. https://dealsite.co.kr/articles/173125

## 6. 글로벌 (kyarapu, ooc-na)
- 같은 엔진, 나라별 다른 이름과 장치: 일본은 추애(推し活) 장치(팬 랭킹·스테이지), 북미는 '플레이 가능한 애니'로 범주를 바꿨다. https://ascii.jp/elem/000/004/313/4313114/ · https://01net.it/wrtn-technologies-unveils-its-ai-interactive-storytelling-platform-ooc-the-playable-anime-in-north-america/
- OOC는 기억을 장기·임시·관계·목표로 나눠 관리한다. https://c.m.163.com/news/a/L4DCPLSR05568DTV.html
- 일본에서는 제타가 2025년 12월 엔터테인먼트 AI 앱 이용자 1위였다(경쟁 강도). https://www.digitaltoday.co.kr/en/view/1075/scatterlab-ai-fiction-platform-zeta-japan-revenue-tops-1-1-billion-won-in-december

## 7. 위험
- 확률형 이벤트의 게임물·사행성 판단 가능성 (chat-gacha-risk, 규정 `probability-event`).
- 청소년 과몰입·선정성 민원, 국회 법안·심의 추진 (crack-teen, 규정 `minor-ai-usage`).
- 국내 MAU 감소: 2025년 4월 192만 명 → 2026년 7월 80만 명. 해외 매출이 국내를 넘어 상쇄하는 구조.

## 8. 우리 질문권에 가져올 것 (우선순위)
| 순위 | 아이디어 | 근거 사례 | 역할 | 첫 실험 지표 |
|---|---|---|---|---|
| 1 | 무료 답 아래 '깊은 답' 첫 3줄 미리보기로 질문권 열기 | crack-paywall | 차별 | 질문권 구매율 |
| 2 | 답변마다 명식 요약 + 지난 질문 3개 반영(요약만, 원가 상한) | crack-memory | 차별 | 다음 질문률 |
| 3 | 질문 종류별 모델 라우팅(짧은 질문 저가 모델) | wrtn-pnl | 차별 | 답변 1건 원가 |
| 4 | 질문권을 1p 스토리의 '다음 장'으로 연출(상담 표현 금지) | ooc-na | 차별 | 질문권 구매율 |
| 5 | 성과 지표를 구매자 1인당 질문 수·질문당 매출로 | crack-spinoff, zeta-vs-crack | 기본기 | 구매자 1인당 질문 수 |
| 6 | 미성년자 질문권 월 상한·민감 주제 차단 | crack-teen | 위험 | 환불·민원 |
| 7 | 명리 해석가의 주제별 질문 템플릿(정산은 나중) | crack-creator | 보류(템플릿만 시험) | 질문 제출률 |
| 8 | 원 단위 가격 표시(재화 환산 없음) | crack-kr | 기본기 | 질문권 구매율 |
| 9 | 해외판 질문권 | crack-global, kyarapu | 보류 | - |

## 9. 아직 모르는 것
- 크랙의 결제자 비율, 결제자 1인당 월 결제액, 재화 종류별 매출 구성은 공개되지 않았다.
- 지급수수료 611억 원 중 모델 호출비와 앱 마켓 수수료 비중.
- 플롯(뤼튼 운세 앱)의 상품 구성·가격·이용자 수. 다음 분기 경쟁사 점검 때 직접 확인한다.
