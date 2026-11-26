"""참고 문서 생성: 트래킹 플랜, 경쟁사 지도, 규정 체크리스트, 우리 아이디어 검증표.
사용: python3 tools/docs.py"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))


def write(path, lines):
    open(os.path.join(ROOT, path), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(path, len(lines), 'lines')


ev = J('db/service/events.json')
L = ['# 트래킹 플랜', '', '`db/service/events.json`에서 생성. 퍼널 단계 id는 모두 여기 정의돼 있어야 한다(검사기가 확인).', '',
     f"- 사람 식별: {ev['identity']}", f"- {ev['note']}", '',
     '| 단계·이벤트 id | 이벤트 이름 | 언제 보내나 | 중복 처리 | 속성 |', '|---|---|---|---|---|']
for e in ev['events']:
    L.append(f"| `{e['id']}` | `{e['name']}` | {e['trigger']}{' — ' + e['note'] if e.get('note') else ''} | {e['dedupe']} | {', '.join(e['props'])} |")
write('docs/tracking-plan.md', L)

cp = J('db/saju/competitors.json')
feats = cp['features']
L = ['# 경쟁사 지도', '', f"{cp['note']} (확인일 {cp['checked']})", '',
     '| 기능 | ' + ' | '.join(c['name'] for c in cp['competitors']) + ' |', '|---|' + '---|' * len(cp['competitors'])]
for k, label in feats.items():
    L.append(f'| {label} | ' + ' | '.join({True: '✓', False: '✗', None: ''}[c['has'].get(k)] for c in cp['competitors']) + ' |')
L += ['', '빈칸은 "모름"이다(없다는 뜻이 아님).', '']
for c in cp['competitors']:
    L += [f"## {c['name']}" + (f" ({c['company']})" if c['company'] else ''), '',
          f"- 규모: {c['scale'] or '모름'}", f"- 메모: {c['notes']}"] + \
         ([f"- 사례: `{c['case']}`"] if c['case'] else []) + [f"- 출처: {' · '.join(c['sources'])}", '']
write('docs/competitors.md', L)

rl = J('db/compliance.json')
L = ['# 규정 체크리스트', '', f"{rl['note']} (확인일 {rl['checked']})", '']
for r in rl['rules']:
    L += [f"## `{r['id']}` · {r['law']}" + (f" (시행 {r['since']})" if r['since'] else ''), '', r['summary'], '',
          f"- **확인할 것**: {r['check']}", f"- 관련 단계: {', '.join(r['stages'])}", f"- 출처: {' · '.join(r['sources'])}", '']
write('docs/compliance.md', L)

db = J('db/cases.json')
V = {'obvious': '뻔함', 'impossible': '불가능', 'blindspot': '맹점', 'timing': '타이밍'}
R = {'table': '기본기', 'diff': '차별', 'risk': '위험', 'skip': '보류'}
F = {'transfer': '그대로', 'adapt': '바꿔서', 'reject': '버림'}
P = {'yes': '있음', 'no': '없음', 'unknown': '모름'}
L = ['# 우리 아이디어 검증표 (핵심 50개)', '',
     '사례 → **적합성(Fit)**: 원 사례가 통한 이유가 우리에게도 있나 → **Why not yet**: 경쟁 사주 서비스는 왜 안 했나 → 실험.', '',
     '- 적합성: 그대로 옮김 / 바꿔서 옮김 / 버림. "모름" 조건은 실험에서 먼저 확인한다.',
     '- Why not yet 역할: 기본기(이미 흔함, 안 하면 손해) / 차별(빛날 후보) / 위험(규정·신뢰) / 보류', '',
     '| 사례 | 적합성 | Why not yet | 역할 | 모름 조건 | 규정 |', '|---|---|---|---|---|---|']
deep = [c for c in db['cases'] if c['depth'] == 'deep']
order = {'diff': 0, 'table': 1, 'risk': 2, 'skip': 3}
for c in sorted(deep, key=lambda c: (order[c['saju']['wny']['role']], c['saju']['fit']['verdict'] != 'transfer', c['id'])):
    w, f = c['saju']['wny'], c['saju']['fit']
    unk = sum(x['present'] == 'unknown' for x in f['support_factors'])
    L.append(f"| `{c['id']}` | {F[f['verdict']]} | {V[w['verdict']]} | {R[w['role']]} | {unk} | {', '.join(w['compliance']) or '–'} |")
L.append('')
for c in deep:
    w, f = c['saju']['wny'], c['saju']['fit']
    L += [f"## `{c['id']}` {c['title']}", '', f"**우리 아이디어**: {c['saju']['idea']}", '',
          f"**적합성 — {F[f['verdict']]}** (문제 구조: {dict(same='같음', similar='비슷함', different='다름')[f['problem_match']]})", '',
          f"- 통한 이유: {f['mechanism']}"] + [f"- 조건: {x['condition']} → **{P[x['present']]}**" for x in f['support_factors']] + \
         [f"- 결정적 차이: {f['key_difference']}", '', f"**Why not yet — {V[w['verdict']]}·{R[w['role']]}** (장벽: {w['barrier']})", '', w['why_not_yet'], '']
    if w['competitors']:
        L.append(f"- 근거 경쟁사: {', '.join(w['competitors'])}")
    if w['compliance']:
        L.append(f"- 확인할 규정: {', '.join(w['compliance'])}")
    L.append('')
write('docs/idea-validation.md', L)
