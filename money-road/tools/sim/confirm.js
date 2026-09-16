/* ✅ 확정 후보 점검 — C0 패턴 · DIP 0.88 · 하락가중 0.05.

   4차 스윕 결과(N=300): 최고 25% · 격차 0%p · 전액손실 7.9%.
   숫자가 맞는지만이 아니라 **예전에 고쳐둔 것을 되돌리지 않는지**를 같이 본다.
   DIP는 "초반에 빠지면 던진다"를 죽이려고 0.84까지 내렸던 값이라, 올리면
   그 문제가 돌아올 수 있다. 8a0acc7(패턴 분포 개편)이 세운 기준이 둘이다:
     · 전반부 저점만 보고 강세/약세를 구분할 수 없어야 한다
     · 한 전략이 독주하지 않아야 한다
   여기에 이번 요구 둘을 더한다:
     · 시초를 버리는 봇이 특별대우를 못 받아야 한다(②)
     · 반등 없이 죽는 판이 실제로 있어야 한다(③)

   사용: node sim/confirm.js   (10분쯤) */
const G = require('./_game');
const T = 300, LEV = 3, LIQ = 1 - 1/LEV, LAG = 10;
const mp = G.buildMultiPhase, dev = G.dev, ns = G.noiseScale;
const R = (lo,sp) => lo + Math.random()*sp;
const cash = v => Math.max(0, 1+(v-1)*LEV);

const earlypop = (st,Tt) => { const pf=R(0.08,0.14);
  return mp([[pf, dev(R(1.35,0.55), st.pMult)],
    [pf+R(0.10,0.10), dev(R(0.97,0.10), st.pMult)],
    [1, dev(R(0.88,0.26), st.pMult)]], 0.016*ns(Tt)*st.noiseMult, Tt); };
const crash = (st,Tt) => mp([[R(0.04,0.05), dev(R(0.94,0.04), st.pMult)],
  [R(0.26,0.18), dev(R(0.42,0.16), st.pMult)],
  [1,            dev(R(0.36,0.20), st.pMult)]], 0.011*ns(Tt)*st.noiseMult, Tt);
const downNoBounce = p => (st,Tt) => { const dip=R(0.18,0.10), lo=dev(R(0.82,0.06), st.pMult);
  if(Math.random()<p) return mp([[dip,lo],[R(0.55,0.15), dev(R(0.70,0.10), st.pMult)],
    [1, dev(R(0.45,0.15), st.pMult)]], 0.013*ns(Tt)*st.noiseMult, Tt);
  return mp([[dip,lo],[R(0.42,0.10), dev(R(1.00,0.10), st.pMult)],
    [R(0.65,0.08), dev(R(0.84,0.06), st.pMult)],
    [1, dev(R(0.45,0.15), st.pMult)]], 0.013*ns(Tt)*st.noiseMult, Tt); };

const SPEC = { spike:{weight:0.07}, down:{weight:0.22, gen:downNoBounce(0.20)},
  _new:[{id:'earlypop',tier:'mid',weight:0.03,gen:earlypop},
        {id:'crash',tier:'weak',weight:0.02,gen:crash}] };
const CONF = {'지금 (DIP .84 · down .04)':{dip:0.84,down:0.04,spec:{}},
              '확정안 (C0 · DIP .88 · down .05)':{dip:0.88,down:0.05,spec:SPEC}};

function build(spec){
  const pats = G.PATTERNS.map(p=>{ const s=spec[p.id];
    return {id:p.id, weight:(s&&s.weight!==undefined)?s.weight:p.weight, gen:(s&&s.gen)||p.gen}; });
  const tier = {...G.PATTERN_TIER};
  (spec._new||[]).forEach(n=>{ pats.push({id:n.id,weight:n.weight,gen:n.gen}); tier[n.id]=n.tier; });
  return {pats, tier};
}
function picker(pats,tier,down,stock){
  const pw=(stock&&stock.patW)||null;
  const b = pats.map((p,i)=> p.weight * (pw&&pw[p.id]!==undefined?pw[p.id]:1));
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
function warmTrail(path, warm, pb){
  let mx=path[0], pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(pend>=0){ if(i>=pend) return cash(v); continue; }
    if(i<warm) continue;
    if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; }
  return cash(path[path.length-1]); }
