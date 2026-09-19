/* 사건이 실제로 차수를 조일 때 클리어율이 얼마나 움직이는가.

   사건은 지금까지 문구였다 — 목표도 기한도 안 바꿨으니 인(因)이 될 수가 없었다.
   조이기만 하고 숨통은 3택 중 하나(완화 행동)가 틔우는 설계를 재 본다.
   완화를 고를지 말지는 플레이어 몫이라, 채택률을 0·50·100%로 나눠 본다.

   재는 축은 둘뿐이다 — 기한(판수)과 목표. 종목 잠금은 여기 모델에 없다
   (패턴 풀이 고정이라 흉내 내면 거짓말이 된다).

   쓰는 법: node sim/event.js   ·  gate.js와 같은 플레이어 모델을 쓴다. */
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
/* 게임의 GATES와 같다(난이도 3단계의 −0 일수 기준) */
const GATES=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];

/* 사건이 거는 조임 — 기한을 깎거나 목표를 올린다. 세기 둘만 쓴다. */
const MODS={
  none:{d:0,g:1},
  day1:{d:-1,g:1},
  day2:{d:-2,g:1},
  goal5:{d:0,g:1.05},
  goal10:{d:0,g:1.10},
};
function run(PICK,{lev,ins,mod,relief}){
  let cash=1e5,total=0;
  for(let gi=0;gi<GATES.length;gi++){
    const m=(Math.random()<relief)?MODS.none:mod;      // 완화 행동을 골랐는가
    const goal=GATES[gi][0]*m.g;
    let left=GATES[gi][1]+m.d;
    while(cash<goal){
      if(left<=0)return{e:'관문실패',total};
      if(cash<MINBET)return{e:'파산',total};
      const need=Math.pow(goal/cash,1/left);
      const edge=0.30*lev/3;
      const f=Math.min(1,Math.max(0.2,(need-1)/edge));
      const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*f)));
      let ret=px(PICK().g(),lev,0.12,10);
      const pr=ret-1; ret=1+(pr<0?pr*(1-ins):pr);
      cash=cash-bet+Math.max(0,bet*ret);
      left--; total++;
      if(total>500)return{e:'초과',total};
    }
  }
  return{e:'클리어',total};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
function report(nm,PICK,opt,N=800){
  const rs=[];for(let k=0;k<N;k++)rs.push(run(PICK,opt));
  const cl=rs.filter(x=>x.e==='클리어').map(x=>x.total);
  const gf=rs.filter(x=>x.e==='관문실패').length,bk=rs.filter(x=>x.e==='파산').length;
  const pct=cl.length/N*100;
  console.log(`  ${nm.padEnd(34)} 클리어 ${pct.toFixed(0).padStart(3)}%  성공런 ${String(md(cl)).padStart(3)}판  ` +
    `관문실패 ${(gf/N*100).toFixed(0).padStart(2)}% / 파산 ${(bk/N*100).toFixed(0).padStart(2)}%`);
  return pct;
}
const D=0.04;                       // 3단계(현행 기본 난이도)
const PK=mk(makePool(D));
console.log('■ 사건이 차수를 조일 때 — 완화 행동 채택률별 클리어율 (하락 +4%p · 3배 · 보험0%)\n');
const base=report('현행(사건은 문구뿐)',PK,{lev:3,ins:0,mod:MODS.none,relief:0});
console.log('');
for(const [k,nm] of [['day1','기한 −1일'],['day2','기한 −2일'],['goal5','목표 +5%'],['goal10','목표 +10%']]){
  for(const r of [0,0.5,1]){
    const p=report(`${nm} · 완화 ${(r*100).toFixed(0)}%`,PK,{lev:3,ins:0,mod:MODS[k],relief:r});
    if(Math.abs(p-base)<=3)console.log('      ↑ 현행 ±3%p 안');
  }
  console.log('');
}
console.log(`기준선: ${base.toFixed(0)}%`);
