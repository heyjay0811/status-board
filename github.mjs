// 상황판 — GitHub 통로. 비공개 저장소의 문서를 열쇠(GitHub 토큰)로 읽고, 찍은 답을 커밋 하나로 적는다. //
//
// 무엇을 하나(관리부 설계 `bp-상황판`): //
//   제1조 ①④⑤ — 의회·설계실·작업을 GitHub에서 읽고, 읽을 문서는 저장소 파일 목록으로 정하며, //
//                 `.claude` 폴더를 가진 저장소만 부서·프로젝트로 센다. //
//   제10조 ①③④⑤ — 열쇠로 읽고 쓰고, 찍은 답은 그 파일에 바로 적어 커밋 하나로 남기며, 그사이 파일이 //
//                   바뀌었으면 다시 읽어 그 위에 다시 적고, 문서의 마지막 커밋 시각을 알려 준다. //
//   제7조 ②   — 못 읽으면 「없다」로 덮지 않고 무엇을 못 읽었는지 던진다. 파일이 정말 없을 때만 null이다. //
//
// ★PC 앱과 모바일 앱이 이 한 벌을 쓴다 — 브라우저와 Node에 다 있는 fetch·TextEncoder·btoa만 쓴다. //
// ★열쇠는 부르는 쪽이 넘긴다 — 이 부품은 열쇠를 어디에도 적지 않는다(제10조 ②: 열쇠는 그 기기 안에만). //

const 진짜API = 'https://api.github.com';

// 경로 조각마다 따로 감싼다 — 한글 파일 이름(설계실.md)도, 폴더 구분 「/」도 그대로 살아야 한다. //
const 경로감싸기 = (경로) => String(경로).split('/').map(encodeURIComponent).join('/');

