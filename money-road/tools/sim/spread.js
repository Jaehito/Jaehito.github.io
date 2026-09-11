/* 📈 등급 간 간격을 벌리면 "확신하고 들고 가기"가 정답이 되는가.

   문제: 강세 신호를 받고 끝까지 들고 있으면 손해로 끝나는 패턴이 강세 안에 있다.
     up        끝 1.33 (가중 .12)
     spike     끝 0.67 (가중 .10)   ← 강세의 34%가 여기
     delayup   끝 1.85 (가중 .07)
   3배에서 끝값 0.67은 청산이다. 그래서 "강세여도 일단 빨리 털어라"가 학습되고,
   빠르게 손절하고 크게 먹는 비대칭 전략이 정답이 된다.

   가설: 강세를 확실히 위로(+80~90%), 약세를 확실히 아래로(−50%) 벌리고
   "올랐다가 떨어지는" 패턴을 줄이면, 쫄아서 마이너스에 터는 것이 제일 비싼
   실수가 된다. 신호 적중률이 55%뿐이라 확신은 여전히 도박이다.

   전략 셋을 같이 돌려서 무엇이 정답이 되는지 본다:
     trail  — 고점 대비 12% 밀리면 손절 (지금의 정답)
     hold   — 끝까지 보유
     sig    — 강세면 끝까지, 약세면 관망, 보통이면 트레일링
     panic  — 진입가 −4%만 밀려도 즉시 던진다 (쫄보). 이 안이 노리는 과녁이다

   사용: node sim/spread.js   (3분 남짓) */
const G = require('./_game');

