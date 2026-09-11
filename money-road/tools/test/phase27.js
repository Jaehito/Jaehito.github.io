/* phase27 — E단계 마지막: 🪙 코인 · 그리고 라운드 길이가 종목별 속성이 된 것

   코인은 유일하게 시간축이 다른 종목이다(20초, 다른 종목은 15초). ROUND_TICKS가
   전역 상수였던 자리에 걸려 있던 것이 많아서, 그게 전부 종목별 틱을 따르는지 본다:
     1) 종목별 틱 수와 경로 길이
     2) 노이즈 보정 — 틱이 늘어도 흔들림의 크기는 같아야 한다
     3) 라운드에 ticks가 저장되고 새로고침 뒤에도 남는다
     4) 진행바·남은 시간이 그 종목의 틱을 기준으로 돈다
     5) 장중 뉴스가 코인에서도 정해진 구간에 뜬다
     6) y축 아래 여백이 0 밑으로 안 내려간다 (진폭 큰 종목에서 음수 눈금이 났다) */
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
   await p.evaluate(x=>{ META.xp=x; saveMeta(); S.themeUnlocked=true; S.upg.surge=true;
     S.cash=S.peakCash=9000000; S.upg.leverageLv=3; setBet(2000000); render(); }, xp);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 종목별 틱 수 ===');
 let p=await fresh(1000);
 L('', await p.evaluate(()=>Object.fromEntries(TRADE_STOCKS.map(st=>{
   const r=genRound(st,'mid');
   return [st.name,{ticks:ticksOf(st), 경로:r.path.length-1, 저장된ticks:r.ticks,
     초:+(ticksOf(st)*ROUND_TICK_MS/1000).toFixed(1),
     일치:r.path.length-1===ticksOf(st)&&r.ticks===ticksOf(st)}];}))));
 L('코인만 다르다', await p.evaluate(()=>({
   기본:ROUND_TICKS,
   코인:ticksOf(TRADE_STOCKS.find(s=>s.id==='coin')),
   나머지:TRADE_STOCKS.filter(s=>s.id!=='coin').every(s=>ticksOf(s)===ROUND_TICKS)})));
 await p.close();

 console.log('\n=== 2. 노이즈 보정 — 틱이 늘어도 흔들림은 같다 ===');
 p=await fresh(1000);
 L('횡보 패턴 200회의 평균 흔들림 (틱당 변화량 합 ÷ √틱수)', await p.evaluate(()=>{
   const wig=(st,T)=>{ let sum=0;
     for(let k=0;k<200;k++){ const path=PATTERNS.find(p=>p.id==='flat').gen(st,T);
       let d=0; for(let i=1;i<path.length;i++)d+=Math.abs(path[i]-path[i-1]);
       sum+=d/Math.sqrt(path.length-1); }
     return +(sum/200).toFixed(3); };
   const flat={pMult:1.0,noiseMult:1.0};
   const a=wig(flat,300), c=wig(flat,400), e=wig(flat,600);
   return {'300틱':a, '400틱':c, '600틱':e,
     '오차 10% 이내':Math.abs(c-a)/a<0.1&&Math.abs(e-a)/a<0.1};}));
 await p.close();

 console.log('\n=== 3. ticks가 라운드에 저장되고 살아남는다 ===');
 p=await fresh(1000);
 await p.evaluate(()=>{ S.selectedStock='coin'; setBet(2000000); startRound(1); saveRun(); });
 L('시작 직후', await p.evaluate(()=>({
   종목:S.activeRound.stockId, ticks:S.activeRound.ticks, 경로:S.activeRound.path.length-1})));
 await p.reload(); await p.waitForTimeout(400);
 L('새로고침 뒤', await p.evaluate(()=>({
   라운드있음:!!S.activeRound,
   ticks:S.activeRound?S.activeRound.ticks:null,
   경로:S.activeRound?S.activeRound.path.length-1:null})));
 await p.close();

 console.log('\n=== 4. 진행바·남은 시간이 종목별 틱 기준 ===');
 p=await fresh(1000);
 L('', await p.evaluate(()=>{
   const out=[];
   for(const id of ['stable','coin']){
     S.cash=9000000; setBet(2000000); S.selectedStock=id;
     startRound(1);
     const R=S.activeRound, T=R.ticks;
     const at=t=>{ R.startedAt=Date.now()-t*ROUND_TICK_MS;
       for(let k=0;k<3;k++)renderRoundView();
       return {남은:document.querySelector('.rt-r').textContent, 바:$('rvBar').style.width}; };
     const half=at(Math.round(T/2)), end=at(T+2);
     out.push({종목:TRADE_STOCKS.find(s=>s.id===id).name, ticks:T,
       시작:at(0), 절반:half, 끝:end});
     R.startedAt=Date.now()-(T+2)*ROUND_TICK_MS;
     sellRound(false); $('mOk').click();
   }
   return out;}));
 await p.close();

 console.log('\n=== 5. 뉴스가 코인에서도 구간 안에 뜬다 ===');
 p=await fresh(1000);
 L('각 2000회', await p.evaluate(()=>{
   const chk=(id)=>{ const st=TRADE_STOCKS.find(s=>s.id===id);
     let lo=1, hi=0;
     for(let k=0;k<2000;k++){ const path=genRound(st,'mid').path;
       const n=rollNews(path,st.name); const f=n.idx/(path.length-1);
       if(f<lo)lo=f; if(f>hi)hi=f; }
     return {구간:[+lo.toFixed(2),+hi.toFixed(2)], 설정:NEWS_AT,
       안에있나:lo>=NEWS_AT[0]-0.01&&hi<=NEWS_AT[1]+0.01}; };
   return {사성전자:chk('stable'), 코인:chk('coin')};}));
 await p.close();

 console.log('\n=== 6. y축 아래 여백이 0 밑으로 안 내려간다 ===');
 p=await fresh(1000);
 L('바닥까지 떨어지는 경로를 코인으로', await p.evaluate(()=>{
   S.cash=9000000; setBet(2000000); S.selectedStock='coin';
   startRound(1);
   const R=S.activeRound;
   R.path=R.path.map((_,i)=>Math.max(0.05,1-0.95*(i/R.ticks)));
   R.yMin=1;R.yMax=1;R.boundsIdx=0;R.dispYMin=1;R.dispYMax=1;
   R.startedAt=Date.now()-(R.ticks-1)*ROUND_TICK_MS;
   for(let k=0;k<60;k++)renderRoundView();
   const lo=document.querySelector('#rvTLo').textContent;
   return {아래눈금:lo, 값:parseFloat(lo), '0 이상':parseFloat(lo)>=0,
     dispYMin:+S.activeRound.dispYMin.toFixed(3)};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
