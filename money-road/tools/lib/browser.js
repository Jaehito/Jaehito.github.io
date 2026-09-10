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
async function launch(){
  const {chromium}=require('playwright-core');
  const exe=chromePath();
  return chromium.launch({...(exe?{executablePath:exe}:{}) ,args:['--no-sandbox']});
}
/* 게임 파일의 file:// URL */
const GAME='file://'+path.resolve(__dirname,'..','..','index.html');
module.exports={chromePath,launch,GAME};
