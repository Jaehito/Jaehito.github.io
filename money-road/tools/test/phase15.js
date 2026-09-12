const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   /* phase17에서 첫 진입 안내 모달이 생겼다 — 열려 있으면 클릭을 다 막으므로 먼저 닫는다 */
   await p.evaluate(()=>{if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click();});
   await p.waitForTimeout(80); return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v));

 console.log('=== A안: 블록 축소 ===');
 let p=await fresh();
 L('', await p.evaluate(()=>{
   /* 자동 익절은 C단계에서 판 안 업그레이드 → 메타 해금으로 옮겨갔다(phase19). 여기서는
      화면 배치만 보므로 XP를 채워서 켠다. */
   META.xp=999; saveMeta();
   S.level=6;S.peakCash=1.2e9;S.cash=320000000;S.upg.leverageLv=3;
   S.themeUnlocked=true;S.buffs=['info'];setBet(32000000);render();
   return {히어로:!!document.querySelector('.hero'), 지갑줄:!!document.querySelector('.wallet'),
     레벨힌트:!!document.getElementById('lvHint'), 패널제목:!!document.querySelector('.tp-title'),
     청산경고줄:!!document.querySelector('.liq-note'), 하단안내문:!!document.querySelector('.trade-note'),
     콘텐츠바닥:Math.round(document.querySelector('.trade-panel').getBoundingClientRect().bottom)};
 }));

 console.log('\n=== 잔고가 상단바에 · 스크롤해도 따라오는가 ===');
 L('', await p.evaluate(()=>({
   상단바잔고:$('cashView').textContent,
   상단바sticky:getComputedStyle(document.querySelector('.topbar')).position,
   남은금액칩:document.querySelector('.opt.need').textContent.replace(/\s+/g,' ').trim(),
 })));

 console.log('\n=== 레버리지: 청산선이 버튼 안으로 ===');
 L('', await p.evaluate(()=>({
   버튼:[...document.querySelectorAll('.lev-row button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()),
   헤드:$('tpLimit').textContent,
 })));

 /* 자동 익절은 삭제했다(게임이 시키는 유일한 행동을 대신해 줬다). 그 자리는
    방향 토글과 "목표까지 남은 금액"이 쓴다. */
 console.log('\n=== 옵션 줄 — 방향 토글과 남은 금액 ===');
 L('공매도 해금 전', await p.evaluate(()=>({
   자동익절:!!$('autoToggle'), 방향토글:!!$('dirToggle'),
   줄:document.querySelector('.opt-row').textContent.replace(/\s+/g,' ').trim()})));
 L('해금하면', await p.evaluate(()=>{ META.xp=200; saveMeta(); renderTrade();
   return {방향토글:$('dirToggle').textContent.replace(/\s+/g,' ').trim(),
     시작버튼:$('tradeGo').textContent.trim(), betDir:S.betDir};}));
 L('하락으로', await p.evaluate(()=>{
   $('dirToggle').querySelector('[data-d="-1"]').click();
   return {betDir:S.betDir, 시작버튼:$('tradeGo').textContent.trim()};}));

 console.log('\n=== 티켓: 스트립에서 빠지고 시작 버튼 위 한 줄로 ===');
 L('1개', await p.evaluate(()=>{S.buffs=['info'];render();
   return {스트립에티켓:$('strip').textContent.includes('정보 확신'),
     하단줄:document.querySelector('.buff-line')?document.querySelector('.buff-line').textContent.replace(/\s+/g,' ').trim():null,
     줄수:document.querySelectorAll('.buff-line').length};}));
 L('3개', await p.evaluate(()=>{S.buffs=['info','liq','boost'];renderTrade();
   return {하단줄:document.querySelector('.buff-line').textContent.replace(/\s+/g,' ').trim(),
     줄수:document.querySelectorAll('.buff-line').length};}));
 L('0개', await p.evaluate(()=>{S.buffs=[];renderTrade();
   return {줄수:document.querySelectorAll('.buff-line').length};}));

 console.log('\n=== 잠긴 종목 축소 ===');
 L('', await p.evaluate(()=>{S.themeUnlocked=false;S.upg.surge=false;render();
   return [...document.querySelectorAll('.stock-tab')].map(e=>
     ({텍스트:e.textContent.replace(/\s+/g,' ').trim(), 폭:Math.round(e.getBoundingClientRect().width)}));}));

 console.log('\n=== 하단 안내문은 첫 3판만 ===');
 L('', await p.evaluate(()=>{
   S.today.rounds=0; renderTrade(); const a=!!document.querySelector('.trade-note');
   S.today.rounds=5; renderTrade(); const b=!!document.querySelector('.trade-note');
   return {'0판':a, '5판':b};}));
 await p.close();

 console.log('\n=== errors ==='); console.log(errs.length?errs:'none');
 await b.close();
})();
