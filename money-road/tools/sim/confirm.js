/* ✅ 지금 index.html에 들어 있는 밸런스를 그대로 잰다.

   후보를 손으로 베껴 재던 파일이었는데, 이제 패턴이 게임에 들어갔으므로
   _game.js가 진짜 생성기를 끌어온다 — 베낀 사본을 재는 일이 없어졌다.
   (베끼던 동안 실제로 당했다: down의 눌림 깊이를 0.82로 박아둬서 DIP를
    올렸을 때 강세만 얕아지고 약세는 그대로였다.)

   비교 대상인 "지금"은 고치기 전 실측값이고 아래 표에 적어둔다.
   이 파일은 고친 뒤 값만 낸다.

     고치기 전 (DIP .84 · 하락 반등 100% · 나락 없음, N=600)
       클리어  트레일12 1% · 버티25 19% · 버티35 36% · 쫄보 0% · 홀드 0% · 신호 8%
       최고 36% · 격차 17%p
       전반부 저점  강세 0.85/0.87/0.89   약세 0.84/0.86/0.98
       판당 기댓값  트레일12 1.350 · 버티35 1.668  차이 +0.318
       약세 청산    77% · 중앙 12.3s · 3초 안에 0% · 반등 없이 죽음 15%
       종목별       사성전자 39% · 동전주 98% · 코인 2% · ETF 4%

   목표: 최고 24~27% · 격차 8%p 이내 · 판당 기댓값 차이 0 근처 ·
        전반부 저점은 강세와 약세가 겹칠 것.

   사용: node sim/confirm.js   (10분쯤) */
const G = require('./_game');
const T = 300, LEV = 3, LIQ = 1 - 1/LEV, LAG = 10;
const cash = v => Math.max(0, 1+(v-1)*LEV);

function picker(down, stock){
  const pw=(stock&&stock.patW)||null;
  const b = G.PATTERNS.map(p=> p.weight * (pw&&pw[p.id]!==undefined?pw[p.id]:1));
  const sS = G.PATTERNS.reduce((a,p,i)=>a+(G.PATTERN_TIER[p.id]==='strong'?b[i]:0),0);
  const wS = G.PATTERNS.reduce((a,p,i)=>a+(G.PATTERN_TIER[p.id]==='weak'  ?b[i]:0),0);
  const w = b.map((x,i)=>{ const t=G.PATTERN_TIER[G.PATTERNS[i].id];
    if(t==='weak')  return x+down*(x/wS);
    if(t==='strong')return x-down*(x/sS);
    return x; });
  const sum=w.reduce((a,c)=>a+c,0), n=w.map(x=>x/sum);
  const mix={strong:0,mid:0,weak:0}; G.PATTERNS.forEach((p,i)=>mix[G.PATTERN_TIER[p.id]]+=n[i]);
  return [()=>{ let r=Math.random(),a=0;
    for(let i=0;i<n.length;i++){a+=n[i]; if(r<=a)return {p:G.PATTERNS[i],t:G.PATTERN_TIER[G.PATTERNS[i].id]};}
    const L=G.PATTERNS.length-1; return {p:G.PATTERNS[L],t:G.PATTERN_TIER[G.PATTERNS[L].id]}; }, mix];
}
function warmTrail(path, warm, pb){
  let mx=path[0], pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ) return 0;
    if(pend>=0){ if(i>=pend) return cash(v); continue; }
    if(i<warm) continue;
    if(v>mx)mx=v; if(v<mx*(1-pb)) pend=i+LAG; }
  return cash(path[path.length-1]); }
function panic(path){ let mx=path[0],pend=-1;
  for(let i=1;i<path.length;i++){ const v=path[i];
    if(v<=LIQ)return 0; if(v<=0.96)return cash(v);
    if(pend>=0){ if(i>=pend)return cash(v); } else { if(v>mx)mx=v; if(v<mx*0.88)pend=i+LAG; } }
  return cash(path[path.length-1]); }
function hold(path){ for(let i=1;i<path.length;i++) if(path[i]<=LIQ)return 0;
  return cash(path[path.length-1]); }
