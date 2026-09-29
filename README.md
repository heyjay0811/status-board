# status-board

상황판의 의회·작업 화면 코드와, 문서를 쪼개 읽는 부품을 한 벌만 두는 저장소다.

- `doc-parse.mjs` — 문서의 항목(`## [작업 N] | …` 같은 줄)을 읽는 부품
- `assembly-view.mjs` — 의회 법안이 들어갈 자리를 알아보고 지금 글과 짝짓는 부품
- `doc-parse.test.mjs` — 문서 읽기 부품의 시험(`node doc-parse.test.mjs`)
- `doc-mark.mjs` — 의회 법안·설계실 설계안·작업 항목에 답과 코멘트를 적는 부품(PC 앱 통로 `doc-mark.cjs`와 모바일 앱이 함께 쓴다)
- `doc-mark.test.mjs` — 답 적기 부품의 시험(`node doc-mark.test.mjs`)
- `github.mjs` — GitHub 통로: 열쇠로 문서를 읽고, 찍은 답을 커밋 하나로 적으며, 그사이 파일이 바뀌었으면 다시 읽어 그 위에 적는다
- `github.test.mjs` — GitHub 통로의 시험(`node github.test.mjs`, 공개 저장소를 실제로 읽어 보려면 `--live`를 붙인다)
- `bill-parse.mjs` — 의회 법안과 설계실 설계안을 읽는 부품(갈 곳 · 종류 · 답 · 코멘트 · 항 · 구현 계획)
- `index.html` · `app.css` · `app.mjs` — 상황판 화면(홈 · 의회 · 설계실 · 작업). 폰 폭이면 아래 탭과 화면 전체 박스, 900px 이상이면 목록과 박스 두 칸
- `dev-server.mjs` — 시험 서버. 진짜 저장소의 `docs/` 문서를 임시 폴더로 복사해 GitHub API 모양으로 내준다(진짜 문서는 안 바뀐다). `node dev-server.mjs` 뒤 `http://127.0.0.1:8787/?api=/api`를 열고 열쇠 칸에 아무 글자나 넣는다

모바일 앱은 이 저장소를 GitHub Pages로 띄우고, PC 앱은 옆 폴더(`../management/tools/`)에서 이 부품을 읽는다. 문서는 비공개 저장소에 있고, 화면은 사용자의 GitHub 열쇠로 그 문서를 읽는다. 이 저장소에는 문서를 두지 않는다.
