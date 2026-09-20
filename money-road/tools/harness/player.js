/* ===== 사람 같은 플레이어 =====

   목표는 "잘 하는 플레이어"가 아니라 "사람이 하는 것 같은 플레이어"다. 그래서
   최적이 아니라 **규칙과 흔들림**으로 만든다. 규칙은 전부 숫자 하나씩으로 빠져 있어서
   (PARAMS) 기록에서 뽑은 값으로 갈아끼울 수 있고, 흔들어서 "당신 주변의 플레이어"를
   만들 수도 있다.

   사람과 같게 만드는 장치 넷:

   1. 미래를 안 본다 — game.js가 현재 틱까지만 잘라서 준다. 여기서는 그걸 그대로 쓴다.
   2. 손이 느리다 — STEP틱마다만 판단하고 누른 뒤 lag틱 뒤 체결.
   3. 매번 같은 자리에 못 판다 — 모든 문턱에 판마다 다른 흔들림(jitter)을 준다.
      사람이 "12%에서 손절"이라고 정해도 실제로는 9%와 15% 사이 어딘가에서 판다.
   4. 틸트 — 연패하면 베팅이 커진다. 사람의 비합리성 중 제일 크고 제일 재기 쉽다.

   전부 끄면(jitter 0, tilt 0) 기계적인 규칙 플레이어가 되고, 그게 천장을 재는 데 쓰인다.
*/

/* 기본값. 이 숫자들이 "가정"이고, 기록이 들어오면 log/fit.js가 여기를 덮어쓴다. */
const DEFAULT = {
  /* ── 매도 ── */
  stopPct: 0.12,        // 고점 대비 이만큼 빠지면 판다
  takePnl: 0.55,        // 투자금 대비 이만큼 벌면 판다
  panicPnl: -0.45,      // 이만큼 잃으면 즉시 판다 (손절 보험과 별개로 사람이 못 버틴다)
  lag: 3,               // 누르고 체결까지 (틱, 1틱=0.05초)
  minHold: 12,          // 진입 직후 이 틱 동안은 안 판다 (사람은 바로 안 턴다)

  /* ── 베팅 ── */
  betBase: 0.35,        // 평소 현금의 몇 할
  betUrgency: 0.9,      // 목표가 멀수록 얼마나 더 지르나 (0이면 항상 betBase)
  betSigUp: 1.25,       // 🟢일 때 배수
  betSigDn: 0.65,       // 🔴일 때 배수
  tilt: 0.18,           // 연패 1회당 베팅 배수 증가

  /* ── 레버리지 ── */
  levBase: 3,
  levSigUp: 1,          // 🟢면 한 칸 위
  levSigDn: -1,         // 🔴면 한 칸 아래

  /* ── 방향 ── */
  shortOnRed: 0.35,     // 🔴이고 공매도가 열려 있으면 이 확률로 숏

  /* ── 판 안의 행동 ── */
  waterAt: -0.30,       // 손실이 이만큼이면 물타기 (열려 있을 때)
  halfAt: 0.40,         // 이익이 이만큼이면 절반 실현 (열려 있을 때)

  /* ── 종목 ── */
  riskAppetite: 0.55,   // 0이면 늘 안전한 종목, 1이면 늘 험한 종목
  loyalty: 0.70,        // 이 확률로 직전에 쓰던 종목을 계속 쓴다 (사람은 잘 안 바꾼다)
  /* 선호 종목 목록. 주면 위험 성향 대신 이걸 쓴다 — 사람은 "좋아하는 종목"이 있지
     매번 진폭을 재서 고르지 않는다. 위험 성향 공식만 두었더니 종목이 여섯 개 다
     열린 계정에서 중간 순위 종목(네코프로·유메이드)에 영영 못 닿았다. */
  stockPref: null,

  /* ── 차수 ── */
  reliefFirst: 0.75,    // 사건 완화 선택지가 있으면 이 확률로 그걸 고른다
  grantPref: ['cash', 'lev', 'stop', 'info', 'theme', 'surge'],
  promoPref: ['split', 'water', 'short', 'etf', 'penny', 'dex', 'coin'],

  /* ── 기한 연장 / 은퇴 ── */
  extendAt: 0.55,       // D-1에 목표의 이 비율 넘게 왔으면 연장해서 더 해본다
  /* 은퇴할 수 있는 차수는 게임이 정한다(canRetire → RETIRE_LEVEL). 정책이 따로
     차수 조건을 들고 있으면 둘이 어긋나서, 게임에서 불가능한 은퇴가 시뮬에만 생긴다. */
  retireCash: 0.25,     // 남은 현금이 목표의 이 비율 밑이고 D-1이면 끊고 정산

  /* ── 사람다움 ── */
  jitter: 0.25          // 모든 문턱을 판마다 ±이 비율로 흔든다
};

