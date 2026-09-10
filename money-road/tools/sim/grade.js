const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const PT=pats(1.0,1.0);
function pk(){let r=Math.random(),a=0;for(const p of PT){a+=p.w;if(r<=a)return p;}return PT[9];}
// 통합 지표: 이번 판에 "실제로 도달했던 가격 범위" 안에서 내가 어디에 팔았나
//   score = (매도가 − 그 판 최저) / (그 판 최고 − 그 판 최저)
// 고점 매도=1.0, 바닥 매도=0. 상승장·하락장 구분이 필요 없고 항상 정의된다.
function px(path,pb,lag){
  const peak=Math.max(...path), low=Math.min(...path);
  let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(pend>=0){if(i>=pend)return{mult:v,peak,low};}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return{mult:path[path.length-1],peak,low};
}
const G=[[0.90,'S'],[0.70,'A'],[0.45,'B'],[0.20,'C'],[-Infinity,'D']];
const N=40000;
console.log('통합 등급  score = (매도 − 최저) / (최고 − 최저)');
[[0.04,2,'고수 4%손절/0.1s'],[0.06,4,'숙련 6%손절/0.2s'],[0.12,10,'보통 12%손절/0.5s'],
 [0.20,20,'초보 20%손절/1.0s'],[9,999,'끝까지 홀드']].forEach(([pb,lag,nm])=>{
  const c={S:0,A:0,B:0,C:0,D:0}; let sum=0;
  for(let i=0;i<N;i++){const r=px(pk().g(),pb,lag);
    const rng=r.peak-r.low;
    const e=rng>0.001?Math.max(0,Math.min(1,(r.mult-r.low)/rng)):1;
    sum+=e; c[G.find(g=>e>=g[0])[1]]++;}
  const f=['S','A','B','C','D'].map(k=>`${k} ${(c[k]/N*100).toFixed(0)}%`).join('  ');
  console.log(`  ${nm.padEnd(18)} 평균 ${(sum/N*100).toFixed(0)}%  |  ${f}`);
});
