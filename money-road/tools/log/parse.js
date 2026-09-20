/* ===== 기록 읽기 =====
   게임이 내보낸 압축 배열을 사람이 읽을 수 있는 객체로 편다.
   칸의 순서는 index.html의 logRound()가 정한다 — 둘이 어긋나면 조용히 틀린 값이
   나오므로, 칸 수를 세서 다르면 바로 터뜨린다. */

const STOCKS = ['stable','theme','surge','etf','penny','coin'];
const SIGS = ['strong','mid','weak'];
const GRADES = ['S','A','B','C','D'];
const COLS = 16;                 // logRound가 미는 칸 수

function decodeRound(a) {
  if (a.length !== COLS) throw new Error(
    `기록 한 줄이 ${a.length}칸입니다(${COLS}칸이어야 함). index.html의 logRound()와 이 파일이 어긋났습니다.`);
  const [gate, daysLeft, cash, si, bet, lev, sigI, t, T, profit, gi, flags, streak, fromHigh, maxLev, openMask] = a;
  return {
    gate, daysLeft, cash, bet, lev, maxLev, streak, profit,
    openStocks: STOCKS.filter((_, i) => openMask & (1 << i)),
    stock: STOCKS[si] || '?',
    sig: SIGS[sigI] || null,
    sellTick: t, ticks: T,
    grade: GRADES[gi] || null,
    watered: !!(flags & 1), halved: !!(flags & 2),
    timeout: !!(flags & 4), short: !!(flags & 8),
    fromHigh,                                   // 매도 시점에 "본 구간"에서 불리한 쪽으로 밀린 정도 (음수·방향 반영)
    betFrac: cash > 0 ? bet / cash : 0,
    pnl: bet > 0 ? profit / bet : 0             // 투자금 대비 손익률
  };
}

function decodeRun(r) {
  return {
    tier: r.t, apply: r.a, metaXp: r.mx, promo: r.pr,
    unlocks: (r.un || []).slice(), extends: r.ex || 0,
    end: r.e, gate: r.g, peak: r.pk, xp: r.xp, days: r.d,
    startedAt: r.s, endedAt: r.f,
    grants: (r.gr || []).map(g => (typeof g === 'string'
      ? { id: g.split(':')[0], act: g.split(':')[1] || null, reliefAvail: false, relieved: false }
      : { id: g.i, act: g.a, reliefAvail: !!g.v, relieved: !!g.r })),
    rounds: (r.r || []).map(decodeRound)
  };
}

function parse(raw) {
  const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!o || o.v !== 1 || !Array.isArray(o.runs)) throw new Error('기록 형식이 아닙니다 (v:1, runs[] 필요)');
  return o.runs.map(decodeRun);
}

/* 사람이 읽는 요약 */
function summary(runs) {
  const rounds = runs.reduce((a, r) => a + r.rounds.length, 0);
  const by = {}; for (const r of runs) by[r.end] = (by[r.end] || 0) + 1;
  const stocks = {}, levs = {}, grades = {};
  let shorts = 0, waters = 0, halves = 0, timeouts = 0;
  for (const r of runs) for (const d of r.rounds) {
    stocks[d.stock] = (stocks[d.stock] || 0) + 1;
    levs[d.lev] = (levs[d.lev] || 0) + 1;
    if (d.grade) grades[d.grade] = (grades[d.grade] || 0) + 1;
    if (d.short) shorts++; if (d.watered) waters++; if (d.halved) halves++; if (d.timeout) timeouts++;
  }
  return { runs: runs.length, rounds, by, stocks, levs, grades, shorts, waters, halves, timeouts };
}

module.exports = { parse, summary, decodeRun, decodeRound, STOCKS, SIGS, GRADES, COLS };
