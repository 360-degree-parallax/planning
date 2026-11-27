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

실험 우선순위 (db/meta/ice.txt): id 가설번호 | 영향 확신 쉬움 | 목표 변화 | 가드레일 지표 | 메모
보조 퍼널 단계 (db/meta/also.txt): id | 단계, 단계
기존 사례 가설 갈아끼우기(깊게 쓰기): @! id   (이 블록의 가설로 교체, depth=deep)
새 사례를 처음부터 깊게 쓰기: # 머리줄 아래에 D: deep

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
KEYS = ['id', 'kind', 'domain', 'domain_group', 'title', 'source', 'source_status', 'source_note', 'verified', 'refs', 'depth', 'business', 'problem_metric',
        'outcomes', 'outcome_note', 'saju', 'what', 'hyps', 'solution', 'so_what', 'lesson']


def fail(msg):
    sys.exit(msg)


def meta_lines(path):
    if not os.path.exists(path):
        return
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.strip()
        if line and not line.startswith('//'):
            yield n, line


NEW = {'acquire', 'hook_story', 'input', 'hook_marketing', 'checkout', 'first_pay'}
OLD = {'consume', 'ask', 'trust', 'repeat_pay', 'expand', 'refer'}
SEG_RULES = [  # (정규식, 축, 값) — 사례 본문 키워드로 추정
    (r'추천|초대|입소문|소개', 'channel', 'referral'),
    (r'SNS|인스타|틱톡|유튜브|바이럴', 'channel', 'organic_sns'),
    (r'검색', 'channel', 'naver_search'),
    (r'모바일|스마트폰|휴대폰', 'device', 'mobile'),
    (r'노인|시니어|어르신|50대|60대', 'age_band', '50s+'),
    (r'10대|청소년|중고생|중학생|고등학생|수험생', 'age_band', '10s'),
    (r'20대|대학생|사회초년생|MZ', 'age_band', '20s'),
]