const MODES={ '트레일12':p=>warmTrail(p,0,0.12), '버티25':p=>warmTrail(p,Math.floor(T*0.25),0.12),
  '버티35':p=>warmTrail(p,Math.floor(T*0.35),0.08), '쫄보':panic, '홀드':hold };
const GATES=[[5e5,13],[3e6,13],[2e7,13],[1.5e8,15],[1e9,15],[8e9,17],[5e10,17]];
const MIN_BET=10000, RATE=0.10, INFO_ACC=0.55, TIERS=['strong','mid','weak'];
const sigOf = t => Math.random()<INFO_ACC ? t : TIERS.filter(x=>x!==t)[(Math.random()*2)|0];
function runOne(pick, mode, stock){
  const Tt=G.ticksOf(stock); let money=1e5, total=0;
  for(const [goal,limit] of GATES){
    let left=limit;
    while(money<goal){
      if(left<=0)return '기한실패';
      if(money<MIN_BET)return '파산';
      const need=Math.pow(goal/money,1/left);
      const f=Math.min(1,Math.max(0.2,(need-1)/0.30));
      const bet=Math.max(MIN_BET,Math.min(money,Math.floor(money*f)));
      const {p,t}=pick(); let ret;
      if(mode==='신호'){ const s=sigOf(t);
        if(s==='weak'){ left--; total++; if(total>500)return '초과'; continue; }
        ret=warmTrail(p.gen(stock,Tt), s==='strong'?Math.floor(T*0.35):0, 0.12); }
      else ret=MODES[mode](p.gen(stock,Tt));
      money=money-bet+Math.max(0,bet*ret);
      left--; total++; if(total>500)return '초과';
    }
    money+=goal*RATE*Math.max(0,left);
  }
  return '클리어';
}
const ST=G.STOCKS.stable, ALL=[...Object.keys(MODES),'신호'], NN=600;
const [nb,wb]=G.getDownMix();
console.log(`■ 지금 값 — DIP ${G.getDIP()} · 하락 반등 없음 ${(nb*100)|0}% · 얕음 ${(wb*100)|0}% · 나락 ${G.byId('crash').weight}\n`);

console.log('■ 클리어율 · 파산률 (N=600 · 사성전자 · 3배 · 3단계)\n');
{
  const [pick]=picker(0.04,ST);
  const row=ALL.map(m=>{ let cl=0,bk=0;
    for(let k=0;k<NN;k++){ const r=runOne(pick,m,ST); if(r==='클리어')cl++; if(r==='파산')bk++; }
    return [cl/NN*100, bk/NN*100]; });
  const cl=row.map(r=>r[0]), sorted=cl.slice().sort((a,b)=>b-a);
  console.log('  클리어  '+ALL.map((m,i)=>`${m} ${cl[i].toFixed(0)}%`).join(' · '));
  console.log('  파산    '+ALL.map((m,i)=>`${m} ${row[i][1].toFixed(0)}%`).join(' · '));
  console.log(`  최고 ${sorted[0].toFixed(0)}% · 격차 ${(sorted[0]-sorted[1]).toFixed(0)}%p   (전 36% · 17%p)\n`);
}

console.log('■ 전반부(0~50%) 저점만으로 등급이 읽히는가 — 겹쳐야 한다 (전 강세 0.85/0.87/0.89 · 약세 0.84/0.86/0.98)\n');
{
  const q=t=>{ const sub=G.PATTERNS.filter(p=>G.PATTERN_TIER[p.id]===t);
    const tot=sub.reduce((a,p)=>a+p.weight,0), lows=[];
    for(let k=0;k<4000;k++){ let r=Math.random()*tot,a=0,pk=sub[0];
      for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
      const arr=pk.gen(ST,T), h=Math.floor(T*0.5);
      let lo=9; for(let i=1;i<=h;i++) if(arr[i]<lo)lo=arr[i];
      lows.push(lo); }
    lows.sort((x,y)=>x-y);
    return [lows[(lows.length*0.25)|0], lows[(lows.length*0.5)|0], lows[(lows.length*0.75)|0]]; };
  const S=q('strong'), W=q('weak');
  console.log(`  강세 ${S.map(v=>v.toFixed(2)).join('/')}   약세 ${W.map(v=>v.toFixed(2)).join('/')}\n`);
}

