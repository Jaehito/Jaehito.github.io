// 1차 시뮬에서 발견: "고점 대비 6% 꺾이면 즉시 매도"하는 이상적 플레이어는
// 청산선(5배=0.80x)에 절대 닿지 않아서 레버리지가 공짜 이득이 되어버린다.
// 실제 사람은 (a) 반응이 늦고 (b) 작은 흔들림에는 안 팔고 버틴다.
// 그래서 사람다운 플레이어(반응 지연 + 둔한 손절선)로 다시 검증한다.
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const ROUND_TICKS=300, NOISE_SCALE=Math.sqrt(30/ROUND_TICKS);
function dev(b,m){return Math.max(0.05,1+(b-1)*m);}
function buildMultiPhase(kp,na){
  const kps=[[0,1],...kp]; const path=[1]; let noise=0;
  for(let i=1;i<=ROUND_TICKS;i++){
    const frac=i/ROUND_TICKS; let seg=kps.length-2;
    for(let k=0;k<kps.length-1;k++){ if(frac<=kps[k+1][0]){seg=k;break;} }
    const [f0,v0]=kps[seg],[f1,v1]=kps[seg+1];
    const sf=(f1-f0)>0?(frac-f0)/(f1-f0):1;
    noise+=na*randn(); noise*=0.75;
    path.push(Math.max(0.05,v0+(v1-v0)*Math.sin(Math.min(1,Math.max(0,sf))*Math.PI/2)+noise));
  } return path;
}
function buildFlat(na,da){const path=[1];let noise=0;const d=(Math.random()-0.5)*da;
  for(let i=1;i<=ROUND_TICKS;i++){noise+=na*randn();noise*=0.8;path.push(Math.max(0.05,1+d*(i/ROUND_TICKS)+noise));}return path;}
const st={pMult:1.0,noiseMult:1.0};
const PATTERNS=[
  {id:'up',w:.12,tier:'strong',gen:()=>buildMultiPhase([[0.55+Math.random()*0.20,dev(1.4+Math.random()*0.7,st.pMult)],[1,dev(1.15+Math.random()*0.35,st.pMult)]],0.012*NOISE_SCALE)},
  {id:'down',w:.15,tier:'weak',gen:()=>{const b=dev(0.4+Math.random()*0.3,st.pMult);return buildMultiPhase([[0.5+Math.random()*0.25,b],[1,1+(b-1)*(0.9+Math.random()*0.15)]],0.01*NOISE_SCALE);}},
  {id:'v',w:.12,tier:'mid',gen:()=>buildMultiPhase([[0.22+Math.random()*0.16,dev(0.5+Math.random()*0.25,st.pMult)],[1,dev(1.05+Math.random()*0.45,st.pMult)]],0.014*NOISE_SCALE)},
  {id:'spike',w:.10,tier:'strong',gen:()=>buildMultiPhase([[0.08+Math.random()*0.17,dev(1.8+Math.random()*1.7,st.pMult)],[1,dev(0.5+Math.random()*0.35,st.pMult)]],0.02*NOISE_SCALE)},
  {id:'flat',w:.08,tier:'weak',gen:()=>buildFlat(0.01*NOISE_SCALE,0.15*st.pMult)},
  {id:'invv',w:.10,tier:'mid',gen:()=>buildMultiPhase([[0.4+Math.random()*0.2,dev(1.4+Math.random()*0.7,st.pMult)],[1,dev(0.55+Math.random()*0.3,st.pMult)]],0.014*NOISE_SCALE)},
  {id:'w',w:.10,tier:'mid',gen:()=>buildMultiPhase([[0.22,dev(0.5+Math.random()*0.25,st.pMult)],[0.5,dev(1.15+Math.random()*0.25,st.pMult)],[0.75,dev(0.55+Math.random()*0.25,st.pMult)],[1,dev(0.95+Math.random()*0.2,st.pMult)]],0.013*NOISE_SCALE)},
  {id:'m',w:.10,tier:'mid',gen:()=>buildMultiPhase([[0.22,dev(1.35+Math.random()*0.35,st.pMult)],[0.5,dev(0.75+Math.random()*0.2,st.pMult)],[0.75,dev(1.05+Math.random()*0.2,st.pMult)],[1,dev(0.65+Math.random()*0.2,st.pMult)]],0.013*NOISE_SCALE)},
  {id:'delayup',w:.07,tier:'strong',gen:()=>buildMultiPhase([[0.55,dev(0.98+Math.random()*0.08,1)],[1,dev(1.6+Math.random()*0.5,st.pMult)]],0.008*NOISE_SCALE)},
  {id:'delaydown',w:.06,tier:'weak',gen:()=>buildMultiPhase([[0.55,dev(0.98+Math.random()*0.08,1)],[1,dev(0.4+Math.random()*0.25,st.pMult)]],0.008*NOISE_SCALE)},
];
function pickPattern(){let r=Math.random(),a=0;for(const p of PATTERNS){a+=p.w;if(r<=a)return p;}return PATTERNS[9];}
const TIERS=['strong','mid','weak'];
function signalFor(t,acc){if(Math.random()<acc)return t;const o=TIERS.filter(x=>x!==t);return o[Math.floor(Math.random()*o.length)];}

