/* phase30 — 🛠 테스트 도구 (다섯 탭 · 탭별 되돌리기 · 템플릿)

   정상 플레이에 절대 새지 않아야 하는 기능이라, 여는 조건부터 본다:
     1) 평소 화면에 흔적이 없다
     2) 한 번 누르거나 느긋하게 두 번 눌러서는 안 열린다
     3) 빠른 2연타로 열리고, 다섯 탭이 다 있다
     4~8) 탭마다 실제로 게임 값을 움직이는가
     9) ↺ 이 탭 기본값이 그 탭만 되돌리는가 — 다른 탭에서 맞춘 값을 지우면
        "몇 시간 맞춘 걸 한 번에 날리는 버튼"이 된다
    10) ▶ 재시작이 판만 새로 열고 경험치는 남기는가
    11) 템플릿 JSON이 왕복하는가 — 이게 이 도구를 만든 이유다
    12) 슬롯이 저장·복원되고 전부 초기화에도 살아남는가
    13) 라운드 중에는 안 열린다 (15초짜리 판 위에 모달이 뜨면 그 판을 잃는다)
    14) 초기화가 진짜로 지우는가 — reload가 pagehide→saveRun을 부르므로 잠그지
        않으면 방금 지운 판이 되살아난다. 옛 meta_v4에서 XP가 되돌아오지도 않아야 한다. */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b=await launch(); const errs=[];
 const p=await b.newPage({viewport:{width:390,height:820}});
 p.on('pageerror',e=>errs.push('EXC: '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
 p.on('dialog',d=>d.accept('테스트안'));          // 슬롯 이름 prompt
 await p.goto(url); await p.waitForTimeout(150);
 await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(350);
 await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 /* 열기 전에 화면을 원점으로 — 앞 검사가 템플릿 화면이나 다른 모달을 띄운 채 끝나면
    로고를 눌러도 안 열린다(라운드 중·모달 중에는 안 열리는 게 정상 동작이라서). */
 const open=async()=>{
   await p.evaluate(()=>{ DEV.tpl=false; DEV.tplEdit=false; $('modal').classList.remove('on'); });
   await p.evaluate(()=>{ $('brandTap').click(); $('brandTap').click(); });
   await p.waitForTimeout(350); };
 const tab=async(id)=>{ await p.evaluate(t=>document.querySelector(`[data-tab="${t}"]`).click(),id);
   await p.waitForTimeout(250); };

 L('1. 평소엔 흔적 없음', await p.evaluate(()=>({
   /* body.textContent는 <script> 본문까지 센다 — 화면에 그려진 것만 본다 */
   도구흔적:!!document.querySelector('.dv-title,.dv-btn,.dv-tab'),
   모달열림:$('modal').classList.contains('on'),
   로고:$('brandTap').textContent})));

 L('2. 한 번으로는 안 열림', await p.evaluate(()=>{
   $('brandTap').click();
   return {모달:$('modal').classList.contains('on')};}));
 await p.waitForTimeout(1700);   /* 앞 연타의 창을 비운다 */
 L('3. 느리게 두 번도 안 열림', await p.evaluate(async()=>{
   $('brandTap').click(); await new Promise(r=>setTimeout(r,1700)); $('brandTap').click();
   return {모달:$('modal').classList.contains('on')};}));
 await p.waitForTimeout(1700);

 await open();
 L('4. 빠른 2연타 → 열림', await p.evaluate(()=>({
   모달:$('modal').classList.contains('on'),
   제목:document.querySelector('.dv-title').textContent.trim(),
   상태:document.querySelector('.dv-state').textContent.trim(),
   탭:[...document.querySelectorAll('.dv-tab')].map(t=>t.textContent.replace(/\s/g,'')),
   첫탭:document.querySelector('.dv-tab.on').textContent.replace(/\s/g,''),
   바닥:[...document.querySelectorAll('.dv-foot .dv-btn')].map(x=>x.textContent.trim())})));

 console.log('\n=== 📊 패턴 탭 ===');
 L('5. 열 종이 확률과 함께 보인다', await p.evaluate(()=>({
   행수:document.querySelectorAll('.pat-row').length,
   그린경로:document.querySelectorAll('.pat-row')[0].querySelectorAll('polyline').length,
   요약:[...document.querySelectorAll('.dv-mix span')].map(s=>s.textContent),
   확률합:+[...document.querySelectorAll('.pat-prob')]
     .reduce((a,x)=>a+parseFloat(x.textContent),0).toFixed(1)})));
 L('6. 행을 누르면 다음 판이 고정된다', await p.evaluate(()=>{
   document.querySelector('[data-patrow="down"]').click();
   const st=TRADE_STOCKS.find(s=>s.id==='stable');
   const ids=[]; for(let k=0;k<10;k++) ids.push(genRound(st,'strong').patternId);
   const forced=!!document.querySelector('.pat-row.forced');
   document.querySelector('[data-patrow="down"]').click();      // 다시 누르면 해제
   return {DEV:DEV.pat, 뽑힌패턴:[...new Set(ids)], 파란테두리:forced};}));
 L('7. 가중치 ±가 확률을 움직인다', await p.evaluate(()=>{
   const before=document.querySelector('.pat-row .pat-prob').textContent;
   for(let i=0;i<3;i++)document.querySelector('[data-w="up"][data-d="0.02"]').click();
   return {'up 가중':DEV.w.up, 확률전:before,
     확률후:document.querySelector('.pat-row .pat-prob').textContent};}));

 console.log('\n=== 🧬 메타 · 🎬 시작 · 💸 파산 · ⚖️ 밸런스 ===');
 await tab('meta');
 L('8. XP 칩이 그 해금까지 채운다', await p.evaluate(()=>{
   document.querySelector('[data-xp="900"]').click();
   return {xp:META.xp, 해금:META_UNLOCKS.filter(u=>metaHas(u.id)).map(u=>u.emo).join('')};}));
 await p.waitForTimeout(200);
 L('9. 난이도 4단계', await p.evaluate(()=>{
   document.querySelector('[data-tier="3"]').click();
   return {tier:S.tier, 이름:tierOf().n, 기한:S.daysLeft};}));
 await p.waitForTimeout(200); await tab('start');
 L('10. 시작 현금 · 레버리지 · 거래일', await p.evaluate(()=>{
   document.querySelector('[data-scash="1000000"]').click();
   const cash=START_CASH;
   document.querySelector('[data-minlev="1"]').click();
   return {시작현금:cash, 최소레버리지:MIN_LEVERAGE};}));
 await p.waitForTimeout(250);
 L('10-b. 거래일 −3', await p.evaluate(()=>{
   const before=GATE_DAYS.slice();
   document.querySelector('[data-gdays="-3"]').click();
   return {전:before, 후:GATE_DAYS, 지금기한:S.daysLeft};}));
 await p.waitForTimeout(250); await tab('broke');
 L('11. 즉시 파산이 파산 화면을 띄운다', await (async()=>{
   await p.evaluate(()=>document.querySelector('[data-broke="now"]').click());
   await p.waitForTimeout(350);
   const r=await p.evaluate(()=>({현금:S.cash,
     화면:(document.querySelector('.modal .tt')||{}).textContent}));
   await p.evaluate(()=>{ S.cash=1000000; setBet(MIN_BET); saveRun();
     $('modal').classList.remove('on'); render(); });
   return r;
 })());
 await open(); await tab('bal');
 L('12. 밸런스 네 손잡이', await p.evaluate(()=>{
   const a={MID:MID_DIP, DIP, acc:infoAccOf(), bonus:EARLY_BONUS_RATE};
   document.querySelector('[data-mid="-0.1"]').click();
   document.querySelector('[data-dip="0.02"]').click();
   document.querySelector('[data-acc="2"]').click();
   return {전:a};}));
 await p.waitForTimeout(250); await tab('bal');
 L('12-b. 보너스까지', await p.evaluate(()=>{
   document.querySelector('[data-bonus="0.05"]').click();
   return {MID:MID_DIP, DIP:+DIP.toFixed(2), 적중률:infoAccOf(), 보너스:EARLY_BONUS_RATE};}));

 console.log('\n=== ↺ 탭별 되돌리기 ===');
 await p.waitForTimeout(250);
 L('13. 밸런스 탭 ↺ — 밸런스만 돌아오고 패턴 가중치는 그대로', await (async()=>{
   const before=await p.evaluate(()=>({패턴가중:DEV.w&&DEV.w.up, 시작현금:START_CASH, MID:MID_DIP}));
   await p.evaluate(()=>document.querySelector('[data-tabreset]').click());
   await p.waitForTimeout(300);
   const after=await p.evaluate(()=>({패턴가중:DEV.w&&DEV.w.up, 시작현금:START_CASH,
     MID:MID_DIP, DIP:+DIP.toFixed(2), 적중률:infoAccOf(), 보너스:EARLY_BONUS_RATE}));
   return {전:before, 후:after, '패턴 안 건드림':before.패턴가중===after.패턴가중,
     '시작 안 건드림':before.시작현금===after.시작현금};
 })());
 await tab('pat');
 L('14. 패턴 탭 ↺ — 가중치만 돌아온다', await (async()=>{
   await p.evaluate(()=>document.querySelector('[data-tabreset]').click());
   await p.waitForTimeout(300);
   return await p.evaluate(()=>({가중치:DEV.w, 강제:DEV.pat, 시작현금:START_CASH,
     최소레버리지:MIN_LEVERAGE, xp:META.xp}));
 })());

 console.log('\n=== ▶ 재시작 ===');
 L('15. 판만 새로 열고 경험치는 남는다', await (async()=>{
   await p.evaluate(()=>{ S.cash=99000000; S.gate=4; saveRun(); });
   await p.evaluate(()=>document.querySelector('[data-restart]').click());
   await p.waitForTimeout(400);
   return await p.evaluate(()=>({현금:S.cash, 상환단계:S.gate, xp:META.xp,
     모달:$('modal').classList.contains('on')}));
 })());

 console.log('\n=== 📋 템플릿 ===');
 await open();
 L('16. 내보낸 JSON', await (async()=>{
   await p.evaluate(()=>document.querySelector('[data-tpl]').click());
   await p.waitForTimeout(250);
   return await p.evaluate(()=>JSON.parse($('dvTpl').value));
 })());
 L('17. 왕복 — 값을 바꾼 뒤 원래 JSON을 넣으면 되돌아온다', await (async()=>{
   const orig=await p.evaluate(()=>$('dvTpl').value);
   await p.evaluate(()=>{ MID_DIP=0.2; DIP=0.7; START_CASH=5000000; });
   const messed=await p.evaluate(()=>({MID:MID_DIP, DIP, 현금:START_CASH}));
   await p.evaluate(()=>document.querySelector('[data-tpledit="1"]').click());
   await p.waitForTimeout(200);
   await p.evaluate(t=>{ $('dvTpl').value=t; }, orig);
   await p.evaluate(()=>document.querySelector('[data-tplok]').click());
   await p.waitForTimeout(400);
   return {어긋뜨림:messed, 복원:await p.evaluate(()=>({MID:MID_DIP, DIP:+DIP.toFixed(2),
     현금:START_CASH, 거래일:GATE_DAYS, 적중률:infoAccOf()}))};
 })());
 L('18. 슬롯 저장 → 불러오기', await (async()=>{
   await p.evaluate(()=>document.querySelector('[data-tpl]').click());
   await p.waitForTimeout(200);
   await p.evaluate(()=>{ MID_DIP=0.4; });
   await p.evaluate(()=>document.querySelector('[data-slotsave="0"]').click());
   await p.waitForTimeout(350);
   const saved=await p.evaluate(()=>document.querySelector('.dv-slot .nm').textContent.trim().split('\n')[0]);
   await p.evaluate(()=>{ MID_DIP=1.5; });
   await p.evaluate(()=>document.querySelector('[data-slotload="0"]').click());
   await p.waitForTimeout(400);
   return {이름:saved, '불러온 MID':MID_DIP=await p.evaluate(()=>MID_DIP),
     빈슬롯:await p.evaluate(()=>document.querySelectorAll('.dv-slot.empty').length)};
 })());

 /* 여기부터는 실제로 devWipe를 눌러 새로고침까지 간다. 직접 removeItem을 부르면
    reload 경로(pagehide→saveRun)를 안 타서 진짜 버그를 못 잡는다. */
 const seed=async(page)=>{ await page.evaluate(()=>{
   localStorage.setItem('moneyroad2_meta_v4', JSON.stringify({mute:false,legacyPoints:777,seenIntro:true}));
   META.xp=654; saveMeta();
   S.cash=S.peakCash=88000000; S.gate=3; saveRun(); }); };

 L('20. 판만 초기화 — 판은 날아가고 메타는 남는다', await (async()=>{
   await open(); await tab('start');
   await seed(p);
   await p.evaluate(()=>document.querySelector('[data-wipe="run"]').click());
   await p.waitForTimeout(900);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   return await p.evaluate(()=>({현금:S.cash, xp:META.xp,
     run키:!!localStorage.getItem(RUN_KEY), meta키:!!localStorage.getItem(META_KEY)}));
 })());

 L('21. 전부 초기화 — 돈도 경험치도 0에서 다시 · 슬롯은 남는다', await (async()=>{
   await open();
   await seed(p);
   await p.evaluate(()=>document.querySelector('[data-wipe="all"]').click());
   await p.waitForTimeout(250);
   await p.evaluate(()=>$('mOk').click());        // 확인 화면에서 "네, 전부 지울게요"
   await p.waitForTimeout(1200);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   return await p.evaluate(()=>({
     현금:S.cash, xp:META.xp, 상환단계:S.gate,
     템플릿슬롯:(JSON.parse(localStorage.getItem(DEV_TPL_KEY)||'[]')||[]).filter(Boolean).map(x=>x.name),
     'moneyroad 키 잔존':(()=>{const a=[];for(let i=0;i<localStorage.length;i++){
       const k=localStorage.key(i); if(/^moneyroad/.test(k))a.push(k);} return a;})()}));
 })());

 console.log('\n=== 새지 않는가 ===');
 L('22. 라운드 중에는 안 열림', await p.evaluate(()=>{
   S.cash=3000000; setBet(1000000); startRound(1);
   $('brandTap').click(); $('brandTap').click();
   return {모달:$('modal').classList.contains('on')};}));

 await p.close();
 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
