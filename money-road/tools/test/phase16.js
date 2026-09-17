const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300); return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v));
 // 라운드를 즉시 끝내고 결과 모달까지 닫는 헬퍼를 페이지에 심는다
 const helper=`window.playRound=async(mult)=>{ setBet(Math.max(MIN_BET,Math.floor(S.cash*0.5)));
   startRound(); S.activeRound.path=S.activeRound.path.map(()=>mult);
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
   await new Promise(r=>setTimeout(r,140));
   if($('mOk'))$('mOk').click(); await new Promise(r=>setTimeout(r,80)); };`;

 console.log('=== 1. 배당주 삭제 ===');
 let p=await fresh();
 /* 상점(SHOP_IDS)도 사라졌다 — 정보력·손절 보험이 차수 배정 카드로 들어갔다.
    「돈이 모이면 산다」는 선택이 아니었다(둘뿐이고 사실상 자동이었다). */
 L('', await p.evaluate(()=>({
   'SHOP_IDS 없음':typeof window.SHOP_IDS==='undefined',
   '상점 목록 없음':!document.getElementById('shopList'),
   배당함수:typeof window.payDividend,
   차수배정:GRANTS.map(g=>g.id),
   /* 레거시 트리는 C단계에서 삭제됐다(phase19). 메타 해금 목록이 그 자리다. */
   메타해금:META_UNLOCKS.map(x=>x.name)})));
 await p.close();

 console.log('\n=== 2. 상환 스트립 ===');
 p=await fresh();
 L('', await p.evaluate(()=>({
   스트립:$('repayStrip').textContent.replace(/\s+/g,' ').trim(),
   gate:S.gate, daysLeft:S.daysLeft, goal:fmtMoney(gateOf().goal), 날짜:dateOfDay(0)})));
 L('거래일 진행', await p.evaluate(()=>[0,1,4,5,6,10].map(n=>`${n}일차: ${dateOfDay(n)}`)));
 await p.close();

 console.log('\n=== 3. 라운드마다 하루가 간다 ===');
 p=await fresh();
 await p.evaluate(helper);
 L('', await p.evaluate(async()=>{
   const out=[];
   for(let i=0;i<3;i++){ await window.playRound(1.05);
     out.push({일차:S.dayCount, 남은일:S.daysLeft, 현금:fmtMoney(S.cash)}); }
   return out;
 }));
 await p.close();

 /* 이월은 B단계에서 삭제됐다(phase18이 대체 보상을 본다). 여기서는 상환이 성공하면
    다음 관문이 GATES에 적힌 일수 그대로 시작하는지만 확인한다. */
 console.log('\n=== 4. 상환 성공 → 다음 관문은 정해진 일수로 새로 시작 ===');
 p=await fresh();
 await p.evaluate(helper);
 L('', await p.evaluate(async()=>{
   S.cash=400000; S.peakCash=400000;
   await window.playRound(2.0);                 // 50만 돌파
   const modal=$('modalBox')?$('modalBox').textContent.replace(/\s+/g,' ').trim():'';
   return {모달:modal.slice(0,80), gate:S.gate, level:S.level, daysLeft:S.daysLeft,
     이월없음:`2차 기본 ${GATES[1].days}일 === 남은 ${S.daysLeft}일`};
 }));
 await p.close();

 console.log('\n=== 5. 기한 초과 → 반대매매 ===');
 p=await fresh();
 await p.evaluate(helper);
 L('', await p.evaluate(async()=>{
   S.daysLeft=1; S.cash=100000; S.peakCash=100000;
   setBet(MIN_BET); startRound();
   S.activeRound.path=S.activeRound.path.map(()=>0.9);
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
   await new Promise(r=>setTimeout(r,140));
   $('mOk').click(); await new Promise(r=>setTimeout(r,120));
   return {모달:$('modalBox').textContent.replace(/\s+/g,' ').trim().slice(0,70),
     열림:$('modal').classList.contains('on'), daysLeft:S.daysLeft};
 }));
 await p.close();

 console.log('\n=== 6. 기한 연장 (D-3 이하에서만 노출) ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   S.daysLeft=8; render(); const a=!!$('extendBtn');
   S.daysLeft=3; S.cash=1000000; render();
   const before=S.cash, days=S.daysLeft;
   $('extendBtn').click();
   return {'D-8에 버튼':a, 'D-3에 버튼':true, 지불:fmtMoney(before-S.cash), 연장후:S.daysLeft, 이전:days};
 }));
 await p.close();

 /* 7. 댓글 — 삭제됐다. 체결 통지는 회사가 발행한 문서라 커뮤니티 목소리가
    붙을 자리가 아니었다. 리스크 관리팀 논평은 phase31 10절이 본다. */
 console.log('\n=== 8. 파산은 그대로 ===');
 p=await fresh();
 await p.evaluate(()=>{if($('modal').classList.contains('on'))$('mOk').click();});  // 첫 진입 안내 닫기
 L('', await p.evaluate(()=>{S.cash=5000;S.peakCash=270000;
   const r=checkBankrupt();
   return {파산모달:r, 문구:$('modalBox').textContent.replace(/\s+/g,' ').trim().slice(0,40)};}));
 await p.close();

 console.log('\n=== errors ==='); console.log(errs.length?errs:'none');
 await b.close();
})();
