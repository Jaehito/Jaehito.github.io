// 장세 신호 + 레버리지 검증
// 질문: (1) 신호를 믿고 레버리지 쓰는 플레이가 실제로 이득인가?
//       (2) 정보력을 최대로 올려도 과하게 쉬워지지 않는가?
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const ROUND_TICKS=300, NOISE_SCALE=Math.sqrt(30/ROUND_TICKS);
function dev(base,mult){return Math.max(0.05,1+(base-1)*mult);}
function buildMultiPhase(keypoints,noiseAmt){
  const kps=[[0,1],...keypoints];
  const path=[1]; let noise=0;
  for(let i=1;i<=ROUND_TICKS;i++){
    const frac=i/ROUND_TICKS;
    let seg=kps.length-2;
    for(let k=0;k<kps.length-1;k++){ if(frac<=kps[k+1][0]){seg=k;break;} }
    const [f0,v0]=kps[seg],[f1,v1]=kps[seg+1];
    const segFrac=(f1-f0)>0?(frac-f0)/(f1-f0):1;
    const s=Math.sin(Math.min(1,Math.max(0,segFrac))*Math.PI/2);
    noise+=noiseAmt*randn(); noise*=0.75;
    path.push(Math.max(0.05,v0+(v1-v0)*s+noise));
  }
  return path;
}
function buildFlat(noiseAmt,driftAmt){
  const path=[1]; let noise=0; const drift=(Math.random()-0.5)*driftAmt;
  for(let i=1;i<=ROUND_TICKS;i++){ noise+=noiseAmt*randn(); noise*=0.8;
    path.push(Math.max(0.05,1+drift*(i/ROUND_TICKS)+noise)); }
  return path;
}
const st={pMult:1.0,noiseMult:1.0}; // 사성전자(안정) 기준
const PATTERNS=[
  {id:'up',w:.12,tier:'strong',gen:()=>buildMultiPhase([[0.55+Math.random()*0.20,dev(1.4+Math.random()*0.7,st.pMult)],[1,dev(1.15+Math.random()*0.35,st.pMult)]],0.012*NOISE_SCALE*st.noiseMult)},
  {id:'down',w:.15,tier:'weak',gen:()=>{const b=dev(0.4+Math.random()*0.3,st.pMult);return buildMultiPhase([[0.5+Math.random()*0.25,b],[1,1+(b-1)*(0.9+Math.random()*0.15)]],0.01*NOISE_SCALE*st.noiseMult);}},
  {id:'v',w:.12,tier:'mid',gen:()=>buildMultiPhase([[0.22+Math.random()*0.16,dev(0.5+Math.random()*0.25,st.pMult)],[1,dev(1.05+Math.random()*0.45,st.pMult)]],0.014*NOISE_SCALE*st.noiseMult)},
  {id:'spike',w:.10,tier:'strong',gen:()=>buildMultiPhase([[0.08+Math.random()*0.17,dev(1.8+Math.random()*1.7,st.pMult)],[1,dev(0.5+Math.random()*0.35,st.pMult)]],0.02*NOISE_SCALE*st.noiseMult)},
  {id:'flat',w:.08,tier:'weak',gen:()=>buildFlat(0.01*NOISE_SCALE*st.noiseMult,0.15*st.pMult)},
  {id:'invv',w:.10,tier:'mid',gen:()=>buildMultiPhase([[0.4+Math.random()*0.2,dev(1.4+Math.random()*0.7,st.pMult)],[1,dev(0.55+Math.random()*0.3,st.pMult)]],0.014*NOISE_SCALE*st.noiseMult)},
  {id:'w',w:.10,tier:'mid',gen:()=>buildMultiPhase([[0.22,dev(0.5+Math.random()*0.25,st.pMult)],[0.5,dev(1.15+Math.random()*0.25,st.pMult)],[0.75,dev(0.55+Math.random()*0.25,st.pMult)],[1,dev(0.95+Math.random()*0.2,st.pMult)]],0.013*NOISE_SCALE*st.noiseMult)},
  {id:'m',w:.10,tier:'mid',gen:()=>buildMultiPhase([[0.22,dev(1.35+Math.random()*0.35,st.pMult)],[0.5,dev(0.75+Math.random()*0.2,st.pMult)],[0.75,dev(1.05+Math.random()*0.2,st.pMult)],[1,dev(0.65+Math.random()*0.2,st.pMult)]],0.013*NOISE_SCALE*st.noiseMult)},
  {id:'delayup',w:.07,tier:'strong',gen:()=>buildMultiPhase([[0.55,dev(0.98+Math.random()*0.08,1)],[1,dev(1.6+Math.random()*0.5,st.pMult)]],0.008*NOISE_SCALE*st.noiseMult)},
  {id:'delaydown',w:.06,tier:'weak',gen:()=>buildMultiPhase([[0.55,dev(0.98+Math.random()*0.08,1)],[1,dev(0.4+Math.random()*0.25,st.pMult)]],0.008*NOISE_SCALE*st.noiseMult)},
];
const TIER_W={strong:0,mid:0,weak:0};
PATTERNS.forEach(p=>TIER_W[p.tier]+=p.w);
console.log('티어별 등장 확률:', Object.entries(TIER_W).map(([k,v])=>`${k} ${(v*100).toFixed(0)}%`).join(' / '));

