/* 💥 전반부 급락을 상승장에도 깔면 "급락이면 빼고 급등이면 들고"가 깨지는가.

   지금 문제: 라운드 절반이 지나기 전에 나오는 급등·급락이 그대로 매도 신호로
   쓰인다. 강세 3종의 저점이 전부 1.00 근처(up 1.00 · delayup 0.99)라 상승장은
   한 번도 마이너스로 안 내려가고, 급락하는 판은 거의 다 진짜 하락장이다.
   그러니 "초반에 빠지면 던진다"가 거의 언제나 맞는 규칙이 된다.

   고치는 방향: 상승장의 대부분을 "전반부 급락 → 후반 급등"으로 만들고,
   처음부터 쭉 오르는 패턴은 10~20%만 남긴다.

   ⚠️ 함정: 상승장만 급락으로 시작하면 "초반 급락 = 들고 있어라"라는 새 규칙이
   생길 뿐이다. 하락장도 같은 얼굴로 시작해야 전반부가 정보를 잃는다.
   그래서 V2에서 약세에도 같은 급락을 깐다.

   ⚠️ 제약: 3배 청산선이 0.67이다. 급락 바닥이 그 아래로 내려가면 보유 자체가
   불가능해지므로, 바닥은 0.70~0.85 사이에서만 움직일 수 있다. 그 좁은 띠가
   이 설계의 실제 여유 공간이다.

   전략 다섯을 같이 돌린다. 마지막 'patient'가 중요하다 — 전반부를 통째로
   무시하고 후반에만 트레일링하는 전략이다. 이게 새 정답이 되어버리면
   구멍을 한 칸 옮긴 것뿐이다.

   사용: node sim/crash1st.js   (5분 남짓) */
const G = require('./_game');

