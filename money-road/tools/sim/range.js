/* 📏 종목 타일의 범위 막대 값(TRADE_STOCKS[].rng)을 실측한다.

   rng = [보통저, 보통고, 극단저, 극단고]. 판마다 「그 판에서 실제로 닿은 최저·최고」를
   모아서, 보통은 25~75 백분위, 극단은 10~90으로 끊는다(처음 실측 때 쓴 기준이다 —
   바꾸면 종목끼리 비교가 아니라 눈금이 달라진 것이 되므로 그대로 둔다).
   막대 눈금은 로그(0.05~3.5)다.

   ⚠️ 패턴 가중치·진폭·종목 patW를 고치면 반드시 다시 돌려야 한다 —
   안 그러면 막대가 거짓말을 한다. 값은 index.html의 rng에 손으로 옮겨 적는다.

   사용: node sim/range.js [N]   (기본 6000판) */
const G = require('./_game');
const N = parseInt(process.argv[2],10)||6000;
const IDS=['stable','theme','surge','etf','penny','coin'];
const pct=(a,p)=>a[Math.min(a.length-1,Math.max(0,Math.round((a.length-1)*p)))];

console.log(`■ 종목별 도달 범위 (N=${N} · 3단계 가중치)\n`);
for(const id of IDS){
  const st=G.STOCKS[id], pick=G.makePicker(0.04,st), Tt=G.ticksOf(st);
  const los=[], his=[];
  for(let k=0;k<N;k++){
    const arr=pick().gen(st,Tt);
    let lo=9, hi=0;
    for(let i=1;i<arr.length;i++){ if(arr[i]<lo)lo=arr[i]; if(arr[i]>hi)hi=arr[i]; }
    los.push(lo); his.push(hi);
  }
  los.sort((a,b)=>a-b); his.sort((a,b)=>a-b);
  const r=[pct(los,0.25), pct(his,0.75), pct(los,0.10), pct(his,0.90)].map(v=>+v.toFixed(2));
  const now=(st.rng||[]).join(',');
  console.log(`  ${st.name.padEnd(10)} rng:[${r.join(',')}]`+
    (now?`   지금 [${now}]`:''));
}
