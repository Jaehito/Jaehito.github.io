/* 🔧 종목 밸런스 후보 스윕 — 한 종목의 손잡이를 바꿔가며 클리어율을 잰다.

   inst.js가 문제를 찾고, 이 파일이 후보를 고른다. 종목 하나만 돌리므로
   inst.js 한 판(6종목)의 1/6 값이면 끝난다.

   손잡이는 셋이다 — pMult(추세 크기) · noiseMult(흔들림) · patW(등급 안 패턴 분포).
   진폭을 키우면 기댓값과 파산이 같이 오르고, patW는 기댓값만 민다.

   사용: node sim/instfix.js <종목id> [N]   예: node sim/instfix.js etf 200 */
const G = require('./_game');
const T = 300, LEV = 3, LIQ = 1 - 1/LEV, LAG = 10;
const cash = v => Math.max(0, 1+(v-1)*LEV);
function picker(down, stock){
  const pw=(stock&&stock.patW)||null;
  const b = G.PATTERNS.map(p=> p.weight * (pw&&pw[p.id]!==undefined?pw[p.id]:1));
  const sS = G.PATTERNS.reduce((a,p,i)=>a+(G.PATTERN_TIER[p.id]==='strong'?b[i]:0),0);
  const wS = G.PATTERNS.reduce((a,p,i)=>a+(G.PATTERN_TIER[p.id]==='weak'  ?b[i]:0),0);
  const w = b.map((x,i)=>{ const t=G.PATTERN_TIER[G.PATTERNS[i].id];
    if(t==='weak')  return x+down*(x/wS);
    if(t==='strong')return x-down*(x/sS);
    return x; });
  const sum=w.reduce((a,c)=>a+c,0), n=w.map(x=>x/sum);
  const mix={strong:0,mid:0,weak:0}; G.PATTERNS.forEach((p,i)=>mix[G.PATTERN_TIER[p.id]]+=n[i]);
  return [()=>{ let r=Math.random(),a=0;
    for(let i=0;i<n.length;i++){a+=n[i]; if(r<=a)return {p:G.PATTERNS[i],t:G.PATTERN_TIER[G.PATTERNS[i].id]};}
    const L=G.PATTERNS.length-1; return {p:G.PATTERNS[L],t:G.PATTERN_TIER[G.PATTERNS[L].id]}; }, mix];
}
function warmTrail(path, warm, pb){
  let mx=path[0], pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(pend>=0){ if(i>=pend) return cash(v); continue; }
    if(i<warm) continue;
    if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; }
  return cash(path[path.length-1]); }
function panic(path){ let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ)return 0; if(v<=0.96)return cash(v);
    if(pend>=0){ if(i>=pend)return cash(v); } else { if(v>mx)mx=v; if(v<mx*0.88)pend=i+LAG; } }
  return cash(path[path.length-1]); }
function hold(path){ for(let i=1;i<path.length;i++) if(path[i]<=LIQ)return 0;
  return cash(path[path.length-1]); }
/* 「25%를 버틴다」는 그 판 길이의 25%다. T(=300)로 고정해 두면 20초짜리 코인에서만
   26%·18%가 되어, 코인은 다른 종목과 다른 전략을 재고 있게 된다 — 코인이 유독
   약하게 나오던 이유의 일부였다. 경로 길이에서 뽑는다. */
const warmAt = (p,f) => Math.floor((p.length-1)*f);
const MODES={ '트레일12':p=>warmTrail(p,0,0.12), '버티25':p=>warmTrail(p,warmAt(p,0.25),0.12),
  '버티35':p=>warmTrail(p,warmAt(p,0.35),0.08), '쫄보':panic, '홀드':hold };
