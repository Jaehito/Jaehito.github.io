const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const PT=pats(1.0,1.0);
function pk(){let r=Math.random(),a=0;for(const p of PT){a+=p.w;if(r<=a)return p;}return PT[9];}
function px(path,lev,pb,lag){
  let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(lev>1&&v<=1-1/lev)return 0;
    if(pend>=0){if(i>=pend)return Math.max(0,1+(v-1)*lev);}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
const MINBET=10000;
function run({seed,minLev,betFrac,pb,lag,ins,cap,maxR=500}){
  let cash=seed,peak=seed,r=0;
  while(r<maxR){
    if(cash<MINBET)return{e:'파산',r,peak};
    if(peak>=cap)return{e:'생존',r,peak};
    r++;
    const bet=Math.max(MINBET,Math.min(cash,Math.floor(cash*betFrac)));
    let ret=px(pk().g(),minLev,pb,lag);
    const pr=ret-1; ret=1+(pr<0?pr*(1-ins):pr);
    cash=cash-bet+Math.max(0,bet*ret);
    if(cash>peak)peak=cash;
  }
  return{e:'시간초과',r,peak};
}
const N=800, won=v=>v>=1e8?(v/1e8).toFixed(1)+'억':v>=1e4?(v/1e4).toFixed(0)+'만':v+'원';
function m(o){const rs=[];for(let k=0;k<N;k++)rs.push(run(o));
  const bk=rs.filter(x=>x.e==='파산');
  const md=a=>a.length?a.sort((x,y)=>x-y)[(a.length/2)|0]:0;
  return{rate:bk.length/N,r:md(bk.map(x=>x.r)),pk:md(bk.map(x=>x.peak))};}
console.log('■ "빚내서 시작" — 최소 레버리지 강제  (시드 10만 · 목표 1,000만 · 보통 12%손절)');
console.log('  단계             최소배율 보험 베팅   파산률  중앙판수  그때 최고');
for(const [lev,ins,label] of [[3,0,'1회차'],[3,0.15,'상점 보험1'],[2,0.15,'레거시1'],[2,0.30,'레거시1+보험2'],[1,0.30,'레거시2(자유)']]){
  for(const bf of [0.5,0.8]){
    const x=m({seed:1e5,minLev:lev,betFrac:bf,pb:0.12,lag:10,ins,cap:1e7});
    console.log(`  ${label.padEnd(15)} ${lev}배   ${(ins*100).toFixed(0).padStart(3)}% ${(bf*100).toFixed(0).padStart(3)}%   ${(x.rate*100).toFixed(0).padStart(4)}%  ${String(x.r).padStart(5)}판  ${won(x.pk)}`);
  }
}
console.log('\n■ 초보(20%손절/1.0s반응), 베팅 50%');
for(const [lev,ins,label] of [[3,0,'1회차'],[2,0.15,'레거시1'],[1,0.30,'레거시2']]){
  const x=m({seed:1e5,minLev:lev,betFrac:0.5,pb:0.20,lag:20,ins,cap:1e7});
  console.log(`  ${label.padEnd(8)} ${lev}배 → 파산 ${(x.rate*100).toFixed(0).padStart(3)}%  중앙 ${String(x.r).padStart(3)}판  그때 최고 ${won(x.pk)}`);
}
