#!/usr/bin/env python3
"""한글 픽셀 폰트를 실제 쓰는 글자만 남겨서 data URI로 박는다.

왜 필요한가 — Artifact CSP는 fonts.googleapis.com 외의 웹폰트를 막고,
Google Fonts의 픽셀 폰트(Press Start 2P 등)에는 한글 글리프가 없다.
그래서 한글 픽셀 폰트는 파일에 직접 박는 수밖에 없는데, 원본은 500KB다.
화면에 뜨는 글자는 전부 소스 안 리터럴이라 유한하므로, 서브셋하면 급감한다
(라운드 화면 목업 기준: 505KB → 8KB, Bold까지 15KB).

준비:
  pip install fonttools brotli
  # jsDelivr가 막힌 환경이라 npm 레지스트리에서 받는다 (Galmuri, OFL-1.1)
  curl -sO https://registry.npmjs.org/galmuri/-/galmuri-2.40.3.tgz
  tar xzf galmuri-2.40.3.tgz

사용:
  python3 tools/subset-font.py <대상.html> <Regular.woff2> [Bold.woff2]

대상 HTML 안의 __FONT_R__ / __FONT_B__ 자리에 base64를 채워 넣는다.
서브셋 글자는 그 HTML에 실제로 등장하는 문자 전부 + 런타임 조합용 여분.
"""
import io, os, sys, base64, subprocess, tempfile

if len(sys.argv) < 3:
    raise SystemExit(__doc__)
HTML, REG = sys.argv[1], sys.argv[2]
BOLD = sys.argv[3] if len(sys.argv) > 3 else None

s = io.open(HTML, encoding='utf-8').read()
# fmtWon()이 만들어내는 억/만/원, 등급 문구 등 런타임 조합 문자를 여유로 넣는다
EXTRA = ('0123456789.,+-%()×·… xX억만원초배최고청산잔진입손실전액시간료회수저점~중지'
         '완벽한타이밍잘팔았어요나쁘지않조금아쉬너무늦었')
chars = {c for c in set(s) | set(EXTRA) if ord(c) >= 0x20}

with tempfile.TemporaryDirectory() as tmp:
    txt = os.path.join(tmp, 'chars.txt')
    io.open(txt, 'w', encoding='utf-8').write(''.join(sorted(chars)))
    b64 = {}
    for key, src in (('__FONT_R__', REG), ('__FONT_B__', BOLD)):
        if not src:
            continue
        out = os.path.join(tmp, key + '.woff2')
        subprocess.run(['pyftsubset', src, '--output-file=' + out, '--flavor=woff2',
                        '--text-file=' + txt, '--layout-features=*',
                        '--no-hinting', '--desubroutinize'], check=True)
        b64[key] = base64.b64encode(open(out, 'rb').read()).decode()
        print('%s  %s → %d bytes' % (key, os.path.basename(src), os.path.getsize(out)))

for key, val in b64.items():
    s = s.replace(key, val)
if '__FONT_' in s:
    print('경고: 채우지 못한 자리가 남았다', file=sys.stderr)
io.open(HTML, 'w', encoding='utf-8').write(s)
print('글리프 %d자 · %s 갱신 (%d bytes)' % (len(chars), HTML, len(s)))
