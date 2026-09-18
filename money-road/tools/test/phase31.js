/* phase31 — 언어 배선 (한국어/영어)

   한국어 사용자에게는 화면이 이전과 완전히 같아야 한다는 것이 이 단계의
   첫 번째 기준이다. 영어는 그 위에 얹히는 것이고, 빠진 문장이 있으면
   한국어로 떨어져야 한다 — 키 이름이 화면에 새는 일은 없어야 한다.

   확인하는 것:
     1) 한국어 기본 — 옮긴 문자열이 예전 그대로 나오는가
     2) 첫 실행 감지 — 브라우저 언어가 ko면 ko, 아니면 en
     3) 저장·복원 — 고른 언어가 새로고침을 넘기는가
     4) 전환 — setLang이 화면을 실제로 다시 그리는가
     5) 폴백 — 영어 사전에 없는 키가 한국어로 떨어지는가 (키 이름이 새면 안 된다)
     6) devWipe('all')이 언어를 지우지 않는가 (진행도가 아니라 환경설정이다)
     7) 🛠 도구에 언어 버튼이 있고 눌러서 바뀌는가
     8) 돈 표기 — 같은 정수가 한국어는 만/억, 영어는 $·K/M/B로 나오는가
     9) 날짜 표기 — 주말을 건너뛴 같은 날이 두 언어로 제대로 나오는가
    10) 체결 통지의 논평 — 리스크 관리팀이 등급·상황을 읽는가(무작위가 아니다)
    11) 모달 전수 검사 — 영어에서 한글이 남은 곳이 없는가 */
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
   탭없음:!document.querySelector('.main-tab'),
   퀵최대:[...document.querySelectorAll('.bet-row button[data-q]')].pop().textContent,
   레버리지:document.querySelector('.lev-row button').textContent.replace(/\s+/g,' ').trim(),
   청산줄:document.querySelector('.lev-note').textContent.replace(/\s+/g,' ').trim(),
   방향있음:!!document.querySelector('[data-d="1"]'),
   시작버튼:$('tradeGo').textContent.trim(),
   스트립:$('strip').querySelector('.fire').textContent.trim(),
   목표칩:$('tpGoal').textContent.replace(/\s+/g,' ').trim()
 }));
 L('', ko);
 want('기본 언어', ko.lang, 'ko');
 /* 98 전환에서 이모지가 전부 직접 그린 아이콘(SVG)으로 바뀌었다.
    아이콘은 마크업이라 textContent에는 낱말만 남는다. */
 /* 탭 컨트롤이 통째로 사라졌다 — 상점은 차수 배정 카드로, 배정표는 직급 칩을
    눌러 여는 대화상자로 갔다. 책상에 놓이는 것은 지금 결재할 종이 한 장이다. */
 want('탭이 없다', ko.탭없음, true);
 want('퀵 최대', ko.퀵최대, '최대');
