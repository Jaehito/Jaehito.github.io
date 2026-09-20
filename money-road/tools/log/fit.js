/* ===== 기록에서 규칙 뽑기 =====

   로그는 결과가 아니라 **결정**을 담고 있다. 그래서 여기서 뽑는 것도 결정 규칙이다.
   뽑은 규칙을 진짜 게임 엔진에 다시 태우면(tools/harness) 30런이 1000런이 된다 —
   결과를 지어낼 필요가 없다. 엔진이 매번 새 경로를 준다.

   ⚠️ 못 뽑는 것을 분명히 적어 둔다. 기록에 없는 값을 있는 척 뽑으면 그게 바로
   "시뮬 숫자가 실제와 다른" 이유가 된다:
     · lag(반응 지연)  — 누른 시각을 안 남긴다. 체결 틱만 있다. 기본값을 쓴다.
     · waterAt/halfAt  — 했다는 사실만 남고 "손익 몇 %에서" 가 없다. 빈도로만 민다.
     · panicPnl        — 손절 보험이 먼저 잘라낸 판과 구분이 안 된다. 하한만 본다.
   늘리려면 logRound()에 칸을 더해야 하고, 그때부터 쌓이는 기록만 쓸 수 있다. */

const { DEFAULT } = require('../harness/player');

const med = a => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null);
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
/* 분포의 폭 — 문턱을 얼마나 흔들지(jitter)를 여기서 정한다 */
function spread(a) {
  if (a.length < 4) return null;
  const s = a.slice().sort((x, y) => x - y);
  const q1 = s[Math.floor(s.length * 0.25)], q3 = s[Math.floor(s.length * 0.75)];
  const m = med(a);
  return m ? Math.min(0.9, Math.abs((q3 - q1) / 2 / m)) : null;
}
const mode = o => { let k = null, n = -1; for (const x in o) if (o[x] > n) { n = o[x]; k = x; } return k; };