def infer_segments(c):
    """분류 사례: 퍼널 단계로 방문자 유형, 본문 키워드로 채널·기기·시간대·나이대를 추정한다."""
    st = c['saju']['stage']
    seg = {}
    if st in NEW:
        seg['user_type'] = ['new']
    elif st in OLD:
        seg['user_type'] = ['buyer']
    text = ' '.join([c['title'], *c['what'].values(), c.get('solution', '')])
    for pat, dim, val in SEG_RULES:
        if re.search(pat, text) and val not in seg.get(dim, []):
            seg.setdefault(dim, []).append(val)
    return seg


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
        elif line.startswith('D:'):
            if line[2:].strip() != 'deep':
                fail(f'{where} D 줄은 D: deep 만 가능')
            c['_deep'] = True
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
        c['depth'] = 'deep' if c.pop('_deep', False) else 'tagged'
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
    icef = os.path.join(ROOT, 'db/meta/ice.txt')
    if os.path.exists(icef):
        for n, raw in enumerate(open(icef, encoding='utf-8'), 1):
            line = raw.strip()
            if not line or line.startswith('//'):
                continue
            p = [x.strip() for x in line.split('|')]
            if len(p) != 5:
                fail(f'ice.txt:{n} 5칸이어야 함: {line}')
            head, ice, target, guard, note = p
            cid, _, hn = head.partition(' ')
            if cid not in byid or not hn.isdigit():
                fail(f'ice.txt:{n} 사례·가설 번호: {head}')
            hs = byid[cid]['hyps']
            if int(hn) > len(hs) or 'test' not in hs[int(hn) - 1]:
                fail(f'ice.txt:{n} {cid} {hn}번 가설에 실험이 없음')
            sc = [int(x) for x in ice.split()]
            if len(sc) != 3 or not all(1 <= x <= 10 for x in sc):
                fail(f'ice.txt:{n} 점수는 1~10 세 개')
            m = re.fullmatch(r'([+-])(\d+(?:\.\d+)?)(%p|%)', target)
            if not m:
                fail(f'ice.txt:{n} 목표 변화 형식(+10%, +3%p, -20%): {target}')
            val = float(m.group(2)) * (1 if m.group(1) == '+' else -1)
            hs[int(hn) - 1]['test'].update({
                'ice': {'impact': sc[0], 'confidence': sc[1], 'ease': sc[2], 'score': round(sum(sc) / 3, 1)},
                'target': {'text': target, 'value': val, 'unit': 'pp' if m.group(3) == '%p' else 'relative'},
                'guardrail': guard, 'note': note})
    alsof = os.path.join(ROOT, 'db/meta/also.txt')
    if os.path.exists(alsof):
        for n, raw in enumerate(open(alsof, encoding='utf-8'), 1):
            line = raw.strip()
            if not line or line.startswith('//'):
                continue
            cid, _, st = line.partition(' | ')
            if cid not in byid or not byid[cid].get('saju'):
                fail(f'also.txt:{n} 없는 사례: {cid}')
            byid[cid]['saju']['also'] = [s.strip() for s in st.split(',') if s.strip()]
    VV = {'O': 'obvious', 'I': 'impossible', 'B': 'blindspot', 'T': 'timing'}
    for n, line in meta_lines(os.path.join(ROOT, 'db/saju/ideas.txt')):
        p = [x.strip() for x in line.split(' | ')]
        if len(p) != 7 or p[0] not in byid or p[1] not in VV:
            fail(f'saju/ideas.txt:{n} 형식: {line[:60]}')
        cid, v, role, why, bar, comp, rules = p
        byid[cid]['saju']['wny'] = {
            'verdict': VV[v], 'role': role, 'why_not_yet': why, 'barrier': bar,
            'competitors': [] if comp == '-' else [x.strip() for x in comp.split(',')],
            'compliance': [] if rules == '-' else [x.strip() for x in rules.split(',')]}
    FV = {'y': 'yes', 'n': 'no', '?': 'unknown'}
    for n, line in meta_lines(os.path.join(ROOT, 'db/saju/fit.txt')):
        p = [x.strip() for x in line.split(' | ')]
        if len(p) != 6 or p[0] not in byid:
            fail(f'saju/fit.txt:{n} 6칸: {line[:60]}')
        cid, prob, mech, conds, diff, verdict = p
        if prob not in ('same', 'similar', 'different') or verdict not in ('transfer', 'adapt', 'reject'):
            fail(f'saju/fit.txt:{n} 값: {prob} / {verdict}')
        cs = []
        for part in conds.split(';'):
            k, _, v = part.strip().rpartition('=')
            if v.strip() not in FV or not k:
                fail(f'saju/fit.txt:{n} 지원 조건 형식: {part}')
            cs.append({'condition': k.strip(), 'present': FV[v.strip()]})
        byid[cid]['saju']['fit'] = {'problem_match': prob, 'mechanism': mech, 'support_factors': cs,
                                    'key_difference': diff, 'verdict': verdict}
    for n, line in meta_lines(os.path.join(ROOT, 'db/meta/saju-ideas.txt')):
        cid, _, idea = line.partition(' | ')
        if cid not in byid or not idea:
            fail(f'saju-ideas.txt:{n} 형식: {line[:50]}')
        if byid[cid]['saju'].get('idea'):
            fail(f'saju-ideas.txt:{n} {cid}는 이미 아이디어가 있음')
        byid[cid]['saju']['idea'] = idea
        byid[cid]['saju']['idea_level'] = 'draft'
    nof = os.path.join(ROOT, 'db/meta/no-outcome.txt')
    for n, line in meta_lines(nof):
        cid, _, why = line.partition(' | ')
        if cid not in byid or not why:
            fail(f'no-outcome.txt:{n} 형식: {line}')
        byid[cid]['outcome_note'] = why
    segf = os.path.join(ROOT, 'db/meta/segments.txt')
    for n, line in meta_lines(segf):
        cid, _, body = line.partition(' | ')
        if cid not in byid:
            fail(f'segments.txt:{n} 없는 사례: {cid}')
        seg = {}
        if body.strip() != 'all':
            for part in body.split(';'):
                dim, _, vals = part.strip().partition(':')
                seg[dim] = [v.strip() for v in vals.split(',') if v.strip()]
        byid[cid]['saju']['segments'] = seg
        byid[cid]['saju']['segments_inferred'] = False
    for n, line in meta_lines(os.path.join(ROOT, 'db/meta/barrier-review.txt')):
        p = [x.strip() for x in line.split(' | ')]
        cid, _, hn = p[0].partition('#')
        if len(p) != 5 or cid not in byid or not hn.isdigit() or int(hn) > len(byid[cid]['hyps']):
            fail(f'barrier-review.txt:{n} 형식: {line[:50]}')
        byid[cid]['hyps'][int(hn) - 1]['barrier'] = {
            'type': p[1], 'holder': p[2], 'changed': '' if p[3] == '-' else p[3],
            'year': int(p[4]) if p[4].isdigit() else None, 'evidence': '', 'inferred': False, 'reviewed': True}
    for c in cases:
        if c.get('saju') and 'segments' not in c['saju']:
            c['saju']['segments'] = infer_segments(c)
            c['saju']['segments_inferred'] = True
        c.setdefault('outcome_note', None)
    swf = os.path.join(ROOT, 'db/meta/sowhat.txt')
    for n, line in meta_lines(swf):
        head, _, rest = line.partition(' | ')
        chain, _, sol = rest.partition(' || ')
        cid, _, hn = head.strip().partition(' ')
        steps = [x.strip() for x in chain.split(' > ') if x.strip()]
        if cid not in byid or not hn.isdigit() or not sol.strip() or len(steps) < 2:
            fail(f'sowhat.txt:{n} 형식: {line[:60]}')
        hi = int(hn)
        if hi < 1 or hi > len(byid[cid]['hyps']):
            fail(f'sowhat.txt:{n} {cid} 가설 번호 {hi} 없음')
        if byid[cid].get('so_what'):
            fail(f'sowhat.txt:{n} {cid} 중복')
        byid[cid]['so_what'] = {'hyp': hi, 'why_not_yet': byid[cid]['hyps'][hi - 1]['why_not_yet'],
                                'steps': steps, 'solution': sol.strip()}
    groups = {}
    for n, line in meta_lines(os.path.join(ROOT, 'db/meta/domains.txt')):
        g, _, toks = line.partition(' | ')
        for t in toks.split(','):
            groups[t.strip()] = g.strip()
    disputed = {}
    for n, line in meta_lines(os.path.join(ROOT, 'db/meta/disputed.txt')):
        cid, _, why = line.partition(' | ')
        if cid not in byid:
            fail(f'disputed.txt:{n} 없는 사례 {cid}')
        disputed[cid] = why
    for c in cases:
        c['domain_group'] = groups.get(c['domain'].split('·')[0].strip())
        c['refs'] = list(dict.fromkeys(c['refs']))
        c['source_status'] = 'disputed' if c['id'] in disputed else ('verified' if c['refs'] else 'unverified')
        c['source_note'] = disputed.get(c['id'])
        c['verified'] = bool(c['refs'])
        for h in c['hyps']:
            if 'barrier' not in h:
                h['barrier'] = infer_barrier(h)
        c.setdefault('so_what', None)
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
