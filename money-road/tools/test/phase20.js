/* phase20 — D단계: 난이도 선택(승천)

   확인하는 것:
     1) 사다리 값이 sim/tier.js에서 확정한 대로인지
     2) 난이도가 패턴 가중치와 관문 기한을 실제로 움직이는지
     3) 가중치 재계산이 누적되지 않는지 (BASE_WEIGHTS를 안 두면 단계를 바꿀 때마다
        이전 보정 위에 또 보정된다 — 이 테스트가 그걸 잡는다)
     4) 해금: 완제로만 열리고 파산으로는 안 열린다
     5) XP 배율
     6) 정산 → 난이도 선택 흐름 */
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
 /* 하락 계열 패턴의 등장 확률 합 — 난이도가 실제로 이걸 민다 */
 const weakSum=`PATTERNS.filter(x=>PATTERN_TIER[x.id]==='weak').reduce((a,x)=>a+x.weight,0)`;

 console.log('=== 1. 사다리 ===');
 let p=await fresh();
 L('', await p.evaluate(()=>TIERS.map((t,i)=>
   `${i+1} · ${t.n} — 하락 +${(t.down*100).toFixed(0)}%p · 일수 ${t.dday>=0?'+':''}${t.dday} · XP ×${t.xp}`)));
 L('최소 레버리지는 난이도 축이 아니다', await p.evaluate(()=>({
   MIN_LEVERAGE, 단계마다고정:TIERS.every(()=>minLevOf()===3)})));
 await p.close();

 console.log('\n=== 2. 난이도가 패턴 가중치와 기한을 움직인다 ===');
 p=await fresh();
 L('', await p.evaluate(`(()=>{
   const out=[];
   for(let i=0;i<TIERS.length;i++){
     S.tier=i; applyTierWeights();
     out.push({단계:i+1, 이름:TIERS[i].n,
       하락합:+(${weakSum}).toFixed(4),
       '1차기한':gateDaysOf(0), '6차기한':gateDaysOf(5)});
   }
   return out;})()`));
 await p.close();

 console.log('\n=== 3. 가중치 재계산은 누적되지 않는다 ===');
 p=await fresh();
 L('', await p.evaluate(`(()=>{
   S.tier=4; applyTierWeights(); const once=+(${weakSum}).toFixed(6);
   for(let k=0;k<20;k++)applyTierWeights();
   const many=+(${weakSum}).toFixed(6);
   S.tier=0; applyTierWeights(); const back=+(${weakSum}).toFixed(6);
   return {'5단계 1회':once, '5단계 20회':many, 같음:once===many,
     '1단계로 되돌림':back, '원래값 0.29로 복귀':Math.abs(back-0.29)<1e-6};})()`));
 await p.close();

 console.log('\n=== 4. 해금 — 완제로만 열린다 ===');
 p=await fresh();
 L('처음', await p.evaluate(()=>({cleared:META.cleared, 고를수있는최고:maxTierIdx()+1})));
 L('1단계에서 파산', await p.evaluate(()=>{
   S.tier=0; S.peakCash=3000000; S.cash=0; showBankruptModal(); $('mOk').click();
   return {cleared:META.cleared, 고를수있는최고:maxTierIdx()+1};}));
 await p.waitForTimeout(150);
 L('1단계 완제', await p.evaluate(()=>{
   META.pendingSettle=null; saveMeta(); startRunAt(0);
   S.gate=GATES.length-1; S.level=7; S.cash=S.peakCash=GATES[GATES.length-1].goal; S.daysLeft=3;
   checkLevelUp();
   return {cleared:META.cleared, 고를수있는최고:maxTierIdx()+1};}));
 L('같은 단계를 또 완제해도 안 늘어남', await p.evaluate(()=>{
   $('mOk').click(); META.pendingSettle=null; saveMeta(); startRunAt(0);
   S.gate=GATES.length-1; S.level=7; S.cash=S.peakCash=GATES[GATES.length-1].goal; S.daysLeft=3;
   checkLevelUp();
   return {cleared:META.cleared, 고를수있는최고:maxTierIdx()+1};}));
 await p.close();

 console.log('\n=== 5. XP 배율 ===');
 p=await fresh();
 L('', await p.evaluate(()=>{
   S.peakCash=20000000; S.earlyXp=10;
   const base=xpOfPeak(S.peakCash);
   return TIERS.map((t,i)=>{ S.tier=i; const st=settleOf(0);
     return {단계:i+1, 배율:st.mult, XP:st.total, 검산:st.total===Math.round((base+10)*t.xp)};});}));
 await p.close();

 console.log('\n=== 6. 정산 → 난이도 선택 흐름 ===');
 p=await fresh();
 L('아직 1단계뿐이면 바로 새 판', await p.evaluate(()=>{
   META.cleared=0; saveMeta();
   S.peakCash=3000000; S.cash=0; showBankruptModal(); $('mOk').click();  // 정산 화면
   $('mOk').click();                                                      // 새 판 시작
   return {모달:$('modal').classList.contains('on'), tier:S.tier, 현금:fmtWon(S.cash)};}));
 await p.waitForTimeout(150);
 L('단계를 깼으면 선택 화면', await p.evaluate(()=>{
   META.cleared=2; saveMeta();
   S.peakCash=3000000; S.cash=0; showBankruptModal(); $('mOk').click();
   $('mOk').click();
   return {제목:$('modalBox').querySelector('.tt').textContent,
     카드수:document.querySelectorAll('.diff-card').length,
     잠긴카드:document.querySelectorAll('.diff-card.lock').length,
     기본선택:tierPick+1, 버튼:$('mOk').textContent.trim()};}));
 L('2단계를 골라 시작', await p.evaluate(()=>{
   document.querySelector('.diff-card[data-tier="1"]').click(); $('mOk').click();
   return {모달:$('modal').classList.contains('on'), tier:S.tier, 이름:tierOf().n,
     칩:$('tierChip').textContent, 기한:S.daysLeft};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
