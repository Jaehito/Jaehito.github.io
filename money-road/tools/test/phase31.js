/* phase31 — 언어 배선 (한국어/영어)

   이 단계의 성공 기준은 "아무것도 안 달라 보인다"다. 문자열 458개 중
   단타 탭 일부만 t()로 옮긴 상태이므로, 한국어 사용자에게는 화면이
   이전과 완전히 같아야 하고 영어는 없는 문장이 한국어로 남아야 한다.

   확인하는 것:
     1) 한국어 기본 — 옮긴 문자열이 예전 그대로 나오는가
     2) 첫 실행 감지 — 브라우저 언어가 ko면 ko, 아니면 en
     3) 저장·복원 — 고른 언어가 새로고침을 넘기는가
     4) 전환 — setLang이 화면을 실제로 다시 그리는가
     5) 폴백 — 영어 사전에 없는 키가 한국어로 떨어지는가 (키 이름이 새면 안 된다)
     6) devWipe('all')이 언어를 지우지 않는가 (진행도가 아니라 환경설정이다)
     7) 🛠 도구에 언어 버튼이 있고 눌러서 바뀌는가 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 async function fresh(opt){
   const p=await b.newPage(Object.assign({viewport:{width:390,height:740}}, opt||{}));
   p.on('pageerror',e=>errs.push('EXC: '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
   await p.goto(url); await p.waitForTimeout(150);
   await p.evaluate(()=>localStorage.clear());
   await p.reload(); await p.waitForTimeout(350);
   return p;
 }
 const dismiss=p=>p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 const fail=[];
 const want=(name,got,exp)=>{ if(got!==exp)fail.push(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(exp)}`); };

 /* ── 1. 한국어 기본 — 옮긴 문자열이 예전 그대로인가 ── */
 console.log('=== 1. 한국어 기본 (ko 로케일) ===');
 let p=await fresh({locale:'ko-KR'}); await dismiss(p);
 const ko=await p.evaluate(()=>({
   lang:LANG,
   탭:[$('mtTrade').textContent,$('mtShop').textContent,$('mtUnlock').textContent],
   퀵최대:[...document.querySelectorAll('.bet-quicks button')].pop().textContent,
   레버리지:document.querySelector('.lev-row button').textContent.replace(/\s+/g,' ').trim(),
   방향있음:!!document.querySelector('[data-d="1"]'),
   시작버튼:$('tradeGo').textContent.trim(),
   스트립:$('strip').querySelector('.fire').textContent.trim(),
   목표칩:$('tpGoal').textContent.replace(/\s+/g,' ').trim()
 }));
 L('', ko);
 want('기본 언어', ko.lang, 'ko');
 want('단타 탭', ko.탭[0], '🎯 단타');
 want('상점 탭', ko.탭[1], '🛒 상점');
 want('해금 탭', ko.탭[2], '🔓 해금');
 want('퀵 최대', ko.퀵최대, '최대');
 want('레버리지 3배', ko.레버리지, '3배 청산 0.67x');
 want('연승 없음', ko.스트립, '🔥 연승 없음');
 want('목표 칩', ko.목표칩, '🔗 50만원·D-13');   // fmtWon은 만/억으로 쓴다
 if(!/로 시작$/.test(ko.시작버튼)) fail.push('시작 버튼: '+ko.시작버튼);

 /* ── 2. 첫 실행 감지 ── */
 console.log('\n=== 2. 첫 실행 감지 ===');
 const en1=await fresh({locale:'en-US'}); await dismiss(en1);
 const enDetect=await en1.evaluate(()=>({lang:LANG, 탭:$('mtTrade').textContent, 퀵:[...document.querySelectorAll('.bet-quicks button')].pop().textContent}));
 L('en-US', enDetect);
 want('en 로케일 감지', enDetect.lang, 'en');
 want('영어 탭', enDetect.탭, '🎯 Trade');
 want('영어 퀵', enDetect.퀵, 'Max');
 const ja=await fresh({locale:'ja-JP'}); await dismiss(ja);
 want('ko가 아니면 en', await ja.evaluate(()=>LANG), 'en');

 /* ── 3. 저장·복원 ── */
 console.log('\n=== 3. 저장·복원 ===');
 await p.evaluate(()=>setLang('en'));
 const saved=await p.evaluate(()=>localStorage.getItem('moneyroad2_lang'));
 await p.reload(); await p.waitForTimeout(350); await dismiss(p);
 const after=await p.evaluate(()=>({lang:LANG, 탭:$('mtTrade').textContent}));
 L('', {저장값:saved, 새로고침후:after});
 want('저장값', saved, 'en');
 want('새로고침 후 유지', after.lang, 'en');
 want('새로고침 후 화면', after.탭, '🎯 Trade');

 /* ── 4. 전환이 화면을 다시 그리는가 ── */
 console.log('\n=== 4. 전환 ===');
 const swap=await p.evaluate(()=>{
   const before=$('mtTrade').textContent;
   setLang('ko');
   const mid=$('mtTrade').textContent;
   setLang('en');
   return {before, mid, after:$('mtTrade').textContent};
 });
 L('', swap);
 want('en→ko 즉시 반영', swap.mid, '🎯 단타');
 want('ko→en 즉시 반영', swap.after, '🎯 Trade');
 want('잘못된 값은 무시', await p.evaluate(()=>{setLang('zz');return LANG;}), 'en');

 /* ── 5. 폴백 — 영어에 없으면 한국어로 ── */
 console.log('\n=== 5. 폴백 ===');
 const fb=await p.evaluate(()=>{
   const keep=L.en.qMax; delete L.en.qMax;
   const got=t('qMax');
   L.en.qMax=keep;
   return {없는키:t('존재하지않는키'), 영어에없음:got, 채우기:t('dday',{n:7})};
 });
 L('', fb);
 want('영어에 없으면 한국어', fb.영어에없음, '최대');
 want('사전에 아예 없으면 키 그대로', fb.없는키, '존재하지않는키');
 want('{} 채우기', fb.채우기, 'D-7');

 /* ── 6. devWipe이 언어를 안 지우는가 ── */
 console.log('\n=== 6. 전부 초기화 ===');
 await p.evaluate(()=>{ setLang('en'); META.xp=500; saveMeta(); });
 await p.evaluate(()=>devWipe('all'));
 await p.waitForTimeout(500); await dismiss(p);
 const wiped=await p.evaluate(()=>({
   lang:localStorage.getItem('moneyroad2_lang'), LANG:LANG, xp:META.xp|0
 }));
 L('', wiped);
 want('언어는 남는다', wiped.lang, 'en');
 want('언어 적용도 유지', wiped.LANG, 'en');
 want('진행도는 지워진다', wiped.xp, 0);

 /* ── 7. 🛠 도구 언어 버튼 ── */
 console.log('\n=== 7. 테스트 도구 ===');
 await p.evaluate(()=>{ const e=new Event('click'); $('brandTap').dispatchEvent(e); $('brandTap').dispatchEvent(e); });
 await p.waitForTimeout(250);
 const devOpen=await p.evaluate(()=>$('modal').classList.contains('on')&&!!document.querySelector('.dv-tab'));
 let devLang={열림:devOpen};
 if(devOpen){
   await p.evaluate(()=>{ const b=[...document.querySelectorAll('.dv-tab')].find(x=>/시작/.test(x.textContent)); if(b)b.click(); });
   await p.waitForTimeout(200);
   devLang.버튼수=await p.evaluate(()=>document.querySelectorAll('[data-lang]').length);
   await p.evaluate(()=>{ const b=document.querySelector('[data-lang="ko"]'); if(b)b.click(); });
   await p.waitForTimeout(250);
   devLang.누른뒤=await p.evaluate(()=>LANG);
 }
 L('', devLang);
 want('도구 열림', devLang.열림, true);
 want('언어 버튼 2개', devLang.버튼수, 2);
 want('버튼으로 전환', devLang.누른뒤, 'ko');

 /* ── 결과 ── */
 console.log('\n=== 결과 ===');
 if(errs.length){ console.log('페이지 오류:'); errs.forEach(e=>console.log('  '+e)); }
 if(fail.length){ console.log('실패:'); fail.forEach(f=>console.log('  ✗ '+f)); }
 else console.log('  ✓ 전부 통과');
 await b.close();
 if(fail.length||errs.length) process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
