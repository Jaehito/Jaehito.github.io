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
  let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(lev>1&&v<=1-1/lev)return 0;
    if(pend>=0){if(i>=pend)return Math.max(0,1+(v-1)*lev);}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
const MINBET=10000;
function run(pick,cap,maxR=700){
  let cash=1e5,peak=1e5,r=0;
  while(r<maxR){
    if(cash<MINBET)return{e:'파산',r};
    if(peak>=cap)return{e:'클리어',r};
    r++;
    const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*0.5)));
    cash=cash-bet+Math.max(0,bet*px(pick().g(),3,0.12,10));
    if(cash>peak)peak=cash;
  }
  return{e:'초과',r};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
const mins=n=>typeof n==='number'?Math.round(n*22/60)+'분':'-';
console.log('■ 목표 × 난이도 — 클리어 런과 파산 런의 길이 (전판 50% 베팅 · 3배)');
console.log('  목표     하락가중   클리어율   클리어 런        파산 런');
for(const [cap,cn] of [[1e9,'10억'],[1e10,'100억'],[5e10,'500억']]){
  for(const d of [0,0.06,0.12,0.18]){
    const pick=mk(makePool(d)); const N=500, rs=[];
    for(let k=0;k<N;k++)rs.push(run(pick,cap));
    const cl=rs.filter(x=>x.e==='클리어').map(x=>x.r), bk=rs.filter(x=>x.e==='파산').map(x=>x.r);
    console.log(`  ${cn.padEnd(6)}   +${(d*100).toFixed(0).padStart(2)}%p      ${(cl.length/N*100).toFixed(0).padStart(3)}%     ${String(md(cl)).padStart(4)}판 ${mins(md(cl)).padStart(6)}   ${String(md(bk)).padStart(4)}판 ${mins(md(bk)).padStart(6)}`);
  }
  console.log('');
}
