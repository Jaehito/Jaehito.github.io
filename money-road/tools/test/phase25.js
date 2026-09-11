/* phase25 — E단계 다섯째: 📊 코스피ETF · 그리고 종목이 "성격"을 갖는 구조

   원래 ETF는 "신호가 항상 맞는 종목"으로 잡았는데, 구현해 보니 익스플로잇이 열린다:
   신호는 라운드가 끝날 때 한 번 뽑히고 종목을 바꿔도 안 바뀌므로(좋은 신호가 뜰 때까지
   종목을 돌리는 걸 막으려고 그렇게 돼 있다), ETF에서 참값을 보고 진폭 큰 종목으로
   갈아타면 그만이다 — ETF가 다른 종목의 치트키가 된다.

   그래서 구조를 바꿨다: 신호는 "등급"까지만 말하고, 그 등급 안에서 어떤 패턴이 나올지를
   종목이 정한다. 등급 분포가 종목과 무관하므로 종목을 바꿔도 신호가 유효하고,
   동시에 종목마다 다른 판이 나온다.

   확인하는 것:
     1) pending이 등급 구조다 (patId를 안 쓴다)
     2) 종목을 바꿔도 신호가 그대로다 — 익스플로잇이 닫혔는지
     3) ETF는 급변 패턴이 안 나온다 (strong=up만, weak=down/flat)
     4) 다른 종목은 기본 분포 그대로
     5) 어떤 종목도 한 등급을 통째로 막지 않는다
     6) 해금 전에는 잠겨 있다 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(xp,openAll){const p=await b.newPage({viewport:{width:420,height:900}});
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
   await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
   await p.evaluate(([x,o])=>{ META.xp=x; saveMeta();
     if(o){S.themeUnlocked=true; S.upg.surge=true;}
     S.cash=S.peakCash=5000000; S.upg.leverageLv=3; setBet(2000000); render(); }, [xp,openAll]);
   return p;}
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 console.log('=== 1. 해금 전에는 잠겨 있다 ===');
 let p=await fresh(0,false);
 L('', await p.evaluate(()=>({
   metaHas:metaHas('etf'),
   탭:[...document.querySelectorAll('.stock-tab')].map(e=>
     (e.classList.contains('locked')?'🔒 ':'')+e.querySelector('.n').textContent),
   열수:getComputedStyle($('stockTabs')).gridTemplateColumns.split(' ').length})));
 await p.close();

 console.log('\n=== 2. pending은 등급만 담는다 ===');
 p=await fresh(600,true);
 L('', await p.evaluate(()=>{ rollPending();
   return {pending:S.pending, 'patId 없음':S.pending.patId===undefined,
     'tier가 신호 등급 중 하나':SIGNAL_TIERS.includes(S.pending.tier)};}));
 await p.close();

 console.log('\n=== 3. 종목을 바꿔도 신호가 그대로 (익스플로잇이 닫혔나) ===');
 p=await fresh(600,true);
 L('같은 pending에서 네 종목을 돌려본다', await p.evaluate(()=>{
   rollPending();
   const tier=S.pending.tier, sig=S.pending.sig;
   const seen=TRADE_STOCKS.map(st=>{ S.selectedStock=st.id; renderTrade();
     return {종목:st.name, 신호:document.querySelector('.sg-name').textContent}; });
   return {pending:{tier,sig}, 화면:seen,
     '전부 같은 신호':new Set(seen.map(x=>x.신호)).size===1,
     'pending 안 바뀜':S.pending.tier===tier&&S.pending.sig===sig};}));
 await p.close();

 console.log('\n=== 4. 등급 안 패턴 분포 — 종목마다 다르다 ===');
 p=await fresh(600,true);
 L('각 4000회', await p.evaluate(()=>{
   const out={};
   for(const st of TRADE_STOCKS){
     const row={};
     for(const tier of ['strong','mid','weak']){
       const c={};
       for(let k=0;k<4000;k++){ const id=pickInTier(tier,st).id; c[id]=(c[id]||0)+1; }
       row[tier]=Object.entries(c).sort((a,b)=>b[1]-a[1])
         .map(([k,v])=>`${k} ${(v/40).toFixed(0)}%`).join(' · ');
     }
     out[st.name]=row;
   }
   return out;}));
 L('ETF 검증', await p.evaluate(()=>{
   const etf=TRADE_STOCKS.find(s=>s.id==='etf');
   const ids=t=>{const set=new Set();
     for(let k=0;k<4000;k++)set.add(pickInTier(t,etf).id); return [...set].sort();};
   return {strong:ids('strong'), weak:ids('weak'), mid:ids('mid'),
     '급변 패턴 없음':![...ids('strong'),...ids('weak')].some(x=>['spike','delayup','delaydown'].includes(x)),
     진폭:etf.pMult, '사성전자 대비':`${(etf.pMult/1.0*100).toFixed(0)}%`};}));
 await p.close();

 console.log('\n=== 5. 어떤 종목도 한 등급을 통째로 막지 않는다 ===');
 p=await fresh(600,true);
 L('', await p.evaluate(()=>
   TRADE_STOCKS.map(st=>({종목:st.name,
     ...Object.fromEntries(['strong','mid','weak'].map(t=>
       [t, !!(pickInTier(t,st)&&PATTERN_TIER[pickInTier(t,st).id]===t)]))}))));
 await p.close();

 console.log('\n=== 6. ETF로 실제 라운드가 돌아간다 ===');
 p=await fresh(600,true);
 L('강세 신호 · ETF 20판', await p.evaluate(()=>{
   const c={}; let maxHi=0;
   for(let k=0;k<20;k++){
     S.cash=5000000; setBet(1000000); S.selectedStock='etf';
     S.pending={tier:'strong',sig:'strong'};
     startRound(1);
     const R=S.activeRound;
     c[R.patternId]=(c[R.patternId]||0)+1;
     const hi=Math.max(...R.path); if(hi>maxHi)maxHi=hi;
     R.startedAt=Date.now()-(ROUND_TICKS+2)*ROUND_TICK_MS;
     sellRound(false); $('mOk').click();
   }
   return {패턴:c, '최고 배율':+maxHi.toFixed(2), '급등 없음':maxHi<2.2};}));
 await p.close();

 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
