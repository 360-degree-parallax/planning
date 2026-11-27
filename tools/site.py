#!/usr/bin/env python3
"""사이트 데이터·묶음 만들기.

  python3 tools/site.py            site/data/cases.min.json 생성 (사이트가 읽는 가벼운 사본)
  python3 tools/site.py --bundle OUT.html
                                   이론+DB를 데이터까지 한 파일에 담은 미리보기 페이지

cases.min.json은 db/cases.json에서 사이트가 안 쓰는 칸(사주 적용, 가설 실험 등)을 뺀 것.
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


def body(name):
    h = open(os.path.join(SITE, name), encoding='utf-8').read()
    m = re.search(r'</nav>\s*(<div class="wrap".*?)\n<(?:div class="toast"|script)', h, re.S)
    return m.group(1)


def bundle(out):
    rd = lambda n: open(os.path.join(SITE, n), encoding='utf-8').read()
    data = json.dumps(slim(), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    js = lambda n: rd(n).replace('</script', '<\\/script')
    html = f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>기획 공부 — 이론·사례 DB</title>
<style>{rd('app.css')}</style></head>
<body>
<header class="gnb"><a class="wordmark" href="#theory:intro">기획 공부<span>본질 파악 방법론 · 사례 DB</span></a>
<div class="right"><button class="ib" id="theme" aria-label="테마 바꾸기" title="테마 바꾸기"><svg class="i" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg></button></div></header>
<nav class="topnav" aria-label="보기"><a href="#theory:intro" data-v="theory"><b>1</b>이론 공부</a><a href="#db:" data-v="db"><b>2</b>사례 DB</a></nav>
<section id="v-theory">{body('index.html')}</section>
<section id="v-db" hidden>{body('db.html')}</section>
<div class="toast" id="toast" role="status"></div>
<script>window.__BUNDLE=true;window.__CASES={data};
(function(){{function v(){{var h=location.hash.slice(1),db=h.indexOf('db:')===0;if(!db&&h.indexOf('theory:')!==0){{history.replaceState(null,'','#theory:intro')}}
document.getElementById('v-db').hidden=!db;document.getElementById('v-theory').hidden=db;
document.querySelectorAll('.topnav a').forEach(function(a){{a.toggleAttribute('aria-current',a.dataset.v===(db?'db':'theory'));if(a.hasAttribute('aria-current'))a.setAttribute('aria-current','page')}})}}
v();addEventListener('hashchange',v)}})();</script>
<script>{js('shared.js')}</script><script>{js('theory.js')}</script><script>{js('theory-page.js')}</script><script>{js('db-page.js')}</script>
</body></html>'''
    open(out, 'w', encoding='utf-8').write(html)
    print(f'{out} ({len(html.encode()) // 1024} KB)')


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--bundle':
        bundle(sys.argv[2])
    else:
        write_data()
