/* phase24 — E단계 넷째: 📰 장중 뉴스

   확인하는 것:
     1) 해금 전에는 뉴스가 아예 안 생긴다
     2) truth는 "뉴스 시점 가격 vs 최종가"로 정해진다
     3) 적중률이 NEWS_ACC를 따른다 (표본으로)
     4) 문구가 방향에 맞는 풀에서 나오고 종목명을 단다
     5) 3초(NEWS_TICKS)만 떠 있다
     6) 결과 카드에서 사후에 적중/빗나감을 알려준다

   주의 — path를 손으로 바꾼 뒤에는 rollNews를 다시 불러야 한다. 뉴스의 truth는
   생성 시점의 path로 정해지므로, path만 갈아끼우면 뉴스가 옛 경로를 가리킨다. */
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
     S.cash=S.peakCash=5000000; S.upg.leverageLv=3; setBet(2000000); renderTrade(); }, xp);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 해금 전에는 뉴스가 없다 ===');
 let p=await fresh(0);
 L('', await p.evaluate(()=>{ startRound(1);
   const has=!!S.activeRound.news; S.activeRound=null;
   return {metaHas:metaHas('news'), 뉴스:has, 오버레이숨김:$('rvNews').hidden};}));
 await p.close();

 console.log('\n=== 2. truth = 뉴스 시점 가격 vs 최종가 ===');
 p=await fresh(500);
 L('', await p.evaluate(()=>{
   const out=[];
   /* 경로를 먼저 만들고 그 경로로 뉴스를 뽑는다 */
   const mk=(f)=>Array.from({length:ROUND_TICKS+1},(_,i)=>f(i/ROUND_TICKS));
   const cases=[
     ['끝까지 오름',   mk(f=>1+0.5*f)],
     ['끝까지 내림',   mk(f=>1-0.4*f)],
     ['올랐다 급락',   mk(f=>f<0.5?1+0.6*f:1.3-0.9*(f-0.5))],
   ];
   for(const [nm,path] of cases){
     const n=rollNews(path,'테스트');
     const now=path[n.idx], end=path[path.length-1];
     out.push({경로:nm, 뉴스시점:+now.toFixed(3), 최종가:+end.toFixed(3),
       truth:n.truth, 검산:(end>=now?'up':'down')===n.truth});
   }
   return out;}));
 await p.close();

 console.log('\n=== 3. 적중률 · 등장 구간 · 문구 ===');
 p=await fresh(500);
 L('표본 4000회', await p.evaluate(()=>{
   let hit=0, minF=1, maxF=0, badPool=0, noName=0;
   for(let k=0;k<4000;k++){
     const path=genRound(TRADE_STOCKS[0]).path;
     const n=rollNews(path,'사성전자');
     if(n.say===n.truth)hit++;
     const f=n.idx/ROUND_TICKS; if(f<minF)minF=f; if(f>maxF)maxF=f;
     const pool=n.say==='up'?NEWS_UP:NEWS_DOWN;
     if(!pool.some(t=>n.text.endsWith(t)))badPool++;
     if(!n.text.startsWith('사성전자'))noName++;
   }
   return {적중률:+(hit/4000).toFixed(3), 설정:NEWS_ACC,
     '오차 2%p 이내':Math.abs(hit/4000-NEWS_ACC)<0.02,
     등장구간:[+minF.toFixed(2),+maxF.toFixed(2)], 설정구간:NEWS_AT,
     '방향과 문구 불일치':badPool, '종목명 누락':noName};}));
 await p.close();

 console.log('\n=== 4. 3초만 떠 있다 ===');
 p=await fresh(500);
 L('', await p.evaluate(()=>{
   startRound(1);
   const R=S.activeRound; R.news.idx=100;
   const at=(tick)=>{ R.startedAt=Date.now()-tick*ROUND_TICK_MS; renderRoundView();
     return !$('rvNews').hidden; };
   return {'idx 99 (뜨기 전)':at(99), 'idx 100 (뜨는 순간)':at(100),
     'idx 159 (마지막)':at(100+NEWS_TICKS-1), 'idx 160 (사라짐)':at(100+NEWS_TICKS),
     NEWS_TICKS, 초:NEWS_TICKS*ROUND_TICK_MS/1000};}));
 await p.close();

 console.log('\n=== 5. 결과 카드가 사후에 알려준다 ===');
 p=await fresh(500);
 L('', await p.evaluate(()=>{
   const out=[];
   for(const forceHit of [true,false]){
     S.cash=5000000; setBet(2000000);
     startRound(1);
     const R=S.activeRound;
     /* 뉴스를 원하는 결과로 고정한다 */
     R.news.say = forceHit ? R.news.truth : (R.news.truth==='up'?'down':'up');
     R.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
     sellRound(false);
     const chip=[...document.querySelectorAll('.rs-chip')].find(x=>x.textContent.includes('뉴스'));
     out.push({의도:forceHit?'적중':'빗나감', 칩:chip?chip.textContent.trim():'(없음)',
       클래스:chip?chip.className:'-'});
     $('mOk').click();
   }
   return out;}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
