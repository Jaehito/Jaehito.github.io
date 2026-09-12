/* phase30 — 🛠 테스트 도구

   정상 플레이에 절대 새지 않아야 하는 기능이라, 여는 조건부터 본다:
     1) 평소 화면에 흔적이 없다
     2) 4연타로는 안 열린다 / 5번을 1.5초 안에 다 못 누르면 안 열린다
     3) 빠른 5연타로 열린다
     4) 판·메타를 실제로 움직이는가 (현금·XP·난이도·상환 단계)
     5) 패턴 강제가 genRound를 실제로 고정하는가
     6) DIP 조절이 경로에 반영되는가 · 기본값은 따로 남아 있는가
     7) 라운드 중에는 안 열린다 (15초짜리 판 위에 모달이 뜨면 그 판을 잃는다)
     8) 판만 초기화하면 메타가 남는가 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b=await launch(); const errs=[];
 const p=await b.newPage({viewport:{width:390,height:820}});
 p.on('pageerror',e=>errs.push('EXC: '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
 await p.goto(url); await p.waitForTimeout(150);
 await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(350);
 await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 L('1. 평소엔 흔적 없음', await p.evaluate(()=>({
   /* body.textContent는 <script> 본문까지 센다 — 화면에 그려진 것만 본다 */
   도구흔적:!!document.querySelector('.dv-title,.dv-btn,.dv-head'),
   모달열림:$('modal').classList.contains('on'),
   로고:$('brandTap').textContent})));

 L('2. 4번만 누르면 안 열림', await p.evaluate(()=>{
   for(let i=0;i<4;i++)$('brandTap').click();
   return {모달:$('modal').classList.contains('on')};}));
 await p.waitForTimeout(1700);   /* 앞 연타의 창을 비운다 */
 L('3. 느리게 5번도 안 열림', await p.evaluate(async()=>{
   for(let i=0;i<5;i++){ $('brandTap').click(); await new Promise(r=>setTimeout(r,450)); }
   return {모달:$('modal').classList.contains('on')};}));
 await p.waitForTimeout(1700);
 L('4. 빠르게 5번 → 열림', await p.evaluate(()=>{
   for(let i=0;i<5;i++)$('brandTap').click();
   return {모달:$('modal').classList.contains('on'),
     제목:document.querySelector('.dv-title').textContent,
     헤더:document.querySelector('.dv-ver').textContent};}));

 L('5. 현금 ×10', await p.evaluate(()=>{
   const before=S.cash;
   document.querySelector('[data-cash="10"]').click();
   return {전:before, 후:S.cash, peak:S.peakCash};}));
 L('6. XP 900 → 해금', await p.evaluate(()=>{
   document.querySelector('[data-xp="900"]').click();
   return {xp:META.xp, 해금:META_UNLOCKS.filter(u=>metaHas(u.id)).map(u=>u.emo).join('')};}));
 L('7. 난이도 4', await p.evaluate(()=>{
   document.querySelector('[data-tier="3"]').click();
   return {tier:S.tier, 이름:tierOf().n, 기한:S.daysLeft};}));
 L('8. 완제 직전', await p.evaluate(()=>{
   document.querySelector('[data-gate="last"]').click();
   return {gate:S.gate, 관문:gateOf().n, 현금:fmtWon(S.cash), 기한:S.daysLeft};}));
 L('9. 패턴 강제 — 하락 10판', await p.evaluate(()=>{
   document.querySelector('[data-pat="down"]').click();
   const st=TRADE_STOCKS.find(s=>s.id==='stable');
   const ids=[]; for(let k=0;k<10;k++) ids.push(genRound(st,'strong').patternId);
   return {DEV:DEV.pat, 뽑힌패턴:[...new Set(ids)]};}));
 L('10. DIP 조절', await p.evaluate(()=>{
   const a=DIP;
   document.querySelector('[data-dip="0.02"]').click();
   document.querySelector('[data-dip="0.02"]').click();
   const st=TRADE_STOCKS.find(s=>s.id==='stable');
   let lo=9; const arr=PATTERNS.find(x=>x.id==='up').gen(st,300);
   for(let i=1;i<=150;i++) if(arr[i]<lo)lo=arr[i];
   return {전:a, 후:DIP, 기본:DIP_BASE, '상승 전반부 저점':+lo.toFixed(2)};}));
 L('11. 패턴 강제 끄기', await p.evaluate(()=>{
   document.querySelector('[data-pat=""]').click();
   return {DEV:DEV.pat};}));
 L('12. 닫기', await p.evaluate(()=>{
   $('mOk').click();
   return {모달:$('modal').classList.contains('on')};}));
 L('13. 라운드 중에는 안 열림', await p.evaluate(()=>{
   S.cash=3000000; setBet(1000000); startRound(1);
   for(let i=0;i<5;i++)$('brandTap').click();
   const on=$('modal').classList.contains('on');
   S.activeRound=null; render();
   return {모달:on};}));
 L('14. 판만 초기화 (메타 유지)', await p.evaluate(()=>{
   META.xp=555; saveMeta(); saveRun();
   const keys={run:!!localStorage.getItem(RUN_KEY), meta:!!localStorage.getItem(META_KEY)};
   try{localStorage.removeItem(RUN_KEY);}catch(e){}
   return {전:keys, 후:{run:!!localStorage.getItem(RUN_KEY), meta:!!localStorage.getItem(META_KEY)}};}));
 await p.close();
 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
