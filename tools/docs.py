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
L = [f'# 우리 아이디어 검증표 (deep {sum(1 for c in db["cases"] if c["depth"] == "deep")}개)', '',
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


# 본질 파악 체인
cs = J('db/cases.json')['cases']
MODE = {'break': '관습 파괴', 'shift': '조건 변화', 'other': '기타'}
L = ['# 본질 파악·구조화 체인', '',
     '목표는 **본질 파악**이다. 가설을 세우는 힘과 가설을 부수는 힘을 함께 쓴다.', '',
     '| 단계 | 이 DB에서 | 무엇을 묻나 |', '|---|---|---|',
     '| 분석 A. 5 Why (과정) | 5 Why | 증상에서 "왜?"를 3~5번 파고들어 근본 원인까지 간다 |',
     '| 분석 B. PEST | PEST | 정치·법(P)과 기술(T) 위주로 본다. 경제·사회는 참고만 |',
     '| 분석 C. SWOT(SO·WO·ST) | SWOT | 강점으로 잡을 기회(SO), 기회로 옮겨 가려고 메울 약점(WO), 강점으로 막을 위협(ST). 약점이면서 기회도 없는 WT는 뺀다 |',
     '| 분석 D. 3C | 3C | 고객·경쟁·자사를 보고 고객이 원하는데 경쟁은 못 채우고 자사는 채울 수 있는 빈자리를 찾는다 |',
     '| 1. 제한없는 가설설정 | 가설 목록 | 가능한 해법을 제한 없이 모두 적는다 |',
     '| 2. 의심 | Why not yet | 클라이언트·업계의 가설을 의심한다: 왜 아무도 안 했나 |',
     '| 3. 관습과 파괴 (과정) | 관습 파괴 체인 | 그 관습을 깨면 무엇이 열리나: "그래서?"를 반복한다 (타이밍형은 "조건 변화") |',
     '| So what (결론) | So what | 5 Why와 관습 파괴 과정을 거쳐 내린 결론 한 문장 |',
     '| 4. 긍정 오피니언 | 긍정 오피니언 | 핵심 고객은 왜 좋아하나 |',
     '| 5. 안티오피니언 | 안티오피니언 | 안 쓰는 사람·떠난 사람·비판자는 뭐라 하나 |',
     '| 6. 트레이드온 | 트레이드온 | 둘 중 하나라던 것을 어떻게 둘 다 잡았나 |',
     '| 7. 목표 재분석 | 목표 재분석 | 처음 목표를 본질에 맞게 다시 정의하면 무엇인가 |',
     '| 8. 이슈트리 | 이슈트리 | 재정의한 목표를 MECE로 쪼개면 어느 가지를 공략했나 |',
     '| 9. 파레토 | 파레토(속도×임팩트) | 이슈트리 하위 이슈를 속도·임팩트로 매겨 중요한 소수만 고른다 |',
     '| 10. 대체 왜 | 대체 왜 | 이 목표를 대체 왜 원하나를 다시 의심해 진짜 사업 의도(매출·이익·유지 등)를 찾고, 그 의도를 올려야 하는지(올리기) 낮아지지만 않으면 되는지(지키기) 정한다 |',
     '| 11. 중요 지표 선별 | 핵심 지표 | 의도 지표(진짜 의도), 북극성 1개(목표 지표), 선행 지표 1~3개, 가드레일 1개, 허영 지표(쫓지 않음), 선별 방법 |', '',
     '사분면: 퀵윈(속도 4+·임팩트 4+), 큰 베팅(속도 3 이하·임팩트 4+), 잡일(속도 4+·임팩트 3 이하), 보류(나머지). 임팩트 4 미만은 선별하지 않는다.', '',
     '분석 A~D와 1~6은 문제를 깨닫고 본질을 찾는 단계, 7~11은 찾은 문제를 구조화하고 중요한 것만 남기는 단계다. 분석 A~D, So what 결론, 4·5·7~11은 deep 사례에만 직접 작성돼 있다(일반 사례의 So what 결론은 과정 마지막 단계를 자동으로 쓴다).', '',
     '- 해결은 그 사례가 실제로 한 것이다. 체인·오피니언·트레이드온은 그 해결이 왜 그 모양이 되었는지를 보여 주는 해석이다.',
     '- 오피니언 출처가 "추정"인 것은 사례 내용에서 도출한 해석이며 실제 발언 기록이 아니다. 출처 URL이 붙은 것만 실제 목소리에 근거한다.',
     '- 긍정·안티 오피니언은 deep 사례에만 있다. 원본: `db/meta/sowhat.txt`, `db/meta/pro.txt`, `db/meta/anti.txt`, `db/meta/tradeon.txt`', '']
groups = {}
for c in cs:
    groups.setdefault(c.get('domain_group') or '기타', []).append(c)
def op(o):
    src = '추정' if o['inferred'] else f"[출처]({o['source']})"
    return f"{o['who']}: \"{o['says']}\" → {o['reveals']} ({src})"
for g, items in groups.items():
    L += [f'## {g} ({len(items)})', '']
    for c in items:
        sw = c['so_what']
        h = c['hyps'][sw['hyp'] - 1]
        L.append(f"### `{c['id']}` {c['title']}")
        L.append(f"- **문제**: {c['what']['problem']}")
        if c.get('five_why'):
            fw = c['five_why']
            L.append(f"- **5 Why (과정)**: {' → '.join(fw['whys'])}")
            L.append(f"  - 근본 원인: {fw['root_cause']}")
        if c.get('pest'):
            pe = c['pest']
            lab = {'P': '정치·법', 'E': '경제', 'S': '사회', 'T': '기술'}
            foc = ', '.join(lab[k] for k in pe['focus']) or 'P·T 영향 적음'
            L.append(f"- **PEST (P·T 중심)**: 정치·법 {pe['political']} / 기술 {pe['technological']} (P·T 핵심: {foc})")
            L.append(f"  - 참고(비중 낮음): 경제 {pe['economic']} / 사회 {pe['social']}")
        if c.get('swot'):
            sw2 = c['swot']
            L.append(f"- **SWOT (SO·WO·ST, WT 제외)**: SO = 강점 '{sw2['strength']}'로 기회 '{sw2['opportunity']}'를 잡는다 → {sw2['so']}")
            L.append(f"  - WO = 기회로 옮겨 가려고 약점 '{sw2['weakness']}'을 메운다 → {sw2['wo']}")
            if sw2.get('st'):
                L.append(f"  - ST = 강점 '{sw2['strength']}'로 위협 '{sw2['threat']}'을 막는다 → {sw2['st']}")
        if c.get('three_c'):
            tc = c['three_c']
            L.append(f"- **3C**: 고객 {tc['customer']} / 경쟁 {tc['competitor']} / 자사 {tc['company']}")
            L.append(f"  - 빈자리: {tc['gap']}")
            if tc.get('overlap'):
                ov = tc['overlap']
                OVN = {'A': '고객만', 'B': '고객∩경쟁', 'C': '고객∩자사', 'D': '셋 다', 'E': '경쟁∩자사', 'F': '경쟁만', 'G': '자사만', 'H': '밖'}
                L.append("  - 3C 겹침: " + ' / '.join(f"{k} {OVN[k]} {ov[k]}" for k in 'ABCDEFGH'))
                L.append(f"  - 우리 상황에 맞는 시장(진입): **{', '.join(tc['entry'])}** — {tc['entry_why']}")
        if c.get('ansoff'):
            AN = {'penetration': '시장침투(기존 제품·기존 시장)', 'product_dev': '신제품개발(신제품·기존 시장)', 'market_dev': '시장개척(기존 제품·신시장)', 'diversify': '다각화(신제품·신시장, 최종 목표)'}
            L.append(f"- **앤소프**: {AN[c['ansoff']['cell']]}{' **[집중 전략]**' if c['ansoff']['focus'] else ''} — {c['ansoff']['why']}")
            if c.get('bcg'):
                B = {'star': '스타', 'cash_cow': '캐시카우', 'question': '물음표', 'dog': '개', 'exit': '철수'}
                b = c['bcg']
                L.append(f"- **BCG**: {', '.join(u['name'] + '=' + B[u['cell']] for u in b['units'])} → {b['target']} {B[b['before']]} → {B[b['after']]}{' **[유망주→스타]**' if b['q_to_star'] else ''} — {b['why']}")
        L.append(f"- **가설 {sw['hyp']}**: {h['text']}")
        L.append(f"- **의심 (Why not yet)**: {sw['why_not_yet']}")
        for k, st in enumerate(sw['steps'], 1):
            L.append(f"- **{MODE[sw['mode']]} 과정 {k}**: {st}")
        L.append(f"- **So what (결론)**: {sw['conclusion']}{' (과정 마지막 단계에서 자동)' if sw.get('conclusion_auto') else ''}")
        if c.get('pro_opinion'):
            L.append(f"- **긍정 오피니언**: {op(c['pro_opinion'])}")
        if c.get('anti_opinion'):
            L.append(f"- **안티오피니언**: {op(c['anti_opinion'])}")
        L.append(f"- **트레이드온**: {c['trade_on']['tradeoff']} → {c['trade_on']['how']}")
        if c.get('goal'):
            g = c['goal']
            L.append(f"- **목표 재분석**: {g['surface']} → {g['reframed']} (지표: {g['metric']})")
        if c.get('issue_tree'):
            t = c['issue_tree']
            L.append(f"- **이슈트리**: {t['root']}")
            for b in t['branches']:
                mark = ' ← 공략' if b['chosen'] else ''
                L.append(f"  - {'**' + b['issue'] + '**' if b['chosen'] else b['issue']}: {', '.join(b['sub'])}{mark}")
            L.append(f"  - 고른 이유: {t['why']}")
        if c.get('pareto'):
            pa = c['pareto']
            src = '추정' if pa['inferred'] else f"[근거]({pa['source']})"
            L.append(f"- **파레토**: {pa['vital_few']} → {pa['effect']} ({src})")
            if pa.get('matrix'):
                Q = {'quick_win': '퀵윈', 'big_bet': '큰 베팅', 'chore': '잡일', 'drop': '보류'}
                sel = [f"{i['issue']}({i['speed']}/{i['impact']}·{Q[i['quadrant']]})" for i in pa['matrix'] if i['selected']]
                L.append(f"  - 속도×임팩트 선별: {', '.join(sel)} — {pa['why']}")
        if c.get('deep_why'):
            dw = c['deep_why']
            IT = {'revenue': '매출', 'profit': '이익·원가', 'retention': '유지·재구매', 'growth': '성장', 'risk': '위험', 'trust': '신뢰', 'mission': '사명'}
            L.append(f"- **대체 왜**: {' → '.join(dw['whys'])}")
            L.append(f"  - 진짜 의도({IT[dw['type']]}): {dw['intent']} (의도 지표: {dw['intent_metric']})")
            if dw.get('mode'):
                L.append(f"  - 의도 방향: {'올리기' if dw['mode'] == 'raise' else '지키기(낮아지지만 않으면 됨)'} — {dw['criterion']}")
        if c.get('key_metrics'):
            k = c['key_metrics']
            L.append(f"- **중요 지표**: 의도 {k.get('intent_metric', '-')} / 북극성 {k['north_star']} / 선행 {', '.join(k['leading'])} / 가드레일 {k['guardrail']} / 허영(쫓지 않음) {k['vanity']}")
            if k.get('select_method'):
                M = {'fgi': 'FGI', 'interview': '인터뷰', 'observation': '관찰', 'voc': '고객 목소리 데이터', 'quant': '정량 분석', 'survey': '설문 기법', 'experiment': '실험', 'scoring': '내부 점수화'}
                sm = k['select_method']
                src = '추정' if sm['inferred'] else f"[근거]({sm['source']})"
                L.append(f"  - 선별 방법: {', '.join(M[x] for x in sm['methods'])} — {sm['how']} ({src})")
        L.append(f"- **해결**: {sw['solution']}")
        L.append('')
write('docs/so-what.md', L)

# 3C Section A 디깅: 고객 니즈는 있는데 아직 아무도 들어가지 않은 영역
_cs = J('db/cases.json')
_cs = _cs['cases'] if isinstance(_cs, dict) else _cs
A_ok = [c for c in _cs if 'A' in c['three_c']['entry'] and '(실패)' not in c['three_c']['entry_why']]
A_fail = [c for c in _cs if 'A' in c['three_c']['entry'] and '(실패)' in c['three_c']['entry_why']]
L = ['# 3C Section A 디깅: 니즈는 있는데 아직 아무도 들어가지 않은 영역', '',
     '`db/cases.json`에서 생성(`tools/docs.py`). 3C 겹침에서 진입 칸으로 A를 고른 사례만 모았다.',
     'A가 왜 아직 비어 있는지는 곧 **의심(Why not yet)**의 답이다. 그래서 사례마다 A 칸, Why not yet, So what 결론을 나란히 둔다.', '',
     '- A: 고객 니즈는 있는데 아직 아무도 들어가지 않은 영역',
     '- E: 현재 고객은 없지만 경쟁사와 우리가 싸우는 영역',
     '- H: 아무도 아직 발견하지 못해 언제 G·A·F가 될지 알 수 없는 영역', '',
     '## A를 진짜 A로 확인하는 질문', '',
     '1. 니즈가 진짜인가: 고객이 지금 다른 방법(돈·시간·불편)으로 이 문제를 버티고 있나? 버티는 행동이 없으면 A가 아니라 H다.',
     '2. 왜 아직 비었나(Why not yet): 통념, 강자의 수익원 충돌, 비고객이라 안 보임, 기술·제도가 막 열림, 작다고 무시, 신뢰 장치 부재 중 무엇인가?',
     '3. 우리는 들어갈 수 있나: 들어가는 순간 A는 C(우리만 채움)가 된다. C로 만들 역량이 없으면 A는 그림의 떡이다.',
     '4. 얼마나 버티나: 경쟁이 따라오면 C는 B·D가 된다. 따라오기 어렵게 만드는 장치(데이터, 네트워크, 규제, 원가)가 있나?', '',
     f'## 진입 A 사례 {len(A_ok)}건', '']
cur = None
for c in sorted(A_ok, key=lambda x: (x['domain_group'], x['id'])):
    if c['domain_group'] != cur:
        cur = c['domain_group']
        L += ['', f'### {cur}', '', '| 사례 | A (빈 니즈) | 왜 아직 비었나 (Why not yet) | So what |', '|---|---|---|---|']
    t = c['three_c']
    L.append(f"| {c['title']} (`{c['id']}`) | {t['overlap']['A']} | {c['so_what']['why_not_yet']} | {c['so_what']['conclusion']} |")
L += ['', f'## A를 봤지만 실패한 사례 {len(A_fail)}건', '',
      'A가 맞아도 C로 만들지 못하면 실패한다. 니즈 검증, 단위 경제, 안전 장치 중 무엇이 빠졌는지 본다.', '',
      '| 사례 | A (빈 니즈) | 왜 실패했나 |', '|---|---|---|']
for c in A_fail:
    t = c['three_c']
    L.append(f"| {c['title']} (`{c['id']}`) | {t['overlap']['A']} | {t['entry_why'].replace('(실패) ', '')} |")
write('docs/3c-section-a.md', L)
