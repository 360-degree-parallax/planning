"""질문권 단위 경제 계산기.

입력: db/service/unit-econ.json (없으면 unit-econ.example.json)
출력: 상품(묶음)별 질문 1회당 순매출·원가·공헌이익과 공헌이익률, 손익분기 질문 단가, 무료 질문 허용 상한.

원가 구성 (질문 1회):
  모델 비용 = (입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) / 1,000,000 × 환율 × 재생성 배수
  검수 비용 = 사람 검수 비율 × 검수 1건 인건비
  결제 수수료 = 판매가 × 채널별 수수료율(앱 마켓·PG 혼합)
  환불 손실 = 판매가 × 환불률
  무료 질문 원가 = 무료 질문 1회 원가 × (무료 질문 수 / 유료 질문 수)

사용: python3 tools/unit_econ.py [경로]
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def model_cost(m, fx):
    per = (m['input_tokens'] * m['input_price_per_m'] + m['output_tokens'] * m['output_price_per_m']) / 1_000_000
    return per * fx * m.get('regenerate_factor', 1.0)


def blended_fee(channels):
    share = sum(c['share'] for c in channels)
    if abs(share - 1) > 0.01:
        raise ValueError(f'채널 비중 합이 1이 아님: {share}')
    return sum(c['share'] * c['fee_rate'] for c in channels)


def per_question(pack, cfg):
    fx = cfg['fx_krw_per_usd']
    fee = blended_fee(cfg['channels'])
    price_q = pack['price'] / pack['questions']
    routes = cfg['routing']
    mc = sum(r['share'] * model_cost(cfg['models'][r['model']], fx) for r in routes)
    review = cfg['review']['share'] * cfg['review']['cost_per_review']
    free = cfg['free']
    free_cost = model_cost(cfg['models'][free['model']], fx) * free['free_per_paid']
    pay_fee = price_q * fee
    refund = price_q * cfg['refund_rate']
    vat = price_q - price_q / (1 + cfg['vat_rate'])
    net = price_q - vat - pay_fee - refund
    cost = mc + review + free_cost
    cm = net - cost
    return {'pack': pack['id'], 'price_per_q': round(price_q), 'net_revenue': round(net),
            'model': round(mc, 1), 'review': round(review, 1), 'free_alloc': round(free_cost, 1),
            'pay_fee': round(pay_fee), 'refund': round(refund), 'vat': round(vat),
            'contribution': round(cm), 'cm_rate': round(cm / price_q, 3)}


def break_even_price(cfg):
    """공헌이익 0이 되는 질문 1회 판매가(부가세 포함)."""
    fx = cfg['fx_krw_per_usd']
    fee = blended_fee(cfg['channels'])
    mc = sum(r['share'] * model_cost(cfg['models'][r['model']], fx) for r in cfg['routing'])
    review = cfg['review']['share'] * cfg['review']['cost_per_review']
    free_cost = model_cost(cfg['models'][cfg['free']['model']], fx) * cfg['free']['free_per_paid']
    keep = 1 / (1 + cfg['vat_rate']) - fee - cfg['refund_rate']
    return round((mc + review + free_cost) / keep)


def main(path=None):
    if path is None:
        real = os.path.join(ROOT, 'db/service/unit-econ.json')
        path = real if os.path.exists(real) else os.path.join(ROOT, 'db/service/unit-econ.example.json')
    cfg = json.load(open(path, encoding='utf-8'))
    print(f'# 질문권 단위 경제 ({os.path.basename(path)})')
    print(f"결제 수수료 혼합률 {blended_fee(cfg['channels']):.1%} · 환불률 {cfg['refund_rate']:.0%} · 무료 질문/유료 질문 {cfg['free']['free_per_paid']}")
    print('| 묶음 | 1회 단가 | 순매출 | 모델 | 검수 | 무료 배분 | 결제 수수료 | 환불 | 공헌이익 | 공헌이익률 |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for p in cfg['packs']:
        r = per_question(p, cfg)
        print(f"| {r['pack']} | {r['price_per_q']:,} | {r['net_revenue']:,} | {r['model']} | {r['review']} | {r['free_alloc']} | {r['pay_fee']:,} | {r['refund']:,} | {r['contribution']:,} | {r['cm_rate']:.0%} |")
    print(f'\n손익분기 질문 1회 판매가(부가세 포함): {break_even_price(cfg):,}원')
    print('주의: 예시 파일의 단가·토큰 수는 가정값이다. 실제 계약 단가와 로그로 바꿔 쓴다.')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