// UTF-8 글 ↔ base64 — GitHub 파일 내용 API는 base64로 주고받는다. btoa·atob는 한 바이트씩만 받아 //
//   한글을 바로 넣으면 깨지므로 바이트로 바꿔 건넨다. 큰 파일도 되게 조각내어 잇는다. //
function 글을b64(글) {
  const 바이트 = new TextEncoder().encode(글);
  let s = '';
  for (let i = 0; i < 바이트.length; i += 0x8000) s += String.fromCharCode(...바이트.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64를글(b64) {
  const s = atob(String(b64).replace(/\s/g, ''));
  const 바이트 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) 바이트[i] = s.charCodeAt(i);
  return new TextDecoder().decode(바이트);
}

// 통로 하나를 만든다. 열쇠가 없으면 공개 저장소만 읽힌다. //
// API는 시험 때만 바꾼다 — 시험 서버(`dev-server.mjs`)가 GitHub과 같은 모양으로 임시 사본을 읽고 쓴다. //
export function 통로만들기({ 열쇠 = '', 주인 = 'heyjay0811', API = 진짜API, fetch: 부르기 = globalThis.fetch?.bind(globalThis), 기록 = console } = {}) {
  if (typeof 부르기 !== 'function') throw new Error('fetch가 없는 곳이다 — 이 통로를 쓸 수 없다');

  async function 요청(방법, 주소, 몸) {
    const 머리 = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (열쇠) 머리.Authorization = `Bearer ${열쇠}`;
    if (몸) 머리['Content-Type'] = 'application/json';
    const r = await 부르기(API + 주소, { method: 방법, headers: 머리, body: 몸 ? JSON.stringify(몸) : undefined, cache: 'no-store' });
    const 글 = await r.text();
    let 값 = null;
    // GitHub은 보통 JSON을 주지만 오류 쪽은 글 그대로 올 때가 있다 — 그때는 글을 값으로 두고 남긴다 //
    try { 값 = 글 ? JSON.parse(글) : null; } catch (e) { 기록.log(`[GitHub 통로] 응답이 JSON이 아니다(${r.status}) — 글 그대로 쓴다: ${e.message}`); 값 = 글; }
    return { 상태: r.status, 값 };
  }
  const 실패 = (무엇, r) => new Error(`${무엇} — GitHub 응답 ${r.상태}${r.값 && r.값.message ? ': ' + r.값.message : ''}`);

  // 파일 하나를 읽는다. 없으면 null, 못 읽으면 던진다. //
  async function 파일읽기(저장소, 경로) {
    기록.log(`[GitHub 통로] START 파일읽기 — ${저장소}/${경로}`);
    const r = await 요청('GET', `/repos/${주인}/${저장소}/contents/${경로감싸기(경로)}`);
    if (r.상태 === 404) { 기록.log(`[GitHub 통로] SUCCESS 파일 없음 — ${저장소}/${경로}`); return null; }
    if (r.상태 !== 200 || !r.값 || r.값.type !== 'file') throw 실패(`파일을 못 읽었다: ${저장소}/${경로}`, r);
    const 글 = b64를글(r.값.content);
    기록.log(`[GitHub 통로] SUCCESS 파일읽기 — ${저장소}/${경로} ${글.length}자`);
    return { 글, sha: r.값.sha };
  }

  // 저장소의 파일 경로 전부 — 설계실·의회·작업 문서를 이름을 코드에 적지 않고 이 목록에서 찾는다(제1조 ④). //
  async function 파일목록(저장소) {
    const r = await 요청('GET', `/repos/${주인}/${저장소}/git/trees/HEAD?recursive=1`);
    if (r.상태 !== 200 || !r.값 || !Array.isArray(r.값.tree)) throw 실패(`파일 목록을 못 읽었다: ${저장소}`, r);
    if (r.값.truncated) 기록.log(`[GitHub 통로] ERROR 파일 목록이 잘렸다 — ${저장소}: GitHub이 한 번에 주는 수를 넘었다`);
    return r.값.tree.filter((t) => t.type === 'blob').map((t) => t.path);
  }

  // 부서·프로젝트 저장소 — 열쇠 주인의 저장소 가운데 `.claude` 폴더가 있는 것(제1조 ⑤). //
  // ★저장소마다의 파일 목록은 한꺼번에 받는다([작업 395]) — 한 곳씩 차례로 받으면 17곳에 5.7초, 한꺼번에 0.6초였다 //
  //   (2026-09-30 실제 GitHub). 한 곳이라도 못 받으면 Promise.all이 던져 「못 읽었다」로 알린다(제7조 ②). //
  // 한계: 저장소 100개까지 한 번에 받고, 파일 목록 요청도 한 번에 그만큼 보낸다 · 바꿀 때: 저장소가 100개를 넘으면 //
  //   한 쪽씩 받아 이어 붙이고, 한꺼번에 보내는 요청을 몇십 개씩 끊어 보낸다. //
  async function 부서저장소들() {
    const r = await 요청('GET', '/user/repos?per_page=100&affiliation=owner');
    if (r.상태 !== 200 || !Array.isArray(r.값)) throw 실패('저장소 목록을 못 읽었다(열쇠가 맞는지 확인한다)', r);
    const 목록들 = await Promise.all(r.값.map((저장소) => 파일목록(저장소.name)));
    const 결과 = [];
    r.값.forEach((저장소, i) => { if (목록들[i].some((p) => p.startsWith('.claude/'))) 결과.push({ 이름: 저장소.name, 목록: 목록들[i] }); });
    기록.log(`[GitHub 통로] SUCCESS 부서저장소들 — ${r.값.length}곳 가운데 ${결과.length}곳`);
    return 결과;
  }

  // [관리부 작업 422] 제1조 ⑦([확정 19]) — 부서·프로젝트 저장소와 그 세 문서(작업·의회·설계실)의 글과 마지막 커밋 시각을 //
  //   GitHub GraphQL 한 질문으로 받는다. 저장소마다 파일 목록 전체를 받지 않고 `.claude` 폴더가 있는지만 묻는다(제1조 ⑤). //
  // 돌려주는 것: [{ 이름, 문서: { 'docs/work.md': { 글, 시각 } | null, … } }] — `.claude`가 있는 저장소만, 문서가 없으면 null. //
  // ★GitHub이 글을 잘라 준 문서(isTruncated)는 파일읽기()로 다시 받는다 — 잘린 글을 그대로 쓰면 뒤쪽 항목이 사라진다. //
  // 한계: 한 질문에 저장소 25곳씩 묻고 다음 쪽을 이어 묻는다 · 바꿀 때: 문서가 커져 GitHub이 시간 초과로 거절하면 그 수를 줄인다. //
  const 세문서 = { work: 'docs/work.md', asm: 'docs/assembly.md', des: 'docs/설계실.md' };
  async function 한꺼번에읽기() {
    기록.log('[GitHub 통로] START 한꺼번에읽기');
    const 글칸 = Object.entries(세문서).map(([k, p]) => `${k}: object(expression: "HEAD:${p}") { ... on Blob { text isTruncated } }`).join(' ');
    const 시각칸 = Object.entries(세문서).map(([k, p]) => `${k}: history(first: 1, path: "${p}") { nodes { committedDate } }`).join(' ');
    const 질문 = `query($cursor: String) { viewer { repositories(first: 25, after: $cursor, ownerAffiliations: OWNER) { pageInfo { hasNextPage endCursor } nodes { name claude: object(expression: "HEAD:.claude") { __typename } ${글칸} defaultBranchRef { target { ... on Commit { ${시각칸} } } } } } } }`;
    const 결과 = [];
    let 다음 = null, 쪽 = 0;
    do {
      const r = await 요청('POST', '/graphql', { query: 질문, variables: { cursor: 다음 } });
      if (r.상태 !== 200 || !r.값 || r.값.errors || !r.값.data) {
        const 말 = r.값 && r.값.errors ? r.값.errors.map((e) => e.message).join(' / ') : (r.값 && r.값.message) || '';
        throw new Error(`한꺼번에 못 읽었다 — GitHub 응답 ${r.상태}${말 ? ': ' + 말 : ''}`);
      }
      const 저장소들 = r.값.data.viewer.repositories;
      for (const n of 저장소들.nodes) {
        if (!n.claude) continue;
        const 시각들 = (n.defaultBranchRef && n.defaultBranchRef.target) || {};
        const 문서 = {};
        for (const [k, p] of Object.entries(세문서)) {
          const b = n[k];
          if (!b) { 문서[p] = null; continue; }
          const 시각 = 시각들[k] && 시각들[k].nodes[0] ? 시각들[k].nodes[0].committedDate : null;
          if (b.isTruncated || typeof b.text !== 'string') {
            기록.log(`[GitHub 통로] ${n.name}/${p} 글이 잘려 와 따로 다시 받는다`);
            const f = await 파일읽기(n.name, p);
            문서[p] = f ? { 글: f.글, 시각 } : null;
          } else 문서[p] = { 글: b.text, 시각 };
        }
        결과.push({ 이름: n.name, 문서 });
      }
      다음 = 저장소들.pageInfo.hasNextPage ? 저장소들.pageInfo.endCursor : null;
      쪽++;
    } while (다음);
    기록.log(`[GitHub 통로] SUCCESS 한꺼번에읽기 — 질문 ${쪽}번 · 부서·프로젝트 ${결과.length}곳`);
    return 결과;
  }

  // 그 파일의 마지막 커밋 시각(UTC 글자) — 화면 맨 위에 보인다(제10조 ⑤). 커밋이 없으면 null. //
  async function 마지막커밋(저장소, 경로) {
    const r = await 요청('GET', `/repos/${주인}/${저장소}/commits?per_page=1&path=${encodeURIComponent(경로)}`);
    if (r.상태 !== 200 || !Array.isArray(r.값)) throw 실패(`마지막 커밋을 못 읽었다: ${저장소}/${경로}`, r);
    return r.값[0] ? r.값[0].commit.committer.date : null;
  }

  // 파일을 읽어 바꾸기(옛 글 → 새 글)를 적용하고 커밋 하나로 적는다(제10조 ③). //
  // ★그사이 파일이 바뀌어 GitHub이 거절하면(409·422 — 들고 간 sha가 옛것) 새로 읽어 바꾸기를 다시 적용한다 — //
  //   옛 글 위에 쓴 것을 그대로 올리면 그사이 바뀐 글이 사라진다(제10조 ④). 세 번까지 해 보고 던진다. //
  async function 고쳐쓰기(저장소, 경로, 바꾸기, 메시지) {
    기록.log(`[GitHub 통로] START 고쳐쓰기 — ${저장소}/${경로}: ${메시지}`);
    for (let 번 = 1; 번 <= 3; 번++) {
      const 지금 = await 파일읽기(저장소, 경로);
      if (!지금) throw new Error(`고쳐 쓸 파일이 GitHub에 없다: ${저장소}/${경로}`);
      const 새글 = 바꾸기(지금.글);
      if (새글 === 지금.글) { 기록.log(`[GitHub 통로] SUCCESS 바뀐 것 없음 — 커밋하지 않았다`); return { 커밋: null, 바뀜: false }; }
      const r = await 요청('PUT', `/repos/${주인}/${저장소}/contents/${경로감싸기(경로)}`,
        { message: 메시지, content: 글을b64(새글), sha: 지금.sha });
      if (r.상태 === 200 || r.상태 === 201) {
        기록.log(`[GitHub 통로] SUCCESS 커밋 ${r.값.commit.sha.slice(0, 7)} — ${저장소}/${경로}`);
        // 커밋 응답에 적은 글의 새 지문과 커밋 시각이 들어 있다 — 부른 쪽이 파일을 다시 읽지 않아도 된다 //
        return { 커밋: r.값.commit.sha, 바뀜: true, 글: 새글, sha: r.값.content && r.값.content.sha, 시각: r.값.commit.committer && r.값.commit.committer.date };
      }
      if (r.상태 === 409 || r.상태 === 422) { 기록.log(`[GitHub 통로] 그사이 파일이 바뀌었다(${r.상태}) — 다시 읽어 다시 적는다(${번}번째)`); continue; }
      throw 실패(`커밋하지 못했다: ${저장소}/${경로}`, r);
    }
    throw new Error(`세 번 다시 적었는데도 그사이 파일이 계속 바뀌었다: ${저장소}/${경로}`);
  }

  return { 파일읽기, 파일목록, 부서저장소들, 마지막커밋, 고쳐쓰기, 한꺼번에읽기 };
}
