/* 🥊 "머리를 공짜가 아니게" — warmtrail.js가 찾아낸 정답을 실제로 죽이는 안을 고른다.

   warmtrail.js 결론: 시초 25~35%를 버리고 트레일링만 하면 클리어 40%,
   나머지 전략은 전부 19% 이하. 원인은 DIP/midHead가 모든 패턴의 머리를 같은
   얼굴로 만든 것 + 보통 등급 5종이 전부 중반에 큰 고점을 보장하는 것이다.

   먼저 틀린 길(A·B안, 톱니·가짜 돌파 추가 + 보통 축소): 정답은 죽었는데
   클리어가 2%로 같이 무너졌다. 보통 등급이 수익 구간을 거의 다 공급한다는
   기록(README ⚠️ 절)이 여기서도 맞았다. 수익을 빼앗으면 안 된다.

   그래서 이번 안은 수익의 총량을 건드리지 않고 **자리를 옮긴다**:
     · earlypop — 눌림 없이 열려서 8~22%에 고점을 찍고 35% 전에 끝난다.
       워밍업으로 버리는 구간 안에서 판이 다 끝나므로 규칙충은 아무것도 못 얻고,
       보고 있던 사람은 먹는다. spike(고점 중앙값 2.52)의 지분을 여기로 옮긴다.
     · crash  — 되돌림 없이 청산선을 뚫는다. 파산이 가능해지는 유일한 통로.
     · down   — 반등이 늘 오지 않는다(지금은 100%).

   합격선: 어느 전략도 클리어 25%를 못 넘고, 최고와 차순위의 격차가 10%p 안쪽,
          전액손실률 12% 근처, 전체 난이도는 17~27%대 유지.

   사용: node sim/earlypop.js   (10분쯤) */
const G = require('./_game');
const T = 300, LEV = 3, LIQ = 1 - 1/LEV, LAG = 10;
const ST = G.STOCKS.stable;
const mp = G.buildMultiPhase, dev = G.dev, ns = G.noiseScale, mh = G.midHead;
const R = (lo,sp) => lo + Math.random()*sp;
const cash = v => Math.max(0, 1+(v-1)*LEV);

/* ── 후보 패턴 ───────────────────────────────────────────────────────── */
/* 초반 급등급락 — 눌림 없이 열려 8~22%에 고점, 35% 전에 제자리.
   워밍업 창 안에서 판이 끝난다. */
const earlypop = (st,Tt) => { const pf=R(0.08,0.14);
  return mp([[pf, dev(R(1.35,0.55), st.pMult)],
    [pf+R(0.10,0.10), dev(R(0.97,0.10), st.pMult)],
    [1, dev(R(0.88,0.26), st.pMult)]], 0.016*ns(Tt)*st.noiseMult, Tt); };
/* 나락 — 되돌림 없이 청산선을 뚫는다 */
const crash = (st,Tt) => mp([[R(0.04,0.05), dev(R(0.94,0.04), st.pMult)],
  [R(0.26,0.18), dev(R(0.42,0.16), st.pMult)],
  [1,            dev(R(0.36,0.20), st.pMult)]], 0.011*ns(Tt)*st.noiseMult, Tt);
/* 하락 — p 확률로 반등 없이 머리에서 그대로 미끄러진다 */
/* 눌림 깊이는 DIP에서 끌어온다. 0.82처럼 박아두면 DIP를 올렸을 때 강세만
   얕아지고 약세는 그대로라 전반부 저점으로 등급이 읽힌다(confirm.js에서 당했다). */
const downNoBounce = p => (st,Tt) => { const D=G.getDIP();
  const dip=R(0.18,0.10), lo=dev(R(D-0.02,0.06), st.pMult);
  if(Math.random()<p) return mp([[dip,lo],[R(0.55,0.15), dev(R(0.70,0.10), st.pMult)],
    [1, dev(R(0.45,0.15), st.pMult)]], 0.013*ns(Tt)*st.noiseMult, Tt);
  return mp([[dip,lo],[R(0.42,0.10), dev(R(D+0.16,0.10), st.pMult)],
    [R(0.65,0.08), dev(R(D,0.06), st.pMult)],
    [1, dev(R(0.45,0.15), st.pMult)]], 0.013*ns(Tt)*st.noiseMult, Tt); };

