# status-board

상황판의 의회·작업 화면 코드와, 문서를 쪼개 읽는 부품을 한 벌만 두는 저장소다.

- `doc-parse.mjs` — 문서의 항목(`## [작업 N] | …` 같은 줄)을 읽는 부품
- `assembly-view.mjs` — 의회 법안이 들어갈 자리를 알아보고 지금 글과 짝짓는 부품
- `doc-parse.test.mjs` — 문서 읽기 부품의 시험(`node doc-parse.test.mjs`)
- `doc-mark.mjs` — 의회 법안·설계실 설계안·작업 항목에 답과 코멘트를 적는 부품(PC 앱 통로 `doc-mark.cjs`와 모바일 앱이 함께 쓴다)
- `doc-mark.test.mjs` — 답 적기 부품의 시험(`node doc-mark.test.mjs`)
- `github.mjs` — GitHub 통로: 열쇠로 문서를 읽고, 찍은 답을 커밋 하나로 적으며, 그사이 파일이 바뀌었으면 다시 읽어 그 위에 적는다
- `github.test.mjs` — GitHub 통로의 시험(`node github.test.mjs`, 공개 저장소를 실제로 읽어 보려면 `--live`를 붙인다)

모바일 앱은 이 저장소를 GitHub Pages로 띄우고, PC 앱은 옆 폴더(`../management/tools/`)에서 이 부품을 읽는다. 문서는 비공개 저장소에 있고, 화면은 사용자의 GitHub 열쇠로 그 문서를 읽는다. 이 저장소에는 문서를 두지 않는다.
