#!/usr/bin/env node
/* ===== 밸런스 측정 =====

   진짜 게임 로직 위에서 사람 같은 플레이어들로 돌린다. sim/ 의 근사 시뮬과 다른 점:
   배정·조기상환·티켓·보험·업그레이드·사건·해금이 전부 들어 있다. 같은 규칙으로
   재봤을 때 근사 시뮬은 12%, 진짜 로직은 42%였다 — 그 30%p가 빠져 있던 게임이다.

   쓰는 법:
     node tools/harness/balance.js [런수] [--params 파일.json]
   --params 로 tools/log/report.js가 뽑은 값을 주면 **당신의 규칙으로** 잽니다.

   읽는 법: 절대 수치도 이제는 진짜 게임의 것이지만, 여전히 "이 정책의 성적"이지
   "사람의 성적"이 아닙니다. 사람의 성적은 기록을 넣어야 나옵니다. */

const fs = require('fs');
const { createGame } = require('./game');
const { makePlayer, bindRelief } = require('./player');
const { playRun } = require('./run');
const { P, ALL } = require('./personas');

const args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) || 300);
const pi = args.indexOf('--params');
const custom = pi >= 0 && args[pi + 1] ? JSON.parse(fs.readFileSync(args[pi + 1], 'utf8')) : null;

const pct = (a, b) => (a / b * 100).toFixed(0).padStart(3) + '%';
const med = a => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);
/* 한 판 15초 + 서류 읽는 시간. 체감 길이를 분으로 환산한다. */
const mins = r => Math.round(r * 22 / 60) + '분';

function runSet(G, params, n, tier, seed) {
  const ends = {}, gates = {}, rounds = [];
  for (let k = 0; k < n; k++) {
    G.reseed(seed + k * 7919);
    const r = playRun(G, makePlayer(params, Math.random), { tier });
    ends[r.e] = (ends[r.e] || 0) + 1;
    gates[r.gate] = (gates[r.gate] || 0) + 1;
    if (r.e === '클리어') rounds.push(r.rounds);
  }
  return { ends, gates, rounds, n };
}

function main() {
  const G = createGame({ seed: 8888 });
  bindRelief(G);
  const A = G.A;
  const GATES = A.get('GATES');
  const TIERS = A.get('TIERS');

  console.log(`■ 밸런스 — 진짜 게임 로직 · 페르소나별 ${N}런\n`);
  console.log('  ' + '누구'.padEnd(7) + '클리어'.padStart(6) + '파산'.padStart(6) +
    '기한초과'.padStart(8) + '은퇴'.padStart(6) + '   클리어 소요');

  const sets = {};
  const list = custom ? [['기록', custom]] : ALL.map(k => [k, P[k]]);
  for (const [name, params] of list) {
    const s = runSet(G, params, N, 0, 100000);
    sets[name] = s;
    console.log('  ' + name.padEnd(7) +
      pct(s.ends['클리어'] || 0, N).padStart(6) + pct(s.ends['파산'] || 0, N).padStart(6) +
      pct(s.ends['기한초과'] || 0, N).padStart(8) + pct(s.ends['은퇴'] || 0, N).padStart(6) +
      '   ' + (s.rounds.length ? med(s.rounds) + '판 (' + mins(med(s.rounds)) + ')' : '—'));
  }

  /* ── 어느 차수에서 죽나 ──
     "몇 %가 클리어하나"보다 이게 더 쓸모 있다. 한 관문만 유독 두꺼우면 거기가
     범인이고, 고르게 줄면 난이도 곡선이 제대로 선 것이다. */
  console.log('\n■ 어느 차수에서 끝나나 (도달한 사람 중 거기서 끝난 비율)\n');
  console.log('  ' + '차수'.padEnd(6) + '목표'.padStart(12) + '기한'.padStart(6) +
    list.map(([n]) => n.padStart(7)).join(''));
  for (let i = 0; i < GATES.length; i++) {
    const row = list.map(([name]) => {
      const g = sets[name].gates;
      let reached = 0, died = g[i] || 0;
      for (let j = i; j <= GATES.length; j++) reached += g[j] || 0;
      return (reached ? (died / reached * 100).toFixed(0) + '%' : '—').padStart(7);
    }).join('');
    console.log('  ' + (i + 1 + '차').padEnd(6) +
      (GATES[i].goal >= 1e8 ? (GATES[i].goal / 1e8).toFixed(0) + '억' : (GATES[i].goal / 1e4).toFixed(0) + '만').padStart(12) +
      (A.get('GATE_DAYS')[i] + '일').padStart(6) + row);
  }

  /* ── 난이도 사다리 ── */
  console.log('\n■ 난이도 단계 (숙련 기준 · 각 ' + Math.round(N / 2) + '런)\n');
  console.log('  ' + '단계'.padEnd(8) + '클리어'.padStart(7) + '파산'.padStart(7) + '   디메리트');
  /* 단계를 강제로 열어 둔다 — 사다리를 타고 올라가려면 완제를 반복해야 해서 오래 걸린다 */
  A.run(`function(){ META.cleared=${TIERS.length}; saveMeta(); }`);
  for (let t = 0; t < TIERS.length; t++) {
    const s = runSet(G, P['숙련'], Math.round(N / 2), t, 300000 + t * 131);
    console.log('  ' + (t + 1 + '단계').padEnd(8) +
      pct(s.ends['클리어'] || 0, s.n).padStart(7) + pct(s.ends['파산'] || 0, s.n).padStart(7) +
      '   ' + (TIERS[t].de.length ? TIERS[t].de.join(' · ') : '없음'));
  }

  console.log('\n  ※ 이 숫자는 "이 정책의 성적"입니다. 당신의 성적은');
  console.log('    개발자 패널 📊에서 기록을 내보내 tools/log/report.js에 넣으셔야 나옵니다.');
}
main();
