/* 🧬 메타 해금 속도 — 한 판에 XP가 얼마나 나오고, 900 XP까지 몇 판인가.

   결과: 900 XP가 6~8판 · 1~2시간. 해금 9종이 하루 저녁이면 끝난다.
   그리고 사다리가 뒤집혀 있다 — 어려운 단계일수록 XP 효율이 높아서
   (1단계 분당 7 XP, 5단계 17 XP) 난이도를 올릴 이유가 "빨리 털리려고"가 된다.
   xpOfPeak가 log10이라 2천만원(46 XP)과 500억원(113 XP)이 2.5배 차이뿐인 탓이다.

   이 파일은 진폭을 흉내내지 않으므로 _harness.js를 그대로 쓴다. 종목 진폭이
   들어가는 시뮬은 반드시 _game.js를 쓸 것.

   사용: node sim/xp.js   (3분 남짓) */
const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const TIER={0:'strong',1:'weak',2:'mid',3:'strong',4:'weak',5:'mid',6:'mid',7:'mid',8:'strong',9:'weak'};
function makePool(d){
  const P=pats(1.0,1.0).map((p,i)=>({...p,tier:TIER[i]}));
  P.forEach(p=>{ if(p.tier==='weak')p.w+=d*(p.w/0.29); if(p.tier==='strong')p.w-=d*(p.w/0.29); });
  const t=P.reduce((a,p)=>a+p.w,0); P.forEach(p=>p.w/=t); return P;
}
function mk(P){return ()=>{let r=Math.random(),a=0;for(const p of P){a+=p.w;if(r<=a)return p;}return P[9];};}
function px(path,lev,pb,lag){
  let mx=path[0],pend=-1; const out=v=>Math.max(0,1+(v-1)*lev);
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(lev>1&&v<=1-1/lev)return 0;
    if(pend>=0){ if(i>=pend)return out(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag; } }
  return out(path[path.length-1]);
}
const MINBET=10000, RATE=0.10;
const BASE=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const xpOfPeak=p=>Math.max(1,Math.floor(20*Math.log10(Math.max(p,MINBET)/1e5)));
function run(pick,lev){
  let cash=1e5, peak=1e5, total=0, earlyDays=0;
  for(const [goal,limit] of BASE){
    let left=limit;
    while(cash<goal){
      if(left<=0) return {e:'관문실패', peak, total, earlyDays};
      if(cash<MINBET) return {e:'파산', peak, total, earlyDays};
      const need=Math.pow(goal/cash,1/left), edge=0.30*lev/3;
      const f=Math.min(1,Math.max(0.2,(need-1)/edge));
      const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*f)));
      cash=cash-bet+Math.max(0,bet*px(pick().g(),lev,0.12,10));
      if(cash>peak)peak=cash;
      left--; total++;
      if(total>500) return {e:'초과', peak, total, earlyDays};
    }
    earlyDays+=Math.max(0,left);
    cash+=goal*RATE*Math.max(0,left); if(cash>peak)peak=cash;
  }
  return {e:'클리어', peak, total, earlyDays};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:0;
const TIERS=[['1 개미',0.00,1.0],['2 실전',0.02,1.3],['3 하락장',0.04,1.6],['4 촉박',0.04,2.0],['5 벼랑',0.06,2.5]];
console.log('■ 한 판(run)에서 나오는 XP와 900 XP까지의 판 수\n');
console.log('  단계      클리어   판당XP(중앙)  판당XP(평균)  900까지  한판시간  총시간');
for(const [nm,down,mult] of TIERS){
  const pick=mk(makePool(down)); const N=600; const xps=[], rounds=[]; let cl=0;
  for(let k=0;k<N;k++){
    const r=run(pick,3);
    const base=xpOfPeak(r.peak)+2*r.earlyDays;
    const pen=(r.e==='파산')?0.30:0;
    xps.push(Math.max(1,Math.round(base*(1-pen)*mult)));
    rounds.push(r.total); if(r.e==='클리어')cl++;
  }
  const avg=xps.reduce((a,b)=>a+b,0)/N, mdx=md(xps);
  const mdr=md(rounds), mins=mdr*22/60;
  const runs=900/avg;
  console.log(`  ${nm.padEnd(9)} ${String((cl/N*100).toFixed(0)).padStart(4)}%  ` +
    `${String(mdx).padStart(10)}  ${String(avg.toFixed(0)).padStart(11)}  ` +
    `${String(runs.toFixed(1)).padStart(6)}판  ${String(Math.round(mins)).padStart(6)}분  ` +
    `${String(Math.round(runs*mins/60*10)/10).padStart(5)}시간`);
}
console.log('\n■ 각 해금까지 (1단계 기준, 판당 평균 XP로 나눔)');
