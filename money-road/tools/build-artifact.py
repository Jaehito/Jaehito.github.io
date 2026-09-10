#!/usr/bin/env python3
"""index.html → Claude Artifact에 올릴 HTML 조각.

Artifact는 <!doctype>/<html>/<head>/<body>를 자기가 감싸므로 그 태그들을 빼고
<title> + <style> + 본문만 남긴다. 그리고 Artifact CSP는 fonts.googleapis.com
외의 스타일시트를 막기 때문에 jsdelivr에서 불러오는 Pretendard 링크도 제거한다
(그래서 Pages판과 Artifact판의 본문 폰트가 다르다 — 의도된 차이).

  python3 tools/build-artifact.py [출력경로]
"""
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, '..', 'index.html')
OUT  = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'artifact.html')

lines = io.open(SRC, encoding='utf-8').read().split('\n')
def find(pat):
    for i, l in enumerate(lines):
        if pat in l:
            return i
    raise SystemExit('못 찾음: ' + pat)

ti, hd, bd, be = find('<title>'), find('</head>'), find('<body>'), find('</body>')
kept = [l for l in lines[ti:hd] + lines[bd + 1:be]
        if 'jsdelivr' not in l and 'name="description"' not in l]
out = '\n'.join(kept) + '\n'

low = out.lower()
for bad in ('<head', '<!doctype', '<body', '</html'):
    assert bad not in low, '문서 골격 태그가 남았다: ' + bad

io.open(OUT, 'w', encoding='utf-8').write(out)
print('%s  (%d bytes)' % (OUT, len(out)))
print('Artifact 툴에 이 파일 경로를 넘기고, 기존 아티팩트면 url을 같이 준다.')
