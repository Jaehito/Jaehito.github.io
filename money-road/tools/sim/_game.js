/* 게임의 진짜 경로 생성기를 index.html에서 그대로 꺼내 쓴다.

   _harness.js는 PATTERNS를 손으로 베낀 사본이라 게임이 바뀌면 조용히 어긋난다.
   실제로 한 번 크게 당했다 — 종목 진폭을 흉내낸다고 완성된 경로를
   1+(v-1)*amp 로 늘렸는데, 그러면 dev()의 0.05 하한을 건너뛰어 가격이
   음수가 된다(진폭 2.6배에서 1초 하락률이 −162%로 찍혀서 발견). 시뮬 네 개를
   다시 돌려야 했다.

   그래서 베끼지 않고 원본에서 잘라온다. 필요한 것은 네 덩어리뿐이다:
     randn · noiseScale/dev/buildMultiPhase/buildFlat · PATTERNS · PATTERN_TIER
   게임 쪽 함수 이름이 바뀌면 여기서 바로 터진다 — 조용히 어긋나는 것보다 낫다.

   쓰는 법:
     const G = require('./_game');
     const p = G.byId('up').gen(G.STOCKS.stable, 300);   // 경로 하나
     const pick = G.makePicker(0.04, G.STOCKS.coin);     // 3단계 가중치로 뽑기
*/
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

/* 시작 줄부터 "닫는 줄"까지를 통째로 가져온다. 정규식으로 함수 본문을 파싱하려
   들면 중첩 괄호에서 깨지므로, 게임이 쓰는 들여쓰기 규칙(최상위는 0칸)을 믿는다. */
function slice(startPat, endPat) {
  const i = SRC.indexOf(startPat);
  if (i < 0) throw new Error('못 찾음: ' + startPat);
  const j = SRC.indexOf(endPat, i);
  if (j < 0) throw new Error('끝을 못 찾음: ' + endPat + ' (시작: ' + startPat + ')');
  return SRC.slice(i, j + endPat.length);
}

const parts = [
  slice('function randn()', '\n'),
  slice('const ROUND_TICKS=', '\n'),
  slice('function noiseScale(T)', '\n'),
  slice('function dev(base,mult)', '\n'),
  /* DIP는 테스트 도구가 실시간으로 밀 수 있어야 해서 let이다. const로 찾으면
     조용히 안 깨지고 요란하게 깨진다 — 그게 낫다. */
  slice('let DIP=', '\n'),
  slice('let MID_DIP=', '\n'),
  slice('function midHead(st,p,lo,hi){', '\n}'),   // 보통 등급의 머리
  slice('function buildMultiPhase(keypoints,noiseAmt,T){', '\n}'),
  slice('function buildFlat(noiseAmt,driftAmt,T){', '\n}'),
  /* 하락의 반등 얼굴 비율. PATTERNS의 down이 읽으므로 같이 가져와야 한다.
     선언은 PATTERNS 뒤에 있지만 let은 호이스팅되고 gen은 나중에 불리므로 순서는 상관없다. */
  slice('let DOWN_NO_BOUNCE=', '\n'),
  slice('let DOWN_WEAK_BOUNCE=', '\n'),
  slice('const PATTERNS=[', '\n];'),
  slice('const PATTERN_TIER={', '};'),
];

const G = {};
(function () {
  // eslint-disable-next-line no-eval
  eval(parts.join('\n') + '\nG.randn=randn; G.ROUND_TICKS=ROUND_TICKS; G.noiseScale=noiseScale;' +
    'G.dev=dev; G.buildMultiPhase=buildMultiPhase; G.buildFlat=buildFlat; G.midHead=midHead;' +
    'G.PATTERNS=PATTERNS; G.PATTERN_TIER=PATTERN_TIER;' +
    /* DIP/MID_DIP은 게임 쪽에서 let이라 런타임에 밀 수 있다. 시뮬에서도
       같은 손잡이를 돌려야 "패턴을 바꿀 것인가 머리 깊이를 바꿀 것인가"를
       한 표에서 비교할 수 있다. */
    'G.setDIP=v=>{DIP=v}; G.getDIP=()=>DIP;' +
    'G.setMidDip=v=>{MID_DIP=v}; G.getMidDip=()=>MID_DIP;' +
    'G.setDownMix=(nb,wb)=>{DOWN_NO_BOUNCE=nb; DOWN_WEAK_BOUNCE=wb};' +
    'G.getDownMix=()=>[DOWN_NO_BOUNCE,DOWN_WEAK_BOUNCE];');
})();

