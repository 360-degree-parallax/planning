"""우리 서비스 수치(baseline)로 병목 단계를 찾고, 그 단계의 사례·실험을 추천한다.

사용:
    python3 tools/diagnose.py                 # db/service/baseline.json, experiments.json, history/, cohorts.json → docs/diagnosis.md
    python3 tools/diagnose.py --example       # 가짜 예시 수치 → docs/diagnosis-example.md

퍼널 순서는 baseline.funnel이 가리키는 db/funnels/<id>.json에서 읽는다.
통과율은 항상 '그 순서에서 다음 단계 도달 / 이 단계 도달'로 계산하므로, 순서를 바꿔도 다시 돌리면 된다.
"""
import datetime as dt, glob, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stats

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
ROLE = {'diff': (0, '차별'), 'table': (1, '기본기'), 'risk': (2, '위험'), 'skip': (3, '보류')}
FIT = {'transfer': (0, '그대로'), 'adapt': (1, '바꿔서'), 'reject': (2, '버림')}
VERD = {'obvious': '뻔함', 'impossible': '불가능', 'blindspot': '맹점', 'timing': '타이밍'}


def pct(x, d=1):
    return '–' if x is None else f'{x * 100:.{d}f}%'


def num(x):
    return '–' if x is None else f'{x:,.0f}'


def rates(f, reach):
    out = []
    steps = f['steps']
    for i, s in enumerate(steps):
        r = reach.get(s['id'])
        nxt = reach.get(steps[i + 1]['id']) if i + 1 < len(steps) else None
        rate = nxt / r if r and nxt is not None else None
        out.append({**s, 'reach': r, 'next': nxt, 'rate': rate, 'lost': (r - nxt) if rate is not None else None})
    return out


def metric_rates(R, pi):
    """지표 id → (기준 통과율, 분모 단계 index). 단계 지표 + 여러 단계를 묶은 지표."""
    m = {s['metric']: (s['rate'], i) for i, s in enumerate(R) if s.get('metric') and s['rate'] is not None}
    ck = next((i for i, s in enumerate(R) if s['stage'] == 'checkout'), None)
    if ck is not None and R[ck]['reach']:
        m['checkout_conv'] = (R[pi]['reach'] / R[ck]['reach'], ck)
    if R[0]['reach']:
        m['first_pay_conv'] = (R[pi]['reach'] / R[0]['reach'], 0)
    return m


def covers(metric, mr, i, pi):
    if metric not in mr:
        return False
    start = mr[metric][1]
    if metric in ('checkout_conv', 'first_pay_conv'):
        return start <= i < pi
    return start == i


def seasons(cal, start, end):
    """기간과 겹치는 시즌 이름 목록"""
    if not start:
        return []
    a = dt.date.fromisoformat(start)
    b = dt.date.fromisoformat(end) if end else a
    hit = []
    for s in cal['recurring']:
        for y in range(a.year - 1, b.year + 1):
            f = dt.date.fromisoformat(f'{y}-{s["from"]}')
            t = dt.date.fromisoformat(f'{y + (1 if s["to"] < s["from"] else 0)}-{s["to"]}')
            if f <= b and a <= t:
                hit.append(s['label'])
                break
    for s in cal['dated']:
        if s['from'] and dt.date.fromisoformat(s['from']) <= b and a <= dt.date.fromisoformat(s['to'] or s['from']):
            hit.append(s['label'])
    return hit


def ideas_for(deep, s, si, mr, pi):
    cand = []
    for c in deep:
        stages = {c['saju']['stage'], *c['saju'].get('also', [])}
        for n, h in enumerate(c['hyps'], 1):
            t = h.get('test')
            if not t or 'ice' not in t:
                continue
            exact = covers(t['metric'], mr, si, pi)
            if exact or s['stage'] in stages:
                w, fit = c['saju'].get('wny') or {}, c['saju'].get('fit') or {}
                key = (not exact, ROLE.get(w.get('role'), (9,))[0], FIT.get(fit.get('verdict'), (9,))[0], -t['ice']['score'])
                cand.append((key, c, n, t, exact))
    cand.sort(key=lambda x: x[0])
    return cand


