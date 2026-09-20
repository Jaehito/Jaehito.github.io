#!/usr/bin/env node
/* ===== 파이프라인 자체 검증 =====

   "기록에서 뽑은 규칙이 정말 그 사람인가"를 사람 기록 없이 확인한다.

   방법: 답을 아는 사람을 쓴다.
     1. 페르소나 하나로 진짜 게임을 M런 둔다 → 게임이 **자기 로그 훅으로** 기록을 남긴다
     2. 그 기록을 fit.js에 넣어 규칙을 되뽑는다
     3. 뽑힌 값과 페르소나의 진짜 값을 맞춰 본다
     4. 뽑힌 규칙으로 다시 돌려서 결과 분포가 원본과 같은지 본다

   1번이 중요하다 — 로그 형식을 따로 흉내내지 않고 index.html의 logRound()가 쓴
   것을 그대로 읽는다. 게임과 파서가 어긋나면 여기서 터진다.

   쓰는 법:  node tools/log/selftest.js [런수]
   하나라도 기준을 넘게 어긋나면 종료코드 1. */

const { createGame } = require('../harness/game');
const { makePlayer, bindRelief, DEFAULT } = require('../harness/player');
const { playRun } = require('../harness/run');
const { P } = require('../harness/personas');
const { parse, summary } = require('./parse');
const { fit } = require('./fit');

const M = Number(process.argv[2] || 30);

/* 되뽑아야 하는 값과 허용 오차. 비율(rel)이나 절대(abs) 중 하나를 쓴다.
   느슨한 것들은 이유가 있다 — fit.js의 "못 뽑는 것" 주석과 같은 이유다. */
const CHECK = [
  { k: 'stopPct',    rel: 0.60, why: '분포의 중앙값이라 꼬리가 두꺼우면 밀린다' },
  { k: 'betBase',    rel: 0.55, why: '급할 때 지르는 몫이 섞여 들어간다' },
  { k: 'levBase',    abs: 0.01, why: '최빈값이라 정확히 맞아야 한다' },
  { k: 'loyalty',    abs: 0.20, why: '직접 세는 값이라 잘 맞는다' },
  { k: 'shortOnRed', abs: 0.25, why: '🔴 판이 적으면 표본이 얇다' }
];

function run() {
  const G = createGame({ seed: 314159 });
  bindRelief(G);
  const A = G.A;
  const goals = A.get('GATES').map(g => g.goal);
  const levMults = A.get('LEVERAGE_MULTS');
  let bad = 0, checked = 0;

  console.log(`■ 파이프라인 자체 검증 — 페르소나마다 ${M}런\n`);
  console.log('  ' + '페르소나'.padEnd(7) + '항목'.padEnd(12) + '진짜'.padStart(8) + '뽑힘'.padStart(8) + '   판정');

  for (const name of Object.keys(P)) {
    const truth = Object.assign({}, DEFAULT, P[name]);
    A.get('logWipe')();
    for (let k = 0; k < M; k++) {
      G.reseed(7000 + k * 7919);
      playRun(G, makePlayer(P[name], Math.random), { tier: 0 });
    }
    const raw = G.A.store['moneyroad2_log_v1'];
    if (!raw) { console.log('  ' + name + ' — 기록이 안 남았습니다'); bad++; continue; }
    let runs;
    try { runs = parse(raw); } catch (e) { console.log('  ' + name + ' — 파싱 실패: ' + e.message); bad++; continue; }
    const sm = summary(runs);
    const f = fit(runs, { goals, levMults });

    let first = true;
    for (const c of CHECK) {
      const t = truth[c.k], g = f.params[c.k];
      if (typeof t !== 'number' || typeof g !== 'number') continue;
      /* 계정이 못 여는 값은 검사에서 뺀다. 되뽑기가 틀린 게 아니라 **기록에 있을 수가
         없는** 값이다 — 공매도가 안 열린 판에서 숏 비율을 물으면 0이 정답이고,
         레버리지 상한이 3배인 계정에서 10배를 쓸 방법은 없다.
         이걸 안 가르면 검사가 멀쩡한 되뽑기를 탓한다(실제로 3건 그랬다). */
      if (c.k === 'shortOnRed' && !runs.some(r => (r.unlocks || []).includes('short'))) continue;
      if (c.k === 'levBase') {
        let maxSeen = 0;
        for (const r of runs) for (const d of r.rounds) if (d.lev > maxSeen) maxSeen = d.lev;
        if (t > maxSeen) continue;        // 계정이 그 배율까지 못 올랐다
      }
      checked++;
      const ok = c.abs !== undefined
        ? Math.abs(t - g) <= c.abs
        : Math.abs(t - g) <= Math.max(0.02, Math.abs(t) * c.rel);
      if (!ok) bad++;
      console.log('  ' + (first ? name.padEnd(7) : ''.padEnd(7)) + c.k.padEnd(12) +
        t.toFixed(2).padStart(8) + g.toFixed(2).padStart(8) + '   ' + (ok ? '✓' : '✗ ' + c.why));
      first = false;
    }

    /* 결과 분포가 닮았나 — 규칙이 맞아도 결과가 다르면 쓸모가 없다 */
    const ends = {};
    for (let k = 0; k < M * 4; k++) {
      G.reseed(900000 + k * 7919);
      const r = playRun(G, makePlayer(f.params, Math.random), { tier: 0 });
      ends[r.e] = (ends[r.e] || 0) + 1;
    }
    const EN = { clear: '클리어', deadline: '기한초과', broke: '파산', retire: '은퇴' };
    const realE = {}; for (const r of runs) realE[EN[r.end] || r.end] = (realE[EN[r.end] || r.end] || 0) + 1;
    let worst = 0;
    for (const k of new Set([...Object.keys(realE), ...Object.keys(ends)]))
      worst = Math.max(worst, Math.abs((realE[k] || 0) / sm.runs - (ends[k] || 0) / (M * 4)));
    checked++;
    /* 허용치는 표본 수가 정한다. 원본이 M런뿐이면 그 비율 자체가 ±√(0.25/M)만큼
       흔들리므로, 그보다 엄한 기준을 걸면 멀쩡한 복제를 탓하게 된다
       (M=20에서 「공격」이 그랬다 — 파산률 71%짜리 고분산 페르소나였다).
       3표준오차를 쓰되 25%p 밑으로는 안 내린다. */
    const tol = Math.max(0.25, 3 * Math.sqrt(0.25 / sm.runs));
    const distOk = worst <= tol;
    if (!distOk) bad++;
    console.log('  ' + ''.padEnd(7) + '결과분포'.padEnd(12) + ''.padStart(8) +
      ((worst * 100).toFixed(0) + '%p').padStart(8) + '   ' + (distOk ? '✓' : `✗ 복제가 원본과 다르게 끝납니다 (허용 ${(tol * 100).toFixed(0)}%p)`));
    console.log('');
  }

  console.log(`■ ${checked}개 검사 중 ${bad}개 어긋남`);
  if (bad) {
    console.log('\n  어긋난 항목은 둘 중 하나입니다:');
    console.log('   · 기록에 그 값을 정할 정보가 없다 → logRound()에 칸을 더해야 합니다');
    console.log('   · 표본이 얇다 → 런수를 늘려 보세요 (지금 ' + M + '런)');
    process.exit(1);
  }
  console.log('\n✓ 기록 → 규칙 → 복제 고리가 닫혔습니다.');
}
run();
