"""진단 리포트용 통계 함수 (표준 라이브러리만 사용). tests/test_stats.py에서 검증한다."""
import math

Z_A, Z_B = 1.959964, 0.841621  # 유의수준 5%(양측), 검정력 80%


def norm_p(z):
    """표준정규 양측 p값"""
    return math.erfc(abs(z) / math.sqrt(2))


def sample_size(p1, target, alpha_z=Z_A):
    """두 비율 비교 군당 표본 수. target = {'value': 10, 'unit': 'relative'|'pp'}"""
    if p1 is None or not 0 < p1 < 1:
        return None
    p2 = p1 + target['value'] / 100 if target['unit'] == 'pp' else p1 * (1 + target['value'] / 100)
    if not 0 < p2 < 1 or p2 == p1:
        return None
    pb = (p1 + p2) / 2
    n = (alpha_z * math.sqrt(2 * pb * (1 - pb)) + Z_B * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2
    return math.ceil(n)


def ztest(a, b):
    """두 비율 z검정. a, b = {'n': 노출, 'conv': 전환} → (p1, p2, 상대 변화, p값)"""
    p1, p2 = a['conv'] / a['n'], b['conv'] / b['n']
    p = (a['conv'] + b['conv']) / (a['n'] + b['n'])
    se = math.sqrt(p * (1 - p) * (1 / a['n'] + 1 / b['n']))
    z = (p2 - p1) / se if se else 0
    return p1, p2, (p2 / p1 - 1) if p1 else None, norm_p(z)


def welch(a, b):
    """방문자당 매출 비교 (Welch t, 큰 표본이라 정규 근사).
    a, b = {'n': 노출, 'revenue_sum': 매출 합, 'revenue_sumsq': 사람별 매출 제곱 합} → (평균1, 평균2, 상대 변화, p값)"""
    def mv(x):
        m = x['revenue_sum'] / x['n']
        v = (x['revenue_sumsq'] - x['n'] * m * m) / (x['n'] - 1)
        return m, max(v, 0)
    m1, v1 = mv(a)
    m2, v2 = mv(b)
    se = math.sqrt(v1 / a['n'] + v2 / b['n'])
    t = (m2 - m1) / se if se else 0
    return m1, m2, (m2 / m1 - 1) if m1 else None, norm_p(t)


def srm(ns, split=None):
    """배정 비율 이상(SRM) 카이제곱 검정. ns = 군별 노출 수, split = 계획 비율 → p값 (자유도 k-1, 윌슨-힐퍼티 근사)"""
    k, tot = len(ns), sum(ns)
    split = split or [1 / k] * k
    chi = sum((o - tot * s) ** 2 / (tot * s) for o, s in zip(ns, split))
    df = k - 1
    if df == 1:
        return norm_p(math.sqrt(chi))
    z = ((chi / df) ** (1 / 3) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    return 0.5 * math.erfc(z / math.sqrt(2))


def bonferroni(alpha, arms):
    """대조군 1개 + 실험군 (arms-1)개 비교 시 보정 유의수준"""
    return alpha / max(arms - 1, 1)


def pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return sxy / (sx * sy) if sx and sy else None