console.log('■ 시초를 버리는 봇이 특별대우를 받는가 — 차이가 0 근처여야 한다 (전 +0.318)\n');
{
  const [pick]=picker(0.04,ST); const N=40000; let a=0,b=0;
  for(let k=0;k<N;k++){ const p=pick().p.gen(ST,T);
    a+=warmTrail(p,0,0.12); b+=warmTrail(p,Math.floor(T*0.35),0.08); }
  console.log(`  트레일12 ${(a/N).toFixed(3)} · 버티35 ${(b/N).toFixed(3)}  차이 ${((b-a)/N).toFixed(3)}\n`);
}

console.log('■ 하락 판의 반등이 어떤 얼굴로 오는가 — 셋이 실제로 갈리는가\n');
{
  const d=G.byId('down'); const buckets={'본전 못 넘음':0,'1.00~1.05':0,'1.05 위':0,'안 올라옴':0};
  const N=8000;
  for(let k=0;k<N;k++){
    const arr=d.gen(ST,T);
    /* 머리 골짜기가 끝난 뒤부터 재야 한다. 0.95를 처음 깬 지점부터 재면
       그 지점의 값(≈0.95)이 그대로 최고가 되어, 반등이 아예 없는 판도
       "본전 못 넘는 반등"으로 세어진다 — 처음에 그렇게 나왔다. */
    let lowAt=1, lowV=9;
    for(let i=1;i<=Math.floor(T*0.40);i++) if(arr[i]<lowV){lowV=arr[i];lowAt=i;}
    let top=0; for(let i=lowAt;i<=T;i++) if(arr[i]>top)top=arr[i];
    if(top<0.93)buckets['안 올라옴']++;
    else if(top<1.00)buckets['본전 못 넘음']++;
    else if(top<1.05)buckets['1.00~1.05']++;
    else buckets['1.05 위']++;
  }
  console.log('  '+Object.entries(buckets).map(([k,v])=>`${k} ${(v/N*100).toFixed(0)}%`).join(' · ')+'\n');
}

console.log('■ 파산이 가능한가 — 약세 판이 반응할 틈을 주는가 (전 77% · 12.3s · 3초 0% · 반등없이 15%)\n');
{
  const sub=G.PATTERNS.filter(p=>G.PATTERN_TIER[p.id]==='weak');
  const tot=sub.reduce((a,p)=>a+p.weight,0);
  const secs=[]; let died=0, fast=0, nob=0, n=8000;
  for(let k=0;k<n;k++){
    let r=Math.random()*tot,a=0,pk=sub[0];
    for(const p of sub){ a+=p.weight; if(r<=a){pk=p;break;} }
    const arr=pk.gen(ST,T); let li=-1, dipAt=-1, hiAfter=0;
    for(let i=1;i<=T;i++){
      if(arr[i]<=LIQ){li=i;break;}
      if(dipAt<0){ if(arr[i]<0.90)dipAt=i; } else if(arr[i]>hiAfter)hiAfter=arr[i];
    }
    if(li<0)continue;
    died++; secs.push(li*0.05); if(li*0.05<=3)fast++;
    if(dipAt<0 || hiAfter<0.97)nob++;
  }
  secs.sort((x,y)=>x-y);
  console.log(`  청산률 ${(died/n*100).toFixed(0)}% · 중앙 ${secs[secs.length>>1].toFixed(1)}s · `+
    `3초 안에 ${(fast/died*100).toFixed(0)}% · 반등 없이 죽음 ${(nob/died*100).toFixed(0)}%\n`);
}

console.log('■ 종목별 클리어율 (버티35 · N=300) — 전 사성전자 39% · 동전주 98% · 코인 2% · ETF 4%\n');
{
  const cells=['stable','penny','coin','etf'].map(id=>{
    const st=G.STOCKS[id]; const [pick]=picker(0.04,st);
    let cl=0; for(let k=0;k<300;k++) if(runOne(pick,'버티35',st)==='클리어')cl++;
    return `${st.name} ${(cl/300*100).toFixed(0)}%`; });
  console.log('  '+cells.join(' · '));
}