const MIN_BET = 10000, RATE = 0.10, LAG = 10;
const GATES = [[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const INFO_ACC = 0.55;                      // 신호 적중률(강화 안 한 상태)
const TIERS = ['strong','mid','weak'];

/* ── 안(案) — 게임의 PATTERNS를 얕게 복사해서 생성기만 갈아 끼운다 ───────── */
const dev = G.dev, mp = G.buildMultiPhase, ns = G.noiseScale;
const VARIANTS = {
  '지금': null,

  '강세를 위로': P => ({
    ...P,
    up: { endMul:[1.70,0.25] },            // 끝 1.15~1.50 → 1.70~1.95
  }),

  '강세↑ + 급등급락 축소': P => ({
    ...P,
    up: { endMul:[1.70,0.25] },
    spike: { weight:0.03 },                 // .10 → .03
  }),

  '강세↑ + 급등급락을 보통으로': P => ({
    ...P,
    up: { endMul:[1.70,0.25] },
    spike: { tier:'mid' },                  // 강세에서 빼고 보통으로
  }),

  '위 + 약세를 −50%로': P => ({
    ...P,
    up: { endMul:[1.70,0.25] },
    spike: { tier:'mid' },
    down: { botMul:[0.45,0.12] },           // 바닥 0.40~0.70 → 0.45~0.57
    delaydown: { endMul:[0.45,0.12] },
  }),

  /* 여기까지 돌려보고 안 것: 상승 패턴은 저점이 1.00이라 아예 마이너스로 안 간다.
     그래서 "쫄아서 마이너스에 판다"는 일이 상승장에서는 일어나지 않는다 — 쫄보가
     벌을 안 받는다. 상승장에 청산선 위쪽으로만 흔들기를 넣어야 과녁이 생긴다. */
  '강세↑ + 초반 흔들기': P => ({
    ...P,
    up: { shake:true, endMul:[1.70,0.25] },
    delayup: { shake:true },
    spike: { tier:'mid' },
  }),

  '흔들기 + 약세 −50%': P => ({
    ...P,
    up: { shake:true, endMul:[1.70,0.25] },
    delayup: { shake:true },
    spike: { tier:'mid' },
    down: { botMul:[0.45,0.12] },
    delaydown: { endMul:[0.45,0.12] },
  }),

  '위 + 되돌림 패턴 축소': P => ({
    ...P,
    up: { endMul:[1.70,0.25] },
    spike: { tier:'mid', weight:0.05 },
    down: { botMul:[0.45,0.12] },
    delaydown: { endMul:[0.45,0.12] },
    invv: { weight:0.05 },                  // 고점 후 하락 .10 → .05
    m:    { weight:0.05 },                  // 이중 고점   .10 → .05
  }),
};

/* 안을 적용한 패턴 배열과 등급표를 만든다. 생성기는 게임 것을 그대로 쓰되
   끝값·바닥값만 바꿔 끼운다 — 모양(키포인트 위치·노이즈)은 건드리지 않는다. */
function build(variant) {
  const spec = variant ? variant({}) : {};
  const pats = G.PATTERNS.map(p => {
    const s = spec[p.id];
    const out = { ...p };
    if (!s) return out;
    if (s.weight !== undefined) out.weight = s.weight;
    /* 흔들기 — 초반에 청산선 위(0.88~0.94)까지 한 번 눌렀다가 간다.
       3배 청산선이 0.67이라 죽지는 않지만, −4%에 던지는 사람은 여기서 털린다. */
    if (s.shake) {
      const [lo, span] = s.endMul || [1.6, 0.5];
      const endOf = p.id === 'delayup' ? [1.6,0.5] : [lo,span];
      out.gen = (st,T) => mp(
        [[0.12+Math.random()*0.13, dev(0.88+Math.random()*0.06, st.pMult)],
         [0.60+Math.random()*0.15, dev(1.4+Math.random()*0.7, st.pMult)],
         [1, dev(endOf[0]+Math.random()*endOf[1], st.pMult)]],
        0.012*ns(T)*st.noiseMult, T);
      return out;
    }
    if (s.endMul) {
      const [lo, span] = s.endMul;
      if (p.id === 'up') out.gen = (st,T) => mp(
        [[0.55+Math.random()*0.20, dev(1.4+Math.random()*0.7, st.pMult)],
         [1, dev(lo+Math.random()*span, st.pMult)]],
        0.012*ns(T)*st.noiseMult, T);
      if (p.id === 'delaydown') out.gen = (st,T) => mp(
        [[0.55, dev(0.98+Math.random()*0.08, 1)],
         [1, dev(lo+Math.random()*span, st.pMult)]],
        0.008*ns(T)*st.noiseMult, T);
    }
    if (s.botMul && p.id === 'down') {
      const [lo, span] = s.botMul;
      out.gen = (st,T) => {
        const b = dev(lo+Math.random()*span, st.pMult);
        return mp([[0.5+Math.random()*0.25, b],
                   [1, 1+(b-1)*(0.9+Math.random()*0.15)]], 0.01*ns(T)*st.noiseMult, T);
      };
    }
    return out;
  });
  const tier = { ...G.PATTERN_TIER };
  for (const id in spec) if (spec[id].tier) tier[id] = spec[id].tier;
  return { pats, tier };
}

/* 난이도 가중치 — applyTierWeights()와 같은 식 */
function picker(pats, tier, down) {
  const base = pats.map(p => p.weight);
  const strongSum = pats.reduce((a,p,i)=>a+(tier[p.id]==='strong'?base[i]:0),0);
  const weakSum   = pats.reduce((a,p,i)=>a+(tier[p.id]==='weak'  ?base[i]:0),0);
  const w = base.map((b,i) => {
    const t = tier[pats[i].id];
    if (t === 'weak')   return b + down*(b/weakSum);
    if (t === 'strong') return b - down*(b/strongSum);
    return b;
  });
  const sum = w.reduce((a,b)=>a+b,0);
  const norm = w.map(x=>x/sum);
  return () => {
    let r = Math.random(), a = 0;
    for (let i=0;i<norm.length;i++){ a+=norm[i]; if(r<=a) return {p:pats[i], t:tier[pats[i].id]}; }
    return {p:pats[pats.length-1], t:tier[pats[pats.length-1].id]};
  };
}

/* ── 전략 ─────────────────────────────────────────────────────────────── */
const out = (v,lev) => Math.max(0, 1+(v-1)*lev);
function trail(path, lev, pb) {
  let mx = path[0], pend = -1;
  for (let i=1;i<path.length;i++){
    const v = path[i];
    if (lev>1 && v<=1-1/lev) return 0;
    if (pend>=0){ if(i>=pend) return out(v,lev); }
    else { if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; }
  }
  return out(path[path.length-1], lev);
}
/* 쫄보 — 조금만 마이너스가 되면 던진다. 상승장에서 제일 크게 손해 본다. */
function panic(path, lev) {
  let mx = path[0], pend = -1;
  for (let i=1;i<path.length;i++){
    const v = path[i];
    if (lev>1 && v<=1-1/lev) return 0;
    if (v <= 0.96) return out(v, lev);
    if (pend>=0){ if(i>=pend) return out(v,lev); }
    else { if(v>mx)mx=v; if(v<mx*0.88) pend=i+LAG; }
  }
  return out(path[path.length-1], lev);
}
function hold(path, lev) {
  for (let i=1;i<path.length;i++) if (lev>1 && path[i]<=1-1/lev) return 0;
  return out(path[path.length-1], lev);
}
function sigOf(t){ if(Math.random()<INFO_ACC) return t;
  const o=TIERS.filter(x=>x!==t); return o[(Math.random()*2)|0]; }

/* ── 런 ───────────────────────────────────────────────────────────────── */
function run(pick, stock, mode) {
  let cash = 1e5, total = 0;
  for (const [goal, limit] of GATES) {
    let left = limit;
    while (cash < goal) {
      if (left <= 0) return '기한실패';
      if (cash < MIN_BET) return '파산';
      const need = Math.pow(goal/cash, 1/left);
      const f = Math.min(1, Math.max(0.2, (need-1)/0.30));
      const bet = Math.max(MIN_BET, Math.min(cash, Math.floor(cash*f)));
      const {p, t} = pick();
      const s = sigOf(t);
      let ret;
      if (mode === 'panic')      ret = panic(p.gen(stock, G.ticksOf(stock)), 3);
      else if (mode === 'hold')  ret = hold(p.gen(stock, G.ticksOf(stock)), 3);
      else if (mode === 'trail') ret = trail(p.gen(stock, G.ticksOf(stock)), 3, 0.12);
      else {                                     // sig
        if (s === 'weak') { left--; total++; if(total>500) return '초과'; continue; }  // 관망
        const path = p.gen(stock, G.ticksOf(stock));
        ret = s === 'strong' ? hold(path, 3) : trail(path, 3, 0.12);
      }
      cash = cash - bet + Math.max(0, bet*ret);
      left--; total++;
      if (total > 500) return '초과';
    }
    cash += goal*RATE*Math.max(0, left);
  }
  return '클리어';
}

/* 판당 기댓값 — 전액 베팅 기준의 평균 회수 배수 */
function ev(pick, stock, mode, N) {
  let s = 0;
  for (let k=0;k<N;k++){
    const {p,t} = pick();
    const path = p.gen(stock, G.ticksOf(stock));
    if (mode==='panic') s += panic(path,3);
    else if (mode==='hold') s += hold(path,3);
    else if (mode==='trail') s += trail(path,3,0.12);
    else s += (sigOf(t)==='strong') ? hold(path,3) : trail(path,3,0.12);
  }
  return s/N;
}

const stock = G.STOCKS.stable;
const DOWN = 0.04;   // 3단계
console.log('■ 등급 간 간격을 벌리면 무엇이 정답이 되는가');
console.log('  사성전자 · 3배 · 3단계 · 신호 적중률 55% · 이월 없음\n');
console.log('  안                            전략     판당EV   클리어   파산   기한실패');
for (const [name, v] of Object.entries(VARIANTS)) {
  const {pats, tier} = build(v);
  const pick = picker(pats, tier, DOWN);
  console.log('  ' + '─'.repeat(70));
  for (const mode of ['trail','panic','hold','sig']) {
    const N = 400, rs = [];
    for (let k=0;k<N;k++) rs.push(run(pick, stock, mode));
    const c = rs.filter(x=>x==='클리어').length/N*100;
    const b = rs.filter(x=>x==='파산').length/N*100;
    const g = rs.filter(x=>x==='기한실패').length/N*100;
    const e = ev(pick, stock, mode, 4000);
    console.log(`  ${(mode==='trail'?name:'').padEnd(28)} ${mode.padEnd(7)} ` +
      `${e.toFixed(3).padStart(6)}  ${c.toFixed(0).padStart(5)}%  ${b.toFixed(0).padStart(4)}%  ${g.toFixed(0).padStart(6)}%`);
  }
}

console.log('\n■ 강세 등급 안에서 끝값이 어떻게 되는가 (사성전자, 각 3000회)');
for (const [name, v] of Object.entries(VARIANTS)) {
  const {pats, tier} = build(v);
  const strong = pats.filter(p => tier[p.id]==='strong');
  const tot = strong.reduce((a,p)=>a+p.weight,0);
  const line = strong.map(p => {
    let s=0; for(let k=0;k<3000;k++){const a=p.gen(stock,300); s+=a[a.length-1];}
    return `${p.id} ${(s/3000).toFixed(2)}(${(p.weight/tot*100).toFixed(0)}%)`;
  }).join('  ');
  console.log(`  ${name.padEnd(26)} ${line}`);
}
