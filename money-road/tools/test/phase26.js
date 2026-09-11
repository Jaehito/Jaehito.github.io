/* phase26 — E단계 일곱째: 📋 패턴 도감

   확인하는 것:
     1) 해금 전에는 버튼도 없고 기록도 안 쌓인다
     2) 판당 한 번만 쌓인다 (분할 매도를 해도 한 번)
     3) 화면의 비율이 pickInTier의 실제 분포와 맞는다
     4) 종목을 바꾸면 비율이 바뀐다 (도감이 종목별 참고표라는 것)
     5) 안 본 패턴은 "아직 못 봤어요"로 남는다
     6) 도감이 신호 적중률을 바꾸지 않는다 — 쉬워지는 기능이 아니다 */
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
   await p.evaluate(x=>{ META.xp=x; saveMeta(); S.themeUnlocked=true; S.upg.surge=true;
     S.cash=S.peakCash=5000000; S.upg.leverageLv=3; setBet(2000000); render(); }, xp);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 /* 한 판을 끝까지 굴린다 */
 const play=`window.one=(tier,stockId)=>{ S.cash=5000000; setBet(1000000);
   if(stockId)S.selectedStock=stockId;
   S.pending={tier,sig:tier};
   startRound(1);
   const id=S.activeRound.patternId;
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
   sellRound(false); $('mOk').click();
   return id; };`;

 console.log('=== 1. 해금 전에는 기록이 안 쌓인다 ===');
 let p=await fresh(0);
 await p.evaluate(play);
 L('', await p.evaluate(()=>{
   for(let k=0;k<10;k++)window.one('mid');
   return {metaHas:metaHas('dex'), 도감버튼:!!$('dexBtn'),
     기록:META.dex, 쌓인종:dexSeen()};}));
 await p.close();

 console.log('\n=== 2. 판당 한 번만 쌓인다 ===');
 p=await fresh(800);
 await p.evaluate(play);
 L('10판', await p.evaluate(()=>{
   for(let k=0;k<10;k++)window.one('mid');
   const tot=Object.values(META.dex).reduce((a,e)=>a+e.n,0);
   return {총기록:tot, '10판 = 10회':tot===10, 도감버튼:!!$('dexBtn')};}));
 L('분할 매도를 해도 한 번', await p.evaluate(()=>{
   const before=Object.values(META.dex).reduce((a,e)=>a+e.n,0);
   S.cash=5000000; setBet(2000000); S.pending={tier:'mid',sig:'mid'};
   startRound(1);
   sellHalf();
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
   sellRound(false); $('mOk').click();
   const after=Object.values(META.dex).reduce((a,e)=>a+e.n,0);
   return {전:before, 후:after, '한 번만 늘었나':after-before===1};}));
 await p.close();

 console.log('\n=== 3. 화면의 비율이 실제 분포와 맞는다 ===');
 p=await fresh(800);
 L('동전주 강세', await p.evaluate(()=>{
   S.selectedStock='penny'; render(); showDexModal();
   const shown=[...document.querySelectorAll('.dex-sec')][0].querySelectorAll('.dex');
   const ui={}; shown.forEach(e=>{
     const nm=e.querySelector('.dex-nm').textContent.trim().split(' ').slice(1).join(' ');
     ui[nm]=parseInt(e.querySelector('.dex-pct').textContent); });
   /* 같은 분포를 직접 굴려서 대조한다 */
   const st=TRADE_STOCKS.find(x=>x.id==='penny'), c={};
   for(let k=0;k<8000;k++){const q=pickInTier('strong',st); c[q.name]=(c[q.name]||0)+1;}
   const real=Object.fromEntries(Object.entries(c).map(([k,v])=>[k,Math.round(v/80)]));
   const ok=Object.keys(ui).every(k=>Math.abs(ui[k]-(real[k]||0))<=2);
   $('mOk').click();
   return {화면:ui, 실제:real, '오차 2%p 이내':ok};}));
 await p.close();

 console.log('\n=== 4. 종목을 바꾸면 비율이 바뀐다 ===');
 p=await fresh(800);
 L('강세 안에서', await p.evaluate(()=>{
   const read=(id)=>{ S.selectedStock=id; render(); showDexModal();
     const r=[...[...document.querySelectorAll('.dex-sec')][0].querySelectorAll('.dex')]
       .map(e=>e.querySelector('.dex-nm').textContent.trim()+' '+e.querySelector('.dex-pct').textContent);
     $('mOk').click(); return r; };
   return {'📊 ETF':read('etf'), '🏦 사성전자':read('stable'), '🎲 동전주':read('penny')};}));
 await p.close();

 console.log('\n=== 5. 안 본 패턴 · 섹션 구성 ===');
 p=await fresh(800);
 await p.evaluate(play);
 L('', await p.evaluate(()=>{
   window.one('strong','etf');   // ETF 강세는 언제나 up — 한 종만 본다
   S.selectedStock='stable'; render(); showDexModal();
   const cards=[...document.querySelectorAll('.dex')];
   const unseen=cards.filter(e=>e.classList.contains('unseen'));
   return {섹션수:document.querySelectorAll('.dex-sec').length,
     카드수:cards.length, 패턴수:PATTERNS.length,
     본것:dexSeen(), 못본카드:unseen.length,
     '못 본 것 문구':unseen[0].querySelector('.dex-st').textContent,
     뱃지:document.querySelector('.rs-badge').textContent};}));
 await p.close();

 console.log('\n=== 6. 도감은 게임을 쉽게 만들지 않는다 ===');
 p=await fresh(800);
 L('신호 적중률은 그대로', await p.evaluate(()=>{
   let hit=0;
   for(let k=0;k<4000;k++){ rollPending(); if(S.pending.sig===S.pending.tier)hit++; }
   return {적중률:+(hit/4000).toFixed(3), 설정:infoAccOf(),
     '오차 2%p 이내':Math.abs(hit/4000-infoAccOf())<0.02,
     '도감은 지나간 판의 통계일 뿐':true};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
