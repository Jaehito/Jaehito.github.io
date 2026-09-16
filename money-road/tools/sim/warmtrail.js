/* 🧊 "시초 눌림은 항상 가짜다" — 지금 유일하게 남은 정답 전략을 재고, 고치면 어떻게 되는지 본다.

   플레이어가 말한 것 둘:
     ② 하락 판이라도 초반에 오르는 구간이 있어서, 거기서 팔고 내려가면 바로 파는 게 여전히 된다.
     ③ 급락 뒤에 늘 완화(반등)가 와서 파산을 할 수가 없다.

   재는 방법: 시초 warm 구간은 아무것도 하지 않고 버틴 뒤 트레일링으로 파는 봇.
   DIP/midHead가 모든 패턴의 머리를 같은 얼굴로 만들어 놨으므로, 이 봇은
   "머리는 정보가 없다"는 사실만 알면 된다 — 패턴을 읽을 필요가 없다.

   반응 지연 LAG(0.5초)은 bounce.js와 같게 둔다. 지연이 없으면 트레일링이 과대평가된다.

   사용: node sim/warmtrail.js   (3분 남짓) */
const G = require('./_game');
const T = 300, LEV = 3, LIQ = 1 - 1/LEV, LAG = 10;
const ST = G.STOCKS.stable;
const mp = G.buildMultiPhase, dev = G.dev, ns = G.noiseScale, mh = G.midHead;
const R = (lo,sp) => lo + Math.random()*sp;
const cash = v => Math.max(0, 1+(v-1)*LEV);

/* ── 후보 패턴 ───────────────────────────────────────────────────────── */
/* 톱니 — 위아래로 흔들리기만 한다. 고점이 없어서 트레일링이 헛발질한다. */
const chop = (st,Tt) => { const k=[]; let f=0;
  while(f<0.95){ f+=R(0.10,0.08); k.push([Math.min(1,f), dev(R(0.93,0.14), st.pMult)]); }
  k.push([1, dev(R(0.95,0.10), st.pMult)]);
  return mp(k, 0.016*ns(Tt)*st.noiseMult, Tt); };
/* 가짜 돌파 — 조금(1.06~1.15) 오르고 되돌림 없이 무너진다 */
const fake = (st,Tt) => { const pf=R(0.14,0.24);
  return mp([[pf, dev(R(1.06,0.09), st.pMult)],
    [Math.min(0.95, pf+R(0.30,0.20)), dev(R(0.74,0.10), st.pMult)],
    [1, dev(R(0.70,0.14), st.pMult)]], 0.014*ns(Tt)*st.noiseMult, Tt); };
/* 나락 — 되돌림 없이 청산선을 뚫는다. 파산이 가능해지는 유일한 통로. */
const crash = (st,Tt) => mp([[R(0.04,0.05), dev(R(0.94,0.04), st.pMult)],
  [R(0.26,0.18), dev(R(0.42,0.16), st.pMult)],
  [1,            dev(R(0.36,0.20), st.pMult)]], 0.011*ns(Tt)*st.noiseMult, Tt);
/* 하락 — 45%는 반등 없이 머리에서 그대로 미끄러진다 */
const down2 = (st,Tt) => { const dip=R(0.18,0.10), lo=dev(R(0.82,0.06), st.pMult);
  if(Math.random()<0.45) return mp([[dip,lo],[R(0.55,0.15), dev(R(0.70,0.10), st.pMult)],
    [1, dev(R(0.45,0.15), st.pMult)]], 0.013*ns(Tt)*st.noiseMult, Tt);
  return mp([[dip,lo],[R(0.42,0.10), dev(R(1.00,0.10), st.pMult)],
    [R(0.65,0.08), dev(R(0.84,0.06), st.pMult)],
    [1, dev(R(0.45,0.15), st.pMult)]], 0.013*ns(Tt)*st.noiseMult, Tt); };

const VARIANTS = {
  '지금': {},
  'A 톱니·가짜·나락': {
    up:{weight:.20}, down:{weight:.14, gen:down2}, v:{weight:.08}, spike:{weight:.05},
    flat:{weight:.06}, invv:{weight:.07}, w:{weight:.07}, m:{weight:.07},
    delayup:{weight:.04}, delaydown:{weight:.04},
    _new:[{id:'chop',tier:'mid',weight:.09,gen:chop},
          {id:'fake',tier:'mid',weight:.09,gen:fake},
          {id:'crash',tier:'weak',weight:.06,gen:crash}],
  },
  'B 보통을 더 눌러서': {
    up:{weight:.20}, down:{weight:.12, gen:down2}, v:{weight:.05}, spike:{weight:.04},
    flat:{weight:.05}, invv:{weight:.05}, w:{weight:.05}, m:{weight:.05},
    delayup:{weight:.04}, delaydown:{weight:.04},
    _new:[{id:'chop',tier:'mid',weight:.13,gen:chop},
          {id:'fake',tier:'mid',weight:.13,gen:fake},
          {id:'crash',tier:'weak',weight:.07,gen:crash}],
  },
};

