/* Playwright 실행 파일 찾기 — 환경마다 chromium 빌드 번호가 달라서 고정 경로를 쓸 수 없다.
   PW_CHROME 환경변수, 그다음 /opt/pw-browsers 안의 최신 chromium, 마지막으로 playwright 기본 탐색. */
const fs=require('fs'), path=require('path');
function chromePath(){
  if(process.env.PW_CHROME&&fs.existsSync(process.env.PW_CHROME))return process.env.PW_CHROME;
  const root='/opt/pw-browsers';
  if(fs.existsSync(root)){
    for(const d of fs.readdirSync(root).filter(x=>x.startsWith('chromium-')).sort().reverse()){
      const p=path.join(root,d,'chrome-linux','chrome');
      if(fs.existsSync(p))return p;
    }
  }
  return undefined;   // playwright가 알아서 찾게 둔다
}
/* newPage의 기본 로케일을 ko-KR로 못 박는다.
   게임이 navigator.language로 첫 언어를 정하기 때문에, 이걸 두지 않으면 회귀
   테스트가 컨테이너 로케일을 따라간다 — 여기 컨테이너는 en-US라서 15~30단계
   로그가 조용히 영어로 바뀌어 있었다. 예전 출력과 비교가 안 되면 회귀 로그는
   쓸모없다. 언어 자체를 보는 테스트(phase31)는 locale을 직접 넘겨서 덮는다. */
async function launch(){
  const {chromium}=require('playwright-core');
  const exe=chromePath();
  const b=await chromium.launch({...(exe?{executablePath:exe}:{}) ,args:['--no-sandbox']});
  const orig=b.newPage.bind(b);
  b.newPage=(opt)=>orig(Object.assign({locale:'ko-KR'},opt||{}));
  return b;
}
/* 게임 파일의 file:// URL */
const GAME='file://'+path.resolve(__dirname,'..','..','index.html');
module.exports={chromePath,launch,GAME};
