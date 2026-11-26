"""db/cases.json → docs/saju-playbook.md : AI 사주(웹툰형, 결제) 퍼널 단계별 사례·장벽·검증 실험 모음

사용: python3 tools/report.py
"""
import collections, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, 'db/cases.json'), encoding='utf-8'))
T = json.load(open(os.path.join(ROOT, 'db/taxonomy.json'), encoding='utf-8'))
C = d['cases']
PASS = {'blindspot', 'timing'}
B = T['barriers']
M = T['metrics']
order = ['acquire', 'taste', 'binge', 'paywall', 'first_pay', 'repeat_pay', 'expand', 'refer', 'trust', 'economics']

H = [h for c in C for h in c['hyps']]
L = []
L += ['# AI 사주 결제 플레이북 (사례 DB에서 자동 생성)', '',
      '기준: 웹툰형(회차 연재) AI 사주 · 최종 지표 = 결제. `python3 tools/report.py`로 다시 만든다.', '',
      f'사례 {len(C)}개 · deep {sum(c["depth"] == "deep" for c in C)}개 · 가설 {len(H)}개 · 근거 있는 결과 지표 {sum(len(c["outcomes"]) for c in C)}건', '',
      '> deep 사례의 장벽·실험·적용 아이디어는 직접 작성했고, tagged 사례의 장벽 유형은 규칙 추정(inferred)이다. 아래 분포는 둘을 합친 값이라 방향을 보는 용도로 쓴다.', '']

# 전체: 살아남은 가설의 장벽 유형
surv = collections.Counter(h['barrier']['type'] for h in H if h['verdict'] in PASS)
dead = collections.Counter(h['barrier']['type'] for h in H if h['verdict'] not in PASS)
L += ['## 1. 전체: 무엇이 기회를 막고 있었나', '',
      '| 살아남은 가설의 장벽 | 수 | 탈락한 가설의 장벽 | 수 |', '|---|---|---|---|']
s, k = surv.most_common(), dead.most_common()
for i in range(max(len(s), len(k))):
    a = f"{B[s[i][0]]['label']} | {s[i][1]}" if i < len(s) else ' | '
    b = f"{B[k[i][0]]['label']} | {k[i][1]}" if i < len(k) else ' | '
    L.append(f'| {a} | {b} |')
L.append('')

L += ['## 2. 퍼널 단계별', '']
for st in order:
    cs = [c for c in C if c['saju'] and c['saju']['stage'] == st]
    if not cs:
        continue
    fs = T['funnel_stages'][st]
    hs = [h for c in cs for h in c['hyps'] if h['verdict'] in PASS]
    bc = collections.Counter(h['barrier']['type'] for h in hs).most_common(3)
    L += [f"### {fs['label']} (`{st}`) — 사례 {len(cs)}개", '', f"사주 서비스에서: {fs['saju']}", '',
          '살아남은 가설의 주요 장벽: ' + ', '.join(f"{B[b]['label']} {n}" for b, n in bc), '']
    deep = [c for c in cs if c['depth'] == 'deep']
    for c in deep:
        L.append(f"**{c['title']}** (`{c['id']}`)")
        L.append(f"- 적용: {c['saju']['idea']}")
        for h in c['hyps']:
            if h['verdict'] in PASS and h.get('test'):
                mt = M.get(h['test']['metric'], {}).get('label', h['test']['metric'])
                L.append(f"- 실험: {h['test']['experiment']} → 지표: {mt}")
                break
        for o in c['outcomes'][:2]:
            L.append(f"- 근거: {M[o['metric']]['label']} {o['before']} → {o['after']} ({o['context']}) [출처]({o['evidence']})")
        L.append('')
    rest = [c for c in cs if c['depth'] != 'deep']
    if rest:
        L.append('같은 단계의 다른 사례: ' + ', '.join(f"{c['title']}(`{c['id']}`)" for c in rest))
        L.append('')

L += ['## 3. 결제 지표 트리별 근거 수치', '', '| 지표 | 사례 | 이전 → 이후 | 맥락 |', '|---|---|---|---|']
for c in C:
    for o in c['outcomes']:
        L.append(f"| {M[o['metric']]['label']} | {c['title']} | {o['before']} → {o['after']} | {o['context']} [출처]({o['evidence']}) |")
L.append('')
open(os.path.join(ROOT, 'docs/saju-playbook.md'), 'w', encoding='utf-8').write('\n'.join(L))
print('docs/saju-playbook.md', len(L), 'lines')