function pickPattern(){let r=Math.random(),a=0;for(const p of PATTERNS){a+=p.w;if(r<=a)return p;}return PATTERNS[PATTERNS.length-1];}
const TIERS=['strong','mid','weak'];
function signalFor(trueTier,acc){
  if(Math.random()<acc)return trueTier;
  const others=TIERS.filter(t=>t!==trueTier);
  return others[Math.floor(Math.random()*others.length)];
}
// 플레이어 행동 모델: 고점 대비 pullback% 떨어지면 매도(= "꺾이면 판다").
// 레버리지가 걸리면 청산선(1-1/lev) 아래로 가는 순간 강제 전액 손실.
function playRound(path,lev,pullback){
  const liq=lev>1?1-1/lev:0;
  let runMax=path[0];
  for(let i=1;i<path.length;i++){
    const v=path[i];
    if(lev>1&&v<=liq)return 0;                 // 청산
    if(v>runMax)runMax=v;
    if(v<runMax*(1-pullback))return Math.max(0,1+(v-1)*lev); // 꺾여서 매도
  }
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
// 정책: 신호에 따라 레버리지/참여 결정. betFrac는 자금 대비 비중.
function simPolicy({acc,levStrong,levMid,levWeak,skipWeak,pullback,N=60000}){
  let sumRet=0, played=0, wipeouts=0;
  for(let i=0;i<N;i++){
    const pat=pickPattern();
    const sig=signalFor(pat.tier,acc);
    if(skipWeak&&sig==='weak'){continue;}      // 약세 신호면 관망
    const lev=sig==='strong'?levStrong:sig==='mid'?levMid:levWeak;
    const r=playRound(pat.gen(),lev,pullback);
    if(r===0)wipeouts++;
    sumRet+=r; played++;
  }
  return {avgRet:sumRet/played, playRate:played/N, wipeRate:wipeouts/played};
}
const PB=0.06; // 고점 대비 6% 꺾이면 매도하는 플레이어
console.log('\n--- 기준선: 신호 무시 ---');
[1,2,3,5].forEach(lev=>{
  const r=simPolicy({acc:1/3,levStrong:lev,levMid:lev,levWeak:lev,skipWeak:false,pullback:PB});
  console.log(`  전판 ${lev}배 고정: 라운드당 ${r.avgRet.toFixed(3)}x, 전액손실 ${(r.wipeRate*100).toFixed(1)}%`);
});
console.log('\n--- 신호 활용: 강세면 레버리지, 약세면 관망 ---');
[0.45,0.55,0.65,0.75,0.85].forEach(acc=>{
  const r3=simPolicy({acc,levStrong:3,levMid:1,levWeak:1,skipWeak:true,pullback:PB});
  const r5=simPolicy({acc,levStrong:5,levMid:1,levWeak:1,skipWeak:true,pullback:PB});
  console.log(`  적중률 ${(acc*100).toFixed(0)}% | 강세3배: ${r3.avgRet.toFixed(3)}x (참여 ${(r3.playRate*100).toFixed(0)}%, 전손 ${(r3.wipeRate*100).toFixed(1)}%)`
    +` | 강세5배: ${r5.avgRet.toFixed(3)}x (전손 ${(r5.wipeRate*100).toFixed(1)}%)`);
});
console.log('\n--- 신호를 거꾸로 쓰면(잘못된 플레이) ---');
const bad=simPolicy({acc:0.55,levStrong:1,levMid:1,levWeak:5,skipWeak:false,pullback:PB});
console.log(`  약세 신호에 5배: ${bad.avgRet.toFixed(3)}x (전손 ${(bad.wipeRate*100).toFixed(1)}%)`);
