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

기획 공부·아이데이션을 위한 **사례 DB**입니다. 지금은 DB만 있고 툴 화면은 보류 중입니다.

방법론: **WHAT**(무슨 문제를 풀 것인가) → **가설**(최대한 많이) → **Why not yet**(왜 지금까지 아무도 안 했나?) → 해결
- 뻔함·불가능 → 탈락 (뻔하거나 불가능한 아이디어 제거)
- 통념의 맹점·타이밍 → 생존 (주목하지 않던 아이디어가 빛나는 아이디어였음을 발견)

기준 서비스: **AI 사주 웹사이트 · 커머스형 · 최종 지표 = 결제**. 웹툰형 스토리 후킹(1p) → 마케팅 후킹(2p) → 결제 → 한 번 구매로 전체 결과 공개. 모든 사례가 결제 지표 트리와 사주 퍼널 단계에 연결되어 있습니다.

## 규모 (스키마 v4)
- 사례 **{len(cases)}개** (실제 {kc['real']} · 실패 {kc['failure']} · 연습 {kc['practice']}), 가설 **{nh}개**
- **deep {len(deep)}개**: Why not yet 장벽 구조(유형·주체·바뀐 계기·연도·근거), 검증 실험과 지표, 사주 적용 아이디어 직접 작성. 근거 URL이 확인된 결과 지표 {nout}건 ({sum(1 for c in deep if c.get('outcomes'))}개 사례), 나머지 {sum(1 for c in deep if c.get('outcome_note'))}개는 수치가 없는 이유를 기록
- **tagged {len(tagged)}개**: 비즈니스 모델·단계·시장·지역·문제 지표·사주 퍼널 단계는 사람이 태깅, 장벽 유형과 적용 세그먼트는 규칙 추정(`inferred: true`)
- 출처 링크 확인 {nref}개

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
| [docs/diagnosis-example.md](docs/diagnosis-example.md) | 진단 리포트 예시: 병목 단계 → 추천 실험·표본 수, 세그먼트, 공헌이익 (가짜 숫자) |

## 만들기
```bash
python3 tools/build_db.py && node tools/check_db.mjs && python3 tools/report.py && python3 tools/readme.py
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
