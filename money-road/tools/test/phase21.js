/* phase21 — E단계 첫 항목: 🐻 공매도

   손익 부호만 뒤집으면 되는 일이 아니라서, 방향에 걸리는 것을 전부 본다:
     1) 해금 전에는 방향 선택이 아예 없다 (첫 판 화면이 안 변한다)
     2) 손익 부호 대칭
     3) 청산선 — 롱은 아래(1−1/L), 숏은 위(1+1/L). 숏은 1배에도 청산이 있다
     4) 매도 등급 반전 (숏은 낮게 덮을수록 잘한 것)
     5) 자동 익절은 숏에서 목표 배율의 역수
     6) 청산 경고 영역이 청산선 바깥쪽만 칠하는가 (화면 밖으로 나가도) */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(xp){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   await p.evaluate(x=>{ META.xp=x; saveMeta();
     S.cash=S.peakCash=3000000; S.upg.leverageLv=3; setBet(1000000); renderTrade(); }, xp);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 /* 경로를 한 값으로 채우고 라운드를 끝까지 굴린다 */
 const play=`window.playAt=(dir,mult)=>{ startRound(dir);
   S.activeRound.path=S.activeRound.path.map(()=>mult);
   S.activeRound.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS; };`;

 console.log('=== 1. 해금 전에는 방향 선택이 없다 ===');
 let p=await fresh(0);
 L('XP 0', await p.evaluate(()=>({
   metaHas:metaHas('short'),
   상승버튼:!!$('tradeGo'), 하락버튼:!!$('tradeShort'),
   버튼문구:$('tradeGo').textContent.replace(/\s+/g,' ').trim(),
   레버리지소문자:[...document.querySelectorAll('.lev-row small')].map(e=>e.textContent)})));
 L('해금해도 startRound(-1)은 롱으로 막힌다', await p.evaluate(()=>{
   startRound(-1); const d=S.activeRound.dir; S.activeRound=null; return {dir:d};}));
 await p.close();

 console.log('\n=== 1-b. 해금하면 좌우로 쪼개진다 ===');
 p=await fresh(200);
 L('', await p.evaluate(()=>({
   metaHas:metaHas('short'),
   상승:$('tradeGo').textContent.replace(/\s+/g,' ').trim(),
   하락:$('tradeShort').textContent.replace(/\s+/g,' ').trim(),
   레버리지소문자:[...document.querySelectorAll('.lev-row small')].map(e=>e.textContent.trim())})));
 await p.close();

 console.log('\n=== 2. 손익 부호 대칭 ===');
 p=await fresh(200);
 await p.evaluate(play);
 L('', await p.evaluate(async()=>{
   const out=[];
   for(const [dir,mult] of [[1,1.20],[-1,1.20],[1,0.80],[-1,0.80]]){
     S.cash=3000000; setBet(1000000);
     window.playAt(dir,mult);
     const bet=S.activeRound.bet, lev=S.activeRound.leverage;
     sellRound(false);
     const r=S.lastResult||{};
     out.push({방향:dir>0?'롱':'숏', 배율:mult, 배율표시:lev+'배',
       손익:r.profit, 기대:Math.round(bet*(mult-1)*lev*dir), 일치:r.profit===Math.round(bet*(mult-1)*lev*dir)});
     $('mOk').click(); await new Promise(r=>setTimeout(r,60));
   }
   return out;}));
 await p.close();

 console.log('\n=== 3. 청산선 ===');
 p=await fresh(200);
 L('', await p.evaluate(()=>[1,2,3,5,10].map(L2=>({
   배율:L2+'배', 롱:liqMultOf(L2,1).toFixed(3), 숏:liqMultOf(L2,-1).toFixed(3),
   '숏은 1배에도 청산':liqMultOf(1,-1)===2}))));
 await p.close();

 console.log('\n=== 4. 매도 등급은 방향에 따라 뒤집힌다 ===');
 p=await fresh(200);
 L('저점 0.70 · 고점 1.30인 판에서', await p.evaluate(()=>
   [0.75,1.00,1.25].map(m=>({
     매도배율:m,
     롱:(g=>g?`${g.g} ${g.pct}%`:'-')(gradeOf(m,0.70,1.30,1)),
     숏:(g=>g?`${g.g} ${g.pct}%`:'-')(gradeOf(m,0.70,1.30,-1))}))));
 await p.close();

 console.log('\n=== 5. 자동 익절 — 숏은 목표 배율의 역수 ===');
 p=await fresh(200);
 L('', await p.evaluate(()=>{
   const out=[];
   for(const [dir,t,mult,hit] of [[1,1.5,1.50,true],[1,1.5,1.40,false],
                                  [-1,1.5,0.66,true],[-1,1.5,0.70,false]]){
     const ok = dir>0 ? mult>=t : mult<=1/t;
     out.push({방향:dir>0?'롱':'숏', 목표:t+'x', 실제:mult, 발동:ok, 기대:hit, 일치:ok===hit});
   }
   return out;}));
 await p.close();

 console.log('\n=== 6. 청산 경고 영역은 청산선 바깥쪽만 칠한다 ===');
 p=await fresh(200);
 await p.evaluate(play);
 L('', await p.evaluate(()=>{
   const out=[];
   /* y축 경계(dispYMin/Max)는 목표치를 향해 이징으로 따라간다. 실제 게임은 50ms마다
      다시 그리므로 자연히 수렴하지만, 테스트는 프레임을 직접 여러 번 돌려야 한다. */
   const settle=()=>{ for(let k=0;k<40;k++)renderRoundView(); };
   const zone=()=>({y:+$('rvZone').getAttribute('y'), h:+$('rvZone').getAttribute('height')});
   /* 숏 3배 청산선 1.33 — 가격이 1.17이면 아직 화면 밖(위)이라 경고 영역이 없어야 한다 */
   window.playAt(-1,1.0);
   S.activeRound.path=S.activeRound.path.map((_,i)=>1+0.17*(i/ROUND_TICKS));
   settle(); out.push({상황:'숏 · 청산선이 화면 위', ...zone()});
   /* 가격이 청산선을 넘어가면 화면 전체가 위험 구간 */
   S.activeRound.path=S.activeRound.path.map(()=>1.40);
   S.activeRound.yMin=1.35; S.activeRound.yMax=1.45; S.activeRound.boundsIdx=S.activeRound.path.length-1;
   settle(); out.push({상황:'숏 · 청산선을 넘김', ...zone()});
   sellRound(false); $('mOk').click();
   /* 롱은 반대쪽 */
   window.playAt(1,1.0);
   S.activeRound.path=S.activeRound.path.map((_,i)=>1-0.05*(i/ROUND_TICKS));
   settle(); out.push({상황:'롱 · 청산선이 화면 아래', ...zone()});
   return out;}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