// 사람다운 플레이어: 고점 대비 pullback 만큼 꺾인 걸 "인지"한 뒤 lag틱 후에 실제로 매도.
// 청산선은 인지/지연과 무관하게 즉시 발동(강제 전액 손실).
function playRound(path,lev,pullback,lag){
  const liq=lev>1?1-1/lev:0;
  let runMax=path[0], pending=-1;
  for(let i=1;i<path.length;i++){
    const v=path[i];
    if(lev>1&&v<=liq)return 0;
    if(pending>=0){ if(i>=pending) return Math.max(0,1+(v-1)*lev); }
    else { if(v>runMax)runMax=v;
           if(v<runMax*(1-pullback)) pending=i+lag; }
  }
  return Math.max(0,1+(path[path.length-1]-1)*lev);
}
function sim({acc,levStrong,levMid,skipWeak,pullback,lag,N=40000}){
  let s=0,played=0,wipe=0;
  for(let i=0;i<N;i++){
    const p=pickPattern(), sig=signalFor(p.tier,acc);
    if(skipWeak&&sig==='weak')continue;
    const lev=sig==='strong'?levStrong:levMid;
    const r=playRound(p.gen(),lev,pullback,lag);
    if(r===0)wipe++;
    s+=r; played++;
  }
  return {ret:s/played, play:played/N, wipe:wipe/played};
}
const PROFILES=[
  {name:'숙련 (6% 손절, 0.2s 반응)',  pb:0.06, lag:4},
  {name:'보통 (12% 손절, 0.5s 반응)', pb:0.12, lag:10},
  {name:'느슨 (20% 손절, 1.0s 반응)', pb:0.20, lag:20},
];
for(const pr of PROFILES){
  console.log(`\n===== ${pr.name} =====`);
  console.log('  [신호 무시] 전판 고정 배율');
  [1,2,3,5].forEach(l=>{const r=sim({acc:1/3,levStrong:l,levMid:l,skipWeak:false,pullback:pr.pb,lag:pr.lag});
    console.log(`    ${l}배: ${r.ret.toFixed(3)}x  전액손실 ${(r.wipe*100).toFixed(1)}%`);});
  console.log('  [신호 활용] 강세=레버리지 / 보통=1배 / 약세=관망');
  [0.55,0.75,0.85].forEach(acc=>{
    const a=sim({acc,levStrong:3,levMid:1,skipWeak:true,pullback:pr.pb,lag:pr.lag});
    const b=sim({acc,levStrong:5,levMid:1,skipWeak:true,pullback:pr.pb,lag:pr.lag});
    console.log(`    적중 ${(acc*100).toFixed(0)}% → 강세3배 ${a.ret.toFixed(3)}x(전손 ${(a.wipe*100).toFixed(1)}%) | 강세5배 ${b.ret.toFixed(3)}x(전손 ${(b.wipe*100).toFixed(1)}%)`);
  });
}
