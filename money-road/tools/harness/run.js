/* ===== 런 진행 =====
   플레이어 하나로 한 판(런)을 끝까지 돌린다. 끝나는 길은 넷이다:
     클리어 · 파산 · 기한초과(반대매매) · 은퇴
   그 넷 말고 다른 이유로 끝나면 하니스가 게임의 어떤 흐름을 놓친 것이므로
   '미끄러짐'으로 따로 센다 — 조용히 넘어가면 누락을 영영 못 본다. */
const { createGame } = require('./game');
const { makePlayer, bindRelief } = require('./player');

const MAX_ROUNDS = 400;          // 관문 일수 총합(103)의 넉넉한 세 배 + 연장

function playRun(G, player, opts) {
  opts = opts || {};
  const tier = opts.tier || 0;
  G.onGrant((cands, d) => player.grant(cands, d));
  G.onPromo(cands => player.promo(cands));
  G.newRun(tier);
  bindRelief(G);

  const trace = [];
  let n = 0;
  while (n < MAX_ROUNDS) {
    if (G.over) break;
    const d = G.desk();

    /* 기한이 오늘까지다 — 연장할 것인가, 끊을 것인가 */
    if (d.daysLeft <= 1) {
      if (G.canRetire() && player.wantRetire(d)) { G.retire(); break; }
      if (player.wantExtend(d)) G.extend();
    }
    if (d.cash < d.minBet) { G.bankruptCheck(); if (G.over) break; }

    const setup = player.setup(d, G);
    const r = G.round(setup, v => player.decide(v));
    if (!r.ok) { G.bankruptCheck(); if (G.over) break; return finish(G, trace, n, '미끄러짐:' + r.why); }
    player.after(r.res);
    n++;
    if (opts.trace) trace.push({
      n, gate: d.gate, day: d.dayCount, daysLeft: d.daysLeft,
      stock: setup.stock, bet: setup.bet, lev: setup.lev, dir: setup.dir,
      sig: d.sig, cash: d.cash, goal: d.goal,
      profit: r.res ? r.res.profit : 0, grade: r.res && r.res.grade ? r.res.grade.g : null
    });
  }
  return finish(G, trace, n, null);
}

function finish(G, trace, n, slip) {
  const o = G.over;
  const d = G.desk();
  return {
    e: slip || (o ? o.e : '미끄러짐:라운드상한'),
    rounds: n, gate: d.gate, peak: d.peak,
    xp: o && o.st ? o.st.total : 0,
    trace
  };
}

/* N런을 한 번에. 시드를 런마다 새로 매겨 재현 가능하게 둔다. */
function sweep(opts) {
  opts = opts || {};
  const N = opts.n || 200;
  const seed0 = opts.seed || 1;
  const G = createGame({ seed: seed0, step: opts.step });
  const out = { e: {}, gate: {}, rounds: [], peaks: [], xp: [], runs: [] };
  for (let k = 0; k < N; k++) {
    G.reseed(seed0 + k * 7919);
    /* 사람마다 다른 습관 — params를 런마다 흔들고 싶으면 opts.params를 함수로 준다 */
    const p = typeof opts.params === 'function' ? opts.params(k) : opts.params;
    const player = makePlayer(p, Math.random);
    const r = playRun(G, player, { tier: opts.tier || 0, trace: opts.trace });
    out.e[r.e] = (out.e[r.e] || 0) + 1;
    out.gate[r.gate] = (out.gate[r.gate] || 0) + 1;
    out.rounds.push(r.rounds); out.peaks.push(r.peak); out.xp.push(r.xp);
    if (opts.keep) out.runs.push(r);
  }
  out.cov = G.cov;
  out.N = N;
  return out;
}

const pct = (a, b) => (a / b * 100).toFixed(0) + '%';
const med = a => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);

module.exports = { playRun, sweep, pct, med, MAX_ROUNDS };