function build(spec){
  /* {...p} 로 베끼면 안 된다 — PATTERNS의 name은 t()를 부르는 getter라 노드에서 터진다.
     생성기가 실제로 쓰는 세 칸만 옮긴다. */
  const pats = G.PATTERNS.map(p=>{ const s=spec[p.id];
    return {id:p.id, weight:(s&&s.weight!==undefined)?s.weight:p.weight, gen:(s&&s.gen)||p.gen}; });
  const tier = {...G.PATTERN_TIER};
  (spec._new||[]).forEach(n=>{ pats.push({id:n.id,weight:n.weight,gen:n.gen}); tier[n.id]=n.tier; });
  return {pats, tier};
}
function picker(pats,tier,down){
  const b = pats.map(p=>p.weight);
  const sS = pats.reduce((a,p,i)=>a+(tier[p.id]==='strong'?b[i]:0),0);
  const wS = pats.reduce((a,p,i)=>a+(tier[p.id]==='weak'  ?b[i]:0),0);
  const w = b.map((x,i)=>{ const t=tier[pats[i].id];
    if(t==='weak')  return x+down*(x/wS);
    if(t==='strong')return x-down*(x/sS);
    return x; });
  const sum=w.reduce((a,c)=>a+c,0), n=w.map(x=>x/sum);
  const mix={strong:0,mid:0,weak:0}; pats.forEach((p,i)=>mix[tier[p.id]]+=n[i]);
  return [()=>{ let r=Math.random(),a=0;
    for(let i=0;i<n.length;i++){a+=n[i]; if(r<=a)return {p:pats[i],t:tier[pats[i].id]};}
    return {p:pats[n.length-1],t:tier[pats[n.length-1].id]}; }, mix];
}

/* 시초 warm 틱은 손대지 않고, 그 뒤로 고점 대비 pb 밀리면 판다(반응 LAG 포함) */
function warmTrail(path, warm, pb){
  let mx=path[0], pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(pend>=0){ if(i>=pend) return cash(v); continue; }
    if(i<warm){ continue; }
    if(v>mx)mx=v;
    if(v<mx*(1-pb)) pend=i+LAG;
  }
  return cash(path[path.length-1]);
}

const BOTS = [
  ['즉시 트레일 12%',      0,             0.12],
  ['버티고(25%) 트레일 12%', Math.floor(T*0.25), 0.12],
  ['버티고(25%) 트레일 8%',  Math.floor(T*0.25), 0.08],
  ['버티고(35%) 트레일 8%',  Math.floor(T*0.35), 0.08],
  ['끝까지 홀드',          0,             0.999],
];
const N = 30000;
console.log('■ 판당 잔고 배수 (사성전자 · 3배 · 3단계 · 반응 0.5초)\n');
for(const [name,spec] of Object.entries(VARIANTS)){
  const b = build(spec); const [pick,mix] = picker(b.pats,b.tier,0.04);
  console.log(`  ── ${name} ──  등급 강세 ${(mix.strong*100).toFixed(0)}% · 보통 ${(mix.mid*100).toFixed(0)}% · 약세 ${(mix.weak*100).toFixed(0)}%`);
  console.log('     봇                      강세   보통   약세   전체  전액손실');
  for(const [bn,warm,pb] of BOTS){
    const acc={strong:[0,0],mid:[0,0],weak:[0,0]}; let wipe=0;
    for(let k=0;k<N;k++){ const {p,t}=pick(); const r=warmTrail(p.gen(ST,T),warm,pb);
      if(r===0)wipe++; acc[t][0]+=r; acc[t][1]++; }
    const all=(acc.strong[0]+acc.mid[0]+acc.weak[0])/N;
    console.log('    ',bn.padEnd(22),
      (acc.strong[0]/acc.strong[1]).toFixed(2).padStart(5),
      (acc.mid[0]/acc.mid[1]).toFixed(2).padStart(6),
      (acc.weak[0]/acc.weak[1]).toFixed(2).padStart(6),
      all.toFixed(2).padStart(6), ((wipe/N*100).toFixed(1)+'%').padStart(8));
  }
  console.log('');
}

