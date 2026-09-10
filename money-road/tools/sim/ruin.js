const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const PT=pats(1.0,1.0);
function pk(){let r=Math.random(),a=0;for(const p of PT){a+=p.w;if(r<=a)return p;}return PT[9];}
function px(path,lev,pb,lag){
  let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(pend>=0){if(i>=pend)return Math.max(0,1+(v-1)*lev);}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
const MINBET=10000;                 // 파산선 = 최소 베팅 = 1만원 고정
// 초반엔 레버리지 미구매(1배)라 청산 없음. 순수하게 "돈이 마르는가"만 본다.
function run({seed,betFrac,pb,lag,fee,cap,maxR=800}){
  let cash=seed, peak=seed, rounds=0;
  while(rounds<maxR){
    if(cash<MINBET) return {e:'파산',rounds,peak};
    if(peak>=cap)   return {e:'생존',rounds,peak};
    rounds++;
    const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*betFrac)));
    const ret=px(pk().g(),1,pb,lag);
    cash=cash-bet+Math.max(0,bet*ret)-Math.round(bet*fee);   // 수수료는 베팅금 기준
    if(cash>peak)peak=cash;
  }
  return {e:'시간초과',rounds,peak};
}
const N=1500;
function measure(o){
  const rs=[];for(let k=0;k<N;k++)rs.push(run(o));
  const bk=rs.filter(r=>r.e==='파산');
  const med=a=>a.length?a.sort((x,y)=>x-y)[(a.length/2)|0]:0;
  return {rate:bk.length/N, peak:med(bk.map(r=>r.peak)), rd:med(bk.map(r=>r.rounds))};
}
const won=v=>v>=1e8?(v/1e8).toFixed(1)+'억':v>=1e4?(v/1e4).toFixed(0)+'만':v+'원';

console.log('■ 파산선 1만원 고정 · 목표 1,000만원까지 살아남기 · 수수료 0%');
console.log('  (초반 구간만 본다. 레버리지 없음 = 청산 없음)');
for(const [nm,pb,lag,bf] of [['보통 50%베팅·12%손절',0.12,10,0.5],['공격 80%베팅·12%손절',0.12,10,0.8],['올인 100%베팅·20%손절',0.20,20,1.0]]){
  console.log(`  ── ${nm} ──`);
  for(const seed of [20000,30000,50000,100000,200000,400000]){
    const m=measure({seed,betFrac:bf,pb,lag,fee:0,cap:1e7});
    console.log(`    시드 ${won(seed).padEnd(5)} → 파산 ${(m.rate*100).toFixed(0).padStart(3)}%  (중앙 ${String(m.rd).padStart(3)}판, 그때 최고 ${won(m.peak)})`);
  }
}
console.log('\n■ 수수료를 걸면 어떻게 되나 (시드 10만 · 보통 플레이 · 목표 1,000만)');
for(const fee of [0,0.02,0.05,0.08,0.12]){
  const m=measure({seed:1e5,betFrac:0.5,pb:0.12,lag:10,fee,cap:1e7});
  console.log(`    수수료 ${(fee*100).toFixed(0).padStart(2)}% → 파산 ${(m.rate*100).toFixed(0).padStart(3)}%  (중앙 ${String(m.rd).padStart(3)}판, 그때 최고 ${won(m.peak)})`);
}
console.log('\n■ 후반에도 위험이 남는가 (시드=이미 모은 돈, 파산선 1만원 고정, 목표=시드×100)');
for(const seed of [1e5,1e6,1e7,1e8,1e9]){
  const m=measure({seed,betFrac:0.5,pb:0.12,lag:10,fee:0,cap:seed*100});
  console.log(`    보유 ${won(seed).padEnd(5)} → 파산 ${(m.rate*100).toFixed(1).padStart(4)}%`);
}
