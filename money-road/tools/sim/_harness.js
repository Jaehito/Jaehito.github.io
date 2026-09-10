// 진행 속도 검증: 플레이어가 실제로 각 레벨까지 몇 판, 몇 분이 걸리나
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const T=300, NS=Math.sqrt(30/T);
function dev(b,m){return Math.max(0.05,1+(b-1)*m);}
function mp(kp,na){const kps=[[0,1],...kp];const p=[1];let n=0;
  for(let i=1;i<=T;i++){const f=i/T;let s=kps.length-2;
    for(let k=0;k<kps.length-1;k++){if(f<=kps[k+1][0]){s=k;break;}}
    const[f0,v0]=kps[s],[f1,v1]=kps[s+1];const sf=(f1-f0)>0?(f-f0)/(f1-f0):1;
    n+=na*randn();n*=0.75;p.push(Math.max(0.05,v0+(v1-v0)*Math.sin(Math.min(1,Math.max(0,sf))*Math.PI/2)+n));}return p;}
function flat(na,da){const p=[1];let n=0;const d=(Math.random()-0.5)*da;
  for(let i=1;i<=T;i++){n+=na*randn();n*=0.8;p.push(Math.max(0.05,1+d*(i/T)+n));}return p;}
function pats(M,NM){return [
 {w:.12,t:'strong',g:()=>mp([[0.55+Math.random()*0.2,dev(1.4+Math.random()*0.7,M)],[1,dev(1.15+Math.random()*0.35,M)]],0.012*NS*NM)},
 {w:.15,t:'weak',g:()=>{const b=dev(0.4+Math.random()*0.3,M);return mp([[0.5+Math.random()*0.25,b],[1,1+(b-1)*(0.9+Math.random()*0.15)]],0.01*NS*NM);}},
 {w:.12,t:'mid',g:()=>mp([[0.22+Math.random()*0.16,dev(0.5+Math.random()*0.25,M)],[1,dev(1.05+Math.random()*0.45,M)]],0.014*NS*NM)},
 {w:.10,t:'strong',g:()=>mp([[0.08+Math.random()*0.17,dev(1.8+Math.random()*1.7,M)],[1,dev(0.5+Math.random()*0.35,M)]],0.02*NS*NM)},
 {w:.08,t:'weak',g:()=>flat(0.01*NS*NM,0.15*M)},
 {w:.10,t:'mid',g:()=>mp([[0.4+Math.random()*0.2,dev(1.4+Math.random()*0.7,M)],[1,dev(0.55+Math.random()*0.3,M)]],0.014*NS*NM)},
 {w:.10,t:'mid',g:()=>mp([[0.22,dev(0.5+Math.random()*0.25,M)],[0.5,dev(1.15+Math.random()*0.25,M)],[0.75,dev(0.55+Math.random()*0.25,M)],[1,dev(0.95+Math.random()*0.2,M)]],0.013*NS*NM)},
 {w:.10,t:'mid',g:()=>mp([[0.22,dev(1.35+Math.random()*0.35,M)],[0.5,dev(0.75+Math.random()*0.2,M)],[0.75,dev(1.05+Math.random()*0.2,M)],[1,dev(0.65+Math.random()*0.2,M)]],0.013*NS*NM)},
 {w:.07,t:'strong',g:()=>mp([[0.55,dev(0.98+Math.random()*0.08,1)],[1,dev(1.6+Math.random()*0.5,M)]],0.008*NS*NM)},
 {w:.06,t:'weak',g:()=>mp([[0.55,dev(0.98+Math.random()*0.08,1)],[1,dev(0.4+Math.random()*0.25,M)]],0.008*NS*NM)},
];}
const P=pats(1.0,1.0);
function pick(){let r=Math.random(),a=0;for(const p of P){a+=p.w;if(r<=a)return p;}return P[9];}
const TIERS=['strong','mid','weak'];
function sig(t,acc){if(Math.random()<acc)return t;const o=TIERS.filter(x=>x!==t);return o[(Math.random()*2)|0];}
function play(path,lev,pb,lag){
  const liq=lev>1?1-1/lev:0; let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){const v=path[i];
    if(pend>=0){if(i>=pend)return Math.max(0,1+(v-1)*lev);}
    else{if(v>mx)mx=v; if(v<mx*(1-pb))pend=i+lag;}}
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
const LEVELS=[[2,5e5],[3,3e6],[4,2e7],[5,1.5e8],[6,1e9],[7,8e9],[8,5e10]];
function run({betFrac,pb,lag,useSig,acc,lev}){
  let cash=1e5, peak=1e5, rounds=0, li=0; const out=[];
  while(li<LEVELS.length && rounds<20000){
    const p=pick(), s=sig(p.t,acc);
    rounds++;
    if(useSig&&s==='weak')continue;            // 약세면 관망(판수는 셈)
    const bet=Math.max(1000,Math.min(cash,Math.floor(cash*betFrac)));
    const L=(useSig&&s==='strong')?lev:1;
    const r=play(p.g(),L,pb,lag);
    cash=cash-bet+Math.max(0,bet*r);
    if(cash<1000){out.push(['파산',rounds]);cash=1e5;peak=1e5;li=0;continue;}
    if(cash>peak)peak=cash;
    while(li<LEVELS.length&&peak>=LEVELS[li][1]){out.push([`Lv.${LEVELS[li][0]}`,rounds]);li++;}
  }
  return out;
}
const PROFILES=[
 {n:'초보 (전액베팅, 20%손절, 1.0s반응, 신호무시)', o:{betFrac:1.0,pb:0.20,lag:20,useSig:false,acc:0.55,lev:1}},
 {n:'보통 (50%베팅, 12%손절, 0.5s반응, 신호활용3배)', o:{betFrac:0.5,pb:0.12,lag:10,useSig:true,acc:0.55,lev:3}},
 {n:'숙련 (50%베팅, 6%손절, 0.2s반응, 신호활용5배)', o:{betFrac:0.5,pb:0.06,lag:4,useSig:true,acc:0.85,lev:5}},
];
for(const pr of PROFILES){
  const runs=[]; for(let k=0;k<200;k++)runs.push(run(pr.o));
  console.log('\n===== '+pr.n+' =====');
  for(const lvl of ['Lv.2','Lv.3','Lv.4','Lv.5','Lv.6','Lv.7','Lv.8']){
    const hits=runs.map(r=>{const e=r.find(x=>x[0]===lvl);return e?e[1]:null}).filter(x=>x!==null).sort((a,b)=>a-b);
    if(!hits.length){console.log(`  ${lvl}: 200판중 도달 0회`);continue;}
    const med=hits[(hits.length/2)|0];
    console.log(`  ${lvl}: 도달률 ${(hits.length/200*100).toFixed(0)}% · 중앙값 ${med}판 (약 ${(med*22/60).toFixed(0)}분)`);
  }
  const bk=runs.map(r=>r.filter(x=>x[0]==='파산').length);
  console.log(`  파산 횟수 평균 ${(bk.reduce((a,b)=>a+b,0)/200).toFixed(1)}회`);
}
