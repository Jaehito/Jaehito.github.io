/* phase22 — E단계 둘째: ✂️ 분할 매도

   확인하는 것:
     1) 해금 전에는 버튼이 하나뿐이다 (첫 판 화면 불변)
     2) 절반을 팔면 남은 베팅금이 정확히 줄고 현금이 그만큼 들어온다
     3) 판당 한 번 — 두 번째 호출은 아무것도 안 한다
     4) 결과의 손익·베팅금이 두 번의 매도 합계다
     5) 등급은 금액 가중평균 배율로 매긴다
     6) 티켓 효과가 분할로 불어나지 않는다 (⚡부스터 · 🛟청산 면제)
     7) 숏에서도 절반 매도가 맞게 돈다 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(xp){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   await p.evaluate(x=>{ META.xp=x; saveMeta();
     S.cash=S.peakCash=4000000; S.upg.leverageLv=3; setBet(2000000); renderTrade(); }, xp);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 /* 가격을 원하는 값으로 고정해 두고 라운드를 연다 */
 const helper=`window.openAt=(dir,mult)=>{ startRound(dir);
   S.activeRound.path=S.activeRound.path.map(()=>mult);
   S.activeRound.startedAt=Date.now()-10*ROUND_TICK_MS; renderRoundView(); };
 window.setPrice=(mult)=>{ S.activeRound.path=S.activeRound.path.map(()=>mult); renderRoundView(); };`;

 console.log('=== 1. 해금 전에는 버튼이 하나 ===');
 let p=await fresh(0);
 await p.evaluate(helper);
 L('', await p.evaluate(()=>{ window.openAt(1,1.2);
   return {metaHas:metaHas('split'), 절반버튼숨김:$('sellHalf').hidden,
     전량라벨:$('rvSellLab').textContent};}));
 L('해금 전 sellHalf()는 아무 일도 안 한다', await p.evaluate(()=>{
   const before=S.activeRound.bet; sellHalf();
   return {베팅금:S.activeRound.bet, 그대로:S.activeRound.bet===before, half:S.activeRound.half||null};}));
 await p.close();

 console.log('\n=== 2. 절반 매도 — 금액이 맞는가 ===');
 p=await fresh(300);
 await p.evaluate(helper);
 L('', await p.evaluate(()=>{
   window.openAt(1,1.40);
   const bet0=S.activeRound.bet, cash0=S.cash, lev=S.activeRound.leverage;
   sellHalf();
   const h=S.activeRound.half;
   const want=Math.round((bet0/2)*(1.40-1)*lev);
   return {원래베팅:fmtWon(bet0), 절반:fmtWon(h.bet), 남은베팅:fmtWon(S.activeRound.bet),
     '절반+남은=원래':h.bet+S.activeRound.bet===bet0,
     실현손익:h.profit, 기대손익:want, 손익일치:Math.abs(h.profit-want)<2,
     현금증가:S.cash-cash0, '현금=절반+손익':S.cash-cash0===h.bet+h.profit};}));
 L('두 번째 절반 매도는 막힌다', await p.evaluate(()=>{
   const bet=S.activeRound.bet, mult=S.activeRound.half.mult;
   sellHalf();
   return {남은베팅:S.activeRound.bet, 그대로:S.activeRound.bet===bet,
     실현배율그대로:S.activeRound.half.mult===mult, 절반버튼숨김:$('sellHalf').hidden};}));
 await p.close();

 console.log('\n=== 3. 결과는 두 번의 매도 합계 ===');
 p=await fresh(300);
 await p.evaluate(helper);
 L('1.40x에 절반 · 0.80x에 나머지', await p.evaluate(()=>{
   window.openAt(1,1.40);
   const bet0=S.activeRound.bet, lev=S.activeRound.leverage;
   sellHalf();
   const h={...S.activeRound.half};
   window.setPrice(0.80);
   sellRound(false);
   const r=S.lastResult;
   const rest=bet0-h.bet;
   const wantRest=Math.round(rest*(0.80-1)*lev);
   return {총베팅:fmtWon(r.bet), '총베팅=원래':r.bet===bet0,
     절반손익:h.profit, 나머지손익:wantRest, 합계:h.profit+wantRest,
     결과손익:r.profit, 일치:Math.abs(r.profit-(h.profit+wantRest))<2,
     가중평균배율:+r.effMult.toFixed(4),
     '기대 가중평균':+((1.40*h.bet+0.80*rest)/bet0).toFixed(4),
     등급:r.grade?`${r.grade.g} ${r.grade.pct}%`:'-',
     문구:document.querySelector('.rs-sub').textContent.trim(),
     칩:[...document.querySelectorAll('.rs-chip')].map(x=>x.textContent.trim())};}));
 await p.close();

 console.log('\n=== 4. 티켓 효과가 분할로 불어나지 않는다 ===');
 p=await fresh(300);
 await p.evaluate(helper);
 L('⚡부스터 — 한 번에 팔기 vs 나눠 팔기', await p.evaluate(()=>{
   const run=(split)=>{
     S.cash=4000000; setBet(2000000); S.buffs=['boost'];
     window.openAt(1,1.40);
     const c0=S.cash;
     if(split){ sellHalf(); }
     sellRound(false);
     const got=S.lastResult.profit; $('mOk').click();
     return got;
   };
   const once=run(false), twice=run(true);
   return {한번에:once, 나눠서:twice, 같음:once===twice};}));
 L('🛟청산 면제 — 전액 손실 판에서', await p.evaluate(()=>{
   const run=(split)=>{
     S.cash=4000000; setBet(2000000); S.buffs=['liq'];
     window.openAt(1,0.30);           // 3배 청산선(0.67) 아래 — 전액 손실 구간
     if(split){ sellHalf(); }
     sellRound(false);
     const got=S.lastResult.profit; $('mOk').click();
     return got;
   };
   const once=run(false), twice=run(true);
   return {한번에:once, 나눠서:twice, 같음:once===twice,
     '베팅금 30%는 남는다':once===-Math.round(2000000*0.70)};}));
 await p.close();

 console.log('\n=== 5. 숏에서도 맞게 돈다 ===');
 p=await fresh(300);
 await p.evaluate(helper);
 L('0.70x에 절반 · 0.90x에 나머지 (숏)', await p.evaluate(()=>{
   S.cash=4000000; setBet(2000000);
   window.openAt(-1,0.70);
   const bet0=S.activeRound.bet, lev=S.activeRound.leverage;
   sellHalf();
   const h={...S.activeRound.half};
   window.setPrice(0.90);
   sellRound(false);
   const r=S.lastResult, rest=bet0-h.bet;
   return {절반손익:h.profit, 기대:Math.round((bet0/2)*(1-0.70)*lev),
     나머지기대:Math.round(rest*(1-0.90)*lev),
     결과손익:r.profit, dir:r.dir,
     문구:document.querySelector('.rs-sub').textContent.trim()};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
