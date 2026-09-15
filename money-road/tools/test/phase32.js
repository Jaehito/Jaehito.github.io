/* phase32 — 윈도우 98 전환

   이 단계에서 깨질 수 있는 것은 "안 보이는 것"들이다. 웹폰트가 조용히 떨어지면
   픽셀이 아닌 고딕으로 그려지는데 오류는 안 난다. 아이콘은 SVG 문자열이라
   textContent에 넣으면 태그가 글자로 찍히는데 그것도 오류가 아니다.
   둘 다 실제로 당했다. 그래서 눈으로 확인하던 것을 여기 옮긴다.

   확인하는 것:
     1) 픽셀 서체가 실제로 로드됐는가 (CDN 없이 파일에 박혀 있다)
     2) 화면에 이모지가 한 글자도 안 남았는가
     3) 아이콘이 SVG로 그려지는가 — 태그가 글자로 새면 안 된다
     4) 글자 크기가 11의 배수인가
     5) 대화상자가 뜨면 부모 창 제목표가 회색이 되는가
     6) 메뉴바의 언어 전환이 도는가
     7) 진행바가 칸으로 끊어 차는가
     8) 390px에서 가로로 넘치거나 잘리는 곳이 없는가 */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 const p = await b.newPage({viewport:{width:390,height:820}, locale:'ko-KR'});
 p.on('pageerror',e=>errs.push('EXC: '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
 await p.goto(url); await p.waitForTimeout(400);
 await p.evaluate(()=>localStorage.clear());
 await p.reload(); await p.waitForTimeout(600);
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));
 const fail=[];
 const want=(name,got,exp)=>{ if(got!==exp)fail.push(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(exp)}`); };
 const dismiss=()=>p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });

 /* ── 1. 픽셀 서체 ── */
 console.log('=== 1. 서체 ===');
 const font=await p.evaluate(()=>({
   로드됨:document.fonts.check('22px Galmuri11'),
   본문서체:getComputedStyle(document.body).fontFamily,
   안티앨리어싱끔:getComputedStyle(document.body).webkitFontSmoothing,
   CDN링크:[...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>l.href),
 }));
 L('', font);
 want('서체 로드', font.로드됨, true);
 if(!/Galmuri11/.test(font.본문서체)) fail.push('본문 서체: '+font.본문서체);
 want('안티앨리어싱 끔', font.안티앨리어싱끔, 'none');
 if(font.CDN링크.length) fail.push('웹폰트 CDN이 남았다: '+font.CDN링크.join(','));

 /* ── 2. 이모지가 화면에 남았는가 ──
    사전·템플릿 어디에든 하나 새면 픽셀 화면에서 혼자 논다. 🛠 도구는 개발용이라 뺀다. */
 console.log('\n=== 2. 이모지 ===');
 await dismiss(); await p.waitForTimeout(200);
 const emoScan=async()=>p.evaluate(()=>{
   const re=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
   const hit=[];
   const walk=root=>{
     const it=document.createNodeIterator(root,NodeFilter.SHOW_TEXT);
     let n; while((n=it.nextNode())){
       const s=n.nodeValue;
       if(re.test(s))hit.push(s.trim().slice(0,30));
     }
   };
   walk($('app')); if($('modal').classList.contains('on'))walk($('modalBox'));
   return hit;
 });
 const screens=await p.evaluate(()=>{
   const out={};
   S.cash=3000000; S.level=6; META.xp=900; META.cleared=2; render();
   return out;
 });
 let emo=await emoScan();
 for(const tab of ['shop','unlock','trade']){
   await p.evaluate(t=>switchMainTab(t),tab); await p.waitForTimeout(120);
   emo=emo.concat(await emoScan());
 }
 /* 모달도 하나씩 열어서 훑는다 */
 const modals=['showIntroModal()','showTierModal()','showDexModal()','showRetireModal()',
               'showDefaultModal()','showBankruptModal()','showSettleModal(settleOf(0))',
               'showAwayModal({awaySec:5400,roundRefunded:{bet:200000}})'];
 for(const m of modals){
   await p.evaluate(e=>{ $('modal').classList.remove('on'); META.xp=2000; eval(e); },m);
   await p.waitForTimeout(120);
   emo=emo.concat(await emoScan());
 }
 await p.evaluate(()=>$('modal').classList.remove('on'));
 L('남은 이모지', emo);
 if(emo.length) fail.push('화면에 이모지가 남았다: '+JSON.stringify(emo.slice(0,6)));

 /* ── 3. 아이콘이 그림으로 나오는가 ──
    SVG 문자열을 textContent에 넣으면 "<svg class=..."가 글자로 찍힌다. 실제로 당했다. */
 console.log('\n=== 3. 아이콘 ===');
 await p.evaluate(()=>{switchMainTab('trade');render();});
 await p.waitForTimeout(150);
 const icons=await p.evaluate(()=>({
   개수:document.querySelectorAll('#app svg.ic').length,
   탭에아이콘:!!$('mtTrade').querySelector('svg.ic'),
   종목에아이콘:!!document.querySelector('.stock-tab svg.ic'),
   태그가글자로:/<svg|class="ic"/.test($('app').textContent),
   격자:[...document.querySelectorAll('#app svg.ic')].slice(0,4).map(s=>s.getAttribute('viewBox')),
 }));
 L('', icons);
 if(icons.개수<6) fail.push('아이콘이 너무 적다: '+icons.개수);
 want('탭 아이콘', icons.탭에아이콘, true);
 want('종목 아이콘', icons.종목에아이콘, true);
 want('태그가 글자로 새지 않음', icons.태그가글자로, false);
 if(icons.격자.some(v=>v!=='0 0 16 16')) fail.push('16×16 격자가 아니다: '+icons.격자);

 /* ── 4. 글자 크기는 11의 배수 ──
    Galmuri11은 11px 격자로 그려져서 배수가 아니면 글자가 뭉갠다. */
 console.log('\n=== 4. 글자 크기 ===');
 const sizes=await p.evaluate(()=>{
   const bad={};
   document.querySelectorAll('#app *').forEach(el=>{
     if(!el.offsetParent||!el.textContent.trim())return;
     const fs=parseFloat(getComputedStyle(el).fontSize);
     if(Math.abs(fs%11)>0.01) bad[fs]=(bad[fs]||0)+1;
   });
   return bad;
 });
 L('11의 배수가 아닌 크기', sizes);
 if(Object.keys(sizes).length) fail.push('11의 배수가 아닌 글자 크기: '+JSON.stringify(sizes));

 /* ── 5. 대화상자가 뜨면 부모 제목표가 죽는가 ──
    98이 초점을 옮기는 방식이고, 98을 써 본 사람이 가장 먼저 알아보는 자리다. */
 console.log('\n=== 5. 제목표 ===');
 let bar=await p.evaluate(()=>{
   const before=$('topbar').classList.contains('off');
   showIntroModal();
   return {before};
 });
 /* 제목표는 MutationObserver가 칠한다 — 마이크로태스크라 같은 틱에서는 아직이다 */
 await p.waitForTimeout(120);
 Object.assign(bar, await p.evaluate(()=>({
   during:$('topbar').classList.contains('off'),
   대화상자제목:$('modalBarTitle').textContent.trim(),
   대화상자아이콘:!!$('modalBarIcon').querySelector('svg'),
 })));
 await p.evaluate(()=>$('mOk').click());
 await p.waitForTimeout(150);
 bar.after=await p.evaluate(()=>$('topbar').classList.contains('off'));
 L('', bar);
 want('평소엔 활성', bar.before, false);
 want('대화상자 중엔 비활성', bar.during, true);
 want('닫으면 다시 활성', bar.after, false);
 want('대화상자 제목', bar.대화상자제목, '머니로드');
 want('대화상자 아이콘', bar.대화상자아이콘, true);

 /* ── 6. 메뉴바 언어 전환 ── 번역이 끝나서 🛠 도구 밖으로 나온 자리 */
 console.log('\n=== 6. 메뉴바 ===');
 await p.evaluate(()=>$('mnLang').click()); await p.waitForTimeout(150);
 const menu=await p.evaluate(()=>({
   열림:!!document.querySelector('.menu'),
   항목수:document.querySelectorAll('.menu [data-set]').length,
   현재표시:[...document.querySelectorAll('.menu [data-set]')]
     .filter(b=>b.querySelector('.rd').textContent.trim()).map(b=>b.dataset.set),
   높이:document.querySelector('.menubar > button').offsetHeight,
 }));
 await p.evaluate(()=>document.querySelector('.menu [data-set="en"]').click());
 await p.waitForTimeout(250);
 menu.누른뒤=await p.evaluate(()=>LANG);
 menu.화면=await p.evaluate(()=>$('mtTrade').textContent.trim());
 menu.닫힘=await p.evaluate(()=>!document.querySelector('.menu'));
 L('', menu);
 want('메뉴 열림', menu.열림, true);
 want('항목 3개', menu.항목수, 3);
 want('현재 언어에 표시', menu.현재표시.join(','), 'ko');
 want('여는 버튼 48px', menu.높이, 48);
 want('전환됨', menu.누른뒤, 'en');
 want('화면도 바뀜', menu.화면, 'Trade');
 want('고르면 닫힘', menu.닫힘, true);
 await p.evaluate(()=>setLang('ko'));

 /* ── 7. 진행바는 칸으로 ── 채우는 게 아니라 남은 거래일이 줄어드는 연료계다 */
 console.log('\n=== 7. 진행바 ===');
 const bars=await p.evaluate(()=>{
   const read=()=>{const b=$('repayStrip').querySelector('.lv-bar');
     return {전체:b.children.length, 찬칸:[...b.children].filter(i=>!i.classList.contains('e')).length};};
   const a=read();
   S.daysLeft=4; renderLevel();
   const c=read();
   return {시작:a, 'D-4':c};
 });
 L('', bars);
 want('칸 수 고정', bars.시작.전체, 13);
 want('시작은 가득', bars.시작.찬칸, 13);
 want('하루 가면 한 칸씩', bars['D-4'].찬칸, 4);

 /* ── 8. 390px에서 넘치거나 잘리는 곳 ── */
 console.log('\n=== 8. 폭 ===');
 await p.evaluate(()=>{S.daysLeft=13;render();});
 await p.waitForTimeout(200);
 const fit=await p.evaluate(()=>{
   const clip=[];
   document.querySelectorAll('#app *').forEach(el=>{
     if(!el.offsetParent)return;
     if(el.scrollWidth>el.clientWidth+2&&getComputedStyle(el).overflowX==='visible')
       clip.push((el.className||el.id)+' "'+el.textContent.trim().slice(0,22)+'"');
   });
   return {문서폭:document.documentElement.scrollWidth, 잘림:clip.slice(0,6), 잘림수:clip.length};
 });
 L('', fit);
 want('가로 스크롤 없음', fit.문서폭<=390, true);
 if(fit.잘림수) fail.push('잘리는 곳 '+fit.잘림수+'개: '+JSON.stringify(fit.잘림));

 /* ── 결과 ── */
 console.log('\n=== 결과 ===');
 if(errs.length){ console.log('페이지 오류:'); errs.forEach(e=>console.log('  '+e)); }
 if(fail.length){ console.log('실패:'); fail.forEach(f=>console.log('  ✗ '+f)); }
 else console.log('  ✓ 전부 통과');
 await b.close();
 if(fail.length||errs.length) process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
