/* 게임 스크린샷 — 상태를 강제로 만들어 놓고 찍는다.
   사용:  node tools/shot.js out.png [상태를_만드는_JS]
   예:    node tools/shot.js /tmp/a.png "S.cash=140000;S.daysLeft=1;setBet(70000);render()"
   첫 진입 안내 모달은 자동으로 닫는다. */
const { launch, GAME } = require('./lib/browser');
(async()=>{
  const [,,out='shot.png', setup=''] = process.argv;
  const b=await launch();
  const errs=[];
  const p=await b.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  p.on('pageerror',e=>errs.push('EXC: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CON: '+m.text());});
  await p.goto(GAME); await p.waitForTimeout(150);
  await p.evaluate(()=>localStorage.clear());
  await p.reload(); await p.waitForTimeout(350);
  await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
  if(setup){ await p.evaluate(setup); await p.waitForTimeout(250); }
  await p.screenshot({path:out, fullPage:true});
  console.log('저장:', out);
  console.log(errs.length?errs.join('\n'):'오류 없음');
  await b.close();
})();
