// 상황판 — GitHub 통로. 비공개 저장소의 문서를 열쇠(GitHub 토큰)로 읽고, 찍은 답을 커밋 하나로 적는다. //
//
// 무엇을 하나(관리부 설계 `bp-상황판`): //
//   제1조 ①④⑤ — 의회·설계실·작업을 GitHub에서 읽고, 읽을 문서는 저장소 파일 목록으로 정하며, //
//                 `.claude` 폴더를 가진 저장소만 부서·프로젝트로 센다. //
//   제10조 ①③⑤⑥⑧ — 열쇠로 읽고 쓰고, 찍은 답은 그 파일을 읽어 그 위에 한 번만 적어 커밋 하나로 남기며, //
//                   못 적으면 다시 읽거나 다시 적지 않고 까닭을 담아 던지고, 문서의 마지막 커밋 시각을 알려 준다. //
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

  async function 요청(방법, 주소, 몸, 덧머리) {
    const 머리 = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(덧머리 || {}) };
    if (열쇠) 머리.Authorization = `Bearer ${열쇠}`;
    if (몸) 머리['Content-Type'] = 'application/json';
    const r = await 부르기(API + 주소, { method: 방법, headers: 머리, body: 몸 ? JSON.stringify(몸) : undefined, cache: 'no-store' });
    const 글 = await r.text();
    let 값 = null;
    // GitHub은 보통 JSON을 주지만 오류 쪽은 글 그대로 올 때가 있다 — 그때는 글을 값으로 두고 남긴다 //
    try { 값 = 글 ? JSON.parse(글) : null; } catch (e) { 기록.log(`[GitHub 통로] 응답이 JSON이 아니다(${r.status}) — 글 그대로 쓴다: ${e.message}`); 값 = 글; }
    return { 상태: r.status, 값, 지문: r.headers && r.headers.get ? r.headers.get('etag') : null };
  }
  const 실패 = (무엇, r) => new Error(`${무엇} — GitHub 응답 ${r.상태}${r.값 && r.값.message ? ': ' + r.값.message : ''}`);

  // 파일 하나를 읽는다. 없으면 null, 못 읽으면 던진다. //
  // [관리부 작업 422] 제1조 ⑦([확정 19]) — 지난번 받은 지문(ETag)을 넘기면 「이 지문과 같으면 보내지 마라」(If-None-Match)로 //
  //   묻는다. 안 바뀌었으면 GitHub이 304만 보내고 { 안바뀜: true }를, 바뀌었으면 새 글과 새 지문을 돌려준다. //
  async function 파일읽기(저장소, 경로, 지문 = null) {
    기록.log(`[GitHub 통로] START 파일읽기 — ${저장소}/${경로}${지문 ? ' (지문으로 묻기)' : ''}`);
    const r = await 요청('GET', `/repos/${주인}/${저장소}/contents/${경로감싸기(경로)}`, null, 지문 ? { 'If-None-Match': 지문 } : null);
    if (r.상태 === 304) { 기록.log(`[GitHub 통로] SUCCESS 안 바뀜 — ${저장소}/${경로}`); return { 안바뀜: true, 지문 }; }
    if (r.상태 === 404) { 기록.log(`[GitHub 통로] SUCCESS 파일 없음 — ${저장소}/${경로}`); return null; }
    if (r.상태 !== 200 || !r.값 || r.값.type !== 'file') throw 실패(`파일을 못 읽었다: ${저장소}/${경로}`, r);
    const 글 = b64를글(r.값.content);
    기록.log(`[GitHub 통로] SUCCESS 파일읽기 — ${저장소}/${경로} ${글.length}자`);
    return { 글, sha: r.값.sha, 지문: r.지문 };
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

  // 그 파일의 마지막 커밋 시각(UTC 글자) — 화면 맨 위에 보인다(제10조 ⑤). 커밋이 없으면 null. //
  async function 마지막커밋(저장소, 경로) {
    const r = await 요청('GET', `/repos/${주인}/${저장소}/commits?per_page=1&path=${encodeURIComponent(경로)}`);
    if (r.상태 !== 200 || !Array.isArray(r.값)) throw 실패(`마지막 커밋을 못 읽었다: ${저장소}/${경로}`, r);
    return r.값[0] ? r.값[0].commit.committer.date : null;
  }

  // 파일을 한 번 읽어 바꾸기(옛 글 → 새 글)를 적용하고 커밋 하나로 한 번만 적는다(제10조 ③⑥). //
  // ★못 적으면 다시 읽거나 다시 적지 않고 까닭을 담아 던진다(제10조 ⑧) — 다시 할지는 사용자가 단추로 정한다(⑩). //
  //   그사이 파일이 바뀌어 GitHub이 막아도(409·422 — 들고 간 sha가 옛것) 옛 글 위에 쓴 것은 올라가지 않아, //
  //   그사이 바뀐 글은 GitHub에 그대로 남는다. //
  async function 고쳐쓰기(저장소, 경로, 바꾸기, 메시지) {
    기록.log(`[GitHub 통로] START 고쳐쓰기 — ${저장소}/${경로}: ${메시지}`);
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
    if (r.상태 === 409 || r.상태 === 422) {
      기록.log(`[GitHub 통로] ERROR 그사이 파일이 바뀌어 GitHub이 막았다(${r.상태}) — 다시 적지 않는다: ${저장소}/${경로}`);
      throw 실패(`그사이 파일이 바뀌어 GitHub이 막았다: ${저장소}/${경로}`, r);
    }
    기록.log(`[GitHub 통로] ERROR 커밋하지 못했다(${r.상태}) — ${저장소}/${경로}`);
    throw 실패(`커밋하지 못했다: ${저장소}/${경로}`, r);
  }

  return { 파일읽기, 파일목록, 부서저장소들, 마지막커밋, 고쳐쓰기 };
}
