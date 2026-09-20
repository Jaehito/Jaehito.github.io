/* ===== 게임 드라이버 =====

   env.js가 띄운 진짜 게임을 헤드리스로 "조작"한다. 사람이 화면에서 하는 일과
   같은 순서로 같은 함수를 부르는 것이 이 파일의 전부다.

   ── 모달을 어떻게 넘기나 ──
   게임의 흐름은 모달이 쥐고 있다. 결과 → 명단 정정 → 완납 → 차수 통과 → 승격이
   콜백으로 이어져 있어서, 모달을 안 넘기면 판이 진행되지 않는다.
   그래서 모달 함수를 갈아끼운다. **단, 상태를 바꾸는 부분은 절대 베끼지 않는다** —
   index.html의 applyGrantPick / applyPromoPick / finishRun을 그대로 부른다.
   (베꼈다가 조용히 어긋난 것이 sim/_harness.js였다. 같은 실수를 두 번 하지 않는다.)

   ── 사람과 같게 만드는 것 ──
   1. 미래를 못 본다. 경로 배열 전체가 메모리에 있지만 정책에는 **현재 틱까지만**
      잘라서 준다. 이게 깨지면 클리어율이 90%가 나오고 아무 의미가 없어진다.
   2. 매 틱 못 누른다. STEP틱(기본 4 = 0.2초)마다만 판단하고, 누른 뒤 LAG틱 뒤에
      체결된다. 사람의 손이 0.05초마다 움직이지는 않는다.
   3. 화면에 없는 건 못 본다. 패턴 id, 경로 끝값, 다른 종목의 경로는 안 준다.
      주는 것은 화면에 실제로 있는 것뿐이다 — 현재가·고저·손익·남은 시간·신호등급.
*/
const { boot } = require('./env');

/* 라운드 안에서 정책이 볼 수 있는 것. 화면에 있는 것만 담는다. */
function roundView(A, R, idx) {
  const path = R.path;
  let lo = path[0], hi = path[0];
  for (let i = 0; i <= idx; i++) { if (path[i] < lo) lo = path[i]; if (path[i] > hi) hi = path[i]; }
  const mult = path[idx];
  const lev = R.leverage || 1, dir = R.dir || 1, entry = R.entry || 1;
  /* 불리한 쪽으로 얼마나 밀렸나. 숏은 가격이 **올라야** 손해다 — 롱 기준으로만 재면
     숏 판에서 손절이 이익 실현으로 뒤집힌다. 화면에서도 사람은 "내게 불리한 쪽"을 본다. */
  const adverse = dir > 0 ? (mult / hi - 1) : (lo / mult - 1);
  return {
    t: idx, T: R.ticks,                       // 지금 몇 틱 / 전체 몇 틱
    frac: idx / (R.ticks - 1),                // 남은 시간 감각
    mult,                                     // 현재가 배수
    seenLow: lo, seenHigh: hi,                // 지금까지 본 저점/고점
    fromHigh: adverse,                        // 불리한 쪽으로 밀린 정도 (음수·방향 반영)
    pnl: (mult / entry - 1) * lev * dir,      // 투자금 대비 손익률
    entry, lev, dir,
    stockId: R.stockId,
    sig: (A.get('S.pending') || {}).sig,      // 🟢🟡🔴 (틀릴 수 있다)
    watered: !!R.watered, halved: !!R.half,
    buffs: (R.buffs || []).slice(),
    canWater: A.get('canWater')(R, mult),
    canSplit: !R.half && A.get('metaHas')('split')
  };
}

/* 판 밖에서 정책이 볼 수 있는 것 — 계좌 화면에 있는 값들 */
function deskView(A) {
  const S = A.get('S');
  return {
    cash: S.cash, peak: S.peakCash,
    gate: S.gate, goal: A.get('gateOf')().goal,
    daysLeft: S.daysLeft, dayCount: S.dayCount,
    tier: A.get('tierIdx')(),
    level: S.level, streak: S.streak || 0,
    sig: (S.pending || {}).sig,
    upg: Object.assign({}, S.upg),
    maxLev: A.get('leverageMultOf')(), minLev: A.get('minLevOf')(),
    stocks: openStockIds(A),
    grants: (S.grants || []).slice(),
    buffs: (S.buffs || []).slice(),
    minBet: A.get('MIN_BET'),
    reason: A.get('reasonOf')(S.gate),
    mod: A.get('evModOf')(),
    relieved: !!(S.relief && S.relief[S.gate]),
    metaXp: A.get('META').xp, promo: A.get('promoCount')(),
    can: { split: A.get('metaHas')('split'), water: A.get('metaHas')('water'),
           short: A.get('metaHas')('short'), dex: A.get('metaHas')('dex') }
  };
}

