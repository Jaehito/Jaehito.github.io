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