/* spike 지분을 earlypop으로 얼마나 옮기나(mv), 나락 비중(cr), 하락 반등실패율(nb) */
const mk = (mv, cr, nb) => ({
  spike:{weight:0.10-mv},
  down:{weight:0.22, gen:downNoBounce(nb)},
  _new:[{id:'earlypop',tier:'mid',weight:mv,gen:earlypop},
        {id:'crash',tier:'weak',weight:cr,gen:crash}],
});
/* 1차 스윕 결과(N=350): 지금 42%(격차 25%p) · C1 9% · C2 2% · C3 1% · C4 0%.
   정답은 죽지만 게임도 같이 죽는다. 이 게임은 10만 → 500억을 103판에 만들어야
   해서 판당 기댓값 1.13 언저리가 생사선이고, 거기서 조금만 깎여도 클리어율이
   절벽으로 떨어진다. 그래서 2차 스윕은 두 축을 같이 본다:
     · 패턴(정답을 죽이는 쪽) — 약하게 다시
     · 난이도 하락가중 down(전체 난이도를 되돌리는 쪽)
   정답을 없앤 만큼 난이도를 돌려주지 않으면 "고쳤더니 아무도 못 깬다"가 된다.
   목표는 최고 전략 20~27% · 격차 8%p 이내다. */
/* 2차 스윕(N=300):
     지금 down.04        최고 46% 격차 24%p 전액손실 6.4%
     C0 down.04/.02/.00  최고 16/21/31%     격차 7/11/14%p
     C1 down.04/.02/.00  최고 6/7/9%        (게임이 죽는다)

   여기서 한 가지가 분명해졌다. 트레일12(시초부터 트레일링)는 어느 안에서도
   1~2%인데 버티35는 16~46%다. 같은 전략인데 시초 구간을 버리느냐만 다르다.
   즉 격차의 정체는 "워밍업이 공짜"가 아니라 **DIP가 일찍 반응한 사람을 죽이는 것**이다.
   시초 눌림이 0.84까지 파이므로 12% 트레일링은 매 판 거기서 털린다.

   그래서 3차는 DIP를 같이 돌린다. 얕게 파면(0.88~0.90) 즉시 트레일링이 살아나고
   버티기의 값어치가 같이 내려간다 — README의 "올리면 트레일링이 다시 살아난다"가
   바로 이 손잡이다. 쫄보·홀드는 어느 안에서도 0%다(지금도 그렇다). 이건 이번
   변경이 만든 일이 아니라 이미 그런 상태였다 — 되살리는 건 다음 일이다. */
/* 3차 스윕이 답을 냈다 — 격차의 정체는 DIP였다.
     지금패턴 DIP 0.84  트레일12 4% · 버티35 38%   격차 18%p
     지금패턴 DIP 0.88  트레일12 51% · 버티35 50%  격차  2%p  (대신 전체가 50%로 쉬워짐)
     C0      DIP 0.88  트레일12 29% · 버티35 23%  격차  0%p  최고 29%
   시초 눌림을 0.84까지 파면 12% 트레일링이 매 판 거기서 털린다. 그래서
   "버티는 것"이 공짜가 아니라 **유일하게 살아남는 법**이었다. 0.88로 얕게 파면
   일찍 반응해도 살고, 버티기의 값어치가 같이 사라진다.

   4차는 착지점만 찾는다 — C0 고정, DIP 0.86~0.88 × down 0.04~0.06.
   목표 최고 24~27%. 쫄보·홀드가 0%인 것은 이번 변경이 만든 일이 아니라 지금도
   그렇다(다른 숙제다). */
/* 5차: DIP 0.88에서 down 0.05~0.08 → 최고 34/31/23/22%. 0.07이 착지점이다.
   그런데 down은 난이도 단계표(TIERS)의 값이고 3단계가 0.04다. 0.07로 올리면
   4단계(0.04+기한−2) · 5단계(0.06)와 뒤섞이고, 화면에 뜨는 "하락 패턴 +N%p"
   문구도 다섯 줄이 전부 바뀐다 — 밸런스 한 줄 고치자고 UI를 건드리게 된다.

   6차는 단계표를 그대로 두고(down 0.04 고정) 난이도를 ③ 장치 자체로 만든다.
   나락 비중과 하락 반등실패율은 어차피 이번에 넣는 것이고, 그게 곧 난이도다 —
   "파산이 가능해진 만큼 어려워졌다"가 따로 조율한 상수보다 정직하다. */
const BASE = {};
for(const cr of [0.02,0.03,0.04])
  for(const nb of [0.20,0.30,0.40])
    BASE[`나락 ${cr.toFixed(2)} · 반등실패 ${nb.toFixed(2)}`] = mk(0.03,cr,nb);
