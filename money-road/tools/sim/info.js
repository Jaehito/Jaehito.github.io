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
/* 신호를 최대한 활용하는 플레이: 강세면 최대 배율, 보통이면 최소, 약세면 최소 베팅으로 흘려보냄 */
function run({acc,minLev,maxLev,betFrac,pb,lag,ins,cap,maxR=500}){
  let cash=1e5,peak=1e5,r=0;
  while(r<maxR){
    if(cash<MINBET)return{e:'파산',r,peak};
    if(peak>=cap)return{e:'클리어',r,peak};
    r++;
    const p=pk(), s=sg(p.t,acc);
    const lev=(s==='strong')?maxLev:minLev;
    const bet=(s==='weak')?MINBET:Math.max(MINBET,Math.min(cash,Math.floor(cash*betFrac)));
    let ret=px(p.g(),lev,pb,lag); const pr=ret-1; ret=1+(pr<0?pr*(1-ins):pr);
    cash=cash-bet+Math.max(0,bet*ret);
    if(cash>peak)peak=cash;
  }
  return{e:'시간초과',r,peak};
}
const N=500;
function m(o){const rs=[];for(let k=0;k<N;k++)rs.push(run(o));
  const bk=rs.filter(x=>x.e==='파산'), cl=rs.filter(x=>x.e==='클리어');
  const md=a=>a.length?a.map(x=>x.r).sort((x,y)=>x-y)[(a.length/2)|0]:'-';
  return{bk:bk.length/N, cl:cl.length/N, clR:md(cl)};}
console.log('■ 장세 신호 적중률이 게임을 얼마나 쉽게 만드나');
console.log('   보통 플레이(12%손절/0.5s) · 빚 3배 강제 · 강세엔 최대배율 · 약세는 최소베팅으로 흘림');
console.log('   목표 = 1억 도달\n');
console.log('  적중률  최대배율  보험   파산률   1억 도달률   도달 중앙판수');
for(const acc of [0.55,0.62,0.70,0.78,0.85,0.95]){
  for(const [maxLev,ins] of [[3,0],[5,0.30]]){
    const x=m({acc,minLev:3,maxLev,betFrac:0.6,pb:0.12,lag:10,ins,cap:1e8});
    console.log(`   ${(acc*100).toFixed(0).padStart(3)}%     ${maxLev}배    ${(ins*100).toFixed(0).padStart(3)}%   ${(x.bk*100).toFixed(0).padStart(4)}%      ${(x.cl*100).toFixed(0).padStart(4)}%        ${String(x.clR).padStart(4)}판`);
  }
}
