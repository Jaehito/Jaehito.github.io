/* phase28 — 랭킹 삭제 · 상환 칩을 탑바로 · 인트로 버전 관리

   확인하는 것:
     1) 랭킹 흔적이 하나도 안 남았는가 (칩·전역함수·결과 팝업 줄)
     2) 상환 칩이 위험 3단계와 마지막 거래일을 그대로 물려받는가
     3) 스크롤해도 칩이 화면에 남는가 — 이 작업의 목적 그 자체
     4) 상환금·D-day가 스트립과 겹치지 않는가 (중복 제거)
     5) 인트로가 저장 상태에 따라 제대로 뜨는가 (introV)
     6) 칩을 눌러 인트로를 다시 열 수 있는가
     7) 완제하면 칩이 무엇을 보여주는가 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(seed){const p=await b.newPage({viewport:{width:390,height:740}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(s=>{localStorage.clear();
     if(s)localStorage.setItem(s.key,JSON.stringify(s.val));}, seed||null);
   await p.reload(); await p.waitForTimeout(350);
   return p;}
 const dismiss=p=>p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 랭킹 흔적 ===');
 let p=await fresh(); await dismiss(p);
 L('', await p.evaluate(()=>({
   rankChip엘리먼트:!!document.getElementById('rankChip'),
   '.rank-chip 남음':document.querySelectorAll('.rank-chip').length,
   전역함수:['rankOf','rankText','renderRankChip','updateRankDrift','rankFromAmount']
     .filter(n=>typeof window[n]==='function'),
   FAKE_NAMES유지:Array.isArray(FAKE_NAMES)&&FAKE_NAMES.length>0})));
 L('결과 팝업에 순위 줄이 없다', await p.evaluate(()=>{
   S.cash=3000000; S.upg.leverageLv=3; setBet(1000000);
   startRound(1);
   S.activeRound.path=S.activeRound.path.map(()=>1.30);
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
   sellRound(false);
   const box=$('modalBox');
   return {순위줄:box.querySelectorAll('.rs-rankline').length,
     '전국 포함':/전국|위 \(상위/.test(box.textContent),
     결과에rank키:Object.keys(S.lastResult||{}).filter(k=>/rank/i.test(k)),
     손익:$('modalBox').querySelector('.rs-money').textContent};}));
 await p.close();

 console.log('\n=== 2. 칩 — 위험 3단계 ===');
 p=await fresh(); await dismiss(p);
 L('1차 관문(50만원)에서 현금 12만원일 때', await p.evaluate(()=>{
   const out=[];
   for(const d of [13,5,3,2,1]){
     S.cash=120000; S.daysLeft=d; renderLevel();
     const c=$('repayChip');
     out.push({남은일수:d, 칩:c.textContent, 클래스:c.className,
       깜빡임:c.className.includes('last')});
   }
   return out;}));
 L('금액이 커져도 한 줄', await p.evaluate(()=>{
   S.gate=6; S.cash=30000000000; S.daysLeft=9; renderLevel();
   const c=$('repayChip');
   return {칩:c.textContent, 폭:Math.round(c.getBoundingClientRect().width),
     탑바폭:Math.round(document.querySelector('.topbar').getBoundingClientRect().width),
     줄바꿈없음:c.getBoundingClientRect().height<30};}));
 await p.close();

 console.log('\n=== 3. 스크롤해도 칩이 남는가 ===');
 p=await fresh(); await dismiss(p);
 const geom=()=>p.evaluate(()=>{
   const c=$('repayChip').getBoundingClientRect();
   const s=$('repayStrip').getBoundingClientRect();
   /* "보이냐"만 물으면 1px만 걸쳐도 true가 된다. 몇 px이 남았는지를 같이 본다. */
   const vis=r=>Math.max(0,Math.round(Math.min(r.bottom,innerHeight)-Math.max(r.top,0)));
   return {스크롤:Math.round(scrollY),
     '칩 y':Math.round(c.top), '칩 보이는높이':vis(c)+'/'+Math.round(c.height),
     '스트립 y':Math.round(s.top), '스트립 보이는높이':vis(s)+'/'+Math.round(s.height)};});
 L('맨 위', await geom());
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await p.waitForTimeout(200);
 L('끝까지 내림', await geom());
 L('화면 높이', await p.evaluate(()=>({
   문서:document.body.scrollHeight, 뷰포트:innerHeight,
   스크롤여지:document.body.scrollHeight-innerHeight,
   탑바:Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
   스트립:Math.round($('repayStrip').getBoundingClientRect().height)})));
 await p.close();

 console.log('\n=== 4. 스트립과 중복되지 않는다 ===');
 p=await fresh(); await dismiss(p);
 L('', await p.evaluate(()=>{
   S.cash=120000; S.daysLeft=9; renderLevel();
   const strip=$('repayStrip');
   return {'스트립 안 lv-row':strip.querySelectorAll('.lv-row').length,
     '스트립 안 dday':strip.querySelectorAll('.dday').length,
     스트립내용:strip.textContent.replace(/\s+/g,' ').trim(),
     '관문 이름은 설명줄에':/1차/.test(strip.querySelector('.repay-sub').textContent)};}));
 L('기한 연장 버튼은 스트립에 남는다', await p.evaluate(()=>{
   S.cash=120000; S.daysLeft=3; renderLevel();
   return {버튼:!!$('extendBtn'), 문구:$('extendBtn')?$('extendBtn').textContent:'-',
     '칩 안에는 없음':!$('repayChip').querySelector('button')};}));
 await p.close();

 console.log('\n=== 5. 인트로 — 저장 상태별 ===');
 for(const [label,seed] of [
   ['완전 새 플레이어', null],
   ['v4에서 넘어옴(본 적 O)', {key:'moneyroad2_meta_v4', val:{mute:false,legacyPoints:120,seenIntro:true}}],
   ['v5인데 아직 못 본 판', {key:'moneyroad2_meta_v5', val:{mute:false,xp:300,cleared:0,dex:{},introV:0}}],
   ['v5 · 이번 버전을 봤음',  {key:'moneyroad2_meta_v5', val:{mute:false,xp:300,cleared:0,dex:{},introV:2}}],
 ]){
   const q=await fresh(seed);
   L(label.padEnd(22), await q.evaluate(()=>({
     모달:$('modal').classList.contains('on'),
     제목:($('modalBox').querySelector('.tt')||{}).textContent||'-',
     introV:META.introV, INTRO_V, xp:META.xp})));
   await q.close();
 }

 console.log('\n=== 6. 칩을 눌러 다시 열기 ===');
 p=await fresh(); await dismiss(p);
 await p.waitForTimeout(100);
 L('닫은 뒤 칩 클릭', await p.evaluate(()=>{
   $('repayChip').click();
   return {모달:$('modal').classList.contains('on'),
     제목:($('modalBox').querySelector('.tt')||{}).textContent||'-'};}));
 await p.evaluate(()=>$('mOk').click()); await p.waitForTimeout(100);
 L('라운드 중에는 안 열린다', await p.evaluate(()=>{
   S.cash=3000000; setBet(1000000); startRound(1);
   $('repayChip').click();
   const on=$('modal').classList.contains('on');
   S.activeRound=null;
   return {모달:on};}));
 await p.close();

 console.log('\n=== 7. 완제 상태 ===');
 p=await fresh(); await dismiss(p);
 L('', await p.evaluate(()=>{
   S.gate=GATES.length; S.cash=S.peakCash=60000000000; renderLevel();
   return {완제:gateDone(), 칩:$('repayChip').textContent,
     클래스:$('repayChip').className,
     스트립:$('repayStrip').textContent.replace(/\s+/g,' ').trim()};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