function panic(path){ let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ)return 0; if(v<=0.96)return cash(v);
    if(pend>=0){ if(i>=pend)return cash(v); } else { if(v>mx)mx=v; if(v<mx*0.88)pend=i+LAG; } }
  return cash(path[path.length-1]); }
function hold(path){ for(let i=1;i<path.length;i++) if(path[i]<=LIQ)return 0;
  return cash(path[path.length-1]); }
const MODES={ '트레일12':p=>warmTrail(p,0,0.12), '버티25':p=>warmTrail(p,Math.floor(T*0.25),0.12),
  '버티35':p=>warmTrail(p,Math.floor(T*0.35),0.08), '쫄보':panic, '홀드':hold };
const GATES=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const MIN_BET=10000, RATE=0.10, INFO_ACC=0.55, TIERS=['strong','mid','weak'];
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];
function runOne(pick, mode, stock){
  const Tt=G.ticksOf(stock); let money=1e5, total=0;
  for(const [goal,limit] of GATES){
    let left=limit;
    while(money<goal){
      if(left<=0)return '기한실패';
      if(money<MIN_BET)return '파산';
      const need=Math.pow(goal/money,1/left);
      const f=Math.min(1,Math.max(0.2,(need-1)/0.30));
      const bet=Math.max(MIN_BET,Math.min(money,Math.floor(money*f)));
      const {p,t}=pick(); let ret;
      if(mode==='신호'){ const s=sigOf(t);
        if(s==='weak'){ left--; total++; if(total>500)return '초과'; continue; }
        ret=warmTrail(p.gen(stock,Tt), s==='strong'?Math.floor(T*0.35):0, 0.12); }
      else ret=MODES[mode](p.gen(stock,Tt));
      money=money-bet+Math.max(0,bet*ret);
      left--; total++; if(total>500)return '초과';
    }
    money+=goal*RATE*Math.max(0,left);
  }
  return '클리어';
}
const ALL=[...Object.keys(MODES),'신호'], NN=600;

console.log('■ 클리어율 · 파산률 (N=600 · 사성전자 · 3배 · 3단계)\n');
for(const [nm,c] of Object.entries(CONF)){
  G.setDIP(c.dip);
  const b=build(c.spec); const [pick]=picker(b.pats,b.tier,c.down,G.STOCKS.stable);
  const row=ALL.map(m=>{ let cl=0,bk=0;
    for(let k=0;k<NN;k++){ const r=runOne(pick,m,G.STOCKS.stable);
      if(r==='클리어')cl++; if(r==='파산')bk++; }
    return [cl/NN*100, bk/NN*100]; });
  const cl=row.map(r=>r[0]), sorted=cl.slice().sort((a,b)=>b-a);
  console.log('  '+nm);
  console.log('    클리어  '+ALL.map((m,i)=>`${m} ${cl[i].toFixed(0)}%`).join(' · '));
  console.log('    파산    '+ALL.map((m,i)=>`${m} ${row[i][1].toFixed(0)}%`).join(' · '));
  console.log(`    최고 ${sorted[0].toFixed(0)}% · 격차 ${(sorted[0]-sorted[1]).toFixed(0)}%p\n`);
}

