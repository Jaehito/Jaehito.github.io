// 구현은 "본 구간(0..매도시점)"의 최저~최고를 쓴다. 시뮬은 전체 경로를 썼으니 실측을 다시 낸다.
const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const PT=pats(1.0,1.0);
function pk(){let r=Math.random(),a=0;for(const p of PT){a+=p.w;if(r<=a)return p;}return PT[9];}
function seen(path,pb,lag){
  let mx=path[0],pend=-1,lo=path[0],hi=path[0];
  for(let i=1;i<path.length;i++){const v=path[i];
    if(v<lo)lo=v; if(v>hi)hi=v;
    if(pend>=0){if(i>=pend)return{mult:v,lo,hi};}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return{mult:path[path.length-1],lo,hi};
}
const G=[[0.90,'S'],[0.70,'A'],[0.45,'B'],[0.20,'C'],[-Infinity,'D']];
const N=30000;
console.log('본 구간 기준 등급 분포 (범위 0.04 미만은 무등급)');
[[0.04,2,'고수 4%/0.1s'],[0.06,4,'숙련 6%/0.2s'],[0.12,10,'보통 12%/0.5s'],
 [0.20,20,'초보 20%/1.0s'],[9,999,'끝까지 홀드']].forEach(([pb,lag,nm])=>{
  const c={S:0,A:0,B:0,C:0,D:0}; let skip=0,sum=0,n=0;
  for(let i=0;i<N;i++){const r=seen(pk().g(),pb,lag); const rng=r.hi-r.lo;
    if(rng<0.04){skip++;continue;}
    const e=Math.max(0,Math.min(1,(r.mult-r.lo)/rng)); sum+=e; n++;
    c[G.find(g=>e>=g[0])[1]]++;}
  const f=['S','A','B','C','D'].map(k=>`${k} ${(c[k]/n*100).toFixed(0)}%`).join('  ');
  console.log(`  ${nm.padEnd(16)} 평균 ${(sum/n*100).toFixed(0)}%  |  ${f}   무등급 ${(skip/N*100).toFixed(1)}%`);
});