const GATES=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const MIN_BET=10000, RATE=0.10, INFO_ACC=0.55, TIERS=['strong','mid','weak'];
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];
function runOne(pick, mode, stock){
  const Tt=G.ticksOf(stock); let money=1e5, total=0;
  for(const [goal,limit] of GATES){
    let left=limit;
    while(money<goal){
      if(left<=0)return '기한실패';
      if(money<MIN_BET)return '파산';
      const need=Math.pow(goal/money,1/left);
      const f=Math.min(1,Math.max(0.2,(need-1)/0.30));
      const bet=Math.max(MIN_BET,Math.min(money,Math.floor(money*f)));
      const {p,t}=pick(); let ret;
      if(mode==='신호'){ const s=sigOf(t);
        if(s==='weak'){ left--; total++; if(total>500)return '초과'; continue; }
        { const path=p.gen(stock,Tt);
          ret=warmTrail(path, s==='strong'?warmAt(path,0.35):0, 0.12); } }
      else ret=MODES[mode](p.gen(stock,Tt));
      money=money-bet+Math.max(0,bet*ret);
      left--; total++; if(total>500)return '초과';
    }
    money+=goal*RATE*Math.max(0,left);
  }
  return '클리어';
}
/* ── 후보 ── 종목마다 무엇을 의심하는지가 다르다 */
const VAR = {
  /* ETF는 첫 종목 해금(Lv.4)인데 지금 갖고 있는 것보다 나쁘다 = 보상이 함정이다.
     정체성은 「급변 없음」이므로 진폭으로 풀면 안 되고, 등급 안 분포로 푼다 —
     대개 완만히 오르거나 횡보하고 가끔 완만히 내리는 종목. */
  etf: {
    '지금': {},
    'E1 하락 0.7': {patW:{down:0.7}},
    'E1b 하락 0.7 · 상승 1.15': {patW:{down:0.7, up:1.15}},
    'E1c 하락 0.62 · 상승 1.1': {patW:{down:0.62, up:1.1}},
    'E1d 하락 0.6 · 상승 1.2 · 횡보 1.15': {patW:{down:0.6, up:1.2, flat:1.15}},
    'E2 하락 0.55 · 상승 1.4': {patW:{down:0.55, up:1.4}},
  },
  /* 동전주는 유메이드와 기댓값이 거의 같은데(2.18 vs 2.24) 파산이 절반이다
     — 같은 상방에 위험만 싸다. 급변 가중치를 덜어 상방을 깎는다. */
  penny: {
    '지금': {},
    'P1 급등급락 1.8 · 지연급락 1.5': {patW:{spike:1.8, delaydown:1.5}},
    'P2 P1 + 나락/개장 1.4': {patW:{spike:1.8, delaydown:1.5, crash:1.4, earlypop:1.4}},
    'P3 진폭 1.35': {pMult:1.35, noiseMult:1.5},
    'P4 P2 + 진폭 1.35': {pMult:1.35, noiseMult:1.5,
      patW:{spike:1.8, delaydown:1.5, crash:1.4, earlypop:1.4}},
  },
  /* 코인은 마지막 해금(Lv.8)인데 제일 약하다. 진폭은 제일 큰데 노이즈 3.0이
     400틱 내내 추세를 지워서 어떤 추적 전략도 안 산다. 흔들림만 줄여 본다. */
  coin: {
    '지금': {},
    'C1 노이즈 2.4': {noiseMult:2.4},
    'C2 노이즈 2.2 · 추세 2.9': {noiseMult:2.2, pMult:2.9},
    'C3 노이즈 2.0 · 추세 3.1': {noiseMult:2.0, pMult:3.1},
    'C4 노이즈 2.6 · 추세 3.0': {noiseMult:2.6, pMult:3.0},
    'C5 노이즈 2.4 · 추세 3.2': {noiseMult:2.4, pMult:3.2},
  },
};
const id=process.argv[2], N=parseInt(process.argv[3],10)||200;
if(!VAR[id]){ console.error('종목: '+Object.keys(VAR).join(' · ')); process.exit(1); }
const base=G.STOCKS[id];
const ALL=[...Object.keys(MODES),'신호'];
console.log(`■ ${base.name} 후보 (N=${N} · 3배 · 3단계)\n`);
console.log('  '+'안'.padEnd(26)+ALL.map(m=>m.padStart(8)).join('')+'   최고    기댓값  청산');
for(const [name,ov] of Object.entries(VAR[id])){
  const st=Object.assign({},base,ov);
  if(ov.patW)st.patW=Object.assign({},base.patW||{},ov.patW);
  const [pick]=picker(0.04,st), Tt=G.ticksOf(st);
  const row=ALL.map(m=>{ let c=0; for(let k=0;k<N;k++) if(runOne(pick,m,st)==='클리어')c++; return c/N*100; });
  const hi=Math.max(...row), who=ALL[row.indexOf(hi)];
  const mode=who==='신호'?'트레일12':who;
  let sum=0, zero=0, M=15000;
  for(let k=0;k<M;k++){ const r=MODES[mode](pick().p.gen(st,Tt)); sum+=r; if(r===0)zero++; }
  console.log('  '+name.padEnd(26)+row.map(v=>(v.toFixed(0)+'%').padStart(8)).join('')+
    `   ${(hi.toFixed(0)+'%').padStart(4)}  ${(sum/M).toFixed(3)}  ${(zero/M*100).toFixed(0)}%`);
}
