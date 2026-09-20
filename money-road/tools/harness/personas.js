/* ===== 페르소나 =====
   한 명으로는 게임을 다 못 건드린다. 신중한 사람은 동전주를 안 사고, 공매도를 즐기는
   사람은 물타기를 안 한다. 그래서 여럿을 둔다 — 밸런스를 여러 사람의 눈으로 재려는
   목적도 있지만, 더 중요한 건 **커버리지**다. audit.js가 이 묶음을 전부 돌려서
   "아무도 안 건드린 시스템"을 잡아낸다.

   숫자는 전부 가정이다. 실제 기록이 들어오면 log/fit.js가 뽑은 값이 여기 옆에 선다.
   그때 이 표는 "사람은 이 근처 어딘가"라는 범위로만 남는다. */

const P = {
  /* 쓰던 종목을 안 바꾸고, 조금 걸고, 빨리 끊는다. 가장 흔한 초보의 모습이다. */
  신중: { riskAppetite: 0.10, loyalty: 0.92, betBase: 0.22, betUrgency: 0.5,
         stopPct: 0.08, takePnl: 0.35, panicPnl: -0.30, tilt: 0.05, levBase: 3,
         grantPref: ['stop', 'info', 'cash', 'lev', 'theme', 'surge'], jitter: 0.20 },

  /* 크게 걸고 오래 버틴다. 파산이 여기서 나온다. */
  공격: { riskAppetite: 0.95, loyalty: 0.45, betBase: 0.70, betUrgency: 1.4,
         stopPct: 0.20, takePnl: 1.20, panicPnl: -0.70, tilt: 0.30, levBase: 10,
         grantPref: ['lev', 'cash', 'surge', 'theme', 'info', 'stop'], jitter: 0.30 },

  /* 지면 더 크게 건다. 사람의 비합리성 중 제일 크고 제일 재기 쉬운 것. */
  틸트: { riskAppetite: 0.60, loyalty: 0.60, betBase: 0.30, betUrgency: 1.0,
         stopPct: 0.14, takePnl: 0.50, panicPnl: -0.55, tilt: 0.55, levBase: 5,
         grantPref: ['cash', 'lev', 'info', 'stop', 'theme', 'surge'], jitter: 0.35 },

  /* 🔴이면 거의 항상 숏. 공매도 경로를 혼자 책임진다. */
  숏선호: { riskAppetite: 0.55, loyalty: 0.55, shortOnRed: 0.92, betBase: 0.35,
           stopPct: 0.12, takePnl: 0.55, levBase: 3,
           promoPref: ['short', 'split', 'water', 'etf', 'penny', 'dex', 'coin'],
           grantPref: ['info', 'cash', 'stop', 'lev', 'theme', 'surge'], jitter: 0.25 },

  /* 종목부터 연다. theme·surge 배정과 그 두 종목을 혼자 책임진다.
     차수를 넘어야 배정을 받으므로 기본기는 숙련에 맞춘다 — 약한 규칙을 주면
     1차에서 죽어 배정 화면을 한 번도 못 보고, 그러면 그 두 종목이 영영 안 열린다
     (실제로 그랬다: 감사에서 stock.theme·grant.theme 빠짐으로 잡힘).
     완화(reliefFirst)도 낮춘다 — 완화를 고르면 그게 배정 선택을 덮어쓴다. */
  수집: { riskAppetite: 0.05, loyalty: 0.35, betBase: 0.50, betUrgency: 1.1,
         stopPct: 0.12, takePnl: 9.0, panicPnl: -0.85, minHold: 10, tilt: 0,
         levBase: 3, waterAt: -0.90, halfAt: 9.0, reliefFirst: 0.10,
         stockPref: ['theme', 'surge', 'stable'], loyalty: 0.35,
         grantPref: ['theme', 'surge', 'cash', 'info', 'lev', 'stop'],
         extendAt: 0.40, retireCash: 0.15, jitter: 0.12 },

  /* 손실이 나면 곧장 물타고, 이익이 나면 절반 뺀다. */
  물타기: { riskAppetite: 0.45, loyalty: 0.70, betBase: 0.28, waterAt: -0.12, halfAt: 0.18,
           stopPct: 0.18, takePnl: 0.70, panicPnl: -0.60, levBase: 3,
           promoPref: ['water', 'split', 'etf', 'short', 'penny', 'dex', 'coin'],
           grantPref: ['cash', 'stop', 'info', 'lev', 'theme', 'surge'], jitter: 0.25 },

  /* 배율을 끝까지 올린다. 10배 경로를 혼자 책임진다.
     배정으로 두 번 올려야 닿는 값이라, 차수를 여러 번 넘는 기본기가 필요하다 —
     약한 규칙을 주면 표본에 따라 10배가 나왔다 안 나왔다 해서 감사가 흔들린다. */
  배율: { riskAppetite: 0.05, loyalty: 0.95, betBase: 0.45, betUrgency: 1.1,
         stopPct: 0.12, takePnl: 9.0, panicPnl: -0.85, minHold: 10, tilt: 0,
         levBase: 10, waterAt: -0.90, halfAt: 9.0, reliefFirst: 0.10,
         stockPref: ['stable'],
         grantPref: ['lev', 'cash', 'stop', 'info', 'theme', 'surge'],
         extendAt: 0.40, retireCash: 0.10, jitter: 0.12 },

  /* 안 판다. 끝까지 들고 간다 — 시간 만료(act.timeout) 경로를 책임진다. */
  버티기: { riskAppetite: 0.35, loyalty: 0.85, betBase: 0.30, stopPct: 0.90,
           takePnl: 9.0, panicPnl: -0.95, minHold: 200, levBase: 3, jitter: 0.10 },

  /* 실제로 관문을 넘는 사람. 난이도 사다리를 올리려면 누군가는 완제해야 한다.
     "잘 하는 규칙"이지 최적은 아니다 — 익절을 안 잘라서 승자를 오래 들고 간다. */
  숙련: { riskAppetite: 0.05, loyalty: 0.98, betBase: 0.50, betUrgency: 1.1,
         stopPct: 0.12, takePnl: 9.0, panicPnl: -0.85, minHold: 10, tilt: 0,
         levBase: 3, waterAt: -0.90, halfAt: 9.0,
         grantPref: ['cash', 'lev', 'stop', 'info', 'theme', 'surge'],
         extendAt: 0.40, retireCash: 0.05, jitter: 0.12 }
};

const ALL = Object.keys(P);
module.exports = { P, ALL };
