/* phase18 — A·B단계
   A: 결과 팝업 장 마감 줄 축소 · 완제하면 바로 정산
   B: 거래일 이월 삭제 → 조기 상환 현금 보너스 · 관문 일수 +1

   그 단계에서 바꾼 것만 본다. phase17이 이미 스트립/경고줄/riskAt을 덮고 있다.

   보너스를 잴 때는 2차 관문(→Lv.3 네코프로 해금)을 쓴다. 1차는 레벨 보상이
   "현금 +20만원"이라 현금 증가분에 섞여 들어가서 보너스만 따로 잴 수가 없다. */
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

 console.log('\n=== 3. 조기 상환 보너스 — 이월을 대체한다 ===');
 p=await fresh();
 L('7거래일 남기고 2차 상환', await p.evaluate(()=>{
   S.gate=1; S.level=2; S.cash=S.peakCash=GATES[1].goal; S.daysLeft=7;
   const before=S.cash, want=Math.round(GATES[1].goal*EARLY_BONUS_RATE*7);
   checkLevelUp();
   const gain=$('modalBox').querySelector('.lv-gain.early');
   return {
     보너스줄:gain?gain.textContent.replace(/\s+/g,' ').trim():'(없음)',
     현금증가:S.cash-before, 기대값:want, 일치:S.cash-before===want,
     남은일:S.daysLeft, '3차기본':GATES[2].days,
     이월안됨:S.daysLeft===GATES[2].days,
     버튼:$('mOk').textContent.trim()};}));
 await p.evaluate(()=>$('mOk').click());
 await p.waitForTimeout(120);
 L('닫은 뒤 판이 이어지는지', await p.evaluate(()=>({
   모달열림:$('modal').classList.contains('on'), 레벨:S.level, gate:S.gate})));
 await p.close();

 console.log('\n=== 4. 마지막 날에 겨우 갚으면 보너스 없음 ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   S.gate=1; S.level=2; S.cash=S.peakCash=GATES[1].goal; S.daysLeft=0;
   const before=S.cash;
   checkLevelUp();
   return {현금증가:S.cash-before,
     보너스줄:!!$('modalBox').querySelector('.lv-gain.early'),
     레벨보상줄:!!$('modalBox').querySelector('.lv-gain:not(.early)'),
     남은일:S.daysLeft};}));
 await p.close();

 console.log('\n=== 5. 관문 일수 (이월 삭제 보정으로 전부 +1) ===');
 p=await fresh();
 L('', await p.evaluate(()=>({
   일수표:GATES.map(g=>`${g.n} ${g.days}일`),
   보너스율:EARLY_BONUS_RATE,
   'CARRY_MAX 제거됨':typeof CARRY_MAX==='undefined'})));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
