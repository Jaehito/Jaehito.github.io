/* 🎯 종목 밸런스 — 여섯 종목을 전략 여섯으로 다 돌려 본다.

   지금까지 종목별 클리어율은 「버티35 하나로 · 네 종목만」 재고 있었다.
   그러면 "이 종목이 세다"와 "이 종목에는 저 전략이 맞다"가 구분이 안 된다.
   종목마다 제일 잘 맞는 전략이 다르면 그건 밸런스가 아니라 성격이다.

   같이 재는 것:
     · 클리어율 — 전략별, 그리고 그 종목의 최고 전략
     · 판당 기댓값(최고 전략) — 클리어율은 절벽이라 기댓값이 진짜 세기다
     · 청산률 — 한 판에 전액을 잃는 비율

   사용: node sim/inst.js [N]   (기본 300 · 6종목 × 6전략이라 오래 걸린다) */
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
  return ()=>{ let r=Math.random(),a=0;
    for(let i=0;i<n.length;i++){a+=n[i]; if(r<=a)return {p:G.PATTERNS[i],t:G.PATTERN_TIER[G.PATTERNS[i].id]};}
    const L=G.PATTERNS.length-1; return {p:G.PATTERNS[L],t:G.PATTERN_TIER[G.PATTERNS[L].id]}; };
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
const IDS=['stable','theme','surge','etf','penny','coin'];
const ALL=[...Object.keys(MODES),'신호'];
const N=parseInt(process.argv[2],10)||300;

console.log(`■ 종목 × 전략 클리어율 (N=${N} · 3배 · 3단계)\n`);
console.log('  '+'종목'.padEnd(10)+ALL.map(m=>m.padStart(8)).join('')+'   최고 전략');
const best={};
for(const id of IDS){
  const st=G.STOCKS[id], pick=picker(0.04,st);
  const row=ALL.map(m=>{ let c=0; for(let k=0;k<N;k++) if(runOne(pick,m,st)==='클리어')c++; return c/N*100; });
  const hi=Math.max(...row), who=ALL[row.indexOf(hi)];
  best[id]=[hi,who];
  console.log('  '+st.name.padEnd(10)+row.map(v=>(v.toFixed(0)+'%').padStart(8)).join('')+
    `   ${who} ${hi.toFixed(0)}%`);
}

console.log('\n■ 판당 기댓값과 청산률 — 클리어율은 절벽이라 여기가 진짜 세기다\n');
console.log('  '+'종목'.padEnd(10)+'기댓값(최고전략)'.padStart(18)+'청산률'.padStart(10)+'   최고 전략');
const M=20000;
for(const id of IDS){
  const st=G.STOCKS[id], pick=picker(0.04,st), Tt=G.ticksOf(st);
  const mode=best[id][1]==='신호'?'트레일12':best[id][1];
  let sum=0, zero=0;
  for(let k=0;k<M;k++){ const r=MODES[mode](pick().p.gen(st,Tt)); sum+=r; if(r===0)zero++; }
  console.log('  '+st.name.padEnd(10)+(sum/M).toFixed(3).padStart(18)+
    ((zero/M*100).toFixed(0)+'%').padStart(10)+`   ${mode}`);
}
