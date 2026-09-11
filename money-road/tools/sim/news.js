/* 📰 장중 뉴스를 몇 %나 맞게 해야 하나.

   라운드 중간에 뉴스가 뜨고, 남은 구간이 오를지 내릴지를 암시한다. 문제는 이게
   매도 타이밍 게임의 정답을 그대로 알려주는 축이라는 것이다 — 100% 맞으면 "뉴스가
   내린다고 하면 팔면 끝"이라 패턴을 볼 이유가 사라지고, 50%면 동전던지기라 아무
   의미가 없다. 그 사이 어디가 "판단 재료"인지를 잰다.

   전략은 가장 단순한 것으로 고정한다: 뉴스가 하락이라고 하면 그 자리에서 즉시 매도,
   상승이라고 하면 원래 손절 규칙대로 간다. 실제 플레이어는 패턴과 같이 보겠지만,
   "뉴스만 보고 반응"의 값어치가 얼마인지가 상한이다.

   사용: node sim/news.js   (1분 남짓) */
const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const TIER={0:'strong',1:'weak',2:'mid',3:'strong',4:'weak',5:'mid',6:'mid',7:'mid',8:'strong',9:'weak'};
function makePool(d){
  const P=pats(1.0,1.0).map((p,i)=>({...p,tier:TIER[i]}));
  P.forEach(p=>{ if(p.tier==='weak')p.w+=d*(p.w/0.29); if(p.tier==='strong')p.w-=d*(p.w/0.29); });
  const t=P.reduce((a,p)=>a+p.w,0); P.forEach(p=>p.w/=t); return P;
}
function mk(P){return ()=>{let r=Math.random(),a=0;for(const p of P){a+=p.w;if(r<=a)return p;}return P[9];};}

/* N={acc} 가 있으면 뉴스를 쓴다. 뉴스는 라운드의 35~65% 구간 어딘가에서 한 번 뜨고,
   그 시점의 가격과 최종가를 비교한 "진실"을 acc 확률로 말한다. */
function px(path,lev,pb,lag,N){
  let newsIdx=-1, say=null;
  if(N){
    newsIdx=Math.floor(path.length*(0.35+Math.random()*0.30));
    const truth = path[path.length-1]>=path[newsIdx] ? 'up' : 'down';
    say = Math.random()<N.acc ? truth : (truth==='up'?'down':'up');
  }
  let mx=path[0],pend=-1;
  const out=v=>Math.max(0,1+(v-1)*lev);
  for(let i=1;i<path.length;i++){
    const v=path[i];
    if(lev>1&&v<=1-1/lev)return 0;
    if(N&&i===newsIdx&&say==='down')return out(v);     // 하락 뉴스면 즉시 매도
    if(pend>=0){ if(i>=pend)return out(v); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag; }
  }
  return out(path[path.length-1]);
}

const MINBET=10000, RATE=0.10;
const BASE=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
function run(pick,{lev,N}){
  let cash=1e5, total=0;
  for(const [goal,limit] of BASE){
    let left=limit;
    while(cash<goal){
      if(left<=0) return {e:'관문실패', total};
      if(cash<MINBET) return {e:'파산', total};
      const need=Math.pow(goal/cash, 1/left);
      const edge=0.30*lev/3;
      let f=Math.min(1, Math.max(0.2, (need-1)/edge));
      const bet=Math.max(MINBET, Math.min(cash, Math.floor(cash*f)));
      const ret=px(pick().g(), lev, 0.12, 10, N);
      cash=cash-bet+Math.max(0,bet*ret);
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
  const pick=mk(makePool(0.04));   // 3단계(지금까지의 난이도)
  const rs=[]; for(let k=0;k<N;k++)rs.push(run(pick,opt));
  const cl=rs.filter(x=>x.e==='클리어').map(x=>x.total);
  const fa=rs.filter(x=>x.e!=='클리어').map(x=>x.total);
  const gf=rs.filter(x=>x.e==='관문실패').length, bk=rs.filter(x=>x.e==='파산').length;
  console.log(`  ${nm.padEnd(26)} 클리어 ${(cl.length/N*100).toFixed(0).padStart(3)}%  ` +
    `성공런 ${String(md(cl)).padStart(3)}판(${mins(md(cl))})  실패런 ${String(md(fa)).padStart(3)}판(${mins(md(fa))})  ` +
    `관문실패 ${String((gf/N*100).toFixed(0)).padStart(2)}% / 파산 ${String((bk/N*100).toFixed(0)).padStart(2)}%`);
}

console.log('■ 장중 뉴스 — "하락 뉴스가 뜨면 즉시 매도" 전략의 값어치');
console.log('  3배 · 하락 +4%p(3단계) · 이월 없음 · 조기상환 10%/일\n');
report('뉴스 없음', {lev:3});
[0.50,0.60,0.70,0.85,1.00].forEach(a=>
  report(`적중률 ${(a*100).toFixed(0)}%`, {lev:3,N:{acc:a}}));
