/* phase18 — A단계: 결과 팝업 장 마감 줄 축소 · 완제하면 바로 정산
   그 단계에서 바꾼 것만 본다. phase17이 이미 스트립/경고줄/riskAt을 덮고 있으므로
   여기서는 (1) 장 마감 줄에서 뺀 정보가 정말 빠졌는지, (2) 완제 버튼이 레거시 화면으로
   넘어가면서 포인트를 100% 주는지만 확인한다. */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 장 마감 줄 — 네 가지 상태 전부 한 줄 ===');
 let p=await fresh();
 L('', await p.evaluate(()=>{
   const cases=[
     ['평상시',   ()=>{S.cash=100000;S.peakCash=100000;S.daysLeft=12;}],
     ['주의',     ()=>{S.cash=100000;S.peakCash=100000;S.daysLeft=5;}],
     ['위험',     ()=>{S.cash=120000;S.peakCash=120000;S.daysLeft=3;}],
     ['기한만료', ()=>{S.cash=120000;S.peakCash=120000;S.daysLeft=1;}],
     ['상환가능', ()=>{S.cash=600000;S.peakCash=600000;S.daysLeft=6;}],
   ];
   return cases.map(([name,set])=>{
     set();
     const d=document.createElement('div'); d.innerHTML=closeRowHTML();
     const box=d.firstElementChild;
     const txt=box.textContent.replace(/\s+/g,' ').trim();
     return {상태:name, 색:box.className.replace('rs-close ',''), 문구:txt,
       줄수:box.querySelectorAll(':scope > div').length,
       날짜없음:!/월 \d+일/.test(txt), 필요수익률없음:!txt.includes('필요'),
       남은금액없음:!txt.includes('까지')};
   });}));
 await p.close();

 console.log('\n=== 2. 완제 → 버튼 하나로 정산 + 레거시 화면 ===');
 p=await fresh();
 L('완제 직전 상태', await p.evaluate(()=>{
   /* 마지막 관문만 남기고 목표를 채워 둔 뒤 한 판 끝내면 checkLevelUp이 완제로 넘긴다 */
   S.gate=GATES.length-1; S.level=7;
   S.cash=S.peakCash=GATES[GATES.length-1].goal;
   S.daysLeft=5;
   return {gate:S.gate, gateDoneYet:gateDone(), 포인트:META.legacyPoints||0};}));

 L('완제 모달', await p.evaluate(()=>{
   checkLevelUp();
   const box=$('modalBox');
   return {제목:box.querySelector('.tt').textContent,
     버튼:$('mOk').textContent.trim(),
     본문:box.querySelector('.dc').textContent.replace(/\s+/g,' ').trim(),
     정산표:[...box.querySelectorAll('.stat-grid .s')].map(s=>
       s.querySelector('.k').textContent+' '+s.querySelector('.v').textContent),
     gateDone:gateDone()};}));

 const expect = await p.evaluate(()=>legacyGain(S.peakCash));
 await p.evaluate(()=>$('mOk').click());
 await p.waitForTimeout(150);
 L('버튼 누른 뒤', await p.evaluate(()=>({
   화면:$('modalBox').querySelector('.tt').textContent,
   레거시목록:!!$('lgList'),
   포인트:META.legacyPoints||0,
   pendingLegacy:META.pendingLegacy})));
 console.log('기대 포인트(은퇴와 동일한 100%)', expect);
 await p.close();

 console.log('\n=== 3. 중간 관문은 그대로 (회귀 확인) ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   S.gate=0; S.level=1; S.cash=S.peakCash=GATES[0].goal; S.daysLeft=7;
   checkLevelUp();
   return {제목:$('modalBox').querySelector('.tt').textContent,
     버튼:$('mOk').textContent.trim(),
     이월문구:$('modalBox').querySelector('.dc').textContent.replace(/\s+/g,' ').trim(),
     gate:S.gate, daysLeft:S.daysLeft};}));
 await p.evaluate(()=>$('mOk').click());
 await p.waitForTimeout(120);
 L('닫은 뒤 판이 이어지는지', await p.evaluate(()=>({
   모달열림:$('modal').classList.contains('on'),
   레벨:S.level, gate:S.gate})));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