const VARIANTS = {'지금 (DIP .84 · down .04)': {__dip:0.84, __down:0.04}};
for(const [n,spec] of Object.entries(BASE))
  VARIANTS[n] = Object.assign({__down:0.04, __dip:0.88}, spec);

function build(spec){
  /* {...p}로 베끼면 안 된다 — PATTERNS의 name은 t()를 부르는 getter라 노드에서 터진다 */
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
function warmTrail(path, warm, pb){
  let mx=path[0], pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(pend>=0){ if(i>=pend) return cash(v); continue; }
    if(i<warm) continue;
    if(v>mx)mx=v;
    if(v<mx*(1-pb)) pend=i+LAG;
  }
  return cash(path[path.length-1]);
}
function panic(path){ let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ)return 0; if(v<=0.96)return cash(v);
    if(pend>=0){ if(i>=pend)return cash(v); } else { if(v>mx)mx=v; if(v<mx*0.88)pend=i+LAG; } }
  return cash(path[path.length-1]); }
function hold(path){ for(let i=1;i<path.length;i++) if(path[i]<=LIQ)return 0;
  return cash(path[path.length-1]); }

const MIN_BET=10000, RATE=0.10, INFO_ACC=0.55, TIERS=['strong','mid','weak'];
const GATES=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];
const MODES = {
  '트레일12': p=>warmTrail(p,0,0.12),
  '버티25':   p=>warmTrail(p,Math.floor(T*0.25),0.12),
  '버티35':   p=>warmTrail(p,Math.floor(T*0.35),0.08),
  '쫄보':     p=>panic(p),
  '홀드':     p=>hold(p),
};
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
      if(mode==='신호'){ const s=sigOf(t);
        if(s==='weak'){ left--; total++; if(total>500)return '초과'; continue; }
        ret=warmTrail(p.gen(ST,T), s==='strong'?Math.floor(T*0.35):0, 0.12); }
      else ret=MODES[mode](p.gen(ST,T));
      money=money-bet+Math.max(0,bet*ret);
      left--; total++; if(total>500)return '초과';
    }
    money+=goal*RATE*Math.max(0,left);
  }
  return '클리어';
}

const ALL=[...Object.keys(MODES),'신호'];
console.log('■ 클리어율 (103거래일 · 3단계 · 사성전자 · 신호 55% · 반응 0.5초)\n');
console.log('  안                                         '+ALL.map(m=>m.padStart(7)).join('')+'   최고  격차');
const NN=400;
const keep={};
for(const [name,spec] of Object.entries(VARIANTS)){
  G.setDIP(spec.__dip!==undefined?spec.__dip:0.84);
  const b=build(spec); const dn=spec.__down!==undefined?spec.__down:0.04;
  const [pick,mix]=picker(b.pats,b.tier,dn); keep[name]={b,mix,dn,dip:spec.__dip};
  const vals=ALL.map(m=>{ let c=0; for(let k=0;k<NN;k++) if(runOne(pick,m)==='클리어')c++; return c/NN*100; });
  const sorted=vals.slice().sort((a,b)=>b-a);
  console.log('  '+name.padEnd(42)+vals.map(v=>(v.toFixed(0)+'%').padStart(7)).join('')+
    '  '+(sorted[0].toFixed(0)+'%').padStart(5)+(sorted[0]-sorted[1]).toFixed(0).padStart(5)+'%p');
}

console.log('\n■ 전액손실률 (판당 · 버티35 기준) · 등급 분포\n');
console.log('  안                                         전액손실   강세  보통  약세');
for(const [name,spec] of Object.entries(VARIANTS)){
  G.setDIP(keep[name].dip!==undefined?keep[name].dip:0.84);
  const {b,mix,dn}=keep[name]; const [pick]=picker(b.pats,b.tier,dn);
  let wipe=0; const N=20000;
  for(let k=0;k<N;k++){ if(warmTrail(pick().p.gen(ST,T),Math.floor(T*0.35),0.08)===0)wipe++; }
  console.log('  '+name.padEnd(42)+((wipe/N*100).toFixed(1)+'%').padStart(8)+
    ('  '+(mix.strong*100).toFixed(0)+'%').padStart(7)+((mix.mid*100).toFixed(0)+'%').padStart(6)+
    ((mix.weak*100).toFixed(0)+'%').padStart(6));
}
