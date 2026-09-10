const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const PT=pats(1.0,1.0);
function pk(){let r=Math.random(),a=0;for(const p of PT){a+=p.w;if(r<=a)return p;}return PT[9];}
/* 폭락 오버레이: 확률 pc로, 30~270틱 사이 한 지점에서 한 틱 만에 d만큼 급락하고
   그 뒤로도 회복하지 않는다. 부드러운 사인 곡선이 아니라서 손절이 못 빠져나간다. */
function withCrash(path,pc,dmin,dmax){
  if(Math.random()>=pc)return path;
  const t=30+((Math.random()*240)|0), d=dmin+Math.random()*(dmax-dmin);
  const out=path.slice();
  for(let i=t;i<out.length;i++)out[i]=Math.max(0.02,out[i]*(1-d));
  return out;
}
function px(path,lev,pb,lag){
  let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(lev>1&&v<=1-1/lev)return 0;
    if(pend>=0){if(i>=pend)return Math.max(0,1+(v-1)*lev);}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
const INS=[0,0.15,0.30,0.45];                    // 손절 보험 환급률 (상점 Lv.0~3)
function net(ret,ins){ const pr=ret-1; return 1+(pr<0?pr*(1-ins):pr); }
const N=25000;
console.log('■ 폭락 이벤트를 넣으면 1배 플레이도 크게 잃는가  (보통 12%손절/0.5s반응, 1배)');
console.log('   pc=판당 폭락 확률, 낙폭 35~60%\n');
console.log('  폭락확률  보험   판당EV   -50%↑손실   -80%↑손실');
for(const pc of [0,0.05,0.08,0.12]){
  for(const ins of [0,0.30]){
    let l50=0,l80=0,sum=0;
    for(let i=0;i<N;i++){
      const r=net(px(withCrash(pk().g(),pc,0.35,0.60),1,0.12,10),ins);
      sum+=r; if(r<0.50)l50++; if(r<0.20)l80++;}
    console.log(`   ${(pc*100).toFixed(0).padStart(4)}%   ${(ins*100).toFixed(0).padStart(3)}%   ${(sum/N).toFixed(3)}   ${(l50/N*100).toFixed(1).padStart(7)}%   ${(l80/N*100).toFixed(1).padStart(7)}%`);
  }
}
console.log('\n■ 신용 N칸 (한 판 -50%↑ 손실 = 1칸 차감) → 파산까지 몇 판?');
console.log('   폭락 8% 고정. 성장할수록 보험이 오르고 칸이 늘어난다.\n');
function survive(hp,ins,M=700){
  const out=[];
  for(let k=0;k<M;k++){let h=hp,r=0;
    while(h>0&&r<2000){r++; if(net(px(withCrash(pk().g(),0.08,0.35,0.60),1,0.12,10),ins)<0.50)h--;}
    out.push(r);}
  out.sort((a,b)=>a-b);
  return out[(M/2)|0];
}
console.log('  단계                                 신용칸  보험   파산까지(중앙)');
[['1회차 초반 (보험 없음)',3,0],['상점 보험 1단계',3,0.15],['보험 2단계',3,0.30],
 ['보험 3단계',3,0.45],['레거시 맷집1 (4칸) + 보험2',4,0.30],['레거시 맷집2 (5칸) + 보험3',5,0.45]]
 .forEach(([nm,h,ins])=>{
  console.log(`  ${nm.padEnd(34)} ${h}칸  ${(ins*100).toFixed(0).padStart(3)}%   ${String(survive(h,ins)).padStart(4)}판`);
});
