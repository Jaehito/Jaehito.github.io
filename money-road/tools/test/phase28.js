/* phase28 — 랭킹 삭제 · 상환 칩을 탑바로 · 인트로 버전 관리

   확인하는 것:
     1) 랭킹 흔적이 하나도 안 남았는가 (칩·전역함수·결과 팝업 줄)
     2) 상환 칩이 위험 3단계와 마지막 거래일을 그대로 물려받는가
     3) 스크롤해도 칩이 화면에 남는가 — 이 작업의 목적 그 자체
     4) 상환금·D-day가 스트립과 겹치지 않는가 (중복 제거)
     5) 인트로가 저장 상태에 따라 제대로 뜨는가 (introV)
     6) 칩을 눌러 인트로를 다시 열 수 있는가
     7) 완제하면 칩이 무엇을 보여주는가
     8) 라운드 화면이 스크롤되지 않는가 — 판이 돌면 모니터가 화면을 차지한다 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 const fail=[];
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
   /* 예전에는 FAKE_NAMES(댓글 작성자)가 살아 있는지도 같이 봤다. 댓글을
      지우면서 같이 없어졌다 — 랭킹 흔적과는 상관없는 검사였다. */
   'CHAT 흔적':typeof window.CHAT!=='undefined'})));
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

 /* 이 절의 목적은 "마감이 늘 보이는가"다. 방법이 두 번 바뀌었다 —
    탑바 sticky → ACCOUNT 패널 → 지금은 창틀 자체가 고정이고 본문만 구른다.
    그래서 문서를 굴리면 안 되고(문서는 이제 안 구른다) .body를 굴려야 한다.
    이 절이 문서 스크롤을 보던 동안은 아무것도 재지 않고 통과하고 있었다. */
 console.log('\n=== 3. 내려도 마감이 남는가 — 창틀 고정 + 접힌 계좌줄 ===');
 p=await fresh(); await dismiss(p);
 const geom=()=>p.evaluate(()=>{
   const vis=r=>Math.max(0,Math.round(Math.min(r.bottom,innerHeight)-Math.max(r.top,0)));
   const box=el=>{const r=el.getBoundingClientRect();
     return vis(r)+'/'+Math.round(r.height);};
   const bd=$('appBody'), mini=$('acctMini');
   return {'본문 스크롤':Math.round(bd.scrollTop),
     '문서 스크롤':Math.round(scrollY),
     '제목표':box(document.querySelector('.topbar')),
     '상태표시줄':box(document.querySelector('.strip')),
     '계좌줄 떴나':!mini.hidden,
     '계좌줄':mini.hidden?'-':mini.textContent.replace(/\s+/g,' ').trim(),
     /* 패널은 .body가 자기 위 모서리에서 잘라내므로 뷰포트 기준으로 재면
        거짓말을 한다. 통 기준 위치로 적는다 — 음수면 위로 밀려난 것이다. */
     'ACCOUNT 패널 위치':Math.round($('repayGrp').getBoundingClientRect().top
       - bd.getBoundingClientRect().top)};});
 L('맨 위', await geom());
 await p.evaluate(()=>{const bd=$('appBody');
   bd.scrollTop=bd.scrollHeight; bd.dispatchEvent(new Event('scroll'));});
 await p.waitForTimeout(250);
 const low=await geom();
 L('끝까지 내림', low);
 if(!low['계좌줄 떴나']) fail.push('내렸는데 접힌 계좌줄이 안 뜬다');
 if(!/D-|마지막/.test(low['계좌줄'])) fail.push('접힌 계좌줄에 마감이 없다: '+low['계좌줄']);
 if(parseInt(low['제목표'],10)<20) fail.push('제목표가 스크롤에 밀렸다: '+low['제목표']);
 if(parseInt(low['상태표시줄'],10)<20) fail.push('상태표시줄이 스크롤에 밀렸다: '+low['상태표시줄']);
 L('화면 높이', await p.evaluate(()=>({
   본문:$('appBody').scrollHeight, 뷰포트:innerHeight,
   '문서가 안 구른다':document.documentElement.scrollHeight<=innerHeight+2,
   고정영역:['.topbar','.acct-mini','.strip'].reduce((a,s)=>{
     const e=document.querySelector(s); return a+(e&&!e.hidden?Math.round(e.getBoundingClientRect().height):0);},0)})));
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

 /* ── 8. 라운드는 스크롤되지 않는다 ──
    주문표는 스크롤해도 되지만 라운드는 안 된다 — 15초 동안 차트와 매도 버튼이
    같이 보여야 한다. 라운드 뷰가 주문표 안(#tradeBody)에 있던 동안은 탭과 종목
    여섯 줄이 위에 남아 차트를 접힘선 아래로 밀어냈다. 실기준선은 360×640이다. */
 console.log('\n=== 8. 라운드가 화면에 들어가는가 ===');
 for(const [w,h] of [[390,844],[360,640]]){
   const rp=await b.newPage({viewport:{width:w,height:h}});
   rp.on('pageerror',e=>errs.push('EXC: '+e.message));
   await rp.goto(url); await rp.waitForTimeout(150);
   await rp.evaluate(()=>localStorage.clear());
   await rp.reload(); await rp.waitForTimeout(350);
   await dismiss(rp);
   /* 해금을 전부 켜서 제일 높은 라운드 화면(물타기 줄 + 절반 매도)으로 잰다 */
   await rp.evaluate(()=>{ META.xp=99999; grantByXp(); saveMeta(); S.cash=3000000; setBet(300000); startRound(1); });
   await rp.waitForTimeout(300);
   const m=await rp.evaluate(()=>{
     const bd=$('appBody');
     /* scrollHeight는 clientHeight 아래로 안 내려가서 넘침을 0으로 거짓말한다 —
        보이는 자식을 직접 더한다. 예전에 이 실수로 모든 화면이 통과했다. */
     let hh=0; for(const c of bd.children){ if(c.hidden)continue; hh+=c.getBoundingClientRect().height; }
     const cs=getComputedStyle(bd); hh+=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
     return {넘침:Math.round(hh-bd.clientHeight),
       '매도버튼 아래 여유':Math.round($('strip').getBoundingClientRect().top
         -$('sellBtn').getBoundingClientRect().bottom),
       '서류철 접힘':$('tabsWrap').hidden, '계좌 패널 접힘':$('repayGrp').hidden,
       '계좌줄 떴나':!$('acctMini').hidden,
       '기기 안에 화면':!!document.querySelector('.dev.live .scrn .trm'),
       명판:(document.querySelector('.dev.live .plate')||{}).textContent||'-'};});
   L(w+'×'+h, m);
   if(m.넘침>0) fail.push(`라운드가 ${w}×${h}에서 ${m.넘침}px 넘친다`);
   if(m['매도버튼 아래 여유']<0) fail.push(`매도 버튼이 ${w}×${h}에서 상태표시줄 아래로 밀렸다`);
   if(!m['서류철 접힘']) fail.push('판이 도는데 서류철이 그대로 있다');
   if(!m['계좌 패널 접힘']||!m['계좌줄 떴나']) fail.push('ACCOUNT 패널이 계좌줄로 안 접혔다');
   if(!m['기기 안에 화면']) fail.push('라운드 화면이 기기 안에 없다');
   await rp.close();
 }

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 /* 3번 절이 실제로 재는 절이 된 이상 결과도 내야 한다 — 이 파일은 그동안
    구경만 하고 언제나 0으로 끝났다. */
 if(fail.length){ console.log('\n실패:'); fail.forEach(f=>console.log('  ✗ '+f)); }
 else console.log('\n  ✓ 전부 통과');
 await b.close();
 if(fail.length||errs.length) process.exit(1);
})();