const MIN_BET = 10000, RATE = 0.10, LAG = 10;
let LEV = 3, LIQ = 1 - 1/LEV;
function setLev(x){ LEV = x; LIQ = x>1 ? 1-1/x : 0; }
const GATES = [[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const DOWN = 0.04;
let INFO_ACC = 0.55;
const TIERS = ['strong','mid','weak'];
const dev = G.dev, mp = G.buildMultiPhase, ns = G.noiseScale;
const R = (lo, span) => lo + Math.random()*span;

/* 전반부 급락 → 후반 목적지. dipLo~dipLo+dipSpan 이 바닥, at 이 바닥 시점. */
function crashThen(dipLo, dipSpan, endLo, endSpan, at, noise) {
  return (st,T) => mp(
    [[at[0]+Math.random()*at[1], dev(R(dipLo,dipSpan), st.pMult)],
     [1, dev(R(endLo,endSpan), st.pMult)]],
    noise*ns(T)*st.noiseMult, T);
}

const VARIANTS = {
  '지금': {},

  'V1 강세를 급락후급등으로': {
    up:    { weight:0.20, gen: crashThen(0.74,0.10, 1.70,0.25, [0.25,0.15], 0.014) },
    spike: { tier:'mid' },
  },

  'V2 약세도 같은 얼굴로': {
    up:    { weight:0.20, gen: crashThen(0.74,0.10, 1.70,0.25, [0.25,0.15], 0.014) },
    spike: { tier:'mid' },
    down:  { weight:0.20, gen: crashThen(0.74,0.10, 0.42,0.15, [0.25,0.15], 0.014) },
  },

  'V3 쭉 오르는 건 17%만': {
    up:      { weight:0.20, gen: crashThen(0.74,0.10, 1.70,0.25, [0.25,0.15], 0.014) },
    spike:   { tier:'mid' },
    down:    { weight:0.20, gen: crashThen(0.74,0.10, 0.42,0.15, [0.25,0.15], 0.014) },
    delayup: { weight:0.04 },
  },

  'V4 급락을 더 깊게 (0.70~0.78)': {
    up:      { weight:0.20, gen: crashThen(0.70,0.08, 1.70,0.25, [0.25,0.15], 0.014) },
    spike:   { tier:'mid' },
    down:    { weight:0.20, gen: crashThen(0.70,0.08, 0.42,0.15, [0.25,0.15], 0.014) },
    delayup: { weight:0.04 },
  },
};

function build(spec) {
  const pats = G.PATTERNS.map(p => {
    const s = spec[p.id]; if (!s) return { ...p };
    const out = { ...p };
    if (s.weight !== undefined) out.weight = s.weight;
    if (s.gen) out.gen = s.gen;
    return out;
  });
  const tier = { ...G.PATTERN_TIER };
  for (const id in spec) if (spec[id].tier) tier[id] = spec[id].tier;
  return { pats, tier };
}
function picker(pats, tier, down) {
  const base = pats.map(p => p.weight);
  const sSum = pats.reduce((a,p,i)=>a+(tier[p.id]==='strong'?base[i]:0),0);
  const wSum = pats.reduce((a,p,i)=>a+(tier[p.id]==='weak'  ?base[i]:0),0);
  const w = base.map((b,i)=>{ const t=tier[pats[i].id];
    if(t==='weak')  return b + down*(b/wSum);
    if(t==='strong')return b - down*(b/sSum);
    return b; });
  const sum = w.reduce((a,b)=>a+b,0), norm = w.map(x=>x/sum);
  return () => { let r=Math.random(),a=0;
    for(let i=0;i<norm.length;i++){a+=norm[i]; if(r<=a) return {p:pats[i],t:tier[pats[i].id]};}
    return {p:pats[9],t:tier[pats[9].id]}; };
}

/* ── 전략 ─────────────────────────────────────────────────────────────── */
const cash = (v) => Math.max(0, 1+(v-1)*LEV);
function trail(path, pb, fromFrac) {
  const start = Math.floor((path.length-1)*(fromFrac||0));
  let mx = path[start] || path[0], pend = -1;
  for (let i=1;i<path.length;i++){
    const v = path[i];
    if (v<=LIQ) return 0;                       // 청산은 전반부에도 발동
    if (i < start) continue;                    // patient: 전반부는 쳐다보지 않는다
    if (pend>=0){ if(i>=pend) return cash(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; }
  }
  return cash(path[path.length-1]);
}
function panic(path) {
  let mx = path[0], pend = -1;
  for (let i=1;i<path.length;i++){
    const v = path[i];
    if (v<=LIQ) return 0;
    if (v<=0.96) return cash(v);                // 진입가 −4%면 즉시 던진다
    if (pend>=0){ if(i>=pend) return cash(v); }
    else { if(v>mx)mx=v; if(v<mx*0.88) pend=i+LAG; }
  }
  return cash(path[path.length-1]);
}
function hold(path) {
  for (let i=1;i<path.length;i++) if (path[i]<=LIQ) return 0;
  return cash(path[path.length-1]);
}
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];
const MODES = {
  trail:   (p)=>trail(p,0.12,0),
  panic:   (p)=>panic(p),
  patient: (p)=>trail(p,0.12,0.5),              // 전반부 무시, 후반에만 트레일링
  hold:    (p)=>hold(p),
};

function run(pick, stock, mode) {
  const T = G.ticksOf(stock);
  let money = 1e5, total = 0;
  for (const [goal, limit] of GATES) {
    let left = limit;
    while (money < goal) {
      if (left<=0) return '기한실패';
      if (money<MIN_BET) return '파산';
      const need = Math.pow(goal/money, 1/left);
      const f = Math.min(1, Math.max(0.2, (need-1)/(0.30*LEV/3)));
      const bet = Math.max(MIN_BET, Math.min(money, Math.floor(money*f)));
      const {p,t} = pick();
      let ret;
      if (mode==='sig') {
        const s = sigOf(t);
        if (s==='weak'){ left--; total++; if(total>500) return '초과'; continue; }
        const path = p.gen(stock,T);
        ret = s==='strong' ? hold(path) : trail(path,0.12,0);
      } else ret = MODES[mode](p.gen(stock,T));
      money = money - bet + Math.max(0, bet*ret);
      left--; total++;
      if (total>500) return '초과';
    }
    money += goal*RATE*Math.max(0,left);
  }
  return '클리어';
}

const stock = G.STOCKS.stable;
console.log('■ 전반부 급락을 상승장에도 깔면 (사성전자 · 3배 · 3단계 · 신호 55%)\n');
console.log('  안                             trail   panic  patient    hold     sig');
for (const [name, spec] of Object.entries(VARIANTS)) {
  const {pats, tier} = build(spec);
  const pick = picker(pats, tier, DOWN);
  const cells = ['trail','panic','patient','hold','sig'].map(m=>{
    const N=350; let c=0;
    for(let k=0;k<N;k++) if(run(pick,stock,m)==='클리어') c++;
    return ((c/N*100).toFixed(0)+'%').padStart(7);
  }).join(' ');
  console.log(`  ${name.padEnd(30)}${cells}`);
}

console.log('\n■ 같은 패턴을 레버리지별로 — 급락이 들어갈 공간이 있는가');
console.log('  (청산선: 3배 0.67 · 2배 0.50 · 1.5배 0.33)\n');
console.log('  안                          배율    청산   trail   panic  patient    hold');
for (const [name, spec] of Object.entries(VARIANTS)) {
  if (name !== '지금' && !name.startsWith('V3')) continue;
  const {pats, tier} = build(spec);
  const pick = picker(pats, tier, DOWN);
  for (const lv of [3, 2, 1.5]) {
    setLev(lv);
    const cells = ['trail','panic','patient','hold'].map(m=>{
      const N=350; let c=0;
      for(let k=0;k<N;k++) if(run(pick,stock,m)==='클리어') c++;
      return ((c/N*100).toFixed(0)+'%').padStart(7);
    }).join(' ');
    console.log(`  ${(lv===3?name:'').padEnd(26)} ${(lv+'배').padStart(5)} ${LIQ.toFixed(2).padStart(6)}${cells}`);
  }
  console.log('  ' + '─'.repeat(66));
}
setLev(3);

console.log('\n■ 전반부(0~50%) 저점 분포 — 가중치대로 뽑아서 하위 25%/50%');
for (const [name, spec] of Object.entries(VARIANTS)) {
  const {pats, tier} = build(spec);
  const q = (t) => {
    const sub = pats.filter(p=>tier[p.id]===t);
    const tot = sub.reduce((a,p)=>a+p.weight,0);
    const lows=[];
    for (let k=0;k<3000;k++){
      let r=Math.random()*tot, a=0, pick=sub[0];
      for(const p of sub){ a+=p.weight; if(r<=a){pick=p;break;} }
      const arr=pick.gen(stock,300), h=Math.floor((arr.length-1)*0.5);
      let lo=9; for(let i=1;i<=h;i++) if(arr[i]<lo) lo=arr[i];
      lows.push(lo);
    }
    lows.sort((x,y)=>x-y);
    return [lows[(lows.length*0.25)|0], lows[(lows.length*0.5)|0]];
  };
  const S=q('strong'), W=q('weak');
  console.log(`  ${name.padEnd(30)} 강세 ${S[0].toFixed(2)}/${S[1].toFixed(2)}   약세 ${W[0].toFixed(2)}/${W[1].toFixed(2)}`);
}

/* 패턴에서 정보를 빼면, 그만큼 신호에 정보를 넣어야 버틸 근거가 생긴다.
   'conv'(확신) — 강세 신호면 전반부 급락을 견디고 후반에만 트레일링,
   약세면 관망, 보통이면 평소대로. 신호를 믿는 대가가 얼마인지를 잰다. */
MODES.conv = null;   // run() 안에서 따로 처리
const runConv = (pick, stock) => {
  const T = G.ticksOf(stock);
  let money = 1e5, total = 0;
  for (const [goal, limit] of GATES) {
    let left = limit;
    while (money < goal) {
      if (left<=0) return '기한실패';
      if (money<MIN_BET) return '파산';
      const need = Math.pow(goal/money, 1/left);
      const f = Math.min(1, Math.max(0.2, (need-1)/(0.30*LEV/3)));
      const bet = Math.max(MIN_BET, Math.min(money, Math.floor(money*f)));
      const {p,t} = pick(); const sg = sigOf(t);
      if (sg==='weak'){ left--; total++; if(total>500) return '초과'; continue; }
      const path = p.gen(stock,T);
      const ret = sg==='strong' ? trail(path,0.12,0.5) : trail(path,0.12,0);
      money = money - bet + Math.max(0, bet*ret);
      left--; total++;
      if (total>500) return '초과';
    }
    money += goal*RATE*Math.max(0,left);
  }
  return '클리어';
};

console.log('\n■ 신호 적중률을 올리면 "믿고 버티기"가 성립하는가 (V3 패턴 · 3배)');
console.log('  적중률    trail   panic  patient    conv');
{
  const {pats, tier} = build(VARIANTS['V3 쭉 오르는 건 17%만']);
  const pick = picker(pats, tier, DOWN);
  setLev(3);
  for (const acc of [0.55, 0.70, 0.85, 0.95]) {
    INFO_ACC = acc;
    const cells = ['trail','panic','patient'].map(m=>{
      const N=350; let c=0;
      for(let k=0;k<N;k++) if(run(pick,stock,m)==='클리어') c++;
      return ((c/N*100).toFixed(0)+'%').padStart(7);
    });
    let c=0; for(let k=0;k<350;k++) if(runConv(pick,stock)==='클리어') c++;
    cells.push(((c/350*100).toFixed(0)+'%').padStart(7));
    console.log(`  ${(Math.round(acc*100)+'%').padStart(5)}  ${cells.join(' ')}`);
  }
  INFO_ACC = 0.55;
}
console.log('\n  비교 — 지금 패턴, 적중률 55%:  trail 17~19% · panic 65~70%');
