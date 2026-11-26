"""db/base.json + db/src/*.txt + db/meta/tags.txt → db/cases.json  (스키마 v4)

사례 작성 형식 (db/src/*.txt):
    # id | 제목 | 분야 | kind(real·failure·practice) | 출처
    S: 상황
    X: 현상(겉으로 보이는 문제)
    P: 다시 정의한 문제
    - 판정 관점 | 가설 | Why not yet 답 | 판정 이유 [|| 키=값; 키=값 ...]
    = 해결
    L: 배울 점
    R: https://출처            (여러 줄, 있으면 verified)
    M: 모델 | 단계 | 시장 | 지역  (taxonomy.json의 id)
    K: 문제 지표 id | 설명
    O: 지표 id | 이전 | 이후 | 기간·맥락 | https://근거
    T: 사주 퍼널 단계 id | 사주 서비스 적용 아이디어

기존 사례에 덧붙이기:  @ id   (가설·R·M·K·O·T 줄 추가, T는 덮어씀)
    E: 가설 번호 | 검증 실험 | 지표 id   (기존 가설의 검증 실험을 덮어씀)
기존 사례 가설 갈아끼우기(깊게 쓰기): @! id   (이 블록의 가설로 교체, depth=deep)

가설 줄의 || 뒤 키: barrier(장벽 id), holder(장벽을 가진 주체), changed(무엇이 바꿨나),
                   year(바뀐 해), ev(근거 URL), test(가장 싼 검증 실험), metric(볼 지표 id)
판정: O 뻔함 · I 불가능 · B 통념의 맹점 · T 타이밍
관점: cu 고객 · ti 시점 · pr 가격 · ch 채널 · co 경쟁 · cn 제약 · be 통념

태그 파일 (db/meta/tags.txt): id | 모델 | 단계 | 시장 | 지역 | 문제 지표 | 사주 퍼널 단계
    사례 안의 M·K·T 줄이 있으면 그것이 우선한다.

사용: python3 tools/build_db.py
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = {'O': 'obvious', 'I': 'impossible', 'B': 'blindspot', 'T': 'timing'}
P = {'cu': 'customer', 'ti': 'timing', 'pr': 'price', 'ch': 'channel', 'co': 'competitor', 'cn': 'constraint', 'be': 'belief'}
HKEYS = {'barrier', 'holder', 'changed', 'year', 'ev', 'test', 'metric'}
KEYS = ['id', 'kind', 'domain', 'title', 'source', 'verified', 'refs', 'depth', 'business', 'problem_metric',
        'outcomes', 'saju', 'what', 'hyps', 'solution', 'lesson']


def fail(msg):
    sys.exit(msg)


def parse_hyp(body, where):
    main, _, extra = body.partition(' || ')
    head, *rest = main.split(' | ')
    try:
        v, p = head.split()
    except ValueError:
        fail(f'{where} 가설 머리: {head}')
    if len(rest) != 3 or v not in V or p not in P:
        fail(f'{where} 가설 줄 형식')
    h = {'text': rest[0], 'perspective': P[p], 'why_not_yet': rest[1], 'verdict': V[v], 'reason': rest[2]}
    if extra:
        kv = {}
        for part in extra.split('; '):
            k, _, val = part.partition('=')
            k = k.strip()
            if k not in HKEYS:
                fail(f'{where} 알 수 없는 키: {k}')
            kv[k] = val.strip()
        if 'barrier' in kv:
            h['barrier'] = {'type': kv['barrier'], 'holder': kv.get('holder', ''), 'changed': kv.get('changed', ''),
                            'year': int(kv['year']) if kv.get('year', '').isdigit() else None,
                            'evidence': kv.get('ev', ''), 'inferred': False}
        if 'test' in kv:
            h['test'] = {'experiment': kv['test'], 'metric': kv.get('metric', '')}
    return h


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
                fail(f'{where} 머리줄은 5칸')
            c = {'id': parts[0], 'title': parts[1], 'domain': parts[2], 'kind': parts[3], 'source': parts[4],
                 'refs': [], 'what': {}, 'hyps': [], 'solution': '', 'lesson': '', 'outcomes': []}
            cases.append(c)
        elif line.startswith('@! ') or line.startswith('@ '):
            replace = line.startswith('@!')
            cid = line.split(None, 1)[1].strip()
            c = {'hyps': [], 'refs': [], 'outcomes': [], 'what': {}, 'tests': [], '_replace': replace}
            extra.setdefault(cid, []).append(c)
        elif c is None:
            fail(f'{where} 머리줄 전에 내용')
        elif line[:2] in ('S:', 'X:', 'P:'):
            c['what'][{'S': 'situation', 'X': 'symptom', 'P': 'problem'}[line[0]]] = line[2:].strip()
        elif line.startswith('- '):
            c['hyps'].append(parse_hyp(line[2:], where))
        elif line.startswith('= '):
            c['solution'] = line[2:].strip()
        elif line.startswith('L:'):
            c['lesson'] = line[2:].strip()
        elif line.startswith('R:'):
            c['refs'].append(line[2:].strip())
        elif line.startswith('M:'):
            m = [x.strip() for x in line[2:].split(' | ')]
            c['business'] = {'model': m[0], 'stage': m[1], 'market': m[2], 'region': m[3]}
        elif line.startswith('K:'):
            k = [x.strip() for x in line[2:].split(' | ')]
            c['problem_metric'] = {'id': k[0], 'note': k[1] if len(k) > 1 else ''}
        elif line.startswith('O:'):
            o = [x.strip() for x in line[2:].split(' | ')]
            if len(o) != 5:
                fail(f'{where} 결과 줄은 5칸')
            c['outcomes'].append({'metric': o[0], 'before': o[1], 'after': o[2], 'context': o[3], 'evidence': o[4]})
        elif line.startswith('E:'):
            e = [x.strip() for x in line[2:].split(' | ')]
            if len(e) != 3 or not e[0].isdigit():
                fail(f'{where} E 줄은 번호 | 실험 | 지표')
            c.setdefault('tests', []).append((int(e[0]), e[1], e[2]))
        elif line.startswith('T:'):
            t = [x.strip() for x in line[2:].split(' | ')]
            c['saju'] = {'stage': t[0], 'idea': t[1] if len(t) > 1 else ''}
        else:
            fail(f'{where} 알 수 없는 줄: {line}')
    return cases


# ---- 장벽 유형 규칙 추정 (깊게 쓰지 않은 가설용, inferred=true) ----
RULES = {
    'impossible': [('regulation', r'규제|법|인가|인허가|허용'), ('technology', r'기술|과학|정확도|오류율'),
                   ('social', r'사생활|체면|반발|수용|시선'), ('cost', r'비용|자본|자금|인건비|원가|투자|재고|감당|부담'),
                   ('structural', r'.')],
    'obvious': [('not_core', r'본질|효과 없|해 봤|그대로|소용없|바뀌지|못한다|못 한다'), ('competition', r'.')],
    'blindspot': [('incentive', r'수익|이해|손해|수익원|매출|깎'), ('definition', r'고객|문제|정의|경쟁자|용도|관점'),
                  ('belief', r'.')],
    'timing': [('shock', r'팬데믹|재난|지진|위기|화폐|감염|충격'), ('regulation_change', r'규제|제도|법|인가|허용|정책'),
               ('behavior_change', r'습관|행동|문화|인식|익숙|일상화|사회'),
               ('tech_change', r'기술|스마트폰|AI|LLM|인터넷|센서|배터리|클라우드|API|GPS|칩|데이터|알고리즘|결제'),
               ('market_change', r'.')],
}


def infer_barrier(h):
    text = f"{h['why_not_yet']} {h['reason']}"
    for btype, pat in RULES[h['verdict']]:
        if re.search(pat, text):
            return {'type': btype, 'holder': '', 'changed': '', 'year': None, 'evidence': '', 'inferred': True}


def main():
    base = json.load(open(os.path.join(ROOT, 'db/base.json'), encoding='utf-8'))
    cases, extra = list(base['cases']), {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'db/src/*.txt'))):
        cases += parse(f, extra)
    byid = {}
    for c in cases:
        if c['id'] in byid:
            fail(f'id 중복: {c["id"]}')
        c.setdefault('outcomes', [])
        c['depth'] = 'tagged'
        byid[c['id']] = c
    for cid, blocks in extra.items():
        if cid not in byid:
            fail(f'덧붙일 사례가 없음: {cid}')
        t = byid[cid]
        for b in blocks:
            if b['_replace']:
                t['hyps'] = list(b['hyps'])
                t['depth'] = 'deep'
            else:
                t['hyps'].extend(b['hyps'])
            t['refs'].extend(b['refs'])
            t['outcomes'].extend(b['outcomes'])
            t['what'].update(b['what'])
            for k in ('business', 'problem_metric', 'saju'):
                if k in b:
                    t[k] = b[k]
            for n, exp, met in b.get('tests', []):
                if n > len(t['hyps']):
                    fail(f'{cid}: E {n}번 가설이 없음')
                t['hyps'][n - 1]['test'] = {'experiment': exp, 'metric': met}
            if b.get('solution'):
                t['solution'] = b['solution']
            if b.get('lesson'):
                t['lesson'] = b['lesson']
    tagf = os.path.join(ROOT, 'db/meta/tags.txt')
    if os.path.exists(tagf):
        for n, raw in enumerate(open(tagf, encoding='utf-8'), 1):
            line = raw.strip()
            if not line or line.startswith('//'):
                continue
            p = [x.strip() for x in line.split(' | ')]
            if len(p) != 7:
                fail(f'tags.txt:{n} 7칸이어야 함: {line}')
            cid, model, stage, market, region, metric, funnel = p
            if cid not in byid:
                fail(f'tags.txt:{n} 없는 사례: {cid}')
            c = byid[cid]
            c.setdefault('business', {'model': model, 'stage': stage, 'market': market, 'region': region})
            c.setdefault('problem_metric', {'id': metric, 'note': ''})
            c.setdefault('saju', {'stage': funnel, 'idea': ''})
    for c in cases:
        c['refs'] = list(dict.fromkeys(c['refs']))
        c['verified'] = bool(c['refs'])
        for h in c['hyps']:
            if 'barrier' not in h:
                h['barrier'] = infer_barrier(h)
        for k in ('business', 'problem_metric', 'saju'):
            c.setdefault(k, None)
    base['v'] = 4
    base['taxonomy'] = 'db/taxonomy.json'
    base['cases'] = [{k: c[k] for k in KEYS} for c in cases]
    json.dump(base, open(os.path.join(ROOT, 'db/cases.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    deep = sum(c['depth'] == 'deep' for c in cases)
    print(f'{len(cases)} cases (deep {deep}) → db/cases.json')


if __name__ == '__main__':
    main()