def main():
    ex = '--example' in sys.argv
    sfx = '.example' if ex else ''
    base = J(f'db/service/baseline{sfx}.json')
    exps = J(f'db/service/experiments{sfx}.json')
    cohorts = J(f'db/service/cohorts{sfx}.json')['cohorts']
    hist = [json.load(open(p, encoding='utf-8')) for p in sorted(glob.glob(os.path.join(ROOT, f'db/service/history{sfx}/*.json')))]
    out = os.path.join(ROOT, f'docs/diagnosis{"-example" if ex else ""}.md')
    f = J(f"db/funnels/{base['funnel']}.json")
    tax, db, bm, cal = J('db/taxonomy.json'), J('db/cases.json'), J('db/benchmarks.json'), J('db/service/calendar.json')
    rules = {r['id']: r for r in J('db/compliance.json')['rules']}
    M = tax['metrics']
    if not any(v for v in base['reach'].values()):
        print('db/service/baseline.json의 reach(단계별 도달 수)를 채운 뒤 다시 실행하세요. 예시는 --example')
        return
    days = base['period'].get('days') or 30
    R = rates(f, base['reach'])
    pi = next(i for i, s in enumerate(R) if s.get('purchase'))
    first, buyers = R[0]['reach'], R[pi]['reach']
    bmk = {}
    for b in bm['items']:
        if b.get('value') is not None:
            bmk.setdefault(b['metric'], b)
    alias = {}
    for line in open(os.path.join(ROOT, 'db/meta/aliases.txt'), encoding='utf-8'):
        if line.strip() and not line.startswith('//'):
            a, b = [x.strip() for x in line.split('|')]
            alias[a] = b
    for e_ in exps:
        e_['case'] = alias.get(e_['case'], e_['case'])
    tested = {(e['case'], e['hyp']): e for e in exps}
    deep = [c for c in db['cases'] if c['depth'] == 'deep']
    by_id = {c['id']: c for c in db['cases']}
    L = [f"# 진단 리포트{' (예시: 가짜 숫자)' if ex else ''}", '',
         f"기간 {base['period'].get('from')} ~ {base['period'].get('to')} ({days}일) · 퍼널 `{f['id']}` v{f['version']} ({f['label']})",
         '', '`python3 tools/diagnose.py`로 다시 만든다. 기준값은 업종·정의가 달라 참고선으로만 본다.', '']
    if base.get('funnel_version') != f['version']:
        L += [f"> 경고: 이 수치는 퍼널 v{base.get('funnel_version')} 기준인데 현재 설정은 v{f['version']}입니다.", '']
    ss_ = seasons(cal, base['period'].get('from'), base['period'].get('to'))
    if ss_:
        L += [f"> 시즌 주의: 이 기간은 **{', '.join(ss_)}**과 겹칩니다. 평소 수치와 다를 수 있습니다.", '']

    # 1. 퍼널
    L += ['## 1. 퍼널', '', '| # | 단계 | 도달 | 다음 단계로 | 통과율 | 이탈 | 참고 기준값 |', '|---|---|---|---|---|---|---|']
    for i, s in enumerate(R):
        b = bmk.get(s.get('metric'))
        L.append(f"| {i + 1} | {s['label']} | {num(s['reach'])} | {num(s['next'])} | {pct(s['rate'])} | {num(s['lost'])} | "
                 f"{f'{pct(b['value'])} ({b['source']})' if b else ''} |")
    bad = [s['label'] for s in R if s['rate'] is not None and s['rate'] > 1]
    if bad:
        L += ['', f"> 경고: {', '.join(bad)} 다음 단계 도달 수가 더 많습니다. 퍼널 순서를 바꿨다면, 그 순서로 다시 모은 도달 수를 넣어야 합니다."]
    conv = buyers / first if first else None
    L += ['', f"- 첫 단계 → 결제 성공: **{pct(conv, 2)}** (구매자 {num(buyers)}명)"]
    ck = next((s for s in R if s['stage'] == 'checkout'), None)
    if ck and ck['reach']:
        L.append(f"- 결제 페이지 → 결제 성공: {pct(buyers / ck['reach'])} (참고: 이커머스 장바구니 → 주문 평균 약 29.8%, Baymard)")
    L.append('')

    # 2. 병목 (이탈 + 고치기 쉬움)
    mr = metric_rates(R, pi)
    pre = [s for s in R[:pi] if s['rate'] is not None]
    for s in pre:
        si = R.index(s)
        s['gain'] = buyers * ((s['rate'] + (1 - s['rate']) / 2) / s['rate'] - 1)
        cand = [x for x in ideas_for(deep, s, si, mr, pi) if x[4] and (x[1]['saju'].get('wny') or {}).get('role') != 'skip']
        s['ease'] = max((x[3]['ice']['ease'] for x in cand), default=3)
        s['prio'] = s['gain'] * s['ease'] / 10
    pre.sort(key=lambda s: -s['prio'])
    aov = base['economics'].get('aov')
    L += ['## 2. 병목 순위 (구매 전 단계)', '',
          '이탈 절반을 되살렸을 때 늘어나는 구매자에, 그 단계를 직접 재는 실험 중 가장 쉬운 것의 쉬움 점수(1~10)를 곱해 줄 세웠다. 실험이 없으면 쉬움 3으로 본다.', '',
          '| 순위 | 단계 | 통과율 | 이탈 절반 회복 시 구매자 | 월 매출 | 쉬움 | 우선순위 점수 |', '|---|---|---|---|---|---|---|']
    for i, s in enumerate(pre):
        L.append(f"| {i + 1} | {s['label']} | {pct(s['rate'])} | +{num(s['gain'])}명 | "
                 f"{'+' + num(s['gain'] * aov * 30 / days) + '원' if aov else '–'} | {s['ease']} | {num(s['prio'])} |")
    L.append('')

    # 3. 추천 실험
    L += ['## 3. 병목 단계별 추천 실험', '',
          '정렬: 이 단계를 직접 재는 실험 → 아이디어 역할(차별 > 기본기 > 위험 > 보류) → 적합성(그대로 > 바꿔서 > 버림) → ICE. 표본 수는 군당, 유의수준 5%·검정력 80%.', '',
          '- **판정·역할**: 우리 아이디어의 Why not yet. 뻔함+기본기는 "안 하면 손해지만 차별은 아님"', '- **적합성**: 원 사례가 통한 이유가 우리에게도 있는가', '']
    for s in pre[:3]:
        si = R.index(s)
        cand = ideas_for(deep, s, si, mr, pi)
        L += [f"### {s['label']} (통과율 {pct(s['rate'])}, 하루 {num(s['reach'] / days)}명 도달)", '',
              '| 사례 | 실험 | 판정·역할 | 적합성 | ICE | 목표 | 군당 표본 | 예상 기간 | 확인할 규정 | 기록 |', '|---|---|---|---|---|---|---|---|---|---|']
        for _, c, n, t, exact in cand[:6]:
            base_rate, start = mr.get(t['metric'], (None, None))
            ssz = stats.sample_size(base_rate, t['target']) if exact else None
            d0 = R[start]['reach'] / days if start is not None else 0
            dur = f'{max(7, math.ceil(2 * ssz / d0))}일' if ssz and d0 else ('다른 단계 지표' if not exact else '–')
            w, fit = c['saju'].get('wny') or {}, c['saju'].get('fit') or {}
            e = tested.get((c['id'], n))
            L.append(f"| `{c['id']}` {n} | {t['experiment']} | {VERD.get(w.get('verdict'), '–')}·{ROLE.get(w.get('role'), (0, '–'))[1]} | "
                     f"{FIT.get(fit.get('verdict'), (0, '–'))[1]} | {t['ice']['score']} | {t['target']['text']} | {num(ssz) if ssz else '–'} | {dur} | "
                     f"{', '.join(w.get('compliance', [])) or '–'} | {f'{e['id']} {e['result']}' if e else ''} |")
        L += ['', '먼저 확인할 조건 (적합성 검증에서 "모름"인 것, 위 3개 아이디어):', '']
        for _, c, n, t, exact in cand[:3]:
            unk = [x['condition'] for x in (c['saju'].get('fit') or {}).get('support_factors', []) if x['present'] == 'unknown']
            no = [x['condition'] for x in (c['saju'].get('fit') or {}).get('support_factors', []) if x['present'] == 'no']
            line = f"- `{c['id']}`: {' / '.join(unk) if unk else '없음'}"
            if no:
                line += f" · 우리에게 없는 조건: {' / '.join(no)}"
            L.append(line)
        tg = [c['id'] for c in db['cases'] if c['depth'] != 'deep' and s['stage'] in {c['saju']['stage'], *c['saju'].get('also', [])}]
        L += ['', f"같은 단계의 분류 사례 {len(tg)}개: {', '.join(f'`{x}`' for x in tg[:12])}{' …' if len(tg) > 12 else ''}" if tg else '같은 단계의 분류 사례: 없음', '']

    # 4. 세그먼트
    weak = []
    if base.get('segments'):
        L += ['## 4. 세그먼트', '', '전체보다 통과율이 20% 이상 낮은 칸을 **굵게** 표시했다.', '',
              '| 세그먼트 | ' + ' | '.join(s['label'] for s in R[:pi]) + ' | 구매 전환 |', '|---|' + '---|' * (pi + 1)]
        for g in base['segments']:
            gr = rates(f, g['reach'])
            cells = []
            for a, b in zip(gr[:pi], R[:pi]):
                low = a['rate'] is not None and b['rate'] and a['rate'] < b['rate'] * 0.8
                cells.append(f"**{pct(a['rate'])}**" if low else pct(a['rate']))
            gc = g['reach'].get(R[pi]['id']) / g['reach'].get(R[0]['id']) if g['reach'].get(R[0]['id']) else None
            seg = tax['segments'].get(g['dim'], {}).get('label', g['dim'])
            L.append(f"| {seg}: {g['value']} | " + ' | '.join(cells) + f' | {pct(gc, 2)} |')
            ws = [b for a, b in zip(gr[:pi], R[:pi]) if a['rate'] is not None and b['rate'] and a['rate'] < b['rate'] * 0.8]
            if ws or (gc is not None and conv and gc < conv * 0.8):
                weak.append((g, seg, ws))
        L.append('')
        for g, seg, ws in weak:
            hit = []
            for c in deep:
                if g['value'] not in (c['saju'].get('segments') or {}).get(g['dim'], []):
                    continue
                stages = {c['saju']['stage'], *c['saju'].get('also', [])}
                on = [b['label'] for b in ws if b['stage'] in stages]
                hit.append((not on, c, on))
            hit.sort(key=lambda x: x[0])
            L += [f"**{seg}: {g['value']}** 약한 단계: {', '.join(b['label'] for b in ws) or '구매 전환 전체'}", '']
            for _, c, on in hit[:5]:
                L.append(f"- `{c['id']}` {c['title']}{' (같은 단계)' if on else ''}: {c['saju']['idea']}")
            if not hit:
                L.append('- 이 세그먼트로 태깅된 핵심 사례가 없습니다. `db/meta/segments.txt`에 추가하면 여기 나옵니다.')
            L.append('')

    # 5. 수익 구조
    e = base['economics']
    if e.get('aov'):
        cac = e['ad_spend'] / buyers if e.get('ad_spend') and buyers else None
        pre_cac = e['aov'] * (1 - (e.get('pg_fee_rate') or 0) - (e.get('refund_rate') or 0)) - (e.get('llm_cost_per_report') or 0)
        cm = pre_cac - cac if cac is not None else None
        free = (first - buyers) * e['free_llm_cost_per_visitor'] if e.get('free_llm_cost_per_visitor') else None
        rev = buyers * e['aov']
        L += ['## 5. 수익 구조 (주문 1건 기준)', '', '| 항목 | 값 |', '|---|---|',
              f"| 객단가 | {num(e['aov'])}원 |",
              f"| CAC 제외 공헌이익 (객단가 − PG 수수료 − 환불 − LLM 원가) | {num(pre_cac)}원 |",
              f"| 구매자 1명당 CAC (광고비 / 구매자) | {num(cac)}원 |",
              f"| 공헌이익 (CAC 포함) | **{num(cm)}원** |",
              f"| CAC 회수에 필요한 구매 횟수 | {f'{cac / pre_cac:.2f}회' if cac and pre_cac > 0 else '–'} |",
              f"| ROAS | {f'{e['ad_revenue'] / e['ad_spend']:.2f}' if e.get('ad_revenue') and e.get('ad_spend') else '–'} |",
              f"| 무료 구간 원가 (비구매자 × 1인당 LLM) | {num(free)}원 ({pct(free / rev) if free and rev else '–'} of 매출) |",
              f"| 할인 의존도 | {pct(e.get('discount_share'))} |", '']
        if cm is not None and cm < 0:
            L += ['> 공헌이익이 음수입니다. 전환율 실험보다 CAC·원가를 먼저 봐야 합니다.', '']

    # 6. 추세와 재구매 선행 지표
    pp = base.get('post_purchase') or {}
    if hist:
        L += ['## 6. 월별 추세', '', '| 월 | ' + ' | '.join(s['label'] for s in R[:pi]) + ' | 구매 전환 | 시즌 |', '|---|' + '---|' * (pi + 2)]
        for h in hist:
            hr = rates(f, h['reach'])
            hc = h['reach'][R[pi]['id']] / h['reach'][R[0]['id']]
            L.append(f"| {h['period']['from'][:7]} | " + ' | '.join(pct(x['rate']) for x in hr[:pi]) +
                     f" | {pct(hc, 2)} | {', '.join(seasons(cal, h['period']['from'], h['period']['to'])) or ''} |")
        L.append('')
        rp = [h['post_purchase'].get('repeat_pay_rate') for h in hist]
        lead = tax['payment_tree'].get('leading', {}).get('repeat_pay_rate', [])
        if len(hist) >= 4 and all(v is not None for v in rp):
            L += ['### 재구매 선행 지표 검증', '',
                  f'월별 값 {len(hist)}개로 재구매율과의 상관을 봤다. 표본이 작아 방향만 참고하고, 6개월 이상 쌓이면 다시 본다. 상관은 인과가 아니다.', '',
                  '| 지표 | 최근 값 | 재구매율과 상관 | 판단 |', '|---|---|---|---|']
            for k in lead:
                xs = [h['post_purchase'].get(k) for h in hist]
                if any(v is None for v in xs):
                    continue
                r = stats.pearson(xs, rp)
                judge = '함께 움직임 (선행 후보)' if r is not None and r >= 0.7 else ('약함' if r is not None and r >= 0.3 else '관계 없음')
                last = f'{xs[-1]} / 5' if k == 'satisfaction_score' else pct(xs[-1])
                L.append(f"| {M[k]['label']} | {last} | {r:.2f} | {judge} |" if r is not None else f"| {M[k]['label']} | {last} | – | – |")
            L.append('')
    elif any(v is not None for v in pp.values()):
        L += ['## 6. 재구매 선행 지표', '', '월별 기록(`db/service/history/`)이 4개월 이상 쌓이면 재구매율과의 상관을 계산한다.', '', '| 지표 | 값 |', '|---|---|']
        for k, v in pp.items():
            if v is not None:
                L.append(f"| {M.get(k, {}).get('label', k)} | {f'{v}일' if k == 'time_to_repurchase' else (f'{v} / 5' if k == 'satisfaction_score' else pct(v))} |")
        L.append('')

    # 7. 코호트
    if cohorts:
        L += ['## 7. 첫 구매 월별 재구매 코호트', '', '| 첫 구매 월 | 구매자 | 30일 | 60일 | 90일 | 180일 |', '|---|---|---|---|---|---|']
        for c in cohorts:
            L.append(f"| {c['cohort']} | {num(c['buyers'])} | " + ' | '.join(pct(c['repeat'].get(k)) for k in ('30', '60', '90', '180')) + ' |')
        L += ['', '같은 경과일 칸을 위에서 아래로 읽으면 최근 코호트가 나아지는지 보인다. 빈칸은 아직 그만큼 시간이 지나지 않은 것.', '']

    # 8. 실험 기록
    if exps:
        L += ['## 8. 실험 기록', '', '| id | 사례 | 지표 | 군 | 대조 → 실험 | 상대 변화 | p값 (기준) | 방문자당 매출 | 결과 | 점검 |', '|---|---|---|---|---|---|---|---|---|---|']
        for x in exps:
            arms = x['arms']
            alpha = stats.bonferroni(0.05, len(arms))
            flags = []
            srm_p = stats.srm([a['n'] for a in arms], x.get('planned_split'))
            if srm_p < 0.001:
                flags.append(f'배정 비율 이상(SRM p={srm_p:.4f}): 결과 해석 보류')
            if x.get('start') and x.get('end'):
                dur = (dt.date.fromisoformat(x['end']) - dt.date.fromisoformat(x['start'])).days + 1
                if dur < 7:
                    flags.append(f'{dur}일만 실행(최소 7일)')
            if x['result'] in ('win', 'lose') and x.get('planned_end') and x.get('end') and x['end'] < x['planned_end']:
                flags.append('계획보다 일찍 결론(중간 확인 후 멈춤 위험)')
            if x['result'] in ('win', 'lose') and x.get('planned_n') and min(a['n'] for a in arms) < x['planned_n'] * 0.9:
                flags.append('계획 표본 미달')
            sz = seasons(cal, x.get('start'), x.get('end'))
            if sz:
                flags.append('시즌 겹침: ' + ', '.join(sz))
            if x.get('funnel_version') != f['version'] or x.get('funnel') != f['id']:
                flags.append('퍼널 버전 다름')
            need = set((by_id.get(x['case'], {}).get('saju', {}).get('wny') or {}).get('compliance', []))
            miss = need - set(x.get('compliance_checked', []))
            if miss:
                flags.append('규정 미확인: ' + ', '.join(sorted(miss)))
            if not (x.get('guardrail') or {}).get('ok', None):
                flags.append('가드레일 ' + {False: '위반', None: '미확인'}[(x.get('guardrail') or {}).get('ok')])
            for j, b in enumerate(arms[1:], 1):
                p1, p2, lift, pv = stats.ztest(arms[0], b)
                rpv = '–'
                if 'revenue_sum' in arms[0] and 'revenue_sum' in b:
                    m1, m2, rl, rp_ = stats.welch(arms[0], b)
                    rpv = f'{num(m1)} → {num(m2)}원 ({pct(rl)}, p={rp_:.3f})'
                sig = '유의' if pv < alpha else '유의하지 않음'
                L.append(f"| {x['id'] if j == 1 else ''} | `{x['case']}` {x['hyp']} | {M[x['metric']]['label'] if j == 1 else ''} | {b['name']} | "
                         f"{pct(p1)} → {pct(p2)} | {pct(lift)} | {pv:.3f} ({alpha:.3f}, {sig}) | {rpv} | {x['result'] if j == 1 else ''} | "
                         f"{'<br>'.join(flags) if j == 1 else ''} |")
        L += ['', '군이 3개 이상이면 유의 기준을 (군 수 − 1)로 나눴다(본페로니). 규칙 전문은 `docs/experiment-rules.md`.', '']
    open(out, 'w', encoding='utf-8').write('\n'.join(L))
    print(os.path.relpath(out, ROOT), len(L), 'lines')


if __name__ == '__main__':
    main()
