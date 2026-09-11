/* ⚰️ 죽은 가설 — 다시 시도하지 않기 위한 기록.

   "변동이 큰 종목이 거의 대부분 이득"을 고치려고 세 가지를 시도했고 전부 빗나갔다.
   셋 다 그럴듯해서 또 떠오를 것들이라 코드로 남긴다.

     1. 종목별 증거금  — 변동 큰 종목의 청산선을 가깝게
     2. 종목별 베팅상한 — 변동 큰 종목은 적게만 걸게
     3. 체결 지연      — 매도를 눌러도 N틱 뒤에 체결

   공통 원인: 매도 시점을 고를 수 있는 한 기대 성장률이 진폭에 비례한다.
   위험을 깎는 세금은 전부 빗나가고, 기대값 자체를 깎아야 듣는다(sim/spread.js).

   ⚠️ 이 파일은 _game.js로 다시 쓴 것이다. 처음 돌릴 때는 완성된 경로를
   1+(v-1)*amp 로 늘려 진폭을 흉내냈는데, 그러면 dev()의 0.05 하한을 건너뛰어
   가격이 음수가 된다(진폭 2.6배에서 1초 하락률 −162%). 종목 진폭은 반드시
   생성기 안에서 pMult로 적용해야 한다.

   사용: node sim/deadends.js   (5분 남짓) */
const G = require('./_game');

const MIN_BET = 10000, RATE = 0.10, LAG = 10, PB = 0.12, LEV = 3;
const GATES = [[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const DOWN = 0.04;                       // 3단계
const STOCKS = [['📊 ETF','etf'],['🏦 사성전자','stable'],['🎲 동전주','penny'],['🪙 코인','coin']];

/* opt = {liq, lag} — liq는 청산 배율(기본 1−1/LEV = 0.667), lag는 총 반응+체결 틱 */
function play(path, opt) {
  const liq = opt.liq !== undefined ? opt.liq : 1 - 1/LEV;
  const lag = opt.lag !== undefined ? opt.lag : LAG;
  const out = v => Math.max(0, 1 + (v-1)*LEV);
  let mx = path[0], pend = -1;
  for (let i=1;i<path.length;i++){
    const v = path[i];
    if (v <= liq) return 0;
    if (pend>=0){ if(i>=pend) return out(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-PB)) pend=i+lag; }
  }
  return out(path[path.length-1]);
}

/* cap = 현금 대비 베팅 상한 (1.0이면 제한 없음) */
function run(pick, stock, opt) {
  const cap = opt.cap !== undefined ? opt.cap : 1.0;
  const T = G.ticksOf(stock);
  let cash = 1e5, total = 0;
  for (const [goal, limit] of GATES) {
    let left = limit;
    while (cash < goal) {
      if (left <= 0) return '기한실패';
      if (cash < MIN_BET) return '파산';
      const need = Math.pow(goal/cash, 1/left);
      const f = Math.min(cap, Math.max(0.2, (need-1)/0.30));
      const bet = Math.max(MIN_BET, Math.min(Math.floor(cash*cap), Math.floor(cash*f)));
      cash = cash - bet + Math.max(0, bet*play(pick().gen(stock,T), opt));
      left--; total++;
      if (total > 500) return '초과';
    }
    cash += goal*RATE*Math.max(0, left);
  }
  return '클리어';
}
function rate(stock, opt, N=350) {
  const pick = G.makePicker(DOWN, stock);
  let c = 0; for (let k=0;k<N;k++) if (run(pick, stock, opt) === '클리어') c++;
  return c/N*100;
}
const pct = x => (x.toFixed(0)+'%').padStart(6);

console.log('■ 출발점 — 종목은 진폭으로만 갈린다 (3배 · 3단계)');
for (const [nm,id] of STOCKS) {
  const st = G.STOCKS[id];
  console.log(`  ${nm.padEnd(12)} pMult ${String(st.pMult).padEnd(5)} 클리어 ${pct(rate(st,{}))}`);
}

console.log('\n■ 죽은 가설 1 — 종목별 증거금 (청산선을 가깝게)');
console.log('  종목          0.55   0.62   0.67   0.74   0.80   0.85');
for (const [nm,id] of STOCKS) {
  const st = G.STOCKS[id];
  console.log(`  ${nm.padEnd(12)}` + [0.55,0.62,0.667,0.74,0.80,0.85].map(l=>pct(rate(st,{liq:l}))).join(' '));
}
console.log('  → 코인은 청산선 0.85에서도 살아남는다. 트레일링 스톱이 청산선에');
console.log('    닿기 전에 빠져나가므로 "수준"을 보는 장치는 전부 빗나간다.');

console.log('\n■ 죽은 가설 2 — 종목별 베팅 상한');
console.log('  종목          100%    75%    50%    35%    25%');
for (const [nm,id] of STOCKS) {
  const st = G.STOCKS[id];
  console.log(`  ${nm.padEnd(12)}` + [1.0,0.75,0.5,0.35,0.25].map(c=>pct(rate(st,{cap:c}))).join(' '));
}
console.log('  → 변동 큰 종목은 상한을 걸면 오히려 좋아진다. 진폭이 크면 적게 걸어도');
console.log('    필요 수익률이 나오므로, 상한이 과베팅(안티-켈리)을 고쳐주는 선물이 된다.');

console.log('\n■ 죽은 가설 3 — 체결 지연 (반응 0.5초 = 10틱에 더한다)');
console.log('  종목          지연없음  +0.2초  +0.4초  +0.7초');
for (const [nm,id] of STOCKS) {
  const st = G.STOCKS[id];
  console.log(`  ${nm.padEnd(12)}` + [10,14,18,24].map(l=>pct(rate(st,{lag:l}))).join(' '));
}
console.log('  → 난이도 다이얼로는 강하지만 종목 간 격차를 못 뒤집는다. 게다가 누른');
console.log('    가격이 기준점이 되어 차액이 "빼앗긴 돈"으로 기억된다 — 계약을 깬다.');
