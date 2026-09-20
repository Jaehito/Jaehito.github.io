/* ===== 헤드리스 게임 환경 =====

   index.html의 <script> 블록을 **통째로** Node에서 돌린다. 베끼지 않는다.

   왜 이게 중요한가: sim/_harness.js는 PATTERNS를 손으로 옮겨 적은 사본이었고,
   조용히 어긋난 채로 몇 달을 굴렀다. 동전주 가중치가 게임과 아예 달랐는데도
   그 숫자를 "게임의 클리어율"이라고 불렀다. sim/_game.js가 생성기만 잘라오는
   것으로 절반을 고쳤지만, 관문·배정·티켓·보험·조기상환은 여전히 근사였다.
   실제로 얼마나 벌어졌는지 재보면:

     sim/gate.js (근사)   클리어 12%
     진짜 게임 로직        클리어 42%      ← 같은 규칙, 같은 난이도

   30%p가 "시뮬에 없던 진짜 게임"이었다. 그래서 잘라오는 걸 그만두고 통째로 돌린다.

   브라우저가 없는 자리에는 스텁을 둔다. 스텁이 하는 일은 **아무것도 안 하는 것**뿐이라
   게임의 수치 경로에는 닿지 않는다. 화면을 그리는 함수는 불리긴 하지만 결과를 버린다.

   가상 시계: 게임은 currentTickIdx()를 Date.now()-startedAt으로 잰다. 한 판이
   실제로 15초 걸린다는 뜻이다. Date를 프록시로 갈아끼워 시계를 우리가 돌린다.
   (이걸 안 하면 100런에 4시간이 걸린다. 지금은 1.3초다.)

   시드 난수: Math.random을 시드 있는 PRNG로 바꾼다. 같은 시드면 같은 판이 나오므로
   "이 런에서 뭐가 잘못됐나"를 다시 열어볼 수 있다. 시드를 안 주면 매번 다르다.
*/
const fs = require('fs');
const path = require('path');

const GAME = path.join(__dirname, '..', '..', 'index.html');

/* DOM 노드 하나로 모든 것을 받아넘긴다. 게임이 el.style.x=… el.classList.add(…)
   el.querySelectorAll(…).forEach(…) 무엇을 하든 조용히 삼킨다. */
function makeEl() {
  const el = new Proxy({}, {
    get(t, k) {
      if (k === 'style') return new Proxy({}, { get: () => '', set: () => true });
      if (k === 'classList') return { add(){}, remove(){}, toggle(){}, contains: () => false };
      if (k === 'children' || k === 'childNodes') return [];
      if (k === 'dataset') return {};
      if (k === 'parentNode' || k === 'firstChild' || k === 'nextSibling') return null;
      if (k === 'querySelectorAll') return () => [];
      if (['value','textContent','innerHTML','innerText','className','id','tagName'].includes(k)) return '';
      if (k === 'hidden') return false;
      if (k === Symbol.toPrimitive || k === 'toString') return () => '[el]';
      if (typeof k === 'string') return () => null;
      return undefined;
    },
    set() { return true; }
  });
  return el;
}