/* 종목의 험한 정도 — 진폭(noiseMult)으로 줄 세운다. 게임 표에서 읽는다. */
function riskRank(G) {
  const list = G.A.get('TRADE_STOCKS');
  return list.slice().sort((a, b) => (a.noiseMult || 1) - (b.noiseMult || 1)).map(s => s.id);
}

function makePlayer(paramsIn, rnd) {
  const P = Object.assign({}, DEFAULT, paramsIn || {});
  const R = rnd || Math.random;
  /* 판마다 문턱을 흔든다. 같은 사람이라도 매번 같은 자리에서 팔지 않는다. */
  const J = v => v * (1 + (R() * 2 - 1) * P.jitter);
  let lastStock = null, lossStreak = 0;

  return {
    P,
    /* ── 판을 시작할 때 무엇을 얼마나 어떻게 ── */
    setup(d, G) {
      const open = d.stocks;
      /* 종목: 대개 쓰던 걸 계속 쓰고, 가끔 바꾼다. 바꿀 때는 위험 성향대로 고른다. */
      let stock;
      /* 바꾸기로 했으면 **다른** 종목으로 간다. 후보에 직전 종목을 남겨두면
         "안 바꿨다"가 두 경로에서 나와서, 기록에서 충성도를 되뽑을 때 늘 부풀려진다
         (자체 검증에서 0.35가 0.96으로 잡혔다). 사람도 "바꾼다"면 다른 걸 고른다. */
      const alt = open.filter(id => id !== lastStock);
      if (lastStock && open.includes(lastStock) && (R() < P.loyalty || !alt.length)) stock = lastStock;
      else if (P.stockPref) {
        stock = P.stockPref.find(id => alt.includes(id)) || alt[0] || open[0];
      } else {
        const rank = riskRank(G).filter(id => alt.includes(id));
        /* 목표가 멀고 날이 없으면 더 험한 쪽으로 — 사람이 급하면 그렇게 한다 */
        const need = Math.max(0, 1 - d.cash / d.goal);
        const want = Math.min(0.99, Math.max(0, J(P.riskAppetite) * 0.6 + need * 0.4));
        stock = rank[Math.min(rank.length - 1, Math.floor(want * rank.length))] || open[0];
      }
      lastStock = stock;

      /* 베팅: 남은 날 안에 목표를 넘으려면 얼마가 필요한가 + 신호 + 틸트 */
      const left = Math.max(1, d.daysLeft);
      const needMult = Math.pow(Math.max(1, d.goal / Math.max(1, d.cash)), 1 / left);
      const urg = Math.min(2.2, 1 + (needMult - 1) * 4 * P.betUrgency);
      let f = J(P.betBase) * urg;
      if (d.sig === 'strong') f *= P.betSigUp;
      else if (d.sig === 'weak') f *= P.betSigDn;
      f *= 1 + lossStreak * P.tilt;
      f = Math.min(1, Math.max(0.05, f));

      /* 레버리지: 기본에서 신호만큼 밀고 상한에서 자른다 */
      const MULTS = G.A.get('LEVERAGE_MULTS');
      let li = MULTS.indexOf(P.levBase); if (li < 0) li = 2;
      if (d.sig === 'strong') li += P.levSigUp;
      else if (d.sig === 'weak') li += P.levSigDn;
      const maxI = MULTS.indexOf(d.maxLev), minI = MULTS.indexOf(d.minLev);
      li = Math.max(minI < 0 ? 0 : minI, Math.min(maxI < 0 ? MULTS.length - 1 : maxI, li));

      /* 방향: 🔴이고 공매도가 열려 있으면 가끔 숏 */
      const dir = (d.can.short && d.sig === 'weak' && R() < P.shortOnRed) ? -1 : 1;

      return { stock, bet: Math.floor(d.cash * f), lev: MULTS[li], dir, lag: Math.round(J(P.lag)) };
    },

    /* ── 판 안에서 매 순간 ── */
    decide(v) {
      if (v.t < P.minHold) return { act: 'hold' };
      /* 크게 잃는 중이면 더 못 본다 */
      if (v.pnl <= J(P.panicPnl)) return { act: 'sell' };
      /* 물타기 — 손실 중이고 열려 있을 때 한 번 */
      if (v.canWater && !v.watered && v.pnl <= J(P.waterAt)) return { act: 'water' };
      /* 절반 실현 — 이익 중이고 열려 있을 때 한 번 */
      if (v.canSplit && !v.halved && v.pnl >= J(P.halfAt)) return { act: 'half' };
      /* 목표만큼 벌었으면 판다 */
      if (v.pnl >= J(P.takePnl)) return { act: 'sell' };
      /* 고점에서 이만큼 빠지면 판다 — 사람이 제일 많이 쓰는 규칙 */
      if (v.fromHigh <= -J(P.stopPct)) return { act: 'sell' };
      return { act: 'hold' };
    },

    /* ── 판이 끝난 뒤 (틸트 갱신) ── */
    after(res) {
      if (!res) return;
      if ((res.profit || 0) > 0) lossStreak = 0; else lossStreak++;
    },

    /* ── 차수 통과: 배정 3택 ── */
    grant(cands, d) {
      if (!cands.length) return null;
      /* 사건을 푸는 선택지가 있으면 대개 그것 — "이번 차수가 조인다"가 눈앞에 있으니까 */
      if (d && d.mod && !d.relieved && R() < P.reliefFirst) {
        const need = G_RELIEF(d);
        const hit = cands.find(c => c.act && +c.act.slice(-1) === need);
        if (hit) return hit;
      }
      for (const id of P.grantPref) { const c = cands.find(x => x.id === id); if (c) return c; }
      return cands[0];
    },

    /* ── 승격: 권한 고르기 ── */
    promo(cands) {
      if (!cands.length) return null;
      for (const id of P.promoPref) { const c = cands.find(x => x.id === id); if (c) return c; }
      return cands[0];
    },

    /* ── 판 밖의 두 결정 ── */
    wantExtend(d) {
      if (d.daysLeft > 1) return false;
      return d.cash / d.goal >= J(P.extendAt);
    },
    /* 은퇴 가능 여부는 부르는 쪽(run.js)이 게임에 묻는다. 여기서는 "그러고 싶은가"만. */
    wantRetire(d) {
      if (d.daysLeft > 1) return false;
      return d.cash / d.goal < J(P.retireCash);
    }
  };
}

/* 완화 번호는 게임의 EV_RELIEF가 쥐고 있다. 하니스가 desk에 사유를 실어 주므로
   여기서 표를 다시 적지 않고 런타임에 묻는다. */
let _reliefTable = null;
function bindRelief(G) { _reliefTable = G.A.get('EV_RELIEF'); }
function G_RELIEF(d) { return _reliefTable ? _reliefTable[d.reason] : -1; }

module.exports = { makePlayer, DEFAULT, bindRelief, riskRank };
