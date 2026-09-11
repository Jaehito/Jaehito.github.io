/* 이월(거래일)을 없애고 조기 상환 보상을 현금으로 주면 난이도가 어떻게 되나.

   왜 바꾸나 — carry.js가 보여주듯 이월은 난이도를 통째로 흔든다(상한 0→무제한에서
   클리어 22%→41%). 거래일은 복리로 붙기 때문이다: 5일 = 1.68^5 ≈ 13배의 여유라,
   상한을 몇 일로 잡든 "관문을 넘으면 갑자기 편해지는" 구간이 남는다. 게다가 그 보상이
   곧바로 다음 관문의 난이도를 낮추는 형태라 "보상이 게임을 쉽게 만든다"는 문제이기도 하다.

   현금은 선형이라 계수 하나로 조절된다. 관문을 통과할 때 남은 거래일 1일당
   방금 갚은 관문 목표의 rate배를 현금으로 준다. 통과 시점의 현금이 대략 목표와 같으므로
   보너스는 단계와 무관하게 "현금의 rate×남은일"만큼의 출발 이점이 된다 — 즉 매 관문에
   같은 비율의 선불이지, 이월처럼 남은 판수를 늘려 복리로 불어나지 않는다.

   사용: node sim/bonus.js   (3분 남짓) */
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
const BASE=[[5e5,12],[3e6,12],[2e7,12],[1.5e8,14],[1e9,14],[8e9,16],[5e10,16]];
const days=n=>BASE.map(([g,d])=>[g,d+n]);

/* carry: 남은 거래일 이월 상한(0이면 이월 없음)
   rate : 남은 거래일 1일당 현금 보너스 = 방금 통과한 관문 목표 × rate
   cap  : 보너스로 인정하는 남은 거래일 상한(Infinity면 상한 없음) */
function run(pick,{gates,lev,ins,carry=0,rate=0,cap=Infinity}){
  let cash=1e5, total=0, bank=0, bonusTotal=0, early=[];
  for(const [goal,limit] of gates){
    let left=limit+Math.min(carry,bank);
    while(cash<goal){
      if(left<=0) return {e:'관문실패', total};
      if(cash<MINBET) return {e:'파산', total};
      const need=Math.pow(goal/cash, 1/left);
      const edge=0.30*lev/3;
      let f=Math.min(1, Math.max(0.2, (need-1)/edge));
      const bet=Math.max(MINBET, Math.min(cash, Math.floor(cash*f)));
      let ret=px(pick().g(), lev, 0.12, 10);
      const pr=ret-1; ret=1+(pr<0?pr*(1-ins):pr);
      cash=cash-bet+Math.max(0,bet*ret);
      left--; total++;
      if(total>500) return {e:'초과', total};
    }
    const rest=Math.max(0,left);
    early.push(rest);
    bank=rest;
    if(rate>0){ const b=goal*rate*Math.min(rest,cap); cash+=b; bonusTotal+=b; }
  }
  return {e:'클리어', total, early};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
const mins=n=>typeof n==='number'?Math.round(n*22/60)+'분':'-';
function report(nm,pick,opt,N=500){
  const rs=[]; for(let k=0;k<N;k++)rs.push(run(pick,opt));
  const cl=rs.filter(x=>x.e==='클리어');
  const cn=cl.map(x=>x.total);
  const fa=rs.filter(x=>x.e!=='클리어').map(x=>x.total);
  const gf=rs.filter(x=>x.e==='관문실패').length, bk=rs.filter(x=>x.e==='파산').length;
  /* 클리어한 런이 관문마다 며칠씩 남기고 갚았나 — 보너스가 실제로 얼마나 자주 붙는지 */
  const rest=cl.length?md(cl.flatMap(x=>x.early)):'-';
  console.log(`  ${nm.padEnd(34)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%  ` +
    `성공런 ${String(md(cn)).padStart(3)}판(${mins(md(cn))})  실패런 ${String(md(fa)).padStart(3)}판(${mins(md(fa))})  ` +
    `관문실패 ${String((gf/N*100).toFixed(0)).padStart(2)}% / 파산 ${String((bk/N*100).toFixed(0)).padStart(2)}%  ` +
    `관문당 남긴 거래일 ${rest}`);
}

const D=0.04;   // 현행 1회차 DOWN_SHIFT
console.log('■ 이월 → 조기 상환 현금 보너스 (3배 · 보험0%)');
console.log('  기준: 현행은 "이월 최대 5일 + 하락 +4%p"\n');

console.log('  1. 이월을 그냥 없애면');
report('현행 (이월5 · 보너스없음)',       mk(makePool(D)), {gates:BASE,lev:3,ins:0,carry:5});
report('이월0 · 보너스없음',              mk(makePool(D)), {gates:BASE,lev:3,ins:0});

console.log('\n  2. 보너스율 탐색 (이월0 · 관문 목표의 rate × 남은 거래일)');
[0.02,0.05,0.10,0.20,0.40].forEach(r=>
  report(`이월0 · 보너스 ${(r*100).toFixed(0)}%/일`, mk(makePool(D)), {gates:BASE,lev:3,ins:0,rate:r}));

console.log('\n  3. 관문 일수를 늘려서 보정 (이월0 · 보너스 10%/일)');
[0,1,2].forEach(n=>
  report(`일수 +${n}`, mk(makePool(D)), {gates:days(n),lev:3,ins:0,rate:0.10}));

console.log('\n  4. 후보 확정안에서 난이도별 (이월0 · 보너스 10%/일 · 일수 +1)');
[0,0.04,0.08,0.12].forEach(d=>
  report(`하락 +${(d*100).toFixed(0)}%p`, mk(makePool(d)), {gates:days(1),lev:3,ins:0,rate:0.10}));

console.log('\n  5. 보너스 일수 상한 — 운 좋게 빨리 갚으면 목표의 90%까지 튀는 걸 막을까');
[3,5,7,Infinity].forEach(c=>
  report(`상한 ${c===Infinity?'없음':c+'일'}`, mk(makePool(D)), {gates:days(1),lev:3,ins:0,rate:0.10,cap:c}));
