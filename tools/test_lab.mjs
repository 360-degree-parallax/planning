// node tools/test_lab.mjs — 실무 툴 계산 엔진(site/lab-core.js) 회귀 테스트.
// 기대값은 받은 실습 자료의 결과 시트와 표준 통계값으로 맞췄다(원본 데이터는 저장소에 없음).
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const ctx = {window: {}}; vm.runInNewContext(fs.readFileSync(new URL('../site/lab-core.js', import.meta.url), 'utf8'), ctx);
const L = ctx.window.LAB; let n = 0; const ok = (name, f) => { f(); n++; console.log('✓', name); };
const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
ok('웰치 t검정 p값', () => { const w = L.welch([1, 2, 3, 4, 5], [3, 4, 5, 6, 7]); near(w.t, 2); near(w.df, 8); near(w.p, 0.0805, 1e-3); });
ok('카이제곱 꼬리 확률', () => near(L.chiUpperP(3.841, 1), 0.05, 1e-3));
ok('F 꼬리 확률', () => near(L.fUpperP(4.26, 2, 9), 0.05, 2e-3));
ok('카플란-마이어 (광고 활성화 실습 시트 재현)', () => { const km = L.kaplanMeier([41446, 24304, 150770, 9849], [true, true, true, false]); assert.deepEqual(JSON.parse(JSON.stringify(km.curve.map(p => Math.round(p.S * 1000) / 1000))), [1, 1, 0.667, 0.333, 0]); });
ok('A/B 판정 (템플릿 1행 재현: 상승 14.2%, 기각)', () => { const r = L.abTest({cUsers: 5141, cConv: 11, vUsers: 241921, vConv: 591, mde: 0.1}); near(r.delta, 0.14174, 1e-4); near(r.chi, 0.19, 0.01); assert.equal(r.verdict, '기각'); });
ok('A/B 기간 (템플릿 공식)', () => { const d = L.abDuration({baseline: 0.0021396615444466056, mde: 0.1, variants: 2, dailyUsers: 100000}); assert.equal(d.days, 15); });
ok('ICE 정렬', () => { const r = L.ice([{title: 'a', impact: 3, confidence: 3, ease: 4}, {title: 'b', impact: 4, confidence: 4, ease: 5}]); assert.equal(r[0].title, 'b'); assert.equal(r[0].score, 80); });
ok('오퍼 수락률 4분면', () => { const rows = [{c: 'x', v: '57', k: '5', t: '2.07'}, {c: 'y', v: '22', k: '1', t: '1.39'}, {c: 'z', v: '2', k: '0', t: '3.17'}, {c: 'w', v: '8', k: '0', t: '1.0'}]; const r = L.offerAcceptance(rows, {campaign: 'c', visitors: 'v', conversions: 'k', ctr: 't'}).rows.map(x => x['권고 사항']); assert.deepEqual(JSON.parse(JSON.stringify(r)), ['캠페인 운용 및 유사 광고 콘텐츠 진행', '캠페인 수정 및 광고 콘텐츠 개선', '웹사이트 콘텐츠 개선', '캠페인 종료 및 수정 권고']); });
ok('연관 규칙 향상도', () => { const b = [['a', 'b'], ['a', 'b'], ['a'], ['c'], ['b', 'c']]; const r = L.associationRules(b, {minSupport: 0.1, minConfidence: 0.1}).rows.find(x => x['이걸 산 사람은'] === 'a' && x['이것도 산다'] === 'b'); near(r['향상도'], (2 / 3) / (3 / 5), 0.01); });
ok('CSV 파싱 (따옴표·쉼표)', () => { const p = L.parseCSV('a,b\n"x, y",2\n'); assert.equal(p.rows[0].a, 'x, y'); });
ok('매체 소스 정리', () => { assert.equal(L.normSource('"naver","naver"'), 'naver'); assert.equal(L.normSource('m.tiktok.com'), 'tiktok.com'); });
ok('가격 공식 (강의 예제: 정상가 12,000 · 상시 10,900 · 원가 3,500)', () => { const r = L.pricing({cost: 3500, list: 12000, sale: 10900}); near(r.disc, 9.17, 0.01); near(r.crSale, 32.1, 0.1); near(r.crList, 29.17, 0.01); });
ok('상품 회계 (설계서 1행: 호텔식 암막커튼 99,000원)', () => { const r = L.productAccounting([{n: '커튼', p: 99000}], {name: 'n', price: 'p'}).rows[0]; assert.equal(r['이익'], 62040); assert.equal(r['판매당 마케팅비'], 7445); assert.equal(r['추천 입찰 CPC'], 4343); });
ok('선형 예측 ± STEYX', () => { const r = L.forecast([{x: 1, y: 2}, {x: 2, y: 4.1}, {x: 3, y: 5.9}, {x: 4, y: 8.2}], {x: 'x', y: 'y', targets: [5]}); near(r.rows[0]['예상 (예측)'], 10, 1); });
ok('K-means 두 군집 분리', () => { const rows = [...Array(10)].map((_, i) => ({a: i < 5 ? 1 : 10, b: i < 5 ? 1 : 10})); const r = L.kmeans(rows, {features: ['a', 'b'], k: 2}); assert.deepEqual(JSON.parse(JSON.stringify(r.rows.map(x => x['고객 수']).sort())), [5, 5]); });
ok('UTM 캠페인 = 유형_타겟', () => assert.ok(L.utm({url: 'https://x.com/a', source: 'meta', medium: 'display', campaignType: '전환', target: '2030-재회'}).includes('utm_campaign=%EC%A0%84%ED%99%98_2030-%EC%9E%AC%ED%9A%8C')));
console.log(`${n}개 통과`);