function fit(runs, opts) {
  opts = opts || {};
  const rounds = [];
  for (const r of runs) for (const d of r.rounds) rounds.push(d);
  if (!rounds.length) throw new Error('기록에 판이 없습니다');

  const out = Object.assign({}, DEFAULT);
  const notes = [];      // 못 뽑았거나 표본이 얇은 항목
  const ev = {};         // 근거가 된 표본 수

  /* ── 어느 규칙이 눌렀나 ──
     로그만 보면 "+50%에 팔았다"가 익절 목표인지, 손절선이 마침 그 자리였는지
     구분이 안 된다. 따로따로 중앙값을 내면 **익절을 안 하는 사람에게도** 익절값이
     생긴다 — 자체 검증에서 「숙련」(익절 없음)의 복제가 원본과 71%p 다르게 끝난
     이유가 이것이었다. 그래서 먼저 판을 두 무리로 가른다.

     기준: 불리한 쪽으로 거의 안 밀렸는데 이익을 보고 팔았으면 그건 익절이다.
     손절로 팔았다면 정의상 문턱만큼은 밀려 있어야 한다. */
  const sold = rounds.filter(d => !d.timeout);
  const rough = med(sold.filter(d => d.fromHigh < 0).map(d => -d.fromHigh)) || 0.12;
  const takes = sold.filter(d => d.pnl > 0.05 && -d.fromHigh < rough * 0.5).map(d => d.pnl);
  const takeShare = sold.length ? takes.length / sold.length : 0;
  if (takeShare < 0.10) {
    /* 익절로 판 판이 거의 없다 = 이 사람은 목표를 안 잡고 끝까지 들고 간다.
       기본값을 두면 없는 익절을 만들어내므로 사실상 끄는 값을 넣는다. */
    out.takePnl = 9.0;
    notes.push(`takePnl: 익절로 판 판이 ${takes.length}/${sold.length}판뿐 — 익절 안 하는 사람으로 봅니다`);
  } else if (takes.length >= 8) {
    out.takePnl = +med(takes).toFixed(3); ev.takePnl = takes.length;
  } else notes.push('takePnl: 표본 ' + takes.length + '판 — 기본값 유지');

  /* 손절 무리 = 익절로 가른 판을 뺀 나머지 중 불리하게 밀린 것 */
  const takeSet = new Set(sold.filter(d => d.pnl > 0.05 && -d.fromHigh < rough * 0.5));
  const stops = sold.filter(d => !takeSet.has(d) && d.fromHigh < 0).map(d => -d.fromHigh);
  if (stops.length >= 8) { out.stopPct = +med(stops).toFixed(3); ev.stopPct = stops.length; }
  else notes.push('stopPct: 표본 ' + stops.length + '판 — 기본값 유지');

  /* ── 손실 한계: 제일 크게 잃고 판 쪽 ── */
  const losses = rounds.filter(d => d.pnl < 0).map(d => d.pnl).sort((a, b) => a - b);
  if (losses.length >= 8) {
    out.panicPnl = +losses[Math.floor(losses.length * 0.10)].toFixed(3);   // 하위 10%
    ev.panicPnl = losses.length;
  } else notes.push('panicPnl: 표본 ' + losses.length + '판 — 기본값 유지');

  /* ── 진입 직후 얼마나 들고 있나 ── */
  const ticks = rounds.filter(d => !d.timeout).map(d => d.sellTick);
  if (ticks.length >= 8) { out.minHold = Math.max(2, Math.floor(ticks.slice().sort((a, b) => a - b)[Math.floor(ticks.length * 0.05)])); ev.minHold = ticks.length; }

  /* ── 베팅 비중 (거친 값) ── 아래에서 급함·신호·틸트를 걷어내고 다시 뽑는다 */
  const fr = rounds.map(d => d.betFrac).filter(x => x > 0 && x <= 1);
  if (fr.length >= 8) { out.betBase = +med(fr).toFixed(3); ev.betBase = fr.length; }

  /* ── 급할수록 더 지르는가 · 평소엔 얼마나 거는가 ──
     둘은 같은 식의 두 부분이라 따로 뽑으면 서로 오염된다:
         비중 = betBase × 급함 × 신호배수 × (1+연패×틸트)
     그래서 표본을 고를 때 세 가지를 지킨다.
       · **잘린 판을 뺀다.** 비중은 1.0에서 잘린다(전액 베팅). 잘린 값을 그대로
         평균 내면 "평소 이만큼 건다"가 위로 끌려 올라간다 — 실제로 2단계를 넣었더니
         0.47이 0.56으로 더 나빠졌다. 잘린 관측은 값이 아니라 "여기 이상"일 뿐이다.
       · **신호가 보통(mid)인 판만** 쓴다. 🟢🔴 배수가 안 섞인다.
       · **연패 중이 아닌 판만** 쓴다. 틸트가 안 섞인다. */
  const pts = [];
  for (const r of runs) {
    let loss = 0;
    for (const d of r.rounds) {
      const goal = goalOf(d.gate, opts.goals);
      const censored = d.betFrac >= 0.98 || d.betFrac <= 0.06;
      if (goal && goal > d.cash && d.cash > 0 && d.betFrac > 0) {
        pts.push({ need: Math.pow(goal / d.cash, 1 / Math.max(1, d.daysLeft)) - 1,
                   f: d.betFrac, sig: d.sig, loss, censored });
      }
      loss = d.profit > 0 ? 0 : loss + 1;
    }
  }
  const clean = pts.filter(p => !p.censored);
  if (clean.length >= 20) {
    /* 기울기를 최소자승으로 재면 안 된다. 비중이 1.0에서 잘리기 때문에 급한 판일수록
       관측이 위에서 잘려 나가고, 남은 것만 보면 기울기가 0으로 주저앉는다
       (자체 검증에서 1.1이 0.011로 잡혔다). 대신 급한 쪽과 한가한 쪽의 **중앙값 비**를
       쓴다 — 잘려도 비가 과소평가될 뿐 무너지지 않고, 중앙값이라 꼬리에도 안 흔들린다. */
    const sorted = pts.slice().sort((a, b) => a.need - b.need);
    const third = Math.max(5, Math.floor(sorted.length / 3));
    const lo = sorted.slice(0, third), hi = sorted.slice(-third);
    const fLo = med(lo.map(p => p.f)), fHi = med(hi.map(p => p.f));
    const nLo = med(lo.map(p => p.need)), nHi = med(hi.map(p => p.need));
    const dN = nHi - nLo;
    if (fLo > 0.01 && dN > 1e-4) {
      /* f = base·(1 + need·4·urgency) → (fHi/fLo − 1) = 4·urgency·(nHi − nLo) / (1 + 4·urgency·nLo)
         nLo가 작으므로 분모를 1로 근사한다. 잘린 판이 많으면 아래에서 그 사실을 적는다. */
      out.betUrgency = +Math.max(0, Math.min(3, (fHi / fLo - 1) / (4 * dN))).toFixed(3);
      ev.betUrgency = pts.length;
    }
    const b0 = med(clean.map(p => p.f)) || 0.3;

    /* 급함·신호·틸트를 나눠 없앤 뒤 남는 것이 평소 비중이다 */
    const pure = clean.filter(p => p.sig === 'mid' && p.loss === 0);
    const use = pure.length >= 10 ? pure : clean.filter(p => p.loss === 0);
    const base = use.map(p => p.f / Math.min(2.2, 1 + p.need * 4 * out.betUrgency))
                    .filter(x => x > 0 && x < 1);
    if (base.length >= 10) { out.betBase = +med(base).toFixed(3); ev.betBase = base.length; }
    else notes.push('betBase: 깨끗한 표본 ' + base.length + '판 — 거친 중앙값을 씁니다');
    if (pts.length - clean.length > pts.length * 0.4)
      notes.push(`betBase: 판의 ${Math.round((1 - clean.length / pts.length) * 100)}%가 전액 베팅(잘림) — 평소 비중은 이 값보다 클 수 있습니다`);
  } else notes.push('betUrgency: 표본 ' + clean.length + '판 — 기본값 유지');

  /* ── 틸트: 연패 중에 베팅이 커지나 ── */
  const byStreak = {};
  for (const r of runs) {
    let loss = 0;
    for (const d of r.rounds) {
      (byStreak[Math.min(4, loss)] || (byStreak[Math.min(4, loss)] = [])).push(d.betFrac);
      loss = d.profit > 0 ? 0 : loss + 1;
    }
  }
  const b0 = mean(byStreak[0] || []), b2 = mean(byStreak[2] || []);
  if (b0 && b2 && (byStreak[2] || []).length >= 8) {
    out.tilt = +Math.max(-0.3, Math.min(1.2, (b2 / b0 - 1) / 2)).toFixed(3);
    ev.tilt = (byStreak[2] || []).length;
  } else notes.push('tilt: 2연패 표본 ' + ((byStreak[2] || []).length) + '판 — 기본값 유지');

  /* ── 신호별 베팅 배수 ── */
  const sg = { strong: [], mid: [], weak: [] };
  for (const d of rounds) if (d.sig && sg[d.sig]) sg[d.sig].push(d.betFrac);
  const mMid = mean(sg.mid);
  if (mMid && sg.strong.length >= 6) out.betSigUp = +(mean(sg.strong) / mMid).toFixed(3);
  if (mMid && sg.weak.length >= 6) out.betSigDn = +(mean(sg.weak) / mMid).toFixed(3);

  /* ── 레버리지 ──
     최빈값만 보면 틀린다. 계정 상한이 3배인 동안 두는 판이 훨씬 많아서, 10배를
     원하는 사람도 최빈값은 3배로 나온다. 그래서 "상한까지 올려 쓰는 사람인가"를
     먼저 본다 — 그렇다면 원하는 값은 표의 꼭대기다. */
  const lv = {}; for (const d of rounds) lv[d.lev] = (lv[d.lev] || 0) + 1;
  /* 고를 여지가 있던 판만 본다. 계좌는 3배로 시작하고 최소도 3배라, 상한이 3배인
     동안은 "상한까지 썼다"가 저절로 참이 된다 — 그 판을 세면 모두가 최대 배율을
     원하는 사람으로 잡힌다(실제로 그랬다). 상한이 올라간 뒤의 판만 증거가 된다. */
  const MIN = (opts.levMults || [3])[0] === 1 ? 3 : Math.min(...rounds.map(d => d.lev));
  const choice = rounds.filter(d => d.maxLev > MIN);
  if (choice.length >= 10) {
    const atCap = choice.filter(d => d.lev >= d.maxLev).length;
    if (atCap / choice.length >= 0.60) {
      out.levBase = Math.max(...(opts.levMults || [10]));
      notes.push(`levBase: 상한이 올라간 ${choice.length}판 중 ${Math.round(atCap / choice.length * 100)}%를 끝까지 올려 쓰심 — 최대치로 봅니다`);
    } else {
      const lv2 = {}; for (const d of choice) lv2[d.lev] = (lv2[d.lev] || 0) + 1;
      out.levBase = +mode(lv2) || out.levBase;
    }
    ev.levBase = choice.length;
  } else {
    out.levBase = +mode(lv) || out.levBase;
    ev.levBase = rounds.length;
    notes.push('levBase: 배율 상한이 올라간 판이 ' + choice.length + '판뿐 — 더 높은 배율을 원하셨는지는 알 수 없습니다');
  }

  /* ── 공매도: 🔴일 때 얼마나 숏으로 가나 ── */
  const weak = rounds.filter(d => d.sig === 'weak');
  if (weak.length >= 8) { out.shortOnRed = +(weak.filter(d => d.short).length / weak.length).toFixed(3); ev.shortOnRed = weak.length; }

  /* ── 종목 선호 ──
     고른 횟수만 세면 늦게 열리는 종목이 늘 뒤로 밀린다. 네코프로는 배정을 받아야
     열리는데, 그 전 판까지 분모에 들어가면 "안 좋아하는 종목"이 된다.
     그래서 **고를 수 있었던 판 중 고른 비율**로 줄 세운다. */
  const pick = {}, avail = {};
  for (const d of rounds) {
    pick[d.stock] = (pick[d.stock] || 0) + 1;
    for (const id of (d.openStocks || [d.stock])) avail[id] = (avail[id] || 0) + 1;
  }
  const rate = {};
  for (const id in avail) if (avail[id] >= 5) rate[id] = (pick[id] || 0) / avail[id];
  const ranked = Object.keys(rate).sort((a, b) => rate[b] - rate[a]);
  if (ranked.length) out.stockPref = ranked;
  else out.stockPref = Object.keys(pick).sort((a, b) => pick[b] - pick[a]);

  /* ── 종목 충성도: 직전 판과 같은 종목을 쓴 비율 ── */
  let same = 0, pairs = 0, soloRounds = 0;
  for (const r of runs) for (let i = 1; i < r.rounds.length; i++) {
    pairs++;
    if (r.rounds[i].stock === r.rounds[i - 1].stock) same++;
    if ((r.rounds[i].openStocks || []).length <= 1) soloRounds++;
  }
  if (pairs >= 10) { out.loyalty = +(same / pairs).toFixed(3); ev.loyalty = pairs; }
  /* 고를 종목이 하나뿐이었다면 "안 바꿨다"는 선택이 아니라 사정이다.
     그 기록에서 나온 충성도 1.0은 성향이 아니라 "바꿀 데가 없었다"는 뜻이다. */
  if (pairs && soloRounds / pairs > 0.7)
    notes.push(`loyalty: 판의 ${Math.round(soloRounds / pairs * 100)}%가 고를 종목이 하나뿐 — 바꾸실 성향인지는 알 수 없습니다`);

  /* ── 오래 들고 가는 사람인가 ──
     시간 만료로 끝난 판이 많다는 건 매도 규칙이 거의 발동하지 않는다는 뜻이다.
     그런 사람에게 평범한 손절값을 물리면 완전히 다른 사람이 된다. */
  const toShare = rounds.filter(d => d.timeout).length / rounds.length;
  if (toShare > 0.40) {
    out.stopPct = 0.90; out.minHold = 200;
    notes.push(`stopPct/minHold: 판의 ${(toShare * 100).toFixed(0)}%가 시간 만료 — 끝까지 들고 가는 사람으로 봅니다`);
  }

  /* ── 물타기·분할매도: "안 했다"와 "못 했다"를 가른다 ──
     열려 있었는데 한 번도 안 썼으면 그 사람은 안 쓰는 사람이다. 기본 문턱을 그대로
     두면 복제가 원본과 다르게 논다(자체 검증에서 「숙련」이 29%p 어긋난 원인). */
  const openRounds = id => {
    let n = 0;
    for (const r of runs) if ((r.unlocks || []).includes(id)) n += r.rounds.length;
    return n;
  };
  const wOpen = openRounds('water'), hOpen = openRounds('split');
  const wN = rounds.filter(d => d.watered).length, hN = rounds.filter(d => d.halved).length;
  /* 쓰신 적이 없으면 켜지 않는다. 기본값을 남겨 두면 복제가 **기록에 없는 행동**을
     한다 — 그게 복제를 원본과 다르게 만드는 가장 큰 원인이었다(자체 검증 26%p).
     아직 안 열린 장치도 마찬가지다: 안 열렸다는 것은 쓰는 걸 본 적이 없다는 뜻이다. */
  /* 0번이냐 아니냐로 가르면 안 된다. 문턱을 사실상 안 잡은 사람도 아주 크게 벌거나
     잃은 판에서는 한두 번 누른다 — 565판에 3번 같은 것. 비율로 본다. */
  const RARE = 0.02;
  const wRate = wOpen ? wN / wOpen : 0, hRate = hOpen ? hN / hOpen : 0;
  if (wRate < RARE) { out.waterAt = -0.99; notes.push(`waterAt: 열려 있던 ${wOpen}판 중 ${wN}판 — 거의 안 쓰셔서 끕니다`); }
  else notes.push(`waterAt: ${wN}판에서 쓰셨지만 "손익 몇 %에서"가 기록에 없어 기본값`);
  if (hRate < RARE) { out.halfAt = 9.0; notes.push(`halfAt: 열려 있던 ${hOpen}판 중 ${hN}판 — 거의 안 쓰셔서 끕니다`); }
  else notes.push(`halfAt: ${hN}판에서 쓰셨지만 문턱이 기록에 없어 기본값`);

  /* ── 기한 연장 ── */
  const exN = runs.reduce((a, r) => a + (r.extends || 0), 0);
  if (exN === 0) { out.extendAt = 9.9; notes.push('extendAt: 연장을 한 번도 안 하심 — 끕니다'); }
  else notes.push(`extendAt: ${exN}번 연장하셨지만 "잔고 몇 %에서"가 기록에 없어 기본값`);

  /* ── 은퇴 ── */
  const rtN = runs.filter(r => r.end === 'retire').length;
  if (rtN === 0) { out.retireCash = -1; notes.push('retireCash: 끊고 정산한 적이 없으심 — 끕니다'); }

  notes.push('lag: 누른 시각이 기록에 없어 기본값 ' + DEFAULT.lag + '틱');

  /* ── 배정 선호: 고른 횟수 순 ── */
  const gr = {};
  for (const r of runs) for (const g of r.grants) gr[g.id] = (gr[g.id] || 0) + 1;
  if (Object.keys(gr).length) {
    const seen = Object.keys(gr).sort((a, b) => gr[b] - gr[a]);
    out.grantPref = seen.concat(DEFAULT.grantPref.filter(x => !seen.includes(x)));
  }
  /* 완화 우선: **완화 선택지가 실제로 있던 차수** 중 그것을 고른 비율.
     예전에는 "행동 이름이 붙은 카드"를 전부 셌는데, 3택은 거의 늘 행동 이름이
     붙어 있어서 누구나 0.9가 나왔다(자체 검증에서 0.1이 0.899로 잡힘). */
  let av = 0, rel = 0;
  for (const r of runs) for (const g of r.grants) { if (g.reliefAvail) { av++; if (g.relieved) rel++; } }
  if (av >= 6) { out.reliefFirst = +(rel / av).toFixed(3); ev.reliefFirst = av; }
  else notes.push('reliefFirst: 완화 선택지가 있던 차수 ' + av + '번 — 기본값 유지');

  /* ── 흔들림: 손절 분포의 폭이 곧 사람의 일관성 없음 ── */
  const sp = spread(stops);
  if (sp !== null) { out.jitter = +sp.toFixed(3); ev.jitter = stops.length; }

  return { params: out, notes, evidence: ev, n: { runs: runs.length, rounds: rounds.length } };
}

/* 관문 목표. 기록에는 차수 번호만 있으므로 표가 필요하다.
   기본값은 index.html의 GATES에서 읽어 넣는다(report.js가 넘겨준다). */
function goalOf(gate, goals) { return goals && goals[gate]; }

module.exports = { fit, med, mean, spread };
