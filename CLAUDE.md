# 작업 규칙

- **구현 전 반드시 사용자 허락을 받을 것.** 코드를 작성/수정하기 전에 계획을 먼저 설명하고 승인을 받은 뒤에 진행한다. 승인 없이 바로 구현하지 않는다.

- **UI/UX가 바뀌면 예상 화면을 HTML로 먼저 보여줄 것.** 화면 구성·배치·색·문구가 달라지는 작업은 계획을 글로만 설명하지 말고, 실제 스타일을 그대로 쓴 목업 HTML을 만들어 함께 제시한다. 승인은 그 목업을 보고 받는다.

- **기능을 고치거나 더하거나 없앴으면 배포까지 할 것.** 커밋에서 끝내지 말고 `master`에 올려 실제 사이트에 반영한다. 배포 전에 `money-road/tools/check.sh`와 `npm test`가 모두 통과해야 한다.

  ```bash
  cd money-road/tools && ./check.sh && npm test
  git push -u origin <작업브랜치>
  git checkout master && git merge --ff-only <작업브랜치> && git push origin master
  ```

  GitHub Pages가 `master`를 직접 서빙한다 — 브랜치에만 올리면 사이트는 그대로다.
  문서나 도구만 고친 경우는 배포하지 않아도 된다.
