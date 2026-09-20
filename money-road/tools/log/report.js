#!/usr/bin/env node
/* ===== 기록 보고서 =====
   내보낸 기록(JSON)을 읽어서
     1) 실제로 어떻게 두셨는지 요약하고
     2) 거기서 규칙을 뽑고
     3) 그 규칙을 진짜 게임에 다시 태워 1000런 돌리고
     4) **복제가 정말 당신을 닮았는지** 원본과 맞춰 본다.
   4번이 이 파일의 핵심이다. 안 닮았으면 뽑은 규칙으로 밸런스를 논하면 안 된다.

   쓰는 법:  node tools/log/report.js <기록.json> [복제런수]
*/
const fs = require('fs');
const { parse, summary } = require('./parse');
const { fit } = require('./fit');
const { createGame } = require('../harness/game');
const { makePlayer, bindRelief } = require('../harness/player');
const { playRun } = require('../harness/run');

const file = process.argv[2];
const N = Number(process.argv[3] || 1000);
if (!file) { console.error('쓰는 법: node tools/log/report.js <기록.json> [복제런수]'); process.exit(2); }

const runs = parse(fs.readFileSync(file, 'utf8'));
/* 끝을 못 본 판(앱을 닫으신 판)은 **결정 자료로는 쓰고 결과 비교에서는 뺀다.**
   어떻게 두셨는지는 그대로 들어 있지만, 어떻게 끝났는지는 그 판에 없다. */
const done = runs.filter(r => r.end !== 'abandoned');
const dropped = runs.length - done.length;
const sm = summary(done);

const P = n => (n * 100).toFixed(0) + '%';
const line = (k, v) => console.log('  ' + String(k).padEnd(16) + v);

console.log('■ 실제 기록\n');
line('판', sm.runs + '런 · ' + sm.rounds + '거래일' +
  (dropped ? `   (끝을 못 본 ${dropped}런은 결과 비교에서 뺐습니다 — 규칙 되뽑기에는 씁니다)` : ''));
line('끝난 이유', Object.entries(sm.by).map(([k, v]) => k + ' ' + v).join(' · '));
line('종목', Object.entries(sm.stocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
line('레버리지', Object.entries(sm.levs).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '배 ' + v).join(' · '));
line('등급', Object.entries(sm.grades).sort().map(([k, v]) => k + ' ' + v).join(' · '));
line('특수', `공매도 ${sm.shorts} · 물타기 ${sm.waters} · 분할 ${sm.halves} · 시간만료 ${sm.timeouts}`);

/* 관문 목표는 게임에서 읽는다 — 여기 적어두면 낡는다 */
const G = createGame({ seed: 1 });
const goals = G.A.get('GATES').map(g => g.goal);
const levMults = G.A.get('LEVERAGE_MULTS');
bindRelief(G);

const f = fit(runs, { goals, levMults });   // 되뽑기에는 중단된 판도 쓴다
console.log('\n■ 뽑은 규칙\n');
const KEY = {
  stopPct: '손절 (고점 대비)', takePnl: '익절 (투자금 대비)', panicPnl: '손실 한계',
  minHold: '최소 보유(틱)', betBase: '평소 베팅 비중', betUrgency: '급할 때 더 지름',
  tilt: '틸트(연패 시 증가)', betSigUp: '🟢 베팅 배수', betSigDn: '🔴 베팅 배수',
  levBase: '주 레버리지', shortOnRed: '🔴에 숏 비율', loyalty: '종목 충성도',
  reliefFirst: '사건 완화 우선', jitter: '흔들림'
};
for (const k of Object.keys(KEY)) {
  const v = f.params[k];
  const n = f.evidence[k];
  line(KEY[k], (typeof v === 'number' ? v : JSON.stringify(v)) + (n ? `   (${n}판 근거)` : '   (기본값)'));
}
line('종목 선호', f.params.stockPref.join(' > '));
line('배정 선호', f.params.grantPref.join(' > '));

console.log('\n  못 뽑은 것 — 기록에 없는 값입니다');
for (const n of f.notes) console.log('    · ' + n);

/* ── 복제를 진짜 게임에 태운다 ── */
console.log('\n■ 복제 플레이어 ' + N + '런\n');
const ends = {}, gates = {}, peaks = [];
for (let k = 0; k < N; k++) {
  G.reseed(424242 + k * 7919);
  const pl = makePlayer(f.params, Math.random);
  const r = playRun(G, pl, { tier: (done[done.length - 1] || runs[runs.length - 1] || {}).tier || 0 });
  ends[r.e] = (ends[r.e] || 0) + 1;
  gates[r.gate] = (gates[r.gate] || 0) + 1;
  peaks.push(r.peak);
}
const EN = { clear: '클리어', deadline: '기한초과', broke: '파산', retire: '은퇴' };
line('끝난 이유', Object.entries(ends).map(([k, v]) => k + ' ' + P(v / N)).join(' · '));
line('도달 차수', Object.entries(gates).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + '차 ' + P(v / N)).join(' · '));

/* ── 검증: 복제가 원본을 닮았나 ── */
console.log('\n■ 검증 — 복제가 실제를 닮았습니까\n');
const realEnd = {};
for (const r of done) realEnd[EN[r.end] || r.end] = (realEnd[EN[r.end] || r.end] || 0) + 1;
const keys = [...new Set([...Object.keys(realEnd), ...Object.keys(ends)])];
console.log('  ' + '끝난 이유'.padEnd(10) + '실제'.padStart(8) + '복제'.padStart(8) + '   차이');
let worst = 0;
for (const k of keys) {
  const a = (realEnd[k] || 0) / sm.runs, b = (ends[k] || 0) / N;
  const d = Math.abs(a - b); if (d > worst) worst = d;
  console.log('  ' + k.padEnd(10) + P(a).padStart(8) + P(b).padStart(8) + '   ' + (d * 100).toFixed(0) + '%p');
}
const realGate = done.reduce((a, r) => a + r.gate, 0) / Math.max(1, sm.runs);
const cloneGate = Object.entries(gates).reduce((a, [k, v]) => a + k * v, 0) / N;
console.log('  ' + '평균 도달차수'.padEnd(10) + realGate.toFixed(2).padStart(8) + cloneGate.toFixed(2).padStart(8) +
  '   ' + Math.abs(realGate - cloneGate).toFixed(2));

console.log('');
if (sm.runs < 15) {
  console.log('  ⚠ 실제 기록이 ' + sm.runs + '런뿐입니다. 20런은 있어야 이 비교가 뜻이 있습니다.');
} else if (worst > 0.20) {
  console.log('  ✗ 최대 ' + (worst * 100).toFixed(0) + '%p 어긋납니다 — 복제가 당신을 못 닮았습니다.');
  console.log('    이 규칙으로 낸 밸런스 숫자는 쓰지 마세요. 기록을 더 모으거나');
  console.log('    logRound()에 칸을 늘려 못 뽑은 값(lag·물타기 문턱)을 남겨야 합니다.');
} else {
  console.log('  ✓ 최대 ' + (worst * 100).toFixed(0) + '%p 차이 — 복제를 밸런스 측정에 써도 됩니다.');
}