/* xorshift128+ — 빠르고 주기가 길다. Math.random 자리에 그대로 들어간다. */
function makeRng(seed) {
  let a = seed >>> 0 || 1, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  for (let i = 0; i < 20; i++) { /* 워밍업 — 초기 시드의 편향을 턴다 */
    const t = a ^ (a << 11); a = b; b = c; c = d;
    d = (d ^ (d >>> 19) ^ t ^ (t >>> 8)) >>> 0;
  }
  return function rnd() {
    const t = a ^ (a << 11); a = b; b = c; c = d;
    d = (d ^ (d >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    return d / 4294967296;
  };
}

/* 스텁은 한 번만 깐다. 게임 스크립트는 런마다 다시 eval하지 않는다 —
   4,300줄을 eval하는 데 드는 시간이 판을 두는 시간보다 크기 때문이다.
   대신 startRunAt()으로 상태만 갈아끼운다. */
let INSTALLED = false;
function installGlobals() {
  if (INSTALLED) return;
  INSTALLED = true;
  const g = global;
  const el = makeEl();
  g.__el = el;
  g.document = { getElementById: () => el, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el, addEventListener(){}, removeEventListener(){},
    body: el, documentElement: el, head: el, hidden: false };
  g.window = { addEventListener(){}, removeEventListener(){},
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 };
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = () => {};
  g.navigator = { userAgent: 'node', language: 'ko-KR', vibrate(){} };
  const osc = () => ({ connect(){}, start(){}, stop(){}, type: '',
    frequency: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){} } });
  const gain = () => ({ connect(){}, gain: { value: 0, setValueAtTime(){},
    exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} } });
  g.AudioContext = g.webkitAudioContext = function () {
    return { createOscillator: osc, createGain: gain, destination: {},
      currentTime: 0, state: 'running', resume(){} };
  };
  g.Audio = function () { return { play: () => Promise.resolve(), pause(){} }; };
  g.MutationObserver = function () { return { observe(){}, disconnect(){}, takeRecords: () => [] }; };
  g.ResizeObserver = g.IntersectionObserver = function () {
    return { observe(){}, disconnect(){}, unobserve(){} };
  };
  g.getComputedStyle = () => new Proxy({}, { get: () => '' });
  /* 타이머는 안 돈다. 게임에서 setTimeout은 연출(토스트가 사라지는 것 등)에만 쓰이고
     수치를 바꾸지 않는다. 도는 타이머가 있으면 헤드리스에서 끝나지 않는 런이 생긴다. */
  g.setTimeout = () => 0; g.setInterval = () => 0;
  g.clearTimeout = () => {}; g.clearInterval = () => {};
}

/* 게임을 한 번 띄우고, 그 안을 들여다보고 밀 수 있는 손잡이를 돌려준다. */
function boot(opts) {
  opts = opts || {};
  installGlobals();
  const g = global;

  let VT = 1700000000000;                 // 가상 현재시각
  const RealDate = Date;
  g.Date = new Proxy(RealDate, {
    apply: (t, th, a) => (a.length ? new RealDate(...a) : new RealDate(VT)),
    construct: (t, a) => (a.length ? new RealDate(...a) : new RealDate(VT)),
    get: (t, k) => (k === 'now' ? () => VT : RealDate[k])
  });

  let rnd = Math.random;
  if (opts.seed !== undefined) { rnd = makeRng(opts.seed); }
  Math.random = () => rnd();

  const store = {};
  g.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear() { for (const k in store) delete store[k]; }
  };

  const SRC = fs.readFileSync(GAME, 'utf8');
  const i = SRC.indexOf('<script>'), j = SRC.indexOf('</script>', i);
  if (i < 0 || j < 0) throw new Error('index.html에서 <script> 블록을 못 찾음');
  const code = SRC.slice(i + 8, j);

  const api = {
    store,
    clock: { now: () => VT, set: v => { VT = v; }, adv: ms => { VT += ms; } },
    /* 시드를 런마다 새로 매긴다 — 같은 시드면 같은 판이 나온다 */
    reseed: s => { rnd = makeRng(s); },
    lines: code.split('\n').length
  };
  /* 직접 eval이라 game 스코프의 바인딩을 읽고 쓸 수 있다.
     함수 선언도 그 스코프의 변수이므로 set으로 갈아끼울 수 있다 — 그게 모달을
     헤드리스로 통과시키는 방법이다. */
  eval(code + `
    ;api.get = n => { try { return eval(n); } catch (e) { return undefined; } };
    api.set = (n, v) => { eval(n + '=v'); };
    api.run = f => eval('(' + f + ')()');
  `);
  return api;
}

module.exports = { boot, makeRng, GAME };
