/* 난이도 단계(승천) 사다리 짜기 — 디메리트 축 셋이 각각 얼마나 센가.

   쓸 수 있는 축은 셋이고 전부 이미 게임에 있는 다이얼이다:
     · 최소 레버리지  (sim/debt.js: 3배 초보 파산률 76% / 2배 17% / 1배 0%)
     · 하락 패턴 가중 (DOWN_SHIFT)
     · 관문 일수      (GATES)

   주의 — 최소 레버리지를 낮추면 파산은 줄지만 복리가 느려져서 관문을 못 채울 수 있다.
   "낮은 배율 = 쉬움"이 자명하지 않아서 실제로 재봐야 한다. 1번 블록이 그 답이다.

   기준선은 B단계 확정값: 이월 없음 · 조기상환 보너스 10%/일 · GATES 일수 +1.
   그 위에서 현행(최소 3배 · 하락 +4%p)이 클리어 19%다.

   사용: node sim/tier.js   (3분 남짓) */
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
const MINBET=10000, RATE=0.10;
/* B단계 확정 일수(이미 +1 된 값) */
const BASE=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const days=n=>BASE.map(([g,d])=>[g,d+n]);

function run(pick,{gates,lev,ins=0}){
  let cash=1e5, total=0;
  for(const [goal,limit] of gates){
    let left=limit;
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
    cash+=goal*RATE*Math.max(0,left);   // 조기 상환 현금 보너스
  }
  return {e:'클리어', total};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
const mins=n=>typeof n==='number'?Math.round(n*22/60)+'분':'-';
function report(nm,{lev,down,dday},N=500){
  const pick=mk(makePool(down)), gates=days(dday);
  const rs=[]; for(let k=0;k<N;k++)rs.push(run(pick,{gates,lev}));
  const cl=rs.filter(x=>x.e==='클리어').map(x=>x.total);
  const fa=rs.filter(x=>x.e!=='클리어').map(x=>x.total);
  const gf=rs.filter(x=>x.e==='관문실패').length, bk=rs.filter(x=>x.e==='파산').length;
  console.log(`  ${nm.padEnd(30)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%  ` +
    `성공런 ${String(md(cl)).padStart(3)}판(${mins(md(cl))})  실패런 ${String(md(fa)).padStart(3)}판(${mins(md(fa))})  ` +
    `관문실패 ${String((gf/N*100).toFixed(0)).padStart(2)}% / 파산 ${String((bk/N*100).toFixed(0)).padStart(2)}%`);
}

console.log('■ 난이도 축 하나씩 — 기준은 최소 3배 · 하락 +4%p · 일수 +0 (= 현행)\n');

console.log('  1. 최소 레버리지 (하락 +0%p · 일수 +0)');
[1,2,3,5].forEach(l=>report(`최소 ${l}배`,{lev:l,down:0,dday:0}));

console.log('\n  2. 하락 패턴 가중 (최소 3배 · 일수 +0)');
[0,0.04,0.08,0.12].forEach(d=>report(`하락 +${(d*100).toFixed(0)}%p`,{lev:3,down:d,dday:0}));

console.log('\n  3. 관문 일수 (최소 3배 · 하락 +4%p)');
[2,0,-2,-4].forEach(n=>report(`일수 ${n>=0?'+':''}${n}`,{lev:3,down:0.04,dday:n}));

console.log('\n  4. 하락 가중을 2%p 단위로 (최소 3배 · 일수 +0)');
[0.02,0.06].forEach(d=>report(`하락 +${(d*100).toFixed(0)}%p`,{lev:3,down:d,dday:0}));

console.log('\n  5. 최소 레버리지를 뺀 사다리 — 하락 가중 + 관문 일수만');
const LADDER=[
  ['1 · 개미',   {lev:3, down:0.00, dday:0}],
  ['2 · 실전',   {lev:3, down:0.02, dday:0}],
  ['3 · 하락장', {lev:3, down:0.04, dday:0}],   // = 현행
  ['4 · 촉박',   {lev:3, down:0.04, dday:-2}],
  ['5 · 벼랑',   {lev:3, down:0.06, dday:-2}],
];
LADDER.forEach(([n,o])=>report(n,o));
