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
/* 판수 제한 대신 "이자" — 매 판 자산의 r%가 빚 이자로 빠진다.
   자산 비례라서 후반에도 유효하고, 판수를 막지 않으므로 어색함이 없다. */
function run(pick,{rate,frac,lev,cap,maxR=900}){
  let cash=1e5,peak=1e5,r=0;
  while(r<maxR){
    if(cash<MINBET)return{e:'파산',r};
    if(peak>=cap)return{e:'클리어',r};
    r++;
    const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*frac)));
    cash=cash-bet+Math.max(0,bet*px(pick().g(),lev,0.12,10));
    cash-=Math.floor(cash*rate);                       // 이자
    if(cash>peak)peak=cash;
  }
  return{e:'초과',r};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
const mn=n=>typeof n==='number'?Math.round(n*22/60)+'분':'-';
function line(nm,pick,o,N=500){
  const rs=[];for(let k=0;k<N;k++)rs.push(run(pick,o));
  const cl=rs.filter(x=>x.e==='클리어').map(x=>x.r), bk=rs.filter(x=>x.e==='파산').map(x=>x.r);
  console.log(`  ${nm.padEnd(30)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%  성공 ${String(md(cl)).padStart(3)}판(${mn(md(cl))})  파산 ${(bk.length/N*100).toFixed(0).padStart(3)}%  ${String(md(bk)).padStart(3)}판(${mn(md(bk))})`);
}
console.log('■ 판수 제한 없이 "판당 이자"만으로 (목표 500억 · 3배 · 하락 +0%p)');
console.log('  플레이어가 자산의 몇 %를 거는지에 따라\n');
for(const rate of [0,0.04,0.08,0.12]){
  console.log(`  ── 판당 이자 ${(rate*100).toFixed(0)}% ──`);
  const pick=mk(makePool(0));
  [['소심 20% 베팅',0.2],['보통 50% 베팅',0.5],['공격 80% 베팅',0.8]].forEach(([nm,f])=>
    line(nm,pick,{rate,frac:f,lev:3,cap:5e10}));
}
console.log('\n■ 이자 + 하락 가중치 조합 (보통 50% 베팅)');
for(const [rate,d] of [[0.08,0],[0.08,0.06],[0.12,0],[0.12,0.06],[0.16,0]]){
  line(`이자 ${(rate*100).toFixed(0)}% · 하락 +${(d*100).toFixed(0)}%p`, mk(makePool(d)), {rate,frac:0.5,lev:3,cap:5e10});
}
