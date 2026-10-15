# status-board

상황판의 의회·작업 화면 코드와, 문서를 쪼개 읽는 부품을 한 벌만 두는 저장소다.

- `doc-parse.mjs` — 문서의 항목(`## [작업 N] | …` 같은 줄)을 읽는 부품
- `assembly-view.mjs` — 의회 법안이 들어갈 자리를 알아보고 지금 글과 짝짓는 부품
- `doc-parse.test.mjs` — 문서 읽기 부품의 시험(`node doc-parse.test.mjs`)
- `doc-mark.mjs` — 의회 법안·설계실 설계안·작업 항목에 답과 코멘트를 적는 부품(PC 앱 통로 `doc-mark.cjs`와 모바일 앱이 함께 쓴다)
- `doc-mark.test.mjs` — 답 적기 부품의 시험(`node doc-mark.test.mjs`)
- `answer-file.mjs` — 답 파일 한 벌의 셈: 법안·설계안에 찍은 답과 코멘트를 누를 때마다 남기는 작은 답 파일(`docs/답/<누른 시각>-<기기 표지>-<누른 번호>.json`)의 이름 짓기 · 칸 검사 · 같은 자리에서 가장 늦은 답 파일로 최종 답과 코멘트 고르기. 브라우저와 node에서 함께 돈다
- `answer-file.test.mjs` — 답 파일 셈의 시험(`node answer-file.test.mjs`)
- `github.mjs` — GitHub 통로: 열쇠로 문서를 읽고, 찍은 답은 그 안이 있는 저장소 `docs/답/`에 새 답 파일 하나로 만든다(파일 지문 없는 요청 한 번, 모바일은 앱을 닫아도 끝까지 가는 keepalive). 기기에 남긴 답 파일 기록의 셈도 둔다
- `github.test.mjs` — GitHub 통로의 시험(`node github.test.mjs`, 공개 저장소를 실제로 읽어 보려면 `--live`를 붙인다)
- `deliver.test.mjs` — 답 파일을 원본에 전달하기의 시험(기기 기록 · 닿음과 끝내 못 닿음 가르기 · GitHub 통로와 PC 통로의 결과)
- `bill-parse.mjs` — 의회 법안과 설계실 설계안을 읽는 부품(갈 곳 · 종류 · 답 · 코멘트 · 항 · 구현 계획)
- `index.html` · `app.css` · `app.mjs` — 상황판 화면(홈 · 의회 · 설계실 · 작업). 폰 폭이면 아래 탭과 화면 전체 박스, 900px 이상이면 목록과 박스 두 칸
- `dev-server.mjs` — 시험 서버. 진짜 저장소의 `docs/` 문서를 임시 폴더로 복사해 GitHub API 모양으로 내준다(진짜 문서는 안 바뀐다). `node dev-server.mjs` 뒤 `http://127.0.0.1:8787/?api=/api`를 열고 열쇠 칸에 아무 글자나 넣는다

모바일 앱은 이 저장소를 GitHub Pages로 띄우고, PC 앱은 옆 폴더(`../management/tools/`)에서 이 부품을 읽는다. 문서는 비공개 저장소에 있고, 화면은 사용자의 GitHub 열쇠로 그 문서를 읽는다. 이 저장소에는 문서를 두지 않는다.