/* ── 파산이 가능한가 — 약세 판이 반응할 틈을 주는가 ── */
console.log('■ 청산까지 걸리는 시간 (약세 등급 · 3배 청산선 0.667)\n');
console.log('  안                      청산률  청산까지(중앙)  2초 안에 청산  청산 전 최고');
for(const [name,spec] of Object.entries(VARIANTS)){
  const b=build(spec);
  const sub=b.pats.filter(p=>b.tier[p.id]==='weak');
  const tot=sub.reduce((a,p)=>a+p.weight,0);
  const secs=[], highs=[]; let died=0, fast=0, n=6000;
  for(let k=0;k<n;k++){
    let r=Math.random()*tot,a=0,pk=sub[0];
    for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
    const arr=pk.gen(ST,T); let hi=1, li=-1;
    for(let i=1;i<=T;i++){ if(arr[i]<=LIQ){li=i;break;} if(arr[i]>hi)hi=arr[i]; }
    if(li<0)continue;
    died++; secs.push(li*0.05); highs.push(hi); if(li*0.05<=2)fast++;
  }
  secs.sort((x,y)=>x-y); highs.sort((x,y)=>x-y);
  console.log('  '+name.padEnd(22),
    ((died/n*100).toFixed(0)+'%').padStart(6),
    (secs[secs.length>>1].toFixed(1)+'s').padStart(13),
    ((fast/died*100).toFixed(0)+'%').padStart(13),
    highs[highs.length>>1].toFixed(2).padStart(12));
}

/* ── 클리어율 ── EV보다 이쪽이 이 저장소의 기준이다(gate.js 이후로). bounce.js의 런 루프와 같다. */
const MIN_BET=10000, RATE=0.10, INFO_ACC=0.55, TIERS=['strong','mid','weak'];
const GATES=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];
function panic(path){ let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ)return 0; if(v<=0.96)return cash(v);
    if(pend>=0){ if(i>=pend)return cash(v); } else { if(v>mx)mx=v; if(v<mx*0.88)pend=i+LAG; } }
  return cash(path[path.length-1]); }
function hold(path){ for(let i=1;i<path.length;i++) if(path[i]<=LIQ)return 0;
  return cash(path[path.length-1]); }
function runOne(pick, mode){
  let money=1e5, total=0;
  for(const [goal,limit] of GATES){
    let left=limit;
    while(money<goal){
      if(left<=0)return '기한실패';
      if(money<MIN_BET)return '파산';
      const need=Math.pow(goal/money,1/left);
      const f=Math.min(1,Math.max(0.2,(need-1)/0.30));
      const bet=Math.max(MIN_BET,Math.min(money,Math.floor(money*f)));
      const {p,t}=pick(); let ret;
      if(mode==='conv'){ const s=sigOf(t);
        if(s==='weak'){ left--; total++; if(total>500)return '초과'; continue; }
        ret=warmTrail(p.gen(ST,T), s==='strong'?Math.floor(T*0.35):0, 0.12); }
      else if(mode==='warm25')  ret=warmTrail(p.gen(ST,T),Math.floor(T*0.25),0.12);
      else if(mode==='warm35')  ret=warmTrail(p.gen(ST,T),Math.floor(T*0.35),0.08);
      else if(mode==='trail')   ret=warmTrail(p.gen(ST,T),0,0.12);
      else if(mode==='panic')   ret=panic(p.gen(ST,T));
      else                      ret=hold(p.gen(ST,T));
      money=money-bet+Math.max(0,bet*ret);
      left--; total++; if(total>500)return '초과';
    }
    money+=goal*RATE*Math.max(0,left);
  }
  return '클리어';
}
console.log('\n■ 클리어율 (103거래일 · 3단계 · 신호 55%)\n');
console.log('  안                     트레일12  버티25  버티35   쫄보    홀드   신호');
for(const [name,spec] of Object.entries(VARIANTS)){
  const b=build(spec); const [pick]=picker(b.pats,b.tier,0.04);
  const cells=['trail','warm25','warm35','panic','hold','conv'].map(m=>{
    const NN=400; let c=0, broke=0;
    for(let k=0;k<NN;k++){ const r=runOne(pick,m); if(r==='클리어')c++; if(r==='파산')broke++; }
    return ((c/NN*100).toFixed(0)+'%').padStart(7); }).join(' ');
  console.log('  '+name.padEnd(22)+cells);
}
console.log('\n■ 파산률 (같은 조건 · 결말이 파산인 런의 비율)\n');
console.log('  안                     트레일12  버티25  버티35   쫄보    홀드');
for(const [name,spec] of Object.entries(VARIANTS)){
  const b=build(spec); const [pick]=picker(b.pats,b.tier,0.04);
  const cells=['trail','warm25','warm35','panic','hold'].map(m=>{
    const NN=400; let broke=0;
    for(let k=0;k<NN;k++) if(runOne(pick,m)==='파산')broke++;
    return ((broke/NN*100).toFixed(0)+'%').padStart(7); }).join(' ');
  console.log('  '+name.padEnd(22)+cells);
}
