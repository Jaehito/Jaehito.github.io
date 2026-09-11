/* phase23 — E단계 셋째: 💧 물타기

   진입가가 움직이는 첫 기능이라 손익·청산선·자동 익절의 기준이 전부 평단으로 바뀐다.
     1) 해금 전에는 줄이 아예 없다
     2) 평단 = 총투입 ÷ 총수량 (금액 B를 가격 p에 사면 수량은 B/p)
     3) 청산선이 평단을 따라 움직인다
     4) 손실 중일 때만 · 판당 1회 · 현금이 있어야
     5) 손익이 평단 기준
     6) 숏은 대칭 (평단 위일 때만, 청산선은 올라간다)
     7) 물타기 + 분할 매도를 같이 써도 맞는가 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(xp,cash){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   await p.evaluate(([x,c])=>{ META.xp=x; saveMeta();
     S.cash=S.peakCash=c; S.upg.leverageLv=3; setBet(2000000); renderTrade(); }, [xp,cash]);
   await p.evaluate(`window.openAt=(dir,mult)=>{ startRound(dir);
     S.activeRound.path=S.activeRound.path.map(()=>mult);
     S.activeRound.startedAt=Date.now()-10*ROUND_TICK_MS; renderRoundView(); };
   window.setPrice=(mult)=>{ S.activeRound.path=S.activeRound.path.map(()=>mult); renderRoundView(); };`);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 해금 전에는 줄이 없다 ===');
 let p=await fresh(0,5000000);
 L('', await p.evaluate(()=>{ window.openAt(1,0.80);
   return {metaHas:metaHas('water'), 줄숨김:$('rvWater').hidden,
     canWater:canWater(S.activeRound), 평단:S.activeRound.entry};}));
 L('addWater()를 직접 불러도 안 된다', await p.evaluate(()=>{
   const b0=S.activeRound.bet; addWater();
   return {투입:S.activeRound.bet, 그대로:S.activeRound.bet===b0, 평단:S.activeRound.entry};}));
 await p.close();

 console.log('\n=== 2. 평단 = 총투입 ÷ 총수량 ===');
 p=await fresh(400,5000000);
 L('200만을 1.00x에 · 100만을 0.80x에', await p.evaluate(()=>{
   window.openAt(1,0.80);
   const b0=S.activeRound.bet, cash0=S.cash;
   const add=waterAmountOf(S.activeRound);
   addWater();
   const R=S.activeRound;
   const q=(b0/1.0)+(add/0.80);              // 총수량
   const want=(b0+add)/q;
   return {최초베팅:fmtWon(b0), 추가:fmtWon(add), 총투입:fmtWon(R.bet),
     평단:+R.entry.toFixed(6), 기대평단:+want.toFixed(6), 일치:Math.abs(R.entry-want)<1e-9,
     현금차감:cash0-S.cash, '차감=추가액':cash0-S.cash===add};}));
 L('청산선이 평단을 따라 내려간다', await p.evaluate(()=>({
   물타기전:liqMultOf(3,1,1).toFixed(4),
   물타기후:liqMultOf(3,1,S.activeRound.entry).toFixed(4),
   '평단×(1−1/3)':+(S.activeRound.entry*(2/3)).toFixed(4)})));
 L('판당 1회', await p.evaluate(()=>{
   const e=S.activeRound.entry, b=S.activeRound.bet;
   window.setPrice(0.60); addWater();
   return {평단그대로:S.activeRound.entry===e, 투입그대로:S.activeRound.bet===b,
     줄숨김:$('rvWater').hidden};}));
 await p.close();

 console.log('\n=== 3. 손실 중일 때만 ===');
 p=await fresh(400,5000000);
 L('', await p.evaluate(()=>{
   const out=[];
   for(const [dir,m,note] of [[1,1.20,'롱 · 평단 위(이익)'],[1,0.90,'롱 · 평단 아래(손실)'],
                              [-1,0.80,'숏 · 평단 아래(이익)'],[-1,1.20,'숏 · 평단 위(손실)']]){
     /* startRound가 현금에서 베팅금을 빼므로 케이스마다 되돌려 놓는다 */
     S.activeRound=null; S.cash=5000000; setBet(2000000);
     window.openAt(dir,m);
     out.push({상황:note, canWater:canWater(S.activeRound),
       안내:$('rvWaterNote').textContent, 흐림:$('rvWater').classList.contains('off')});
     S.activeRound=null;
   }
   return out;}));
 await p.close();

 console.log('\n=== 4. 현금이 모자라면 못 한다 ===');
 p=await fresh(400,2100000);
 L('베팅 200만 · 남은 현금 10만 (추가는 100만 필요)', await p.evaluate(()=>{
   window.openAt(1,0.80);
   return {남은현금:fmtWon(S.cash), 필요:fmtWon(waterAmountOf(S.activeRound)),
     canWater:canWater(S.activeRound), 안내:$('rvWaterNote').textContent};}));
 await p.close();

 console.log('\n=== 5. 손익과 자동 익절이 평단 기준 ===');
 p=await fresh(400,5000000);
 L('0.80x에 물타고 1.15x에 매도', await p.evaluate(()=>{
   window.openAt(1,0.80);
   addWater();
   const R=S.activeRound, e=R.entry, B=R.bet, lev=R.leverage;
   window.setPrice(1.15);
   sellRound(false);
   const r=S.lastResult;
   const want=Math.round(B*(1.15/e-1)*lev);
   return {평단:+e.toFixed(4), 총투입:fmtWon(B), 손익:r.profit, 기대:want,
     일치:Math.abs(r.profit-want)<2,
     '물타기 안 했으면':Math.round(2000000*(1.15-1)*lev),
     칩:[...document.querySelectorAll('.rs-chip')].map(x=>x.textContent.trim())};}));
 L('자동 익절 1.5x는 평단×1.5에서 걸린다', await p.evaluate(()=>{
   $('mOk').click();
   S.cash=5000000; setBet(2000000); S.betAutoTarget=1.5;
   window.openAt(1,0.80); addWater();
   const e=S.activeRound.entry;
   return {평단:+e.toFixed(4), 목표배율:S.activeRound.autoTarget,
     '발동 가격':+(e*1.5).toFixed(4),
     '1.30x에 발동?':1.30/e>=1.5, '1.40x에 발동?':1.40/e>=1.5};}));
 await p.close();

 console.log('\n=== 6. 숏은 대칭 ===');
 p=await fresh(400,5000000);
 L('1.20x에 물타기 (숏)', await p.evaluate(()=>{
   window.openAt(-1,1.20);
   const b0=S.activeRound.bet, add=waterAmountOf(S.activeRound);
   addWater();
   const R=S.activeRound;
   const want=(b0+add)/((b0/1.0)+(add/1.20));
   return {평단:+R.entry.toFixed(6), 기대:+want.toFixed(6), 일치:Math.abs(R.entry-want)<1e-9,
     '평단이 올라간다':R.entry>1,
     청산선전:liqMultOf(3,-1,1).toFixed(4), 청산선후:liqMultOf(3,-1,R.entry).toFixed(4),
     '청산선이 올라간다':liqMultOf(3,-1,R.entry)>liqMultOf(3,-1,1)};}));
 await p.close();

 console.log('\n=== 7. 물타기 + 분할 매도 ===');
 p=await fresh(400,5000000);
 L('0.80x에 물타고 · 1.10x에 절반 · 1.20x에 나머지', await p.evaluate(()=>{
   window.openAt(1,0.80);
   addWater();
   const e=S.activeRound.entry, B=S.activeRound.bet, lev=S.activeRound.leverage;
   window.setPrice(1.10);
   sellHalf();
   const h={...S.activeRound.half}, rest=S.activeRound.bet;
   window.setPrice(1.20);
   sellRound(false);
   const r=S.lastResult;
   const wantHalf=Math.round(h.bet*(1.10/e-1)*lev);
   const wantRest=Math.round(rest*(1.20/e-1)*lev);
   return {평단:+e.toFixed(4), 총투입:fmtWon(B), '절반+나머지=총투입':h.bet+rest===B,
     절반손익:h.profit, 절반기대:wantHalf,
     나머지기대:wantRest, 결과손익:r.profit, 합계기대:wantHalf+wantRest,
     일치:Math.abs(r.profit-(wantHalf+wantRest))<2,
     칩:[...document.querySelectorAll('.rs-chip')].map(x=>x.textContent.trim())};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
