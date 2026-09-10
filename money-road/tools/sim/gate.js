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
const GATES=[[5e5,12],[3e6,12],[2e7,12],[1.5e8,14],[1e9,14],[8e9,16],[5e10,16]];
/* 합리적 플레이어: 남은 판수 안에 목표를 넘으려면 판당 얼마가 필요한지 계산하고
   그에 맞춰 베팅 비중을 정한다. 여유 있으면 적게, 빠듯하면 크게 건다. */
function run(pick,{gates,lev,ins}){
  let cash=1e5, total=0;
  for(const [goal,limit] of gates){
    let left=limit;
    while(cash<goal){
      if(left<=0) return {e:'관문실패', total, gate:gates.indexOf([goal,limit])};
      if(cash<MINBET) return {e:'파산', total};
      const need=Math.pow(goal/cash, 1/left);            // 판당 필요 성장 배수
      // 필요 성장률이 클수록 크게 건다 (필요 −1을 판당 기대수익으로 나눈 비중)
      const edge=0.30*lev/3;                              // 판당 기대 초과수익 근사
      let f=Math.min(1, Math.max(0.2, (need-1)/edge));
      const bet=Math.max(MINBET, Math.min(cash, Math.floor(cash*f)));
      let ret=px(pick().g(), lev, 0.12, 10);
      const pr=ret-1; ret=1+(pr<0?pr*(1-ins):pr);
      cash=cash-bet+Math.max(0,bet*ret);
      left--; total++;
      if(total>500) return {e:'초과', total};
    }
  }
  return {e:'클리어', total};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
const mins=n=>typeof n==='number'?Math.round(n*22/60)+'분':'-';
function report(nm,pick,opt,N=800){
  const rs=[]; for(let k=0;k<N;k++)rs.push(run(pick,opt));
  const cl=rs.filter(x=>x.e==='클리어').map(x=>x.total);
  const fa=rs.filter(x=>x.e!=='클리어').map(x=>x.total);
  const gf=rs.filter(x=>x.e==='관문실패').length, bk=rs.filter(x=>x.e==='파산').length;
  console.log(`  ${nm.padEnd(30)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%  ` +
    `성공런 ${String(md(cl)).padStart(3)}판(${mins(md(cl))})  실패런 ${String(md(fa)).padStart(3)}판(${mins(md(fa))})  ` +
    `관문실패 ${(gf/N*100).toFixed(0)}% / 파산 ${(bk/N*100).toFixed(0)}%`);
}
console.log('■ 관문 시스템 — 제한 판수 안에 다음 레벨 금액에 못 닿으면 런 종료');
console.log('   관문: 50만/12판 · 300만/12판 · 2000만/12판 · 1.5억/14 · 10억/14 · 80억/16 · 500억/16 (최대 96판)\n');
console.log('  1회차 난이도 후보');
[0,0.06,0.10,0.14,0.18].forEach(d=>{
  report(`하락 +${(d*100).toFixed(0)}%p · 3배 · 보험0%`, mk(makePool(d)), {gates:GATES,lev:3,ins:0});
});
console.log('\n  성장(상점/특성)이 붙으면');
[[0.10,5,0],[0.10,3,0.30],[0.10,5,0.30],[0.14,5,0.30],[0.14,5,0.45]].forEach(([d,l,i])=>{
  report(`하락 +${(d*100).toFixed(0)}%p · ${l}배 · 보험${(i*100).toFixed(0)}%`, mk(makePool(d)), {gates:GATES,lev:l,ins:i});
});
console.log('\n  회차 난이도 (관문 판수를 회차마다 -1)');
[[0.10,0],[0.14,-1],[0.18,-2],[0.22,-3]].forEach(([d,dec],i)=>{
  const g=GATES.map(([a,b])=>[a,b+dec]);
  report(`${i+1}회차: 하락 +${(d*100).toFixed(0)}%p · 판수 ${dec||'0'}`, mk(makePool(d)), {gates:g,lev:3,ins:0});
});
