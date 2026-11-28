#!/usr/bin/env python3
"""사이트 데이터·묶음 만들기.

  python3 tools/site.py            site/data/cases.min.json 생성 (사이트가 읽는 가벼운 사본)
  python3 tools/site.py --bundle OUT.html
                                   이론+DB를 데이터까지 한 파일에 담은 미리보기 페이지

cases.min.json은 db/cases.json에서 사이트가 안 쓰는 칸(사주 적용, 가설 실험 등)을 뺀 것.
saju-rules.min.json은 사주 DB(db/saju/rules/saju_db.json)의 사이트용 사본. 사주 DB는 묶음 페이지에 넣지 않는다.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
DROP = {'saju', 'business', 'problem_metric', 'outcome_note', 'source_note', 'analysis_full'}


def slim():
    d = json.load(open(os.path.join(ROOT, 'db/cases.json'), encoding='utf-8'))
    out = []
    for c in d['cases']:
        c = {k: v for k, v in c.items() if k not in DROP}
        c['hyps'] = [{k: h[k] for k in ('text', 'perspective', 'why_not_yet', 'verdict') if k in h} for h in c['hyps']]
        out.append(c)
    return out


def write_data():
    os.makedirs(os.path.join(SITE, 'data'), exist_ok=True)
    p = os.path.join(SITE, 'data/cases.min.json')
    s = json.dumps(slim(), ensure_ascii=False, separators=(',', ':'))
    open(p, 'w', encoding='utf-8').write(s)
    print(f'{p} ({len(s.encode()) // 1024} KB)')
    write_saju()


SAJU_KEYS = ('concepts', 'rules', 'pair_rules', 'timing_rules', 'procedures', 'cases', 'expressions', 'videos', 'meta')


def write_saju():
    """사주 DB(db/saju/rules/saju_db.json) → site/data/saju-rules.min.json (saju.html이 읽음)"""
    src = os.path.join(ROOT, 'db/saju/rules/saju_db.json')
    if not os.path.exists(src):
        return
    d = json.load(open(src, encoding='utf-8'))
    s = json.dumps({k: d[k] for k in SAJU_KEYS if k in d}, ensure_ascii=False, separators=(',', ':'))
    p = os.path.join(SITE, 'data/saju-rules.min.json')
    open(p, 'w', encoding='utf-8').write(s)
    print(f'{p} ({len(s.encode()) // 1024} KB)')


def body(name):
    h = open(os.path.join(SITE, name), encoding='utf-8').read()
    m = re.search(r'</nav>\s*(<div class="wrap.*?)\n<(?:div class="toast"|script)', h, re.S)
    return m.group(1)


def bundle(out):
    rd = lambda n: open(os.path.join(SITE, n), encoding='utf-8').read()
    data = json.dumps(slim(), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    js = lambda n: rd(n).replace('</script', '<\\/script')
    html = f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>기획 공부 — 이론 1~6장 · 시장 리포트 · 기획 사례 · 노아</title>
<style>{rd('app.css')}</style></head>
<body>
<nav class="topnav" aria-label="메뉴"><a href="#theory:" data-g="theory">이론</a><a href="#reports:" data-g="reports">시장 리포트</a><a href="#db:" data-g="db">기획 사례</a><a href="#noah:" data-g="noah">노아</a><span class="grow"></span><button class="ib" id="theme" aria-label="테마 바꾸기" title="테마 바꾸기"><svg class="i" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg></button></nav>
<nav class="subnav" aria-label="이론 — 장"><a href="#theory:" data-v="theory"><b>1</b>1장 기획의 여섯 단계</a><a href="#ch2:" data-v="ch2"><b>2</b>2장 인사이트 도출</a><a href="#ch3:" data-v="ch3"><b>3</b>3장 기획자의 몸값</a><a href="#ch4:" data-v="ch4"><b>4</b>4장 기획의 선명도</a><a href="#ch5:" data-v="ch5"><b>5</b>5장 GTM</a><a href="#ch6:" data-v="ch6"><b>6</b>6장 실무 도구</a></nav>
<section id="v-theory" data-v="theory">{body('index.html')}</section>
<section id="v-ch2" data-v="ch2" hidden>{body('ch2.html')}</section>
<section id="v-ch3" data-v="ch3" hidden>{body('ch3.html')}</section>
<section id="v-ch4" data-v="ch4" hidden>{body('ch4.html')}</section>
<section id="v-ch5" data-v="ch5" hidden>{body('ch5.html')}</section>
<section id="v-reports" data-v="reports" hidden>{body('reports.html')}</section>
<section id="v-db" data-v="db" hidden>{body('db.html')}</section>
<section id="v-ch6" data-v="ch6" hidden>{body('ch6.html')}</section>
<section id="v-noah" data-v="noah" hidden>{body('noah.html')}</section>
<div class="toast" id="toast" role="status"></div>
<script>window.__BUNDLE=true;window.__CASES={data};
(function(){{function v(){{var h=location.hash.slice(1),k=(h.split(':')[0]);if(['theory','ch2','ch3','ch4','ch5','ch6','reports','db','noah'].indexOf(k)<0){{k='theory';history.replaceState(null,'','#theory:')}}
document.querySelectorAll('section[data-v]').forEach(function(s){{s.hidden=s.dataset.v!==k}});
var g=['theory','ch2','ch3','ch4','ch5','ch6'].indexOf(k)<0?k:'theory';document.querySelectorAll('.topnav a').forEach(function(a){{if(a.dataset.g===g)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}});document.querySelectorAll('.subnav a').forEach(function(a){{if(a.dataset.v===k)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}});document.querySelector('.subnav').hidden=g!=='theory';if(window.TheoryPage)setTimeout(window.TheoryPage.route,0)}}
v();addEventListener('hashchange',v)}})();</script>
<script>{js('shared.js')}</script><script>{js('theory.js')}</script><script>{js('ch2.js')}</script><script>{js('ch3.js')}</script><script>{js('ch4.js')}</script><script>{js('ch5.js')}</script><script>{js('methods.js')}</script><script>{js('triggers.js')}</script><script>{js('ch6.js')}</script><script>{js('viz.js')}</script><script>{js('theory-page.js')}</script><script>{js('reports.js')}</script><script>{js('reports-page.js')}</script><script>{js('db-page.js')}</script><script>{js('noah.js')}</script><script>{js('noah-page.js')}</script>
</body></html>'''
    open(out, 'w', encoding='utf-8').write(html)
    print(f'{out} ({len(html.encode()) // 1024} KB)')


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--bundle':
        bundle(sys.argv[2])
    else:
        write_data()