/* 지금 실제로 고를 수 있는 종목. 게임이 쓰는 판정을 그대로 쓴다. */
function openStockIds(A) {
  const list = A.get('TRADE_STOCKS');
  const out = [];
  for (const s of list) {
    let ok = true;
    try { ok = s.open ? !!s.open() : true; } catch (e) { ok = true; }
    if (ok) out.push(s.id);
  }
  return out;
}

function createGame(opts) {
  opts = opts || {};
  const A = boot({ seed: opts.seed });
  const STEP = opts.step === undefined ? 4 : opts.step;   // 몇 틱마다 판단하나 (4 = 0.2초)
  const cov = newCoverage();
  let over = null;          // 런이 끝나면 {e, st}

  /* ── 상태를 바꾸는 모달은 게임 함수를 그대로 부른다 ── */
  const pass = (...a) => { const cb = a.find(x => typeof x === 'function'); if (cb) cb(); };

  let lastRes = null;
  A.set('showResultModal', (R, after) => { cov.bump('modal.result'); lastRes = R; pass(R, after); });
  A.set('showPitModal', (n, after) => { cov.bump('modal.pit'); pass(n, after); });
  A.set('showPitClearModal', after => { cov.bump('modal.pitClear'); pass(after); });
  A.set('showPaidModal', after => { cov.bump('modal.paid'); pass(after); });
  A.set('showEndingModal', after => { cov.bump('modal.ending'); pass(after); });
  A.set('showAwayModal', () => {});
  /* 기한 초과 = 반대매매. 게임은 여기서 finishRun(settleOf(BANKRUPT_PENALTY))을 한다.
     빈 스텁으로 두면 런이 안 끝나고 무한히 돈다 — 실제로 그랬다. */
  A.set('showDefaultModal', () => {
    cov.bump('modal.default');
    A.run(`function(){ finishRun(settleOf(BANKRUPT_PENALTY)); }`);
    if (over) over.e = '기한초과';
  });
  A.set('showIntroModal', () => {});
  A.set('showDexModal', () => {});
  A.set('showRecordModal', () => {});
  A.set('showTierModal', () => {});
  /* 정산 — 게임에서는 이 화면의 「새 판 시작」이 승격·엔딩·난이도를 잇는다.
     그 연쇄를 스텁이 삼키면 META가 영영 안 오르고, 그러면 분할매도·물타기·공매도·
     ETF·동전주·코인이 한 번도 안 열린다. 실제로 그랬다(커버리지 감사에서 잡힘).
     여기서는 상태를 바꾸는 한 줄만 게임과 똑같이 하고 승격 통지를 그대로 부른다. */
  A.set('showSettleModal', st => {
    cov.bump('modal.settle');
    over = { e: over ? over.e : '정산', st };
    A.run(`function(){ META.pendingSettle=null; saveMeta(); }`);
    if (A.get('promoDue')()) A.get('showPromoModal')(null);
    else if (A.get('endingDue')()) {
      A.run(`function(){ META.sent=1; saveMeta(); }`);
      cov.bump('flow.ending');
    }
  });

  /* 파산 — 게임의 정산식을 그대로 쓴다 */
  A.set('showBankruptModal', () => {
    cov.bump('modal.bankrupt');
    A.run(`function(){ finishRun(settleOf(BANKRUPT_PENALTY)); }`);
    if (over) over.e = '파산';
  });

  /* 차수 통과 / 완제 — index.html의 applyGrantPick을 부른다 (베끼지 않는다) */
  let grantChooser = cands => cands[0];
  A.set('showRepayModal', (g, early, bonus) => {
    cov.bump('modal.repay');
    if (A.get('gateDone')()) {
      cov.bump('flow.cleared');
      A.run(`function(){ finishRun(settleOf(0)); }`);
      if (over) over.e = '클리어';
      return;
    }
    const cands = A.get('grantCandidates')();
    cov.note('grant.cands', cands.length);
    const pickObj = grantChooser(cands, deskView(A)) || cands[0];
    if (pickObj) {
      const relieved = A.get('applyGrantPick')(pickObj);
      cov.bump('grant.' + pickObj.id);
      if (pickObj.act) cov.bump('grantAct');
      if (relieved) cov.bump('flow.relief');
    }
    A.get('render')();
    A.get('checkLevelUp')();          // 화면에서 「확인」을 누른 것과 같다
  });

  /* 승격 — applyPromoPick을 부르고, 게임과 같은 순서로 이어 붙인다 */
  let promoChooser = cands => cands[0];
  A.set('showPromoModal', after => {
    cov.bump('modal.promo');
    let guard = 0;
    while (A.get('promoDue')() && guard++ < 12) {
      const cands = A.get('promoCandidates')();
      const p = promoChooser(cands, deskView(A)) || cands[0];
      if (p) { A.get('applyPromoPick')(p.id); cov.bump('promo.' + p.id); }
      else break;
    }
    if (A.get('endingDue')()) {
      A.run(`function(){ META.sent=1; saveMeta(); }`);
      cov.bump('flow.ending');
    }
    if (after) after();
  });

  const api = {
    A, cov,
    get over() { return over; },
    onGrant(f) { grantChooser = f; },
    onPromo(f) { promoChooser = f; },

    newRun(tier) {
      over = null;
      A.run(`function(){ META.pendingSettle=null; saveMeta(); startRunAt(${(tier | 0)}); }`);
      cov.bump('tier.' + (tier | 0));
      return deskView(A);
    },
    desk: () => deskView(A),
    meta: () => A.get('META'),

    /* 한 판. decide(view) 가 매 STEP틱 호출되고 {act:'hold'|'sell'|'half'|'water'} 를 낸다. */
    round(setup, decide) {
      const S = A.get('S');
      if (setup.stock) { A.set('S.selectedStock', setup.stock); cov.bump('stock.' + setup.stock); }
      const lev = Math.max(A.get('minLevOf')(), Math.min(A.get('leverageMultOf')(), setup.lev || 3));
      const dir = setup.dir === -1 && A.get('metaHas')('short') ? -1 : 1;
      A.set('S.betLeverage', lev);
      cov.bump('lev.' + lev);
      cov.bump('dir.' + (dir < 0 ? 'short' : 'long'));
      const want = Math.max(A.get('MIN_BET'), Math.min(S.cash, Math.floor(setup.bet || 0)));
      A.get('setBet')(want);
      if (S.betAmount < A.get('MIN_BET') || S.betAmount > S.cash) return { ok: false, why: '베팅불가' };
      const preBuffs = (S.buffs || []).slice();
      lastRes = null;
      A.get('startRound')(dir);
      const R = A.get('S.activeRound');
      if (!R) return { ok: false, why: '진입실패' };
      for (const b of preBuffs) cov.bump('buff.' + b);
      cov.bump('pattern.' + R.patternId);
      cov.bump('sig.' + ((A.get('S.pending') || {}).sig || '?'));

      const t0 = A.clock.now();
      let idx = 0, sold = false;
      const lag = setup.lag === undefined ? 3 : setup.lag;   // 누르고 체결까지 (틱)
      while (idx < R.ticks - 1) {
        A.clock.set(t0 + idx * 50);      // 게임은 이 시계로 현재 틱을 읽는다
        const v = roundView(A, R, idx);
        const d = decide(v) || { act: 'hold' };
        if (d.act === 'water' && v.canWater) {
          A.get('addWater')(); cov.bump('act.water');
        } else if (d.act === 'half' && v.canSplit) {
          A.get('sellHalf')(); cov.bump('act.half');
        } else if (d.act === 'sell') {
          idx = Math.min(R.ticks - 1, idx + lag);
          A.clock.set(t0 + idx * 50);
          cov.bump('act.sell');
          A.get('sellRound')();
          sold = true;
          break;
        }
        idx += STEP;
      }
      if (!sold) {
        A.clock.set(t0 + (R.ticks - 1) * 50);
        cov.bump('act.timeout');
        A.get('sellRound')();
      }
      A.clock.adv(1500);                     // 결과를 읽는 시간
      /* lastResult는 결과 모달의 콜백이 지운다. 모달에서 가로챈 사본을 쓴다. */
      const res = lastRes;
      if (res) { cov.bump('grade.' + (res.grade && res.grade.g ? res.grade.g : '-')); if (res.earned) for (const b of res.earned) cov.bump('earn.' + b); }
      return { ok: true, res };
    },

    extend() {
      const before = A.get('S.daysLeft');
      A.get('extendDeadline')();
      const got = A.get('S.daysLeft') > before;
      if (got) cov.bump('act.extend');
      return got;
    },
    /* 은퇴는 아무 때나 못 한다 — 게임은 RETIRE_LEVEL(6차) 위에서만 버튼을 띄운다.
       그 문을 건너뛰면 "1차에서 끊고 정산한" 런이 생겨서 은퇴 비율이 통째로 거짓이 된다. */
    canRetire() { return A.get('canRetire')(); },
    retire() {
      if (!A.get('canRetire')()) return null;
      cov.bump('act.retire');
      A.run(`function(){ finishRun(settleOf(0)); }`);
      if (over) over.e = '은퇴';
      return over;
    },
    bankruptCheck() { return A.get('checkBankrupt')(); },
    gateDone: () => A.get('gateDone')(),
    reseed: s => A.reseed(s)
  };
  return api;
}

/* ── 커버리지 ── 무엇을 건드렸고 무엇을 안 건드렸나 */
function newCoverage() {
  const c = Object.create(null), notes = Object.create(null);
  return {
    bump(k) { c[k] = (c[k] || 0) + 1; },
    note(k, v) { (notes[k] || (notes[k] = [])).push(v); },
    get counts() { return c; },
    get notes() { return notes; },
    has(k) { return !!c[k]; },
    merge(o) { for (const k in o.counts) c[k] = (c[k] || 0) + o.counts[k]; }
  };
}

module.exports = { createGame, newCoverage, roundView, deskView };
