"""db/src/*.txt (간단 작성 형식) + db/base.json → db/cases.json

작성 형식 (사례 하나):
    # id | 제목 | 분야 | kind(real·failure·practice) | 출처
    S: 상황
    X: 현상(겉으로 보이는 문제)
    P: 다시 정의한 문제
    - 판정 관점 | 가설 | Why not yet 답 | 판정 이유
    = 해결
    L: 배울 점
    R: https://출처 (여러 줄 가능, 있으면 verified)
기존 사례에 가설 덧붙이기:
    @ id
    - 판정 관점 | 가설 | Why not yet 답 | 판정 이유
판정: O 뻔함 · I 불가능 · B 통념의 맹점 · T 타이밍
관점: cu 고객 · ti 시점 · pr 가격 · ch 채널 · co 경쟁 · cn 제약 · be 통념

사용: python3 tools/build_db.py
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = {'O': 'obvious', 'I': 'impossible', 'B': 'blindspot', 'T': 'timing'}
P = {'cu': 'customer', 'ti': 'timing', 'pr': 'price', 'ch': 'channel', 'co': 'competitor', 'cn': 'constraint', 'be': 'belief'}
KEYS = ['id', 'kind', 'domain', 'title', 'source', 'verified', 'refs', 'what', 'hyps', 'solution', 'lesson']


def parse(path, extra):
    cases, c = [], None
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.strip()
        if not line or line.startswith('//'):
            continue
        where = f'{os.path.basename(path)}:{n}'
        if line.startswith('# '):
            parts = [x.strip() for x in line[2:].split(' | ')]
            if len(parts) != 5:
                sys.exit(f'{where} 머리줄은 5칸: {line}')
            c = {'id': parts[0], 'title': parts[1], 'domain': parts[2], 'kind': parts[3], 'source': parts[4],
                 'refs': [], 'what': {}, 'hyps': [], 'solution': '', 'lesson': ''}
            cases.append(c)
        elif line.startswith('@ '):
            c = {'hyps': [], 'refs': []}
            extra.setdefault(line[2:].strip(), []).append(c)
        elif c is None:
            sys.exit(f'{where} 머리줄 전에 내용')
        elif line[:2] in ('S:', 'X:', 'P:'):
            c['what'][{'S': 'situation', 'X': 'symptom', 'P': 'problem'}[line[0]]] = line[2:].strip()
        elif line.startswith('- '):
            head, *rest = line[2:].split(' | ')
            v, p = head.split()
            if len(rest) != 3 or v not in V or p not in P:
                sys.exit(f'{where} 가설 줄 형식: {line}')
            c['hyps'].append({'text': rest[0], 'perspective': P[p], 'why_not_yet': rest[1], 'verdict': V[v], 'reason': rest[2]})
        elif line.startswith('= '):
            c['solution'] = line[2:].strip()
        elif line.startswith('L:'):
            c['lesson'] = line[2:].strip()
        elif line.startswith('R:'):
            c['refs'].append(line[2:].strip())
        else:
            sys.exit(f'{where} 알 수 없는 줄: {line}')
    return cases


def main():
    base = json.load(open(os.path.join(ROOT, 'db/base.json'), encoding='utf-8'))
    cases, extra = list(base['cases']), {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'db/src/*.txt'))):
        cases += parse(f, extra)
    byid = {c['id']: c for c in cases}
    for cid, blocks in extra.items():
        if cid not in byid:
            sys.exit(f'덧붙일 사례가 없음: {cid}')
        for b in blocks:
            byid[cid]['hyps'].extend(b['hyps'])
            byid[cid]['refs'].extend(b['refs'])
    seen = set()
    for c in cases:
        if c['id'] in seen:
            sys.exit(f'id 중복: {c["id"]}')
        seen.add(c['id'])
        c['verified'] = bool(c['refs'])
    base['cases'] = [{k: c[k] for k in KEYS} for c in cases]
    json.dump(base, open(os.path.join(ROOT, 'db/cases.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(cases)} cases → db/cases.json')


if __name__ == '__main__':
    main()
