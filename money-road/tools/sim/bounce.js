/* 🪂 급락 뒤에 "탈출 구간"을 주면 3배에서도 전반부 급락이 성립하는가.

   crash1st.js에서 막힌 지점: 상승장에도 전반부 급락을 깔면 전반부가 정보를 잃어
   좋지만, 동시에 버틸 근거도 사라져서 모든 전략이 무너졌다(trail 17%→1%).
   3배 청산선이 0.67이라 급락을 버티는 것이 곧 죽음이었기 때문이다.

   이번 설계: 하락장도 급락으로 시작하되 청산선을 바로 뚫지 않는다. 0.70 근처에서
   한 번 되돌아 올라왔다가 다시 내려간다. 그 반등이 탈출 구간이다 — 거기서 털면
   크게 손해지만 살고, 안 털면 청산된다. 상승장도 같은 얼굴로 급락했다가
   반등하지만 그쪽은 되돌림 뒤에 진짜로 올라간다.

   그래서 전반부는 둘이 구분되지 않고, 갈림은 반등 이후에 온다.
   신호 적중률은 55% 그대로 둔다 — 올리면 너무 쉬워진다.

   단조 패턴(한 번 오르면 계속 오름 / 한 번 내리면 계속 내림)은 소수만 남긴다.

   전략 다섯:
     trail   — 고점 대비 12% 밀리면 손절 (지금의 정답)
     panic   — 진입가 −4%면 즉시 (쫄보)
     bounce  — 급락을 맞으면 손절선을 좁혀서 반등에 탈출 (이 설계가 가르치려는 것)
     conv    — 강세 신호면 전반부를 견디고 후반에만 판단
     hold    — 끝까지 보유

   사용: node sim/bounce.js   (5분 남짓) */
const G = require('./_game');