/* 청산선은 버튼 안이 아니라 칸 밖 한 줄로 내려왔다 — 배율이 셋이 되면
    버튼마다 적을 폭이 안 나온다. */
 want('레버리지 3배', ko.레버리지, '3배');
 want('청산 줄', ko.청산줄, '청산 0.67x — 여기서 손실이 투자금 전액이 됩니다');
 want('연승 없음', ko.스트립, '연승 없음');
 want('목표 칩', ko.목표칩, '50만원·D-13');   // 한국어 표기는 만/억으로 끊는다
 /* 시작 버튼이 결재 도장이 됐다 — 「…로 시작」이라는 문장 대신 「매 수」 아래
    금액과 고른 종목이 한 줄. 주문표를 읽고 도장을 찍는 순서라 버튼이 동사가
    아니라 결재란이다. (「승 인」으로 냈다가 하는 일을 그대로 쓰는 쪽으로 바꿨다.) */
 if(!/^매 수/.test(ko.시작버튼)||!/5만원 × 3배 · 사성전자/.test(ko.시작버튼))
   fail.push('시작 버튼: '+ko.시작버튼);

 /* ── 2. 첫 실행 감지 ── */
 console.log('\n=== 2. 첫 실행 감지 ===');
 const en1=await fresh({locale:'en-US'}); await dismiss(en1);
 /* 탭이 사라져서 「영어 탭」으로 잡던 자리를 주문표 머리로 옮긴다 —
    로케일이 먹었는지를 보는 게 목적이라 어느 문자열이든 상관없다. */
 const enDetect=await en1.evaluate(()=>({lang:LANG, 머리:$('formTitle').textContent,
   퀵:[...document.querySelectorAll('.bet-row button[data-q]')].pop().textContent}));
 L('en-US', enDetect);
 want('en 로케일 감지', enDetect.lang, 'en');
 want('영어 주문표 머리', enDetect.머리, 'ORDER  SLIP');
 want('영어 퀵', enDetect.퀵, 'Max');
 const ja=await fresh({locale:'ja-JP'}); await dismiss(ja);
 want('ko가 아니면 en', await ja.evaluate(()=>LANG), 'en');

 /* ── 3. 저장·복원 ── */
 console.log('\n=== 3. 저장·복원 ===');
 await p.evaluate(()=>setLang('en'));
 const saved=await p.evaluate(()=>localStorage.getItem('moneyroad2_lang'));
 await p.reload(); await p.waitForTimeout(350); await dismiss(p);
 const after=await p.evaluate(()=>({lang:LANG, 탭:$('formTitle').textContent}));
 L('', {저장값:saved, 새로고침후:after});
 want('저장값', saved, 'en');
 want('새로고침 후 유지', after.lang, 'en');
 want('새로고침 후 화면', after.탭, 'ORDER  SLIP');

 /* ── 4. 전환이 화면을 다시 그리는가 ── */
 console.log('\n=== 4. 전환 ===');
 const swap=await p.evaluate(()=>{
   const before=$('formTitle').textContent;
   setLang('ko');
   const mid=$('formTitle').textContent;
   setLang('en');
   return {before, mid, after:$('formTitle').textContent};
 });
 L('', swap);
 want('en→ko 즉시 반영', swap.mid, '주 문 표');
 want('ko→en 즉시 반영', swap.after, 'ORDER  SLIP');
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
 await p.evaluate(()=>{ setLang('en'); META.xp=500; grantByXp(); saveMeta(); });
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

 /* ── 8. 돈 표기 ── */
 /* 내부 숫자는 하나다 — 같은 정수를 두 언어가 어떻게 쓰는지만 본다.
    영어는 100으로 나눠 달러로 쓰고, 1만 달러 위는 K/M/B로 한 자리만 남긴다. */
 console.log('\n=== 8. 돈 표기 ===');
 const nums=[0,100,10000,100000,500000,3000000,20000000,150000000,1000000000,8000000000,50000000000,99996000,-450000];
 const money=await p.evaluate(ns=>{
   const out={};
   for(const l of ['ko','en']){ setLang(l); out[l]=ns.map(fmtMoney); }
   return out;
 },nums);
 L('', money);
 want('한국어 시드',   money.ko[3],  '10만원');
 want('한국어 1차 목표', money.ko[4],  '50만원');
 want('한국어 최종 목표', money.ko[10], '500억원');
 want('한국어 손실',    money.ko[12], '-45만원');
 want('영어 0',        money.en[0],  '$0');
 want('영어 최소 베팅', money.en[2],  '$100');
 want('영어 시드',     money.en[3],  '$1,000');
 want('영어 1차 목표', money.en[4],  '$5,000');
 want('영어 K',       money.en[5],  '$30K');
 want('영어 소수 M',   money.en[7],  '$1.5M');
 want('영어 최종 목표', money.en[10], '$500M');
 want('1000K가 아니라 1M', money.en[11], '$1M');
 want('영어 손실 부호', money.en[12], '-$4,500');

 /* ── 9. 날짜 ── */
 console.log('\n=== 9. 날짜 ===');
 const dates=await p.evaluate(()=>{
   const out={};
   for(const l of ['ko','en']){ setLang(l); out[l]=[0,1,4,5].map(dateOfDay); }
   return out;
 });
 L('', dates);
 want('한국어 첫날', dates.ko[0], '3월 2일 (월)');
 want('한국어 주말 건너뛰기', dates.ko[3], '3월 9일 (월)');   // 4일차 금 → 5일차는 월요일
 want('영어 첫날', dates.en[0], 'Mar 2 (Mon)');
 want('영어 주말 건너뛰기', dates.en[3], 'Mar 9 (Mon)');

 /* ── 10. 체결 통지의 논평 ── */
 /* 커뮤니티 댓글이 있던 자리다. 체결 통지는 회사가 발행한 문서라 「공감 65」가
    붙어 있으면 톤이 안 맞았다 — 이제 리스크 관리팀이 읽는다. 무작위가 아니므로
    같은 판에는 같은 말이 나와야 한다(회사는 즉흥으로 말하지 않는다). */
 console.log('\n=== 10. 체결 통지 — 리스크 관리팀 ===');
 const rmc=await p.evaluate(()=>{
   const R=(over)=>Object.assign({mult:1.3,profit:300000,bet:1000000,lev:3,
     grade:{pct:50,g:'B'},hi:1.5,lo:0.9,streak:0,prevStreak:0,buffs:[],daysLeft:8},over);
   const dump=l=>{ setLang(l); return {
     B:rmResultLines(R({})),
     S:rmResultLines(R({grade:{pct:95,g:'S'}})),
     청산:rmResultLines(R({profit:-1000000})),
     연승:rmResultLines(R({streak:6})),
     마지막날:rmResultLines(R({daysLeft:1})),
     등급없음:rmResultLines(R({grade:null})),
   };};
   const ko=dump('ko'), en=dump('en');
   /* 같은 판을 스무 번 읽어도 같은 말이 나오는가 */
   setLang('ko');
   const same=new Set(); for(let i=0;i<20;i++)same.add(rmResultLines(R({})).join('|'));
   return {ko, en, 흔들림:same.size, 영어에한글:Object.values(en).flat().filter(x=>/[가-힣]/.test(x))};
 });
 L('한국어', rmc.ko); L('영어', rmc.en);
 want('같은 판은 같은 말', rmc.흔들림, 1);
 want('영어에 한글 없음', rmc.영어에한글.length, 0);
 want('청산은 등급을 말하지 않는다', rmc.ko.청산.length, 2);
 if(rmc.ko.연승.length!==2) fail.push('연승 줄이 안 붙는다: '+JSON.stringify(rmc.ko.연승));
 if(rmc.ko.B[0]===rmc.ko.S[0]) fail.push('등급별로 말이 안 갈린다');

 /* ── 11. 모달 전수 검사 ── */
 /* 영어로 두고 모달을 하나씩 열어 한글이 남았는지 본다. 사람이 눈으로 훑으면
    꼭 한두 개를 놓치는 자리라 기계에 맡긴다. 🛠 테스트 도구는 일부러 한국어라
    검사에서 뺀다 — 개발용이고 번역할 이유가 없다. */
 console.log('\n=== 11. 모달 전수 검사 (영어) ===');
 const leaks=await p.evaluate(()=>{
   setLang('en');
   S.cash=3000000; S.peakCash=8000000; S.upg.stoplossLv=1; S.upg.infoLv=1;
   META.xp=900; grantByXp(); META.cleared=2; S.level=6;
   const R={mult:1.62,profit:1800000,bet:1000000,lev:6,grade:{pct:88,g:'A'},hi:1.7,lo:0.9,
            streak:3,prevStreak:2,buffs:['info'],earned:['boost'],daysLeft:2,
            entry:1,half:null,watered:false,dir:1,tier:'win',
            list:[{name:'ChartGoblin',text:'clean exit',likes:12}]};
   const shots=[
     ['intro',     ()=>showIntroModal()],
     ['result',    ()=>showResultModal(R,null)],
     ['repay',     ()=>showRepayModal(GATES[0],null,3,50000)],
     ['default',   ()=>showDefaultModal()],
     ['bankrupt',  ()=>showBankruptModal()],
     ['retire',    ()=>showRetireModal()],
     ['settle',    ()=>showSettleModal(settleOf(0))],
     ['tier',      ()=>showTierModal()],
     ['dex',       ()=>showDexModal()],
     ['away',      ()=>showAwayModal({awaySec:5400,roundRefunded:{bet:200000}})],
   ];
   const out={};
   for(const [nm,fn] of shots){
     try{ fn(); }catch(e){ out[nm]='THREW: '+e.message; continue; }
     const txt=$('modalBox').textContent.replace(/\s+/g,' ').trim();
     const ko=txt.match(/[가-힣]+/g);
     if(ko)out[nm]=ko.join(' ');
   }
   /* 화면 본체도 같이 — 상점·해금·스트립·라운드 카드 */
   render();
   const body=['strip','tabsWrap']
     .map(id=>$(id)?$(id).textContent:'').join(' ');
   const bodyKo=body.match(/[가-힣]+/g);
   if(bodyKo)out['화면본체']=bodyKo.join(' ');
   return out;
 });
 L('', leaks);
 if(Object.keys(leaks).length) fail.push('영어에 한글이 남았다: '+JSON.stringify(leaks));

 /* ── 결과 ── */
 console.log('\n=== 결과 ===');
 if(errs.length){ console.log('페이지 오류:'); errs.forEach(e=>console.log('  '+e)); }
 if(fail.length){ console.log('실패:'); fail.forEach(f=>console.log('  ✗ '+f)); }
 else console.log('  ✓ 전부 통과');
 await b.close();
 if(fail.length||errs.length) process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
