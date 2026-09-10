const src=require('fs').readFileSync(require('path').join(__dirname,'_harness.js'),'utf8');
eval(src.split('const LEVELS=')[0]);
const PT=pats(1.0,1.0);
function pk(){let r=Math.random(),a=0;for(const p of PT){a+=p.w;if(r<=a)return p;}return PT[9];}
const TR=['strong','mid','weak'];
function sg(t,acc){if(Math.random()<acc)return t;const o=TR.filter(x=>x!==t);return o[(Math.random()*2)|0];}
function px(path,lev,pb,lag){
  let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(lev>1&&v<=1-1/lev)return 0;
    if(pend>=0){if(i>=pend)return Math.max(0,1+(v-1)*lev);}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
const MINBET=10000;
/* 지금 최적 전략: 기본 50%, 약세면 25%(또는 최소), 강세면 75% */
function run({minFrac,useSig,acc,sigShown,minLev,maxLev,ins,cap,maxR=600}){
  let cash=1e5,peak=1e5,r=0;
  while(r<maxR){
    const floor=Math.max(MINBET,Math.floor(cash*minFrac));
    if(cash<floor)return{e:'파산',r,peak};
    if(peak>=cap)return{e:'클리어',r,peak};
    r++;
    const p=pk();
    let s=null;
    if(useSig){ s=sg(p.t,acc); if(sigShown<1 && Math.random()>=sigShown) s=null; }
    let want=0.5, lev=minLev;
    if(s==='weak')want=0.25;
    else if(s==='strong'){want=0.75; lev=maxLev;}
    const bet=Math.max(floor,Math.min(cash,Math.floor(cash*want)));
    let ret=px(p.g(),lev,0.12,10); const pr=ret-1; ret=1+(pr<0?pr*(1-ins):pr);
    cash=cash-bet+Math.max(0,bet*ret);
    if(cash>peak)peak=cash;
  }
  return{e:'시간초과',r,peak};
}
const N=600;
function m(o){const rs=[];for(let k=0;k<N;k++)rs.push(run(o));
  const bk=rs.filter(x=>x.e==='파산'), cl=rs.filter(x=>x.e==='클리어');
  const md=a=>a.length?a.map(x=>x.r).sort((x,y)=>x-y)[(a.length/2)|0]:'-';
  return{bk:(bk.length/N*100).toFixed(0), cl:(cl.length/N*100).toFixed(0), r:md(cl)};}
const base={useSig:true,acc:0.55,sigShown:1,minLev:3,maxLev:3,ins:0,cap:5e10};

console.log('■ A. 신호가 정말 원인인가 (목표 500억 = Lv.8 클리어)');
console.log('  전략                                  파산   클리어   판수');
[['신호 그대로 (55%)',{...base}],
 ['신호 아예 없음 (전판 50% 고정)',{...base,useSig:false}],
 ['신호 100% 정확',{...base,acc:1}],
 ['신호 100% 정확 · 30%의 판에만 표시',{...base,acc:1,sigShown:0.3}],
 ['신호 100% 정확 · 60%의 판에만 표시',{...base,acc:1,sigShown:0.6}],
].forEach(([nm,o])=>{const x=m({...o,minFrac:0});
  console.log(`  ${nm.padEnd(36)} ${x.bk.padStart(4)}%  ${x.cl.padStart(5)}%   ${String(x.r).padStart(4)}판`);});

console.log('\n■ B. 최소 베팅 "비중"을 강제하면 (신호 55% · 3배 고정)');
console.log('  최소 비중   파산   클리어   판수');
[0,0.15,0.25,0.35,0.50,0.70].forEach(f=>{const x=m({...base,minFrac:f});
  console.log(`   ${(f*100).toFixed(0).padStart(3)}%      ${x.bk.padStart(4)}%  ${x.cl.padStart(5)}%   ${String(x.r).padStart(4)}판`);});

console.log('\n■ C. 최소 비중 + 손절 보험/레버리지가 붙으면 (성장 반영)');
console.log('  최소 비중  보험  최대배율   파산   클리어   판수');
[[0.35,0,3],[0.35,0.30,5],[0.50,0,3],[0.50,0.30,5],[0.50,0.45,10]].forEach(([f,ins,ml])=>{
  const x=m({...base,minFrac:f,ins,maxLev:ml});
  console.log(`   ${(f*100).toFixed(0).padStart(3)}%     ${(ins*100).toFixed(0).padStart(3)}%    ${String(ml).padStart(2)}배    ${x.bk.padStart(4)}%  ${x.cl.padStart(5)}%   ${String(x.r).padStart(4)}판`);});