/* 종목도 베끼지 않는다. 여기 손으로 옮겨 적은 patW가 조용히 어긋나 있었다 —
   동전주는 게임과 아예 다른 값이었고(spike 3 vs 2.5 · up 0.4 vs 1.0 · …),
   ETF는 나중에 들어온 crash·earlypop을 안 막고 있었다. 그 상태로 잰 종목별
   클리어율은 게임이 아니라 사본을 잰 값이다 — 이 파일이 생긴 이유가 바로
   그것이었는데 종목 표만 예외로 남아 있었다.

   UI 필드(emo·name·ds·lock)는 전부 게터고 open은 함수라, 배열을 만드는
   시점에는 t()도 ic()도 안 불린다. 그래서 그대로 평가할 수 있다.
   이름만 여기서 정해 준다 — 표시용이라 경로에는 영향이 없다. */
const STOCK_NAMES = { stable:'사성전자', theme:'네코프로', surge:'유메이드',
                      etf:'코스피ETF', penny:'동전주', coin:'코인' };
G.STOCKS = {};
(function () {
  const src = slice('const TRADE_STOCKS=[', '\n];')
    .replace(/^const TRADE_STOCKS=/, '').replace(/;\s*$/, '');
  // eslint-disable-next-line no-eval
  const list = eval('(' + src + ')');
  for (const st of list) {
    const o = { id: st.id, name: STOCK_NAMES[st.id] || st.id,
                pMult: st.pMult, noiseMult: st.noiseMult, rng: st.rng };
    if (st.ticks) o.ticks = st.ticks;
    if (st.patW)  o.patW  = st.patW;
    G.STOCKS[st.id] = o;
  }
  if (Object.keys(G.STOCKS).length !== 6) throw new Error('종목 수가 6이 아니다');
})();

G.ticksOf = st => (st && st.ticks) || G.ROUND_TICKS;
G.byId = id => G.PATTERNS.find(p => p.id === id);

/* 난이도 가중치 — index.html의 applyTierWeights()와 같은 식이다.
   약세에 down만큼 얹고 강세에서 같은 양을 뺀다(원본 비중에 비례해서). */
G.tierWeights = function (down) {
  const w = G.PATTERNS.map(p => p.weight);
  G.PATTERNS.forEach((p, i) => {
    const t = G.PATTERN_TIER[p.id];
    if (t === 'weak')   w[i] += down * (p.weight / 0.29);
    if (t === 'strong') w[i] -= down * (p.weight / 0.29);
  });
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / sum);
};

/* down = 난이도 하락 가중치(3단계는 0.04), stock = 종목(patW를 곱해서 반영) */
G.makePicker = function (down, stock) {
  const w = G.tierWeights(down);
  const pw = (stock && stock.patW) || null;
  const eff = G.PATTERNS.map((p, i) => pw && pw[p.id] !== undefined ? w[i] * pw[p.id] : w[i]);
  const sum = eff.reduce((a, b) => a + b, 0);
  const norm = eff.map(x => x / sum);
  return () => {
    let r = Math.random(), a = 0;
    for (let i = 0; i < norm.length; i++) { a += norm[i]; if (r <= a) return G.PATTERNS[i]; }
    return G.PATTERNS[G.PATTERNS.length - 1];
  };
};

/* 등급별 등장 확률 — 신호가 무엇을 말하게 되는지 확인할 때 쓴다 */
G.tierMix = function (down, stock) {
  const w = G.tierWeights(down);
  const pw = (stock && stock.patW) || null;
  const eff = G.PATTERNS.map((p, i) => pw && pw[p.id] !== undefined ? w[i] * pw[p.id] : w[i]);
  const sum = eff.reduce((a, b) => a + b, 0);
  const out = { strong: 0, mid: 0, weak: 0 };
  G.PATTERNS.forEach((p, i) => { out[G.PATTERN_TIER[p.id]] += eff[i] / sum; });
  return out;
};

module.exports = G;
