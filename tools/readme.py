"""README.md를 cases.json으로 다시 만든다: python3 tools/readme.py"""
import json
from collections import Counter, defaultdict

d = json.load(open('db/cases.json'))
tax = json.load(open('db/taxonomy.json'))
cases = d['cases']
kinds = {'real': '실제', 'failure': '실패', 'practice': '연습'}
stage = {k: v['label'] for k, v in tax['funnel_stages'].items()}
metric = {k: v['label'] for k, v in tax['metrics'].items()}
kc = Counter(c['kind'] for c in cases)
deep = [c for c in cases if c['depth'] == 'deep']
tagged = [c for c in cases if c['depth'] != 'deep']
nh = sum(len(c['hyps']) for c in cases)
nout = sum(1 for c in deep for o in c.get('outcomes', []) if o.get('evidence'))
nref = sum(1 for c in cases if c.get('refs'))


def row(c):
    pm = c.get('problem_metric', {}).get('id')
    return (f"| `{c['id']}` | {c['title']} | {kinds.get(c['kind'], c['kind'])}{' ✓' if c.get('verified') else ''} "
            f"| {stage.get(c['saju']['stage'], c['saju']['stage'])} | {metric.get(pm, pm or '')} |")


H = ['| id | 제목 | 구분 | 사주 퍼널 | 문제 지표 |', '|---|---|---|---|---|']
L = f'''# planning

기획 공부를 위한 **사례 DB**입니다.

## 목표: 본질 파악

이 저장소의 모든 작업은 **본질 파악**을 위해 합니다. 사례를 모으는 이유는 "무엇이 통했나"를 외우기 위해서가 아니라, 겉으로 보이는 현상 아래에서 **진짜 문제가 무엇이었고 왜 그것이 풀렸는지**를 보기 위해서입니다.

- **사례 중심**: 이 저장소에는 사례만 모읍니다. 제품 기획은 여기서 하지 않고, 기획자가 따로 합니다.
- **처음 읽는다면**: [docs/method-guide.md](docs/method-guide.md)에서 이론을 처음부터 끝까지 읽을 수 있습니다.
- **가설을 세우는 힘과 부수는 힘**: 본질은 두 힘을 함께 쓸 때 보입니다. 이 DB는 '문제 본질 발견의 기술' 단계를 다음처럼 담습니다.

| 단계 | 이 DB에서 | 범위 |
|---|---|---|
| 분석 A. 5 Why (과정) | 증상에서 "왜?" 3~5번 → 근본 원인 | deep 사례 |
| 분석 B. PEST | 정치·법(P)과 기술(T) 위주, 경제·사회는 참고 | deep 사례 |
| 분석 C. SWOT(SO·WO·ST) | 강점으로 잡을 기회(SO), 기회로 옮겨 가려고 메울 약점(WO), 강점으로 막을 위협(ST). WT는 제외 | deep 사례 |
| 1. 제한없는 가설설정 | 가설 목록 | 모든 사례 |
| 2. 의심 | **Why not yet** (왜 아무도 안 했나) | 모든 사례 |
| 3. 관습과 파괴 (과정) | "그래서?" 2~3번, 타이밍형은 조건 변화 | 모든 사례 |
| So what (결론) | 과정을 거쳐 내린 결론 한 문장 | deep 직접 작성, 나머지는 과정 마지막 단계 |
| 4. 긍정 오피니언 | 핵심 고객이 좋아하는 이유 | deep 사례 |
| 5. 안티오피니언 | 안 쓰는 사람·떠난 사람·비판자의 말 | deep 사례 |
| 6. 트레이드온 | 둘 중 하나라던 것을 둘 다 잡은 방법 | 모든 사례 |
| 7. 목표 재분석 | 표면 목표 → 재정의한 목표 → 지표 | deep 사례 |
| 8. 이슈트리 | 재정의한 목표를 MECE로 쪼개고 공략한 가지 표시 | deep 사례 |
| 9. 파레토 | 하위 이슈를 속도×임팩트로 매겨 중요한 소수만 선별 | deep 사례 |
| 10. 대체 왜 | 목표를 대체 왜 원하나 다시 의심해 진짜 사업 의도(매출·유지 등) 찾기, 올리기(높여야 성공)인지 지키기(낮아지지만 않으면 됨)인지 정하기 | deep 사례 |
| 11. 중요 지표 선별 | 의도 1 · 북극성 1 · 선행 1~3 · 가드레일 1 · 허영 지표(제외) · 선별 방법(FGI·인터뷰·관찰·데이터·실험 등) | deep 사례 |

1~6은 **문제를 깨닫고 본질을 찾는** 단계, 7~11은 **찾은 문제를 구조화하고 중요한 것만 남기는** 단계입니다.

- 해결은 그 사례가 실제로 한 것이고, 각 단계는 해결이 '왜' 그 모양이 되었는지를 드러내는 해석입니다. 오피니언 중 출처 URL이 없는 것은 '추정'으로 표시합니다. 전체: [docs/so-what.md](docs/so-what.md)

방법론: **5 Why**(과정) → **WHAT**(근본 원인) → **PEST(P·T)** → **SWOT(SO·WO·ST)** → **가설**(최대한 많이) → **의심 = Why not yet** → **관습 파괴**(과정) → **So what**(결론) → **긍정·안티 오피니언** → **트레이드온** → 해결
- 뻔함·불가능 → 탈락 (뻔하거나 불가능한 아이디어 제거)
- 통념의 맹점·타이밍 → 생존 (주목하지 않던 아이디어가 빛나는 아이디어였음을 발견)

다른 업종 사례를 우리 서비스에 옮길 때는 그 앞에 **적합성(Fit) 검증**을 둔다: 원 사례가 통한 이유와 그 이유가 작동한 조건이 우리에게도 있는가? (사례 → 적합성 → 우리 가설 → Why not yet → 실험)

기준 서비스: **AI 사주 웹사이트 · 커머스형 · 최종 지표 = 결제**. 웹툰형 스토리 후킹(1p) → 마케팅 후킹(2p) → 결제 → 한 번 구매로 전체 결과 공개. 모든 사례가 결제 지표 트리와 사주 퍼널 단계에 연결되어 있습니다.

## 규모 (스키마 v4)
- 사례 **{len(cases)}개** (실제 {kc['real']} · 실패 {kc['failure']} · 연습 {kc['practice']}), 가설 **{nh}개**
- **deep {len(deep)}개**: Why not yet 장벽 구조(유형·주체·바뀐 계기·연도·근거), 검증 실험과 지표, 사주 적용 아이디어 직접 작성. 근거 URL이 확인된 결과 지표 {nout}건 ({sum(1 for c in deep if c.get('outcomes'))}개 사례), 나머지 {sum(1 for c in deep if c.get('outcome_note'))}개는 수치가 없는 이유를 기록
- **tagged {len(tagged)}개**: 비즈니스 모델·단계·시장·지역·문제 지표·사주 퍼널 단계와 사주 적용 아이디어 초안은 사람이 작성, 장벽 유형과 적용 세그먼트는 규칙 추정(`inferred: true`, 결제 단계 생존 가설 {sum(1 for c in tagged for h in c['hyps'] if h['barrier'].get('reviewed'))}개는 사람 검토)
- 출처 링크 확인 {nref}개, 논란 표시 {sum(1 for c in cases if c.get('source_status') == 'disputed')}개
- 운세·사주 업계 사례 {sum(1 for c in cases if c.get('domain_group') == '운세·사주')}개, 경쟁사 지도 {len(json.load(open('db/saju/competitors.json'))['competitors'])}곳, 규정 {len(json.load(open('db/compliance.json'))['rules'])}개
- AI 채팅·Q&A 업계 사례 {sum(1 for c in cases if c.get('domain_group') == 'AI 채팅·Q&A')}개(그중 캐릭터 채팅·서브컬처 {sum(1 for c in cases if c['domain'].startswith('AI 채팅·캐릭터'))}개): 질문권(질문 1회 → 답변 1회) 관점. 퍼널 `db/funnels/saju-qa.json`, 지표 {sum(1 for m in json.load(open('db/taxonomy.json'))['metrics'].values() if m.get('group') == 'qa')}개(`group: qa`)
- 우리 아이디어 {len(deep)}개: 적합성 검증 + Why not yet (기본기 {sum(1 for c in deep if c['saju']['wny']['role'] == 'table')} · 차별 {sum(1 for c in deep if c['saju']['wny']['role'] == 'diff')} · 위험 {sum(1 for c in deep if c['saju']['wny']['role'] == 'risk')} · 보류 {sum(1 for c in deep if c['saju']['wny']['role'] == 'skip')})

실제·실패 사례는 학습용으로 단순화한 재구성입니다. 가설과 Why not yet 판정은 해석이며, 해당 기업이 실제로 그렇게 판단했다는 기록이 아닙니다. 출처 링크가 없는 사례는 인용 전 확인이 필요합니다.

## 문서
| 문서 | 내용 |
|---|---|
| [docs/schema.md](docs/schema.md) | 스키마 v4, 결제 지표 트리, 사주 퍼널 단계, 장벽 유형 |
| [docs/saju-playbook.md](docs/saju-playbook.md) | 사주 퍼널 단계별 사례·장벽·검증 실험·근거 수치 (자동 생성) |
| `db/taxonomy.json` | 지표·모델·장벽·퍼널 분류 체계 |
| `db/cases.json` | 완성된 DB (빌드 결과) |
| `db/funnels/*.json` | 퍼널 단계 순서 설정 (순서를 바꿔도 사례·실험 연결 유지) |
| `db/service/` | 우리 서비스 단계별 도달 수·수익 구조·실험 기록 (`*.example.json`은 가짜 예시) |
| `db/benchmarks.json` | 출처 있는 외부 참고 기준값 |
| [docs/idea-validation.md](docs/idea-validation.md) | 우리 아이디어의 적합성(Fit) 검증 + Why not yet |
| [docs/crack-deep-dive.md](docs/crack-deep-dive.md) | 크랙·캬라푸·OOC 단계별 딥다이브 (타임라인·수익·원가·위험·질문권 적용 우선순위) |
| [docs/saju-rivals-deep.md](docs/saju-rivals-deep.md) | 사주아이·타이트사주 비교와 두 사례의 본질 |
| [docs/tightsaju-deep-dive.md](docs/tightsaju-deep-dive.md) | 타이트사주 단계별 사례와 본질(유입·팝업·신뢰·IP·니치·성장) |
| [docs/design-ux-cases.md](docs/design-ux-cases.md) | 디자인·UX·브랜드 사례 모음(운세 서비스 화면 문법, 캐릭터, 결제 화면 규제) |
| [docs/method-guide.md](docs/method-guide.md) | 본질 파악 방법론 가이드: 이론을 처음부터 끝까지, 한 사례로 따라가기, 자주 하는 실수, 체크리스트 |
| [docs/so-what.md](docs/so-what.md) | 본질 파악·구조화 체인: 의심 → 관습 파괴 → 긍정·안티 오피니언 → 트레이드온 → 목표 재분석 → 이슈트리 → 파레토 → 대체 왜 → 중요 지표 → 해결 |
| [docs/competitors.md](docs/competitors.md) | 국내 운세·사주 경쟁사 기능 지도 |
| [docs/compliance.md](docs/compliance.md) | 실험 전 확인할 규정 체크리스트 |
| [docs/tracking-plan.md](docs/tracking-plan.md) | 단계별 이벤트 정의 (도달 수 집계 기준) |
| [docs/experiment-rules.md](docs/experiment-rules.md) | 실험 운영 규칙 |
| [docs/diagnosis-example.md](docs/diagnosis-example.md) | 진단 리포트 예시: 병목 → 추천 실험·표본 수, 세그먼트, 공헌이익, 추세·코호트, 실험 점검 (가짜 숫자) |

## 만들기
```bash
python3 tools/build_db.py && node tools/check_db.mjs && python3 -m unittest discover -s tests && python3 tools/report.py && python3 tools/docs.py && python3 tools/readme.py
```
우리 수치 진단: `db/service/baseline.json`에 단계별 도달 수를 넣고 `python3 tools/diagnose.py` → `docs/diagnosis.md` (예시는 `--example`)
원본: `db/base.json`(처음 30개) · `db/src/*.txt`(분야별 사례, `95·96-deep`은 핵심 50개, `97-commerce-remap`은 커머스 구조에 맞춘 사주 적용·실험 덮어쓰기, `98-outcomes`는 결과 지표 보강) · `db/meta/ice.txt`(실험 우선순위·채택 기준·가드레일) · `db/meta/also.txt`(보조 퍼널 단계) · `db/meta/segments.txt`(적용 세그먼트) · `db/meta/no-outcome.txt`(결과 수치가 없는 이유) · `db/meta/tags.txt`(분류 태그). 작성 형식은 `tools/build_db.py` 맨 위 설명을 보세요.

## 핵심 사례 (deep {len(deep)}개)

'''.split('\n')
L += H + [row(c) for c in deep] + ['', '## 분류 사례 (tagged)', '']
by = defaultdict(list)
for c in tagged:
    by[c['domain']].append(c)
for dom, cs in sorted(by.items(), key=lambda x: -len(x[1])):
    L += [f'### {dom} ({len(cs)})', ''] + H + [row(c) for c in cs] + ['']
open('README.md', 'w').write('\n'.join(L))
print('README.md', len(L), 'lines')
