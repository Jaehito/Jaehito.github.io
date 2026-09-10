const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
/* 하락 패턴 가중치를 d만큼 올리고 상승 쪽을 그만큼 내려서 판당 기댓값을 조절한다 */
const TIER={0:'strong',1:'weak',2:'mid',3:'strong',4:'weak',5:'mid',6:'mid',7:'mid',8:'strong',9:'weak'};
function makePool(d){
  const P=pats(1.0,1.0).map((p,i)=>({...p,tier:TIER[i]}));
  P.forEach(p=>{ if(p.tier==='weak')p.w+= d*(p.w/0.29); if(p.tier==='strong')p.w-= d*(p.w/0.29); });
  const tot=P.reduce((a,p)=>a+p.w,0); P.forEach(p=>p.w/=tot); return P;
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
function ev(pick,lev,N=20000){let s=0;for(let i=0;i<N;i++)s+=px(pick().g(),lev,0.12,10);return s/N;}
function run(pick,{cap,maxR=800}){
  let cash=1e5,peak=1e5,r=0;
  while(r<maxR){
    if(cash<MINBET)return{e:'파산',r,peak};
    if(peak>=cap)return{e:'클리어',r,peak};
    r++;
    const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*0.5)));
    cash=cash-bet+Math.max(0,bet*px(pick().g(),3,0.12,10));
    if(cash>peak)peak=cash;
  }
  return{e:'시간초과',r,peak};
}
console.log('■ 하락 패턴 가중치를 올려 기댓값을 낮추면 (전판 50% 베팅 · 3배 · 목표 500억)');
console.log('  하락가중 +   1배 EV   3배 EV    파산   클리어   판수');
for(const d of [0,0.06,0.12,0.18,0.24]){
  const P=makePool(d), pick=mk(P);
  const e1=ev(pick,1), e3=ev(pick,3);
  const N=400, rs=[]; for(let k=0;k<N;k++)rs.push(run(pick,{cap:5e10}));
  const bk=rs.filter(x=>x.e==='파산'), cl=rs.filter(x=>x.e==='클리어');
  const md=a=>a.length?a.map(x=>x.r).sort((x,y)=>x-y)[(a.length/2)|0]:'-';
  console.log(`   +${(d*100).toFixed(0).padStart(2)}%p     ${e1.toFixed(3)}   ${e3.toFixed(3)}   ${(bk.length/N*100).toFixed(0).padStart(4)}%   ${(cl.length/N*100).toFixed(0).padStart(4)}%   ${String(md(cl)).padStart(4)}판`);
}
console.log('\n■ 목표만 올리면? (복리라서 로그로만 늘어난다 · 가중치 그대로)');
const pick0=mk(makePool(0));
for(const [cap,nm] of [[5e10,'500억 (지금)'],[5e13,'50조 (×1,000)'],[5e16,'5경 (×100만)']]){
  const N=300, rs=[]; for(let k=0;k<N;k++)rs.push(run(pick0,{cap,maxR:1500}));
  const cl=rs.filter(x=>x.e==='클리어');
  const md=a=>a.length?a.map(x=>x.r).sort((x,y)=>x-y)[(a.length/2)|0]:'-';
  console.log(`   ${nm.padEnd(16)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%   ${String(md(cl)).padStart(4)}판`);
}
