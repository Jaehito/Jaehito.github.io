#!/usr/bin/env bash
# 게임의 <script> 블록만 뽑아서 문법 검사. 단일 HTML이라 번들러가 없으니
# 오타 하나로 게임 전체가 죽는다 — 커밋 전에 항상 이걸 먼저 돌린다.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="$DIR/../index.html"
TMP="$(mktemp -t moneyroad-XXXXXX.js)"
trap 'rm -f "$TMP"' EXIT
python3 -c "
import re,sys
s=open('$GAME',encoding='utf-8').read()
m=re.search(r'<script>(.*)</script>',s,re.S)
if not m: sys.exit('<script> 블록을 못 찾음')
open('$TMP','w',encoding='utf-8').write(m.group(1))
"
node --check "$TMP"
echo "JS OK"

# 서브셋 폰트에 빠진 글자가 없는지 — 픽셀 서체는 CDN이 아니라 파일에 박혀 있고,
# 쓰는 글자만 남겨 두기 때문에, 한국어 문자열을 고치고 subset-font.py를 안 돌리면
# 그 글자만 시스템 고딕으로 떨어진다. 오류는 안 나고 화면만 조용히 망가진다.
python3 - "$GAME" <<'PYCHK'
import base64, io, re, sys
try:
    from fontTools.ttLib import TTFont
except ImportError:
    print('폰트 검사 건너뜀 (fonttools 없음)'); raise SystemExit(0)
s = io.open(sys.argv[1], encoding='utf-8').read()
# 서체 이름에 매이지 않게 — 첫 @font-face의 base64를 본다(도트→아웃라인으로 한 번 갈았다)
m = re.search(r"@font-face\{[^}]*?base64,([A-Za-z0-9+/=]+)\)", s, re.S)
if not m:
    raise SystemExit('서브셋 폰트를 못 찾음 — subset-font.py를 돌렸나?')
cmap = TTFont(io.BytesIO(base64.b64decode(m.group(1)))).getBestCmap()
# 화면에 뜰 수 있는 글자만 본다 — 주석·코드까지 넣으면 의미가 없다
body = s[s.index('<body>'):]
lits = re.findall(r"'((?:[^'\\\n]|\\.)*)'", body) + re.findall(r'"((?:[^"\\\n]|\\.)*)"', body)
# 이모지는 애초에 한글 서체에 없다. 게임 화면에는 한 자도 안 남았고(phase32가 본다)
# 🛠 테스트 도구에만 남아 있는데, 개발용이라 시스템 이모지 서체로 떨어져도 된다.
def emoji(o):
    return (0x1F000 <= o <= 0x1FAFF or 0x2600 <= o <= 0x27BF
            or 0x2B00 <= o <= 0x2BFF or o in (0xFE0F, 0x20E3))
miss = sorted({c for L in lits for c in L
               if ord(c) > 0x7e and ord(c) not in cmap
               and not emoji(ord(c)) and c != '\u200b'})
if miss:
    raise SystemExit('서브셋 폰트에 없는 글자: ' + ' '.join(
        '%s(%s)' % (c, hex(ord(c))) for c in miss[:20]) +
        '\n  → python3 tools/subset-font.py index.html <Galmuri11.woff2> <Galmuri11-Bold.woff2>')
print('폰트 OK')
PYCHK
