/* phase29 — 패턴 분포 개편: 전반부가 등급을 숨기는가

   예전에는 강세 패턴의 저점이 전부 1.00 근처라 상승장이 한 번도 마이너스로
   안 내려갔다. 그래서 "초반에 빠지면 던진다"가 거의 언제나 맞는 규칙이 됐다.

   확인하는 것:
     1) 전반부(0~50%) 저점이 강세와 약세에서 겹치는가 — 이 개편의 목적 그 자체
     2) 급락 바닥이 3배 청산선(0.67) 위에 있는가 — 죽으면 판단할 기회가 없다
     3) 약세 판에 탈출 창이 열리는가 (급락 뒤 회복 고점)
     4) 강세는 끝에서 확실히 위, 약세는 확실히 아래
     5) 급등급락(spike)이 강세에서 빠졌는가
     6) 단조 패턴(쭉 오름/쭉 내림)이 소수인가
     7) 도감 스파크라인이 실제 모양과 맞는가 (방향만) */
const { launch, GAME: url } = require('../lib/browser');
(async()=>{
 const b = await launch();
 const errs=[];
 const p = await b.newPage({viewport:{width:390,height:800}});
 p.on('pageerror',e=>errs.push('EXC: '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push('CON: '+m.text());});
 await p.goto(url); await p.waitForTimeout(150);
 await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(350);
 await p.evaluate(()=>{ if($('modal').classList.contains('on')&&$('mOk'))$('mOk').click(); });
 const L=(t,v)=>console.log(t,JSON.stringify(v,null,1));

 /* 등급별로 가중치대로 뽑아 전반부 저점의 분위수를 낸다 */
 const HALF=`(t,st)=>{
   const sub=PATTERNS.filter(x=>PATTERN_TIER[x.id]===t);
   const tot=sub.reduce((a,x)=>a+x.weight,0), lows=[];
   for(let k=0;k<3000;k++){
     let r=Math.random()*tot,a=0,pk=sub[0];
     for(const x of sub){ a+=x.weight; if(r<=a){pk=x;break;} }
     const arr=pk.gen(st,300), h=Math.floor((arr.length-1)*0.5);
     let lo=9; for(let i=1;i<=h;i++) if(arr[i]<lo)lo=arr[i];
     lows.push(lo);
   }
   lows.sort((x,y)=>x-y);
   return {q25:+lows[(lows.length*0.25)|0].toFixed(3), q50:+lows[(lows.length*0.5)|0].toFixed(3),
           q75:+lows[(lows.length*0.75)|0].toFixed(3)};
 }`;

 console.log('=== 1. 전반부(0~50%) 저점이 겹치는가 ===');
 L('사성전자', await p.evaluate(`(()=>{
   const half=${HALF}, st=TRADE_STOCKS.find(s=>s.id==='stable');
   const S=half('strong',st), W=half('weak',st);
   return {강세:S, 약세:W,
     '중앙값 차이':+Math.abs(S.q50-W.q50).toFixed(3),
     겹침:Math.abs(S.q50-W.q50)<0.05};
 })()`));

 console.log('\n=== 2. 급락 바닥이 청산선 위인가 ===');
 L('', await p.evaluate(()=>{
   const out=[];
   for(const id of ['stable','etf','penny','coin']){
     const st=TRADE_STOCKS.find(s=>s.id===id);
     const liq=liqMultOf(3,1);
     let below=0, lows=[];
     for(let k=0;k<1500;k++){
       const a=PATTERNS.find(x=>x.id==='up').gen(st,ticksOf(st));
       const h=Math.floor((a.length-1)*0.5);
       let lo=9; for(let i=1;i<=h;i++) if(a[i]<lo)lo=a[i];
       lows.push(lo); if(lo<=liq)below++;
     }
     lows.sort((x,y)=>x-y);
     out.push({종목:st.name, pMult:st.pMult, '전반부 저점 중앙':+lows[750].toFixed(3),
       '3배 청산선':+liq.toFixed(3), '청산까지 간 비율':(below/1500*100).toFixed(0)+'%'});
   }
   return out;}));

 console.log('\n=== 3. 약세 판의 탈출 창 ===');
 L('사성전자 · 급락(0.85 이하) 뒤 회복 고점', await p.evaluate(()=>{
   const st=TRADE_STOCKS.find(s=>s.id==='stable'), liq=liqMultOf(3,1);
   const sub=PATTERNS.filter(x=>PATTERN_TIER[x.id]==='weak');
   const tot=sub.reduce((a,x)=>a+x.weight,0);
   let died=0; const best=[];
   for(let k=0;k<3000;k++){
     let r=Math.random()*tot,a=0,pk=sub[0];
     for(const x of sub){ a+=x.weight; if(r<=a){pk=x;break;} }
     const arr=pk.gen(st,300);
     let dip=false, hi=0, liqd=false;
     for(let i=1;i<arr.length;i++){
       if(arr[i]<=liq){liqd=true;break;}
       if(arr[i]<=0.85)dip=true;
       if(dip&&arr[i]>hi)hi=arr[i];
     }
     if(liqd)died++;
     if(dip&&hi>0)best.push(hi);
   }
   best.sort((x,y)=>x-y);
   const med=best.length?best[(best.length/2)|0]:0;
   return {'회복 고점 중앙값':+med.toFixed(3), '그때 3배 손익':Math.round((med-1)*300)+'%',
     '안 털면 청산까지':(died/3000*100).toFixed(0)+'%'};}));

 console.log('\n=== 4. 끝값은 확실히 갈리는가 ===');
 L('', await p.evaluate(()=>{
   const st=TRADE_STOCKS.find(s=>s.id==='stable');
   return PATTERNS.map(pt=>{
     let s=0; for(let k=0;k<1500;k++){const a=pt.gen(st,300); s+=a[a.length-1];}
     return {패턴:pt.name, 등급:PATTERN_TIER[pt.id], 끝값:+(s/1500).toFixed(2), 가중:pt.weight};
   });}));

 console.log('\n=== 5. 급등급락이 강세에서 빠졌는가 ===');
 L('', await p.evaluate(()=>({
   spike등급:PATTERN_TIER.spike,
   강세목록:PATTERNS.filter(p=>PATTERN_TIER[p.id]==='strong').map(p=>p.id+':'+p.weight),
   등급분포:(()=>{const o={strong:0,mid:0,weak:0};
     const t=PATTERNS.reduce((a,p)=>a+p.weight,0);
     PATTERNS.forEach(p=>o[PATTERN_TIER[p.id]]+=p.weight/t);
     return {강세:+o.strong.toFixed(2), 보통:+o.mid.toFixed(2), 약세:+o.weak.toFixed(2)};})()})));

 console.log('\n=== 6. 단조 패턴은 소수 ===');
 L('', await p.evaluate(()=>{
   const t=PATTERNS.reduce((a,p)=>a+p.weight,0);
   const mono=['delayup','delaydown'].reduce((a,id)=>a+PATTERNS.find(p=>p.id===id).weight,0);
   const strongTot=PATTERNS.filter(p=>PATTERN_TIER[p.id]==='strong').reduce((a,p)=>a+p.weight,0);
   return {'단조 비중':(mono/t*100).toFixed(0)+'%',
     '강세 안에서 쭉 오름':(PATTERNS.find(p=>p.id==='delayup').weight/strongTot*100).toFixed(0)+'%'};}));

 console.log('\n=== 7. 도감 스파크라인이 실제 방향과 맞는가 ===');
 L('', await p.evaluate(()=>{
   const st=TRADE_STOCKS.find(s=>s.id==='stable');
   return ['up','down','v'].map(id=>{
     const pt=PATTERNS.find(p=>p.id===id);
     let s=0; for(let k=0;k<800;k++){const a=pt.gen(st,300); s+=a[a.length-1];}
     const real=(s/800)>1 ? '상승' : '하락';
     /* 스파크라인은 y가 작을수록 위다. 마지막 y가 첫 y보다 작으면 "상승"으로 그린 것.
        "M2 8 L14 17 …" 처럼 명령과 x가 붙어 있으므로 숫자만 뽑아 홀수 번째가 y다. */
     const nums=pt.spark.match(/[\d.]+/g).map(Number);
     const ys=nums.filter((_,i)=>i%2===1);
     const drawn=ys[ys.length-1]<ys[0] ? '상승' : '하락';
     return {패턴:pt.name, 실제:real, 그림:drawn, 일치:real===drawn};});}));

 await p.close();
 console.log('\n=== 오류 ==='); console.log(errs.length?errs.join('\n'):'없음');
 await b.close();
})();
