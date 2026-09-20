#!/usr/bin/env node
/* ===== 커버리지 감사 =====

   "누락이 생기면 안 된다"는 요구에 답하는 파일이다.

   기대 목록을 손으로 적지 않는다 — **게임 표에서 읽는다.** 종목을 하나 더 넣거나
   배정 축을 하나 더 만들면, 아무도 손대지 않아도 다음 감사에서 빨간 줄로 나온다.
   손으로 적은 체크리스트는 콘텐츠가 늘 때 조용히 낡는다. 그게 이 게임에서 이미
   한 번 일어난 일이다(sim/_harness.js).

   돌리는 법:  node tools/harness/audit.js [런수]
   끝날 때 구멍이 하나라도 있으면 종료코드 1. */

const { createGame } = require('./game');
const { makePlayer, bindRelief } = require('./player');
const { playRun } = require('./run');
const { P, ALL } = require('./personas');

const N = Number(process.argv[2] || 40);

/* ── 기대 목록을 게임에서 뽑는다 ── */
function expectations(A) {
  const MULTS = A.get('LEVERAGE_MULTS');
  const minL = A.get('MIN_LEVERAGE');
  const startI = A.get('START_LEVERAGE_LV');
  const levCap = (A.get('GRANTS').find(g => g.id === 'lev') || {}).cap || 0;
  /* 실제로 도달 가능한 배율만 요구한다 — 최소 3배 고정이라 1·2배는 못 쓴다 */
  const reachLev = MULTS.filter((m, i) => m >= minL && i <= startI + levCap);
  return {
    '종목':   A.get('TRADE_STOCKS').map(s => 'stock.' + s.id),
    '배정':   A.get('GRANTS').map(g => 'grant.' + g.id),
    '승격':   A.get('META_UNLOCKS').map(u => 'promo.' + u.id),
    '난이도': A.get('TIERS').map((t, i) => 'tier.' + i),
    '패턴':   A.get('PATTERNS').map(p => 'pattern.' + p.id),
    '배율':   reachLev.map(m => 'lev.' + m),
    '방향':   ['dir.long', 'dir.short'],
    '티켓':   Object.keys(A.get('BUFFS')).map(b => 'buff.' + b),
    '신호':   A.get('SIGNAL_TIERS').map(s => 'sig.' + s),
    '등급':   ['grade.S', 'grade.A', 'grade.B', 'grade.C', 'grade.D'],
    '행동':   ['act.sell', 'act.timeout', 'act.water', 'act.half', 'act.extend', 'act.retire'],
    '서류':   ['modal.result', 'modal.repay', 'modal.promo', 'modal.pit', 'modal.pitClear',
              'modal.paid', 'modal.settle', 'modal.bankrupt', 'modal.default'],
    '흐름':   ['flow.cleared', 'flow.relief', 'flow.ending']
  };
}

function main() {
  const G = createGame({ seed: 20260920 });
  bindRelief(G);
  const A = G.A;
  const want = expectations(A);
  const ends = {};
  let runs = 0;

  const log = (...a) => console.log(...a);
  log('■ 커버리지 감사 — 페르소나 ' + ALL.length + '명 × ' + N + '런 + 난이도 사다리\n');

  /* ── 1단계: 페르소나를 차례로. META가 쌓이면서 해금이 열린다 ── */
  for (const name of ALL) {
    let cl = 0;
    for (let k = 0; k < N; k++) {
      G.reseed(1000 + runs * 7919);
      const pl = makePlayer(P[name], Math.random);
      const r = playRun(G, pl, { tier: 0 });
      ends[r.e] = (ends[r.e] || 0) + 1;
      if (r.e === '클리어') cl++;
      runs++;
    }
    log(`  ${name.padEnd(4)} ${N}런 · 클리어 ${String(cl).padStart(3)}  (누적 XP ${G.meta().xp})`);
  }

  /* ── 2단계: 난이도 사다리. 완제해야 다음 단계가 열리므로 열린 최고 단계로만 간다 ── */
  log('\n  난이도 사다리 — 열린 최고 단계로 계속');
  const TIERS = A.get('TIERS').length;
  for (let k = 0; k < N * 6; k++) {
    const tier = A.get('maxTierIdx')();
    G.reseed(500000 + k * 7919);
    const pl = makePlayer(P['숙련'], Math.random);
    const r = playRun(G, pl, { tier });
    ends[r.e] = (ends[r.e] || 0) + 1;
    runs++;
    if (A.get('maxTierIdx')() >= TIERS - 1 && k > N) break;
  }
  log(`  열린 최고 난이도: ${A.get('maxTierIdx')() + 1}단계 / ${TIERS}단계 · 완제 ${A.get('META').cleared}`);

  /* ── 결과 ── */
  const c = G.cov.counts;
  log('\n■ 결과 — 총 ' + runs + '런');
  log('  끝난 이유: ' + Object.entries(ends).map(([k, v]) => k + ' ' + v).join(' · '));
  const slips = Object.keys(ends).filter(k => k.startsWith('미끄러짐'));
  if (slips.length) log('  ⚠ 미끄러짐: ' + slips.map(k => k + ' ' + ends[k]).join(' · '));

  log('\n■ 커버리지');
  let missing = [];
  for (const [grp, keys] of Object.entries(want)) {
    const gone = keys.filter(k => !c[k]);
    const mark = gone.length ? '✗' : '✓';
    log(`  ${mark} ${grp.padEnd(5)} ${keys.length - gone.length}/${keys.length}` +
        (gone.length ? '   빠짐: ' + gone.map(k => k.split('.').slice(1).join('.')).join(' ') : ''));
    for (const k of gone) missing.push(grp + '/' + k);
  }

  if (missing.length) {
    log('\n✗ 안 건드린 시스템 ' + missing.length + '개 — 시나리오가 게임을 다 덮지 못합니다.');
    log('  ' + missing.join('\n  '));
    process.exit(1);
  }
  log('\n✓ 게임의 모든 콘텐츠 시스템을 건드렸습니다.');
}

main();
