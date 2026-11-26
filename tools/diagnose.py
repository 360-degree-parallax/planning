"""우리 서비스 수치(baseline)로 병목 단계를 찾고, 그 단계의 사례·실험을 추천한다.

사용:
    python3 tools/diagnose.py                 # db/service/baseline.json, experiments.json → docs/diagnosis.md
    python3 tools/diagnose.py --example       # 가짜 예시 수치 → docs/diagnosis-example.md

퍼널 순서는 baseline.funnel이 가리키는 db/funnels/<id>.json에서 읽는다.
통과율은 항상 '그 순서에서 다음 단계 도달 / 이 단계 도달'로 계산하므로, 순서를 바꿔도 다시 돌리면 된다.
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
Z_A, Z_B = 1.959964, 0.841621  # 유의수준 5%(양측), 검정력 80%


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
    """이 지표가 i번째 단계의 통과를 포함하는가"""
    if metric not in mr:
        return False
    start = mr[metric][1]
    if metric in ('checkout_conv', 'first_pay_conv'):
        return start <= i < pi
    return start == i


def sample_size(p1, target):
    if p1 is None or not 0 < p1 < 1:
        return None
    p2 = p1 + target['value'] / 100 if target['unit'] == 'pp' else p1 * (1 + target['value'] / 100)
    if not 0 < p2 < 1 or p2 == p1:
        return None
    pb = (p1 + p2) / 2
    n = (Z_A * math.sqrt(2 * pb * (1 - pb)) + Z_B * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2
    return math.ceil(n)


def ztest(a, b):
    p1, p2 = a['conv'] / a['n'], b['conv'] / b['n']
    p = (a['conv'] + b['conv']) / (a['n'] + b['n'])
    se = math.sqrt(p * (1 - p) * (1 / a['n'] + 1 / b['n']))
    z = (p2 - p1) / se if se else 0
    pv = math.erfc(abs(z) / math.sqrt(2))
    return p1, p2, (p2 / p1 - 1) if p1 else None, pv


def main():
    ex = '--example' in sys.argv
    base = J('db/service/baseline.example.json' if ex else 'db/service/baseline.json')
    exps = J('db/service/experiments.example.json' if ex else 'db/service/experiments.json')
    out = os.path.join(ROOT, 'docs/diagnosis-example.md' if ex else 'docs/diagnosis.md')
    f = J(f"db/funnels/{base['funnel']}.json")
    tax, db, bm = J('db/taxonomy.json'), J('db/cases.json'), J('db/benchmarks.json')
    M = tax['metrics']
    if not any(v for v in base['reach'].values()):
        print('db/service/baseline.json의 reach(단계별 도달 수)를 채운 뒤 다시 실행하세요. 예시는 --example')
        return
    if base.get('funnel_version') != f['version']:
        print(f"경고: baseline은 퍼널 v{base.get('funnel_version')}, 현재 설정은 v{f['version']}")
    days = base['period'].get('days') or 30
    R = rates(f, base['reach'])
    pi = next(i for i, s in enumerate(R) if s.get('purchase'))
    first, buyers = R[0]['reach'], R[pi]['reach']
    bmk = {}
    for b in bm['items']:
        if b.get('value') is not None:
            bmk.setdefault(b['metric'], b)
    tested = {(e['case'], e['hyp']): e for e in exps}
    L = [f"# 진단 리포트{' (예시: 가짜 숫자)' if ex else ''}", '',
         f"기간 {base['period'].get('from')} ~ {base['period'].get('to')} ({days}일) · 퍼널 `{f['id']}` v{f['version']} ({f['label']})",
         '', '`python3 tools/diagnose.py`로 다시 만든다. 기준값은 업종·정의가 달라 참고선으로만 본다.', '']

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

    # 2. 병목
    pre = [s for s in R[:pi] if s['rate'] is not None]
    for s in pre:
        s['gain'] = buyers * ((s['rate'] + (1 - s['rate']) / 2) / s['rate'] - 1)
    pre.sort(key=lambda s: -s['gain'])
    aov = base['economics'].get('aov')
    L += ['## 2. 병목 순위 (구매 전 단계)', '',
          '이 단계 이탈의 절반을 되살리면 늘어나는 구매자 수로 줄 세웠다. 다른 단계 통과율이 그대로라는 가정이다.', '',
          '| 순위 | 단계 | 통과율 | 이탈 절반 회복 시 구매자 | 월 매출 |', '|---|---|---|---|---|']
    for i, s in enumerate(pre):
        L.append(f"| {i + 1} | {s['label']} | {pct(s['rate'])} | +{num(s['gain'])}명 | {'+' + num(s['gain'] * aov * 30 / days) + '원' if aov else '–'} |")
    L.append('')

    # 3. 추천 실험
    deep = [c for c in db['cases'] if c['depth'] == 'deep']
    L += ['## 3. 병목 단계별 추천 실험', '',
          '이 단계 통과를 직접 재는 실험(결제 완료율처럼 여러 단계를 묶은 지표 포함)을 먼저, 그다음 ICE 점수(영향·확신·쉬움 평균) 순. 표본 수는 군당, 유의수준 5%·검정력 80%.', '']
    mr = metric_rates(R, pi)
    for s in pre[:3]:
        si = R.index(s)
        daily = s['reach'] / days
        cand = []
        for c in deep:
            stages = {c['saju']['stage'], *c['saju'].get('also', [])}
            for n, h in enumerate(c['hyps'], 1):
                t = h.get('test')
                if not t or 'ice' not in t:
                    continue
                exact = covers(t['metric'], mr, si, pi)
                if exact or s['stage'] in stages:
                    cand.append((not exact, -t['ice']['score'], c, n, t, exact))
        cand.sort(key=lambda x: (x[0], x[1]))
        L += [f"### {s['label']} (통과율 {pct(s['rate'])}, 하루 {num(daily)}명 도달)", '',
              '| 사례 | 실험 | ICE | 목표 | 군당 표본 | 예상 기간 | 가드레일 | 기록 |', '|---|---|---|---|---|---|---|---|']
        for _, _, c, n, t, exact in cand[:6]:
            base_rate, start = mr.get(t['metric'], (None, None))
            ss = sample_size(base_rate, t['target']) if exact else None
            d0 = R[start]['reach'] / days if start is not None else 0
            dur = f'{math.ceil(2 * ss / d0)}일' if ss and d0 else ('다른 단계 지표' if not exact else '–')
            e = tested.get((c['id'], n))
            rec = f"{e['id']} {e['result']}" if e else ''
            L.append(f"| `{c['id']}` {n} | {t['experiment']} | {t['ice']['score']} | {t['target']['text']} | "
                     f"{num(ss) if ss else '–'} | {dur} | {M.get(t['guardrail'], {}).get('label', t['guardrail'])} | {rec} |")
        tg = [c['id'] for c in db['cases'] if c['depth'] != 'deep' and s['stage'] in {c['saju']['stage'], *c['saju'].get('also', [])}]
        L += ['', f"같은 단계의 분류 사례 {len(tg)}개: {', '.join(f'`{x}`' for x in tg[:12])}{' …' if len(tg) > 12 else ''}" if tg else '같은 단계의 분류 사례: 없음 (핵심 사례만 있음)', '']

    # 4. 세그먼트
    if base.get('segments'):
        L += ['## 4. 세그먼트', '', '전체보다 통과율이 20% 이상 낮은 칸을 **굵게** 표시했다.', '',
              '| 세그먼트 | ' + ' | '.join(s['label'] for s in R[:pi]) + ' | 구매 전환 |',
              '|---|' + '---|' * (pi + 1)]
        for g in base['segments']:
            gr = rates(f, g['reach'])
            cells = []
            for a, b in zip(gr[:pi], R[:pi]):
                low = a['rate'] is not None and b['rate'] and a['rate'] < b['rate'] * 0.8
                cells.append(f"**{pct(a['rate'])}**" if low else pct(a['rate']))
            gc = g['reach'].get(R[pi]['id']) / g['reach'].get(R[0]['id']) if g['reach'].get(R[0]['id']) else None
            seg = tax['segments'].get(g['dim'], {}).get('label', g['dim'])
            L.append(f"| {seg}: {g['value']} | " + ' | '.join(cells) + f' | {pct(gc, 2)} |')
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

    # 6. 재구매 선행 지표
    pp = base.get('post_purchase') or {}
    if any(v is not None for v in pp.values()):
        L += ['## 6. 재구매 선행 지표', '',
              '재구매는 늦게 잡히므로 아래 지표를 매달 기록해 재구매율과 함께 움직이는지 확인한다. 함께 움직이는 지표가 확인되면 실험 판단을 그 지표로 앞당긴다.', '',
              '| 지표 | 값 |', '|---|---|']
        for k, v in pp.items():
            if v is None:
                continue
            val = f'{v}일' if k == 'time_to_repurchase' else (f'{v} / 5' if k == 'satisfaction_score' else pct(v))
            L.append(f"| {M.get(k, {}).get('label', k)} | {val} |")
        L.append('')

    # 7. 실험 기록
    if exps:
        L += ['## 7. 실험 기록', '', '| id | 사례 | 지표 | 대조 → 실험 | 상대 변화 | p값 | 가드레일 | 결과 | 비고 |', '|---|---|---|---|---|---|---|---|---|']
        for x in exps:
            p1, p2, lift, pv = ztest(*x['arms'][:2])
            g = x.get('guardrail') or {}
            gtxt = {True: '통과', False: '위반', None: '미확인'}[g.get('ok')]
            ver = '' if x.get('funnel_version') == f['version'] and x.get('funnel') == f['id'] else '퍼널 버전 다름: 직접 비교 주의'
            L.append(f"| {x['id']} | `{x['case']}` {x['hyp']} | {M[x['metric']]['label']} | {pct(p1)} → {pct(p2)} | "
                     f"{pct(lift)} | {pv:.3f} | {gtxt} | {x['result']} | {ver} |")
        L.append('')
    open(out, 'w', encoding='utf-8').write('\n'.join(L))
    print(os.path.relpath(out, ROOT), len(L), 'lines')


if __name__ == '__main__':
    main()