const MIN_BET = 10000, RATE = 0.10, LAG = 10, LEV = 3, LIQ = 1 - 1/LEV;
const BASE_GATES = [[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
let GATES = BASE_GATES;
function setDays(mul){ GATES = BASE_GATES.map(([g,d])=>[g, Math.round(d*mul)]); }
const DOWN = 0.04, INFO_ACC = 0.55;          // 신호는 그대로
const TIERS = ['strong','mid','weak'];
const dev = G.dev, mp = G.buildMultiPhase, ns = G.noiseScale;
const R = (lo,sp) => lo + Math.random()*sp;

/* 급락 → 반등 → 되돌림 → 목적지. 키포인트를 넷 두어 단조로워지지 않게 한다.
   dip은 청산선(0.67)보다 위에서 멈춘다. 거기서 죽으면 판단할 기회가 없다. */
const crashRally = (st,T) => mp([
  [R(0.18,0.10), dev(R(0.72,0.10), st.pMult)],   // 급락 — 0.72~0.82
  [R(0.42,0.10), dev(R(0.96,0.16), st.pMult)],   // 반등 — 여기가 탈출 구간
  [R(0.62,0.08), dev(R(0.86,0.12), st.pMult)],   // 되돌림 — 한 번 더 흔든다
  [1,            dev(R(1.70,0.25), st.pMult)],   // 진짜 상승
], 0.013*ns(T)*st.noiseMult, T);

const crashBounce = (st,T) => mp([
  [R(0.18,0.10), dev(R(0.70,0.07), st.pMult)],   // 같은 얼굴로 급락
  [R(0.42,0.10), dev(R(0.90,0.12), st.pMult)],   // 데드캣 — 안 털면 여기가 마지막 기회
  [R(0.65,0.08), dev(R(0.74,0.08), st.pMult)],
  [1,            dev(R(0.45,0.15), st.pMult)],   // 결국 청산선 아래로
], 0.013*ns(T)*st.noiseMult, T);

/* 오르다 한 번 크게 밀리고 다시 오르는 보통 등급 — 단조로움을 깨는 쪽 */
const rallyDipRally = (st,T) => mp([
  [R(0.20,0.08), dev(R(1.25,0.20), st.pMult)],
  [R(0.45,0.10), dev(R(0.80,0.10), st.pMult)],
  [1,            dev(R(1.15,0.30), st.pMult)],
], 0.013*ns(T)*st.noiseMult, T);

const VARIANTS = {
  '지금': {},

  'B1 급락 + 탈출 구간': {
    up:    { weight:0.20, gen: crashRally },
    down:  { weight:0.20, gen: crashBounce },
    spike: { tier:'mid' },
  },

  'B2 + 단조 패턴 축소': {
    up:        { weight:0.22, gen: crashRally },
    down:      { weight:0.22, gen: crashBounce },
    spike:     { tier:'mid' },
    delayup:   { weight:0.04 },      // 쭉 오름 — 소수만
    delaydown: { weight:0.04 },      // 쭉 내림 — 소수만
    v:         { weight:0.12, gen: rallyDipRally },
  },

  'B3 + 탈출 구간을 얕게': {
    up:        { weight:0.22, gen:(st,T)=>mp([
                  [R(0.18,0.10), dev(R(0.72,0.10), st.pMult)],
                  [R(0.42,0.10), dev(R(0.88,0.10), st.pMult)],   // 반등이 덜 올라옴
                  [R(0.62,0.08), dev(R(0.82,0.10), st.pMult)],
                  [1,            dev(R(1.70,0.25), st.pMult)]], 0.013*ns(T)*st.noiseMult,T) },
    down:      { weight:0.22, gen:(st,T)=>mp([
                  [R(0.18,0.10), dev(R(0.70,0.07), st.pMult)],
                  [R(0.42,0.10), dev(R(0.82,0.08), st.pMult)],
                  [R(0.65,0.08), dev(R(0.72,0.06), st.pMult)],
                  [1,            dev(R(0.45,0.15), st.pMult)]], 0.013*ns(T)*st.noiseMult,T) },
    spike:     { tier:'mid' },
    delayup:   { weight:0.04 },
    delaydown: { weight:0.04 },
    v:         { weight:0.12, gen: rallyDipRally },
  },
};

function build(spec){
  const pats = G.PATTERNS.map(p=>{ const s=spec[p.id]; if(!s) return {...p};
    const o={...p}; if(s.weight!==undefined)o.weight=s.weight; if(s.gen)o.gen=s.gen; return o; });
  const tier = {...G.PATTERN_TIER};
  for(const id in spec) if(spec[id].tier) tier[id]=spec[id].tier;
  return {pats, tier};
}
function picker(pats,tier,down){
  const b = pats.map(p=>p.weight);
  const sS = pats.reduce((a,p,i)=>a+(tier[p.id]==='strong'?b[i]:0),0);
  const wS = pats.reduce((a,p,i)=>a+(tier[p.id]==='weak'  ?b[i]:0),0);
  const w = b.map((x,i)=>{ const t=tier[pats[i].id];
    if(t==='weak')  return x+down*(x/wS);
    if(t==='strong')return x-down*(x/sS);
    return x; });
  const sum=w.reduce((a,c)=>a+c,0), n=w.map(x=>x/sum);
  return ()=>{ let r=Math.random(),a=0;
    for(let i=0;i<n.length;i++){a+=n[i]; if(r<=a) return {p:pats[i],t:tier[pats[i].id]};}
    return {p:pats[9],t:tier[pats[9].id]}; };
}

/* ── 전략 ─────────────────────────────────────────────────────────────── */
const cash = v => Math.max(0, 1+(v-1)*LEV);
function trail(path, pb, fromFrac){
  const start = Math.floor((path.length-1)*(fromFrac||0));
  let mx = path[0], pend = -1;
  for(let i=1;i<path.length;i++){
    const v = path[i];
    if(v<=LIQ) return 0;
    if(i<start){ if(v>mx)mx=v; continue; }
    if(pend>=0){ if(i>=pend) return cash(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; }
  }
  return cash(path[path.length-1]);
}
function panic(path){
  let mx=path[0], pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(v<=0.96) return cash(v);
    if(pend>=0){ if(i>=pend) return cash(v); }
    else { if(v>mx)mx=v; if(v<mx*0.88) pend=i+LAG; } }
  return cash(path[path.length-1]);
}
/* 급락을 맞으면(0.85 아래) 손절선을 6%로 좁혀서 반등에 빠져나온다 */
function bounce(path){
  let mx=path[0], pend=-1, hit=false;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(v<=0.85) hit=true;
    const pb = hit ? 0.06 : 0.12;
    if(pend>=0){ if(i>=pend) return cash(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; } }
  return cash(path[path.length-1]);
}
function hold(path){
  for(let i=1;i<path.length;i++) if(path[i]<=LIQ) return 0;
  return cash(path[path.length-1]);
}
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];

function run(pick, stock, mode){
  const T = G.ticksOf(stock);
  let money = 1e5, total = 0;
  for(const [goal,limit] of GATES){
    let left = limit;
    while(money<goal){
      if(left<=0) return '기한실패';
      if(money<MIN_BET) return '파산';
      const need = Math.pow(goal/money, 1/left);
      const f = Math.min(1, Math.max(0.2, (need-1)/0.30));
      const bet = Math.max(MIN_BET, Math.min(money, Math.floor(money*f)));
      const {p,t} = pick();
      let ret;
      if(mode==='conv'){
        const s = sigOf(t);
        if(s==='weak'){ left--; total++; if(total>500) return '초과'; continue; }
        const path = p.gen(stock,T);
        ret = s==='strong' ? trail(path,0.12,0.55) : trail(path,0.12,0);
      }
      else if(mode==='trail')  ret = trail(p.gen(stock,T),0.12,0);
      else if(mode==='panic')  ret = panic(p.gen(stock,T));
      else if(mode==='bounce') ret = bounce(p.gen(stock,T));
      else                     ret = hold(p.gen(stock,T));
      money = money - bet + Math.max(0, bet*ret);
      left--; total++;
      if(total>500) return '초과';
    }
    money += goal*RATE*Math.max(0,left);
  }
  return '클리어';
}

const stock = G.STOCKS.stable;
const MODES = ['trail','panic','bounce','conv','hold'];
console.log('■ 급락 뒤 탈출 구간 (사성전자 · 3배 · 3단계 · 신호 55% 그대로)\n');
console.log('  안                        trail   panic  bounce    conv    hold');
const built = {};
for(const [name,spec] of Object.entries(VARIANTS)){
  const b = build(spec); built[name]=b;
  const pick = picker(b.pats, b.tier, DOWN);
  const cells = MODES.map(m=>{ const N=350; let c=0;
    for(let k=0;k<N;k++) if(run(pick,stock,m)==='클리어') c++;
    return ((c/N*100).toFixed(0)+'%').padStart(7); }).join(' ');
  console.log(`  ${name.padEnd(24)}${cells}`);
}

console.log('\n■ 전반부(0~50%)가 등급을 숨기는가 — 저점 하위 25%/50%');
for(const [name,b] of Object.entries(built)){
  const q = t => {
    const sub = b.pats.filter(p=>b.tier[p.id]===t);
    const tot = sub.reduce((a,p)=>a+p.weight,0), lows=[];
    for(let k=0;k<3000;k++){
      let r=Math.random()*tot,a=0,pk=sub[0];
      for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
      const arr=pk.gen(stock,300), h=Math.floor((arr.length-1)*0.5);
      let lo=9; for(let i=1;i<=h;i++) if(arr[i]<lo)lo=arr[i];
      lows.push(lo);
    }
    lows.sort((x,y)=>x-y);
    return [lows[(lows.length*0.25)|0], lows[(lows.length*0.5)|0]];
  };
  const S=q('strong'), W=q('weak');
  console.log(`  ${name.padEnd(24)} 강세 ${S[0].toFixed(2)}/${S[1].toFixed(2)}   약세 ${W[0].toFixed(2)}/${W[1].toFixed(2)}`);
}

console.log('\n■ 탈출 구간이 실제로 열리는가 — 약세 판에서 청산 전 최고 회복');
for(const [name,b] of Object.entries(built)){
  const sub = b.pats.filter(p=>b.tier[p.id]==='weak');
  const tot = sub.reduce((a,p)=>a+p.weight,0);
  let died=0, escape=[];
  for(let k=0;k<3000;k++){
    let r=Math.random()*tot,a=0,pk=sub[0];
    for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
    const arr=pk.gen(stock,300);
    let dip=false, best=0, liq=false;
    for(let i=1;i<arr.length;i++){
      if(arr[i]<=LIQ){ liq=true; break; }
      if(arr[i]<=0.85) dip=true;
      if(dip && arr[i]>best) best=arr[i];
    }
    if(liq) died++;
    if(dip && best>0) escape.push(best);
  }
  escape.sort((x,y)=>x-y);
  const med = escape.length ? escape[(escape.length/2)|0] : 0;
  console.log(`  ${name.padEnd(24)} 청산까지 간 판 ${(died/3000*100).toFixed(0).padStart(3)}%` +
    `   급락 뒤 회복 고점 중앙값 ${med.toFixed(2)}  (3배 손익 ${((med-1)*3*100).toFixed(0)}%)`);
}

/* ── 급락 깊이 스윕 ──────────────────────────────────────────────────────
   전반부 급락을 얼마나 깊게 파야 "빠르게 털기"가 죽고, 그러면서도 게임이
   살아남는가. 3배에서 바닥 d는 베팅금 기준 (d−1)×3 의 평가손이다.
     0.72 → −84%    0.78 → −66%    0.84 → −48%    0.90 → −30% */
console.log('\n■ 급락 깊이를 바꿔가며 (탈출 구간은 유지 · 단조 패턴 축소 적용)');
console.log('  바닥    3배 평가손   trail   panic  bounce    conv    hold');
for (const d of [0.72, 0.78, 0.84, 0.88, 0.92]) {
  const spec = {
    up:   { weight:0.22, gen:(st,T)=>mp([
            [R(0.18,0.10), dev(R(d,0.06), st.pMult)],
            [R(0.42,0.10), dev(R(d+0.18,0.12), st.pMult)],
            [R(0.62,0.08), dev(R(d+0.10,0.10), st.pMult)],
            [1,            dev(R(1.70,0.25), st.pMult)]], 0.013*ns(T)*st.noiseMult,T) },
    down: { weight:0.22, gen:(st,T)=>mp([
            [R(0.18,0.10), dev(R(d-0.02,0.06), st.pMult)],
            [R(0.42,0.10), dev(R(d+0.16,0.10), st.pMult)],
            [R(0.65,0.08), dev(R(d,0.06), st.pMult)],
            [1,            dev(R(0.45,0.15), st.pMult)]], 0.013*ns(T)*st.noiseMult,T) },
    spike:{ tier:'mid' }, delayup:{weight:0.04}, delaydown:{weight:0.04},
    v:    { weight:0.12, gen: rallyDipRally },
  };
  const b = build(spec), pick = picker(b.pats, b.tier, DOWN);
  const cells = MODES.map(m=>{ const N=350; let c=0;
    for(let k=0;k<N;k++) if(run(pick,stock,m)==='클리어') c++;
    return ((c/N*100).toFixed(0)+'%').padStart(7); }).join(' ');
  console.log(`  ${d.toFixed(2)}   ${((d-1)*300).toFixed(0)+'%'}`.padEnd(22) + cells);
}


/* ── 채택안(급락 0.84)에서 거래일이 얼마나 필요한가 ──────────────────────
   0.84는 전략 독주를 없애는 대신 난이도를 크게 올린다. 지금 최고 전략이
   65%(panic)인데 0.84에서는 18%다. 거래일로 되돌려야 한다. */
const DIP = 0.84;
const ADOPTED = {
  up:   { weight:0.22, gen:(st,T)=>mp([
          [R(0.18,0.10), dev(R(DIP,0.06), st.pMult)],
          [R(0.42,0.10), dev(R(DIP+0.18,0.12), st.pMult)],
          [R(0.62,0.08), dev(R(DIP+0.10,0.10), st.pMult)],
          [1,            dev(R(1.70,0.25), st.pMult)]], 0.013*ns(T)*st.noiseMult,T) },
  down: { weight:0.22, gen:(st,T)=>mp([
          [R(0.18,0.10), dev(R(DIP-0.02,0.06), st.pMult)],
          [R(0.42,0.10), dev(R(DIP+0.16,0.10), st.pMult)],
          [R(0.65,0.08), dev(R(DIP,0.06), st.pMult)],
          [1,            dev(R(0.45,0.15), st.pMult)]], 0.013*ns(T)*st.noiseMult,T) },
  spike:{ tier:'mid' }, delayup:{weight:0.04}, delaydown:{weight:0.04},
  v:    { weight:0.12, gen: rallyDipRally },
};
console.log('\n■ 급락 0.84에서 거래일을 늘리면 (총 103일이 기준)');
console.log('  거래일          trail   panic  bounce    conv    최고');
{
  const b = build(ADOPTED), pick = picker(b.pats, b.tier, DOWN);
  for (const mul of [1.0, 1.3, 1.6, 2.0, 2.5]) {
    setDays(mul);
    const tot = GATES.reduce((a,[,d])=>a+d,0);
    const vals = ['trail','panic','bounce','conv'].map(m=>{
      const N=350; let c=0;
      for(let k=0;k<N;k++) if(run(pick,stock,m)==='클리어') c++;
      return c/N*100;
    });
    const best = Math.max(...vals);
    console.log(`  ×${mul.toFixed(1)} (${String(tot).padStart(3)}일)  ` +
      vals.map(v=>(v.toFixed(0)+'%').padStart(7)).join(' ') +
      `  ${(best.toFixed(0)+'%').padStart(6)}`);
  }
  setDays(1.0);
}
console.log('\n  참고 — 지금 패턴 · 103일에서 최고는 panic 65%, trail 21%');
