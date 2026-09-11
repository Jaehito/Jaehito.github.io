/* phase19 — C단계: 레거시 구매 트리 → 트레이더 경험치(메타 레벨)

   확인하는 것만 적는다:
     1) 레거시 트리의 흔적이 남지 않았는지 (시드머니·촉·보험·뒷배·빚 청산)
     2) v4 세이브의 레거시 포인트가 XP로 넘어오는지
     3) 자동 익절이 판 안 레벨 보상 → 메타 해금으로 옮겨갔는지
     4) 정산 XP 계산 (파산/반대매매 30% 감점, 은퇴/완제 100%)
     5) 조기 상환 XP가 판 종료까지 누적되는지
     6) 정산 화면을 띄운 채 앱을 닫았다 켜도 같은 내역이 복원되는지 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function page(){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   return p;}
 async function fresh(){const p=await page();
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 레거시 트리가 남아 있지 않다 ===');
 let p=await fresh();
 L('', await p.evaluate(()=>({
   'LEGACY 없음':typeof LEGACY==='undefined',
   'SEED_CASH 없음':typeof SEED_CASH==='undefined',
   'INFO_BONUS 없음':typeof INFO_BONUS==='undefined',
   'DEBT_LEVS 없음':typeof DEBT_LEVS==='undefined',
   'legacyPoints 없음':META.legacyPoints===undefined,
   'META.xp 있음':typeof META.xp==='number',
   시작현금:fmtWon(S.cash), 최소배율:minLevOf(),
   시작보험:S.upg.stoplossLv, 시작티켓:(S.buffs||[]).length})));
 await p.close();

 console.log('\n=== 2. v4 세이브 → XP 이월 (1pt = 1XP) ===');
 p=await page();
 await p.goto(url); await p.waitForTimeout(150);
 await p.evaluate(()=>{ localStorage.clear();
   localStorage.setItem('moneyroad2_meta_v4', JSON.stringify(
     {mute:true, legacyPoints:57, legacy:{debt:1,seed:2,sense:0,ticket:0,guard:1}, seenIntro:true})); });
 await p.reload(); await p.waitForTimeout(350);
 L('', await p.evaluate(()=>({
   xp:META.xp, 음소거유지:META.mute, 안내본것유지:META.seenIntro,
   메타레벨:metaLv(), 자동익절해금:metaHas('autosell'),
   '옛 빚청산이 최소배율에 영향 없음':minLevOf()===3})));
 await p.close();

 console.log('\n=== 3. 자동 익절 — 판 안 레벨이 아니라 메타 해금 ===');
 p=await fresh();
 L('XP 0 · 판 안 Lv.8이어도', await p.evaluate(()=>{
   S.level=8; S.gate=GATES.length; renderTrade();
   return {metaHas:metaHas('autosell'), 칩있음:!!$('autoToggle'),
     'Lv.4 보상에 autosell 없음':!JSON.stringify(LEVELS.find(l=>l.lv===4)).includes('autosell')};}));
 L('XP 40이면', await p.evaluate(()=>{
   META.xp=40; saveMeta(); renderTrade();
   return {metaHas:metaHas('autosell'), 칩있음:!!$('autoToggle'), 메타레벨:metaLv()};}));
 await p.close();

 console.log('\n=== 4. 정산 XP — 감점 유무 ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   S.peakCash=20000000; S.earlyXp=14;
   const base=xpOfPeak(S.peakCash);
   const full=settleOf(0), pen=settleOf(BANKRUPT_PENALTY);
   return {최고기록:fmtWon(S.peakCash), 기본XP:base, 조기상환XP:S.earlyXp,
     '은퇴/완제(100%)':full.total, '파산/반대매매(-30%)':pen.total,
     검산:full.total===base+14 && pen.total===Math.round((base+14)*0.7)};}));
 await p.close();

 console.log('\n=== 5. 조기 상환 XP가 판 종료까지 누적된다 ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   const out=[];
   S.gate=0; S.level=1; S.cash=S.peakCash=GATES[0].goal; S.daysLeft=6;
   checkLevelUp(); out.push({관문:'1차', 남긴일:6, 누적XP:S.earlyXp});
   $('mOk').click();
   S.cash=S.peakCash=GATES[1].goal; S.daysLeft=4;
   checkLevelUp(); out.push({관문:'2차', 남긴일:4, 누적XP:S.earlyXp});
   return {단계:out, 기대:(6+4)*EARLY_XP_PER_DAY, 일치:S.earlyXp===(6+4)*EARLY_XP_PER_DAY};}));
 await p.close();

 console.log('\n=== 6. 정산 화면을 띄운 채 껐다 켜도 복원 ===');
 p=await fresh();
 await p.evaluate(()=>{ S.peakCash=5000000; S.earlyXp=10; S.cash=0; showBankruptModal(); $('mOk').click(); });
 await p.waitForTimeout(150);
 const before=await p.evaluate(()=>({화면:$('modalBox').querySelector('.tt').textContent,
   합계:$('modalBox').querySelector('.xp-tbl .sum').textContent.replace(/\s+/g,' ').trim(),
   xp:META.xp}));
 L('정산 화면', before);
 await p.reload(); await p.waitForTimeout(400);
 L('새로고침 뒤', await p.evaluate(x=>{
   const box=$('modalBox'), sum=box.querySelector('.xp-tbl .sum');
   return {화면:box.querySelector('.tt')?box.querySelector('.tt').textContent:'(없음)',
     합계:sum?sum.textContent.replace(/\s+/g,' ').trim():'(없음)',
     xp:META.xp, 'XP 이중지급 아님':META.xp===x};}, before.xp));
 await p.evaluate(()=>$('mOk').click()); await p.waitForTimeout(200);
 L('새 판 시작 뒤', await p.evaluate(()=>({
   모달:$('modal').classList.contains('on'), pendingSettle:META.pendingSettle,
   현금:fmtWon(S.cash), earlyXp:S.earlyXp})));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
