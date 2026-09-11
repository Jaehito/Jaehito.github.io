/* 💧 물타기가 "항상 하는 게 이득"인가.

   물타기는 라운드 중 베팅금을 더 얹는다. 금액 B를 가격 p에 사면 수량은 B/p이므로
   평단은 총투입 ÷ 총수량으로 내려가고, 청산선(평단 × (1−1/L))도 같이 내려간다.
   버틸 여력이 생기는 대신 투입금이 늘어 더 떨어지면 손실도 같이 커진다.

   문제는 판당 기댓값이 3배에서 1.68이라는 것이다(sim/ev.js). 추가 베팅 자체의
   기댓값이 양수면 "손실 중이면 무조건 물타기"가 늘 이득이 되고, 그러면 선택이 아니라
   그냥 눌러야 하는 버튼이 된다. 그걸 확인하고, 필요하면 수수료로 눌러야 한다.

   억제 장치 하나는 이미 규칙에 있다: 물타기는 손실 중일 때만 된다(가격이 평단 아래).
   이익 중에 더 얹는 건 물타기가 아니라 그냥 추가 베팅이다.

   사용: node sim/water.js   (2분 남짓) */
const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const TIER={0:'strong',1:'weak',2:'mid',3:'strong',4:'weak',5:'mid',6:'mid',7:'mid',8:'strong',9:'weak'};
function makePool(d){
  const P=pats(1.0,1.0).map((p,i)=>({...p,tier:TIER[i]}));
  P.forEach(p=>{ if(p.tier==='weak')p.w+=d*(p.w/0.29); if(p.tier==='strong')p.w-=d*(p.w/0.29); });
  const t=P.reduce((a,p)=>a+p.w,0); P.forEach(p=>p.w/=t); return P;
}
function mk(P){return ()=>{let r=Math.random(),a=0;for(const p of P){a+=p.w;if(r<=a)return p;}return P[9];};}

/* 베팅금 1을 기준으로, 총 투입(spent)과 투입 대비 회수 배수(mul)를 돌려준다.
   water=false면 기존 px()와 같은 계산이다. */
function px(path,lev,pb,lag,W){
  const {water=false,trig=0.10,frac=0.5,fee=0}=W||{};
  let entry=1, spent=1, done=false;
  let mx=path[0], pend=-1;
  const liq=()=>entry*(1-1/lev);
  const out=v=>({mul:Math.max(0,1+(v/entry-1)*lev), spent});
  for(let i=1;i<path.length;i++){
    const v=path[i];
    if(lev>1&&v<=liq())return {mul:0,spent};
    /* 손실 중(평단 아래)이고 trig만큼 밀렸으면 한 번 물탄다.
       수수료는 실제로 사는 수량에서 뗀다 — 투입은 frac, 사는 건 frac×(1−fee). */
    if(water&&!done&&v<=entry*(1-trig)){
      const q0=spent/entry, q1=(frac*(1-fee))/v;
      entry=(spent+frac)/(q0+q1);
      spent+=frac; done=true;
    }
    if(pend>=0){ if(i>=pend)return out(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag; }
  }
  return out(path[path.length-1]);
}

const MINBET=10000, RATE=0.10;
const BASE=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];

/* reserve=true면 물탈 몫을 미리 빼두고 베팅한다. false면 베팅은 그대로 하고
   남은 현금이 있을 때만 물탄다 — 실제 플레이에 가까운 쪽은 이쪽이다. */
function run(pick,{lev,W,reserve=false}){
  let cash=1e5, total=0;
  const maxSpend=(reserve&&W&&W.water)?1+(W.frac||0.5):1;
  for(const [goal,limit] of BASE){
    let left=limit;
    while(cash<goal){
      if(left<=0) return {e:'관문실패', total};
      if(cash<MINBET) return {e:'파산', total};
      const need=Math.pow(goal/cash, 1/left);
      const edge=0.30*lev/3;
      let f=Math.min(1, Math.max(0.2, (need-1)/edge));
      const bet=Math.max(MINBET, Math.min(Math.floor(cash/maxSpend), Math.floor(cash*f/maxSpend)));
      /* 베팅하고 남은 현금만큼만 물탈 수 있다 */
      const W2=(W&&W.water)?{...W, frac:Math.max(0,Math.min(W.frac,(cash-bet)/bet))}:W;
      const {mul,spent}=px(pick().g(), lev, 0.12, 10, W2&&W2.frac>0?W2:null);
      const invest=bet*spent;
      cash=cash-invest+Math.max(0,invest*mul);
      left--; total++;
      if(total>500) return {e:'초과', total};
    }
    cash+=goal*RATE*Math.max(0,left);
  }
  return {e:'클리어', total};
}
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[(a.length/2)|0]:'-';
const mins=n=>typeof n==='number'?Math.round(n*22/60)+'분':'-';
function report(nm,opt,N=500){
  const pick=mk(makePool(0.04));   // 3단계(지금까지의 난이도)에서 잰다
  const rs=[]; for(let k=0;k<N;k++)rs.push(run(pick,opt));
  const cl=rs.filter(x=>x.e==='클리어').map(x=>x.total);
  const fa=rs.filter(x=>x.e!=='클리어').map(x=>x.total);
  const gf=rs.filter(x=>x.e==='관문실패').length, bk=rs.filter(x=>x.e==='파산').length;
  console.log(`  ${nm.padEnd(34)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%  ` +
    `성공런 ${String(md(cl)).padStart(3)}판(${mins(md(cl))})  실패런 ${String(md(fa)).padStart(3)}판(${mins(md(fa))})  ` +
    `관문실패 ${String((gf/N*100).toFixed(0)).padStart(2)}% / 파산 ${String((bk/N*100).toFixed(0)).padStart(2)}%`);
}

console.log('■ 물타기 — "손실 중이면 무조건 한다" 전략이 얼마나 이득인가');
console.log('  3배 · 하락 +4%p(3단계) · 이월 없음 · 조기상환 10%/일\n');

console.log('  1. 물타기를 쓰는가 (베팅은 그대로 두고 남는 현금으로만)');
report('안 씀', {lev:3});
report('평단 −10%에서 50% 추가', {lev:3,W:{water:true,trig:0.10,frac:0.5}});
report('평단 −20%에서 50% 추가', {lev:3,W:{water:true,trig:0.20,frac:0.5}});

console.log('\n  2. 물탈 몫을 미리 빼두고 베팅하면 (지는 판에만 더 거는 꼴)');
report('안 씀', {lev:3});
report('여력 확보 + 평단 −10%', {lev:3,W:{water:true,trig:0.10,frac:0.5},reserve:true});

console.log('\n  3. 얼마나 크게 무는가 (평단 −10% · 여력 있을 때만)');
[0.3,0.5,1.0].forEach(fr=>
  report(`추가 ${(fr*100).toFixed(0)}%`, {lev:3,W:{water:true,trig:0.10,frac:fr}}));

console.log('\n  4. 수수료를 붙여야 하나 (평단 −10% · 추가 50%)');
[0,0.05].forEach(fe=>
  report(`수수료 ${(fe*100).toFixed(0)}%`, {lev:3,W:{water:true,trig:0.10,frac:0.5,fee:fe}}));