console.log('■ 되돌리지 않았는가 ① — 전반부(0~50%) 저점만으로 등급이 읽히는가');
console.log('   (강세와 약세의 저점 분포가 겹쳐야 한다. 8a0acc7이 세운 기준)\n');
for(const [nm,c] of Object.entries(CONF)){
  G.setDIP(c.dip); const b=build(c.spec);
  const q=t=>{ const sub=b.pats.filter(p=>b.tier[p.id]===t);
    const tot=sub.reduce((a,p)=>a+p.weight,0), lows=[];
    for(let k=0;k<4000;k++){ let r=Math.random()*tot,a=0,pk=sub[0];
      for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
      const arr=pk.gen(G.STOCKS.stable,T), h=Math.floor(T*0.5);
      let lo=9; for(let i=1;i<=h;i++) if(arr[i]<lo)lo=arr[i];
      lows.push(lo); }
    lows.sort((x,y)=>x-y);
    return [lows[(lows.length*0.25)|0], lows[(lows.length*0.5)|0], lows[(lows.length*0.75)|0]]; };
  const S=q('strong'), W=q('weak');
  console.log('  '+nm.padEnd(34)+
    ` 강세 ${S.map(v=>v.toFixed(2)).join('/')}   약세 ${W.map(v=>v.toFixed(2)).join('/')}`);
}

console.log('\n■ 되돌리지 않았는가 ② — 시초를 버리는 봇이 특별대우를 받는가');
console.log('   (트레일12와 버티35의 판당 기댓값 차이가 줄어야 한다)\n');
for(const [nm,c] of Object.entries(CONF)){
  G.setDIP(c.dip); const b=build(c.spec);
  const [pick]=picker(b.pats,b.tier,c.down,G.STOCKS.stable);
  const N=40000; let a=0,bb=0;
  for(let k=0;k<N;k++){ const p=pick().p.gen(G.STOCKS.stable,T);
    a+=warmTrail(p,0,0.12); bb+=warmTrail(p,Math.floor(T*0.35),0.08); }
  console.log('  '+nm.padEnd(34)+` 트레일12 ${(a/N).toFixed(3)} · 버티35 ${(bb/N).toFixed(3)}`+
    `  차이 ${((bb-a)/N).toFixed(3)}`);
}

console.log('\n■ ③ 파산이 가능한가 — 약세 판이 반응할 틈을 주는가\n');
console.log('  안                                 청산률  중앙 시간  3초 안에  반등 없이 죽음');
for(const [nm,c] of Object.entries(CONF)){
  G.setDIP(c.dip); const b=build(c.spec);
  const sub=b.pats.filter(p=>b.tier[p.id]==='weak');
  const tot=sub.reduce((a,p)=>a+p.weight,0);
  const secs=[]; let died=0, fast=0, nob=0, n=8000;
  for(let k=0;k<n;k++){
    let r=Math.random()*tot,a=0,pk=sub[0];
    for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
    const arr=pk.gen(G.STOCKS.stable,T); let hi=1, li=-1;
    for(let i=1;i<=T;i++){ if(arr[i]<=LIQ){li=i;break;} if(arr[i]>hi)hi=arr[i]; }
    if(li<0)continue;
    died++; secs.push(li*0.05); if(li*0.05<=3)fast++;
    if(hi<0.97)nob++;            // 죽기 전에 −3% 위로 못 올라왔다 = 탈출 창이 없었다
  }
  secs.sort((x,y)=>x-y);
  console.log('  '+nm.padEnd(34)+((died/n*100).toFixed(0)+'%').padStart(6)+
    (secs[secs.length>>1].toFixed(1)+'s').padStart(10)+
    ((fast/died*100).toFixed(0)+'%').padStart(9)+((nob/died*100).toFixed(0)+'%').padStart(15));
}

console.log('\n■ 종목별 클리어율 (버티35 · N=300) — DIP는 전역이라 다 같이 움직인다\n');
console.log('  안                                 '+['stable','penny','coin','etf'].map(s=>s.padStart(8)).join(''));
for(const [nm,c] of Object.entries(CONF)){
  G.setDIP(c.dip); const b=build(c.spec);
  const cells=['stable','penny','coin','etf'].map(id=>{
    const st=G.STOCKS[id]; const [pick]=picker(b.pats,b.tier,c.down,st);
    let cl=0; for(let k=0;k<300;k++) if(runOne(pick,'버티35',st)==='클리어')cl++;
    return ((cl/300*100).toFixed(0)+'%').padStart(8); }).join('');
  console.log('  '+nm.padEnd(34)+cells);
}
