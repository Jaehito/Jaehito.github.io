const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300); return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 const helper=`window.playRound=async(mult)=>{ setBet(Math.max(MIN_BET,Math.floor(S.cash*0.5)));
   startRound(); S.activeRound.path=S.activeRound.path.map(()=>mult);
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
   await new Promise(r=>setTimeout(r,140)); };`;

 console.log('=== 1. 첫 진입 안내 모달 (최초 1회) ===');
 let p=await fresh();
 L('모달', await p.evaluate(()=>({on:$('modal').classList.contains('on'),
   본문:$('modalBox').textContent.replace(/\s+/g,' ').trim(), seenIntro:META.seenIntro})));
 await p.evaluate(()=>$('mOk').click());
 await p.reload(); await p.waitForTimeout(300);
 L('재방문시', await p.evaluate(()=>({on:$('modal').classList.contains('on'), seenIntro:META.seenIntro})));
 await p.close();

 console.log('\n=== 2. 스트립 — 필요 수익률 + 경고 단계 ===');
 p=await fresh();
 await p.evaluate(()=>{$('mOk').click();});
 L('', await p.evaluate(()=>{
   const out=[];
   const cases=[[100000,12],[100000,8],[250000,8],[100000,5],[150000,3],[200000,1],[480000,4]];
   for(const [cash,d] of cases){ S.cash=cash; S.daysLeft=d; renderLevel();
     const dd=document.querySelector('#repayStrip .dday');
     out.push({현금:fmtWon(cash), D:d, 표시:dd.textContent.trim(), 색:dd.className,
       하단:document.querySelector('#repayStrip .repay-sub').textContent.replace(/\s+/g,' ').trim()}); }
   return out;}));
 await p.close();

 console.log('\n=== 3. riskAt 수치 검증 ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   const chk=(cash,d)=>{const r=riskAt(cash,d);
     const manual=Math.pow(gateOf().goal/cash,1/d)-1;
     return {cash,d,txt:r.txt,cls:r.cls,수식일치:Math.abs(r.need-manual)<1e-9};};
   return [chk(100000,12),chk(100000,3),chk(400000,6),chk(50000,2)];}));
 await p.close();

 console.log('\n=== 4. 결과 팝업 장 마감 줄 ===');
 p=await fresh();
 await p.evaluate(()=>$('mOk').click());
 await p.evaluate(helper);
 L('평상시(D-12→11)', await p.evaluate(async()=>{ await window.playRound(1.10);
   return $('modalBox').querySelector('.rs-close').textContent.replace(/\s+/g,' ').trim();}));
 await p.evaluate(()=>$('mOk').click());
 await p.waitForTimeout(100);
 L('일수/현금 확인', await p.evaluate(()=>({dayCount:S.dayCount,daysLeft:S.daysLeft})));
 L('위험(D-3→2)', await p.evaluate(async()=>{ S.daysLeft=3; S.cash=120000;
   await window.playRound(0.9);
   const e=$('modalBox').querySelector('.rs-close');
   return {cls:e.className, txt:e.textContent.replace(/\s+/g,' ').trim()};}));
 await p.evaluate(()=>$('mOk').click()); await p.waitForTimeout(100);
 L('마지막날(D-1→만료)', await p.evaluate(async()=>{ S.daysLeft=1; S.cash=120000; S.peakCash=120000;
   await window.playRound(0.9);
   const e=$('modalBox').querySelector('.rs-close');
   return {cls:e.className, txt:e.textContent.replace(/\s+/g,' ').trim()};}));
 await p.close();

 console.log('\n=== 5. 상환 가능 상태 ===');
 p=await fresh();
 await p.evaluate(()=>$('mOk').click());
 await p.evaluate(helper);
 L('', await p.evaluate(async()=>{ S.cash=600000; S.peakCash=600000; S.daysLeft=6;
   await window.playRound(1.02);
   const e=$('modalBox').querySelector('.rs-close');
   return {cls:e.className, txt:e.textContent.replace(/\s+/g,' ').trim()};}));
 await p.close();

 console.log('\n=== 6. 시작 버튼 페이스 경고 ===');
 p=await fresh();
 await p.evaluate(()=>$('mOk').click());
 L('', await p.evaluate(()=>{
   const out=[];
   for(const [cash,d] of [[100000,12],[100000,5],[120000,3],[120000,1]]){
     S.cash=cash; S.daysLeft=d; setBet(Math.floor(cash*0.5)); renderTrade();
     const pl=document.querySelector('.pace-line');
     out.push({현금:fmtWon(cash),D:d, 경고줄:pl?pl.textContent.replace(/\s+/g,' ').trim():'(없음)',
       색:pl?pl.className:'-', 버튼:$('tradeGo').className});}
   return out;}));
 await p.close();

 console.log('\n=== 7. 완제 후 안전성 ===');
 p=await fresh();
 await p.evaluate(()=>$('mOk').click());
 L('', await p.evaluate(()=>{ S.gate=GATES.length; S.level=8; render();
   return {gateDone:gateDone(), 스트립:$('repayStrip').textContent.replace(/\s+/g,' ').trim(),
     closeRow:closeRowHTML(), 경고줄:!!document.querySelector('.pace-line')};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
