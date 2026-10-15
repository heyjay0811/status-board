// 상황판 — GitHub 통로. 비공개 저장소의 문서를 열쇠(GitHub 토큰)로 읽고, 찍은 답은 그 안이 있는 저장소에 새 답 파일 하나로 만든다. //
//
// 무엇을 하나(관리부 설계): //
//   bp-백엔드 「백엔드 모듈은 …문서를 읽고 쓴다」 조 ② — 문서(답 파일 자리 docs/답/의 답 파일 포함)를 읽고, 답 파일 만드는 통로는 //
//     보낼 때마다 결과를 만듦 · 같은 이름 있음(그 파일의 글) · 저장소 없음 · 적어도됨 거짓 · 못 보냄(까닭) 가운데 하나로 알린다. //
//   bp-백엔드 「상황판은 원본에서 그때그때 읽은 문서로 화면을 그린다」 조 ④⑤⑥ — 읽을 문서는 저장소 파일 목록으로 정하고, //
//     `.claude` 폴더를 가진 저장소만 부서·프로젝트로 세며, 지문(ETag)으로 바뀐 문서만 받는다. //
//   bp-백엔드 「문서 저장소는 비공개로 두고, 상황판은 답 파일 자리에 새 답 파일만 만든다」 조 ③④ — 적어도됨 · 파일 지문 없이 새 파일 //
//     하나만 만드는 요청(누르자마자 앱을 닫아도 끝까지 가게 keepalive로, 몸이 64KB를 넘으면 keepalive 없이). //
//   bp-결재 「찍은 답을 답 파일로 원본에 전달하기와 「전달 안 됨」 딱지」 조 ⑫ — 기기에 남긴 답 파일 기록을 자리마다 하나로 갈아 끼우는 셈. //
//   bp-백엔드 「상황판은 PC 앱과 모바일 앱 둘이고 …」 조 ② — 못 읽으면 「없다」로 덮지 않고 무엇을 못 읽었는지 던진다. 파일이 정말 없을 때만 null이다. //
//
// ★PC 앱과 모바일 앱이 이 한 벌을 쓴다 — 브라우저와 Node에 다 있는 fetch·TextEncoder·btoa만 쓴다. //
// ★열쇠는 부르는 쪽이 넘긴다 — 이 부품은 열쇠를 어디에도 적지 않는다(열쇠는 그 기기 안에만). //

import { 답자리, 이름꼴맞음, 글읽기, 자리, 안이름 } from './answer-file.mjs';

const 진짜API = 'https://api.github.com';
// 페이지가 닫혀도 끝까지 가는 요청(keepalive)이 실을 수 있는 몸의 한도 — 브라우저가 64KiB를 넘는 keepalive 요청은 보내지 않는다 //
export const 붙잡기한도 = 64 * 1024;

// 경로 조각마다 따로 감싼다 — 한글 파일 이름(설계실.md · docs/답/)도, 폴더 구분 「/」도 그대로 살아야 한다. //
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

// [관리부 작업 464] 관리부 설계 bp-백엔드 「문서 저장소는 비공개로 두고, 상황판은 답 파일 자리에 새 답 파일만 만든다」 조 ③ — //
//   적어도됨(저장소, 경로, 답 파일) = (저장소 = 관리부 OR 저장소 ∈ 부서·프로젝트 목록) //
//     AND (경로 = docs/답/ 바로 아래이고 이름이 결재 모듈이 내놓는 답 파일의 이름 꼴에 맞음) //
//     AND ((답 파일의 문서 칸 = docs/assembly.md AND 저장소 = 관리부) OR 답 파일의 문서 칸 = docs/설계실.md). //
//   GitHub 열쇠와 `git` 로그인은 파일 하나씩으로 좁힐 수 없어 코드가 막는다 — 답파일만들기()가 보내기 전에 재고, 거짓이면 보내지 않는다. //
//   답 파일의 글이 칸을 못 지나면(answer-file.mjs 글읽기()) 문서 칸을 알 수 없어 거짓이다. //
// 받는 것: 저장소 · 경로 · 답 파일의 글 · 부서·프로젝트 저장소 이름들(화면이 센 곳 목록 — 모바일 앱은 `.claude` 폴더를 가진 저장소, PC 앱은 //
//   `.git`과 `.claude`를 둘 다 가진 폴더). 관리부는 늘 부서라 목록 없이도 든다. 회장실·전역 환경 저장소는 목록에 있어도 들지 않는다. //
// ★PC 앱 본체(관리부 tools/docs-ipc.cjs)도 이 한 벌을 불러 PC 폴더로 한 번 더 잰다. //
const 관리부저장소 = 'management';
const 곳아닌저장소 = ['yessoftbook', 'claude-config'];
export function 적어도됨(저장소, 경로, 답파일글, 곳들 = []) {
  const 곳 = !곳아닌저장소.includes(저장소) && (저장소 === 관리부저장소 || (Array.isArray(곳들) && 곳들.includes(저장소)));
  if (!곳 || !String(경로 ?? '').startsWith(답자리)) return false;
  const 이름 = String(경로).slice(답자리.length);
  if (!이름꼴맞음(이름)) return false;
  const r = 글읽기(이름, 답파일글);
  if (!r.값) return false;
  return (r.값.문서 === 'docs/assembly.md' && 저장소 === 관리부저장소) || r.값.문서 === 'docs/설계실.md';
}
export const 못적는까닭 = (저장소, 경로) => `상황판은 관리부 의회 파일의 법안과 부서·프로젝트마다의 설계실 파일의 설계안에 찍은 답 파일만 그 저장소 docs/답/에 만든다 — ${저장소}/${경로}에는 만들지 않는다`;

// ── 기기에 남긴 답 파일(전달 기록) ─────────────────────────────────────── //
// [관리부 작업 464] 관리부 설계 bp-결재 「찍은 답을 답 파일로 원본에 전달하기와 「전달 안 됨」 딱지」 조 ⑫ — //
//   기록 하나 = { 저장소, 이름(답 파일 이름), 글(답 파일 글), 값(글읽기()의 값), 메시지, 곳(「의회」·「설계실 · 곳 이름」), 까닭(마지막으로 못 보낸 까닭) }. //
//   저장소 · 자리(answer-file.mjs 자리())마다 하나만 둔다 — 같은 자리를 다시 누르면 마지막 누름의 답 파일로 갈아 끼운다(아직 안 보낸 옛 누름은 보내지 않는다). //
//   보낸 것이 닿거나 끝내 못 닿으면 기기에 남은 기록이 보낸 그 이름일 때만 지운다(전달걷기). 화면(app.mjs)의 보내기 줄이 쓴다. //
export const 전달자리 = (a) => `${a.저장소}\n${자리(a.값)}`;
export function 전달넣기(목록, a) {
  const k = 전달자리(a), i = 목록.findIndex((x) => 전달자리(x) === k);
  if (i < 0) return [...목록, a];
  const 새 = 목록.slice(); 새[i] = a; return 새;
}
export const 전달걷기 = (목록, 이름) => 목록.filter((x) => x.이름 !== 이름);
// 같은 조 ⑥⑧ — 답파일만들기()가 알린 결과(r)와 보낸 글로 가른다. 돌려주는 것: '닿음' · '끝내'(끝내 못 닿음) · '다시'(기기에 두고 다시 보낸다). //
//   닿음 = (통로가 원본에 그 답 파일을 만들었다고 알림) OR (원본의 답 파일 자리에 그 이름의 파일이 있고 글이 같음) //
//   끝내못닿음 = (통로가 적어도됨이 거짓이라고 알림) OR (통로가 그 저장소가 원본에 없다고 알림) OR (원본의 답 파일 자리에 그 이름의 파일이 있는데 글이 다름) //
export function 전달가름(r, 글) {
  if (r.결과 === '만듦') return '닿음';
  if (r.결과 === '같은 이름 있음') return r.글 === 글 ? '닿음' : '끝내';
  if (r.결과 === '적어도됨 거짓' || r.결과 === '저장소 없음') return '끝내';
  return '다시';
}
// [관리부 작업 464] 2026-10-13 판이 기기에 남긴 전달 기록(sb.전달할답의 한 줄)을 답 파일 칸으로 푼다 — 자리 · 답(빈 답은 거둠) · 코멘트 글 · //
//   누른 때(번 앞의 밀리초). 돌려주는 것: { 때, 값(문서 · 안 · 무엇 · 줄 · 답 · 글), 덧(저장소 · 메시지 · 곳 · 제목) }. 못 풀면 던진다 //
export function 옛전달풀기(x) {
  if (!x || typeof x !== 'object') throw new Error('기록이 덩어리가 아니다');
  const 때 = Number(String(x.번 || '').split('-')[0]);
  if (!Number.isFinite(때) || 때 <= 0) throw new Error(`누른 때(번)를 못 읽었다: ${x.번}`);
  const 안 = 안이름('## ' + String(x.표식 || ''));
  const 값 = x.무엇 === '답' ? { 문서: x.경로, 안, 무엇: '답', 답: x.답 || '거둠' } : { 문서: x.경로, 안, 무엇: '코멘트', 줄: x.키, 글: x.글 || '' };
  return { 때, 값, 덧: { 저장소: x.저장소, 메시지: x.메시지 || '상황판 답', 곳: x.곳 || '', 제목: x.이름 || 안 } };
}

// 통로 하나를 만든다. 열쇠가 없으면 공개 저장소만 읽힌다. //
// API는 시험 때만 바꾼다 — 시험 서버(`dev-server.mjs`)가 GitHub과 같은 모양으로 임시 사본을 읽고 쓴다. //
export function 통로만들기({ 열쇠 = '', 주인 = 'heyjay0811', API = 진짜API, fetch: 부르기 = globalThis.fetch?.bind(globalThis), 기록 = console } = {}) {
  if (typeof 부르기 !== 'function') throw new Error('fetch가 없는 곳이다 — 이 통로를 쓸 수 없다');

  // 붙잡기 — 참이면 페이지가 닫혀도 끝까지 가는 요청(keepalive)으로 보낸다 //
  async function 요청(방법, 주소, 몸, 덧머리, 붙잡기 = false) {
    const 머리 = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(덧머리 || {}) };
    if (열쇠) 머리.Authorization = `Bearer ${열쇠}`;
    if (몸) 머리['Content-Type'] = 'application/json';
    const r = await 부르기(API + 주소, { method: 방법, headers: 머리, body: 몸 ? (typeof 몸 === 'string' ? 몸 : JSON.stringify(몸)) : undefined, cache: 'no-store', ...(붙잡기 ? { keepalive: true } : {}) });
    const 글 = await r.text();
    let 값 = null;
    // GitHub은 보통 JSON을 주지만 오류 쪽은 글 그대로 올 때가 있다 — 그때는 글을 값으로 두고 남긴다 //
    try { 값 = 글 ? JSON.parse(글) : null; } catch (e) { 기록.log(`[GitHub 통로] 응답이 JSON이 아니다(${r.status}) — 글 그대로 쓴다: ${e.message}`); 값 = 글; }
    return { 상태: r.status, 값, 지문: r.headers && r.headers.get ? r.headers.get('etag') : null };
  }
  const 실패 = (무엇, r) => new Error(`${무엇} — GitHub 응답 ${r.상태}${r.값 && r.값.message ? ': ' + r.값.message : ''}`);

  // 파일 하나를 읽는다. 없으면 null, 못 읽으면 던진다. //
  // [관리부 작업 422] 지난번 받은 지문(ETag)을 넘기면 「이 지문과 같으면 보내지 마라」(If-None-Match)로 //
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

  // 저장소의 파일 경로 전부 — 설계실·의회·작업 문서와 답 파일을 이름을 코드에 적지 않고 이 목록에서 찾는다. //
  // [관리부 작업 457] 커밋을 넘기면 그 커밋의 파일 목록을 받는다 — 곳목록확인()이 물은 마지막 커밋과 받은 목록이 늘 짝이 맞게. //
  async function 파일목록(저장소, 커밋 = 'HEAD') {
    기록.log(`[GitHub 통로] START 파일목록 — ${저장소} @ ${String(커밋).slice(0, 7)}`);
    const r = await 요청('GET', `/repos/${주인}/${저장소}/git/trees/${encodeURIComponent(커밋)}?recursive=1`);
    if (r.상태 !== 200 || !r.값 || !Array.isArray(r.값.tree)) throw 실패(`파일 목록을 못 읽었다: ${저장소}`, r);
    if (r.값.truncated) 기록.log(`[GitHub 통로] ERROR 파일 목록이 잘렸다 — ${저장소}: GitHub이 한 번에 주는 수를 넘었다`);
    return r.값.tree.filter((t) => t.type === 'blob').map((t) => t.path);
  }

  // 열쇠 주인의 저장소 이름 전부 — 한 번 묻는다. 못 읽으면 던진다. //
  // 한계: 저장소 100개까지 한 번에 받는다 · 바꿀 때: 저장소가 100개를 넘으면 한 쪽씩 받아 이어 붙인다. //
  async function 저장소목록() {
    기록.log('[GitHub 통로] START 저장소목록');
    const r = await 요청('GET', '/user/repos?per_page=100&affiliation=owner');
    if (r.상태 !== 200 || !Array.isArray(r.값)) throw 실패('저장소 목록을 못 읽었다(열쇠가 맞는지 확인한다)', r);
    return r.값.map((x) => x.name);
  }

  // 저장소의 마지막 커밋 번호(sha) 하나 — GitHub의 파일은 커밋으로만 바뀌어, 이 번호가 같으면 파일 목록도 같다. //
  async function 저장소커밋(저장소) {
    기록.log(`[GitHub 통로] START 저장소커밋 — ${저장소}`);
    const r = await 요청('GET', `/repos/${주인}/${저장소}/commits?per_page=1`);
    // 커밋이 하나도 없는 빈 저장소는 GitHub이 409로 답한다 — 파일이 없어 부서·프로젝트가 아니니 「없음」(null)으로 돌려준다 //
    if (r.상태 === 409) { 기록.log(`[GitHub 통로] SUCCESS 빈 저장소(커밋 없음) — ${저장소}`); return null; }
    if (r.상태 !== 200 || !Array.isArray(r.값) || !r.값[0] || !r.값[0].sha) throw 실패(`마지막 커밋을 못 읽었다: ${저장소}`, r);
    return r.값[0].sha;
  }

  // [관리부 작업 457] bp-백엔드 「상황판은 원본에서 그때그때 읽은 문서로 화면을 그린다」 조 ⑤ — 모바일 앱이 열 때마다 부른다. //
  //   저장소 목록을 한 번 묻고, 곳마다 마지막 커밋을 물어 //
  //   목록다시받기(곳) = (기기에 저장한 그 곳의 파일 목록 없음) OR (지금 마지막 커밋 ≠ 그 곳 파일 목록을 받을 때 저장한 마지막 커밋)이 //
  //   참인 곳만 그 커밋의 파일 목록을 다시 받는다. 저장소 목록에 새로 생긴 저장소는 파일 목록을 받아 `.claude` 폴더가 있으면 //
  //   부서·프로젝트로 센다. 이미 부서·프로젝트가 아니라고 가른 저장소는 다시 묻지 않는다. //
  // 받는 것: 알던 = { 저장소 이름: { 커밋, 곳 } } — 부르는 쪽이 기기에 저장한 것(곳이면 그 곳의 파일 목록이 기기에 있을 때만 넣는다) · //
  //   모두다시 — 참이면(「↻ 다시 읽기」) 커밋이 같아도 모든 저장소의 파일 목록을 받는다. //
  // 돌려주는 것: 저장소마다 { 이름, 곳, 커밋, 목록(새로 받았을 때) | 그대로: true | 오류(까닭) }. //
  // ★한 곳을 못 읽어도 던지지 않고 그 곳에 까닭을 단다 — 부르는 쪽이 그 곳만 「못 맞춘 곳」으로 알리고 저장해 둔 목록으로 그린다. //
  //   저장소 목록 자체를 못 읽으면 던진다. //
  // ★저장소마다 동시에 묻는다([작업 395]) — 한 곳씩 차례로 받으면 17곳에 5.7초, 한꺼번에 0.6초였다(2026-09-30 실제 GitHub). //
  // 한계: 저장소 100개까지 요청을 한꺼번에 보낸다 · 바꿀 때: 저장소가 100개를 넘으면 몇십 개씩 끊어 보낸다. //
  async function 곳목록확인(알던 = {}, { 모두다시 = false } = {}) {
    const 이름들 = await 저장소목록();
    const 결과 = await Promise.all(이름들.map(async (이름) => {
      const 옛 = 알던[이름];
      if (옛 && 옛.곳 === false && !모두다시) return { 이름, 곳: false, 커밋: 옛.커밋, 그대로: true };
      try {
        const 커밋 = await 저장소커밋(이름);
        if (커밋 === null) return { 이름, 곳: false, 커밋: null, 목록: [] };
        if (옛 && 옛.곳 && !모두다시 && 옛.커밋 === 커밋) return { 이름, 곳: true, 커밋, 그대로: true };
        const 목록 = await 파일목록(이름, 커밋);
        return { 이름, 곳: 목록.some((p) => p.startsWith('.claude/')), 커밋, 목록 };
      } catch (e) {
        기록.log(`[GitHub 통로] ERROR 곳목록확인 — ${이름}: ${e.message}`);
        return { 이름, 곳: 옛 ? 옛.곳 : null, 오류: e.message };
      }
    }));
    const 셈 = (f) => 결과.filter(f).length;
    기록.log(`[GitHub 통로] SUCCESS 곳목록확인 — 저장소 ${결과.length}곳 · 부서·프로젝트 ${셈((x) => x.곳)}곳 · 목록 새로 받음 ${셈((x) => x.목록)} · 그대로 ${셈((x) => x.그대로)} · 못 읽음 ${셈((x) => x.오류)}`);
    return 결과;
  }

  // 그 파일의 마지막 커밋 시각(UTC 글자) — 화면 맨 위에 보인다. 커밋이 없으면 null. //
  async function 마지막커밋(저장소, 경로) {
    const r = await 요청('GET', `/repos/${주인}/${저장소}/commits?per_page=1&path=${encodeURIComponent(경로)}`);
    if (r.상태 !== 200 || !Array.isArray(r.값)) throw 실패(`마지막 커밋을 못 읽었다: ${저장소}/${경로}`, r);
    return r.값[0] ? r.값[0].commit.committer.date : null;
  }

  // [관리부 작업 464] 답 파일 만들기 — 그 저장소 docs/답/<이름>에 새 파일 하나를 만든다(bp-백엔드 「문서 저장소는 비공개로 두고, 상황판은 //
  //   답 파일 자리에 새 답 파일만 만든다」 조 ③④ · 「백엔드 모듈은 …문서를 읽고 쓴다」 조 ②). //
  //   파일 지문(sha) 없이 PUT 한 번 — 같은 이름이 이미 있으면 GitHub이 422로 거절해 원본의 파일을 고치지 않는다. 붙잡기면 keepalive로 보낸다 //
  //   (몸이 붙잡기한도를 넘으면 keepalive 없이). 결과는 던지지 않고 하나로 알린다: //
  //     201 → { 결과: '만듦', 커밋, 시각 } · 422 → 그 파일을 읽어 { 결과: '같은 이름 있음', 글 } · 404 → { 결과: '저장소 없음', 까닭 } · //
  //     적어도됨 거짓 → { 결과: '적어도됨 거짓', 까닭 } · 그 밖(그물 · 401 · 403 · 409 · 5xx · 422인데 그 파일이 없음) → { 결과: '못 보냄', 까닭 }. //
  //   닿음 · 끝내 못 닿음 · 다시 보냄은 이 결과를 받은 화면(app.mjs)이 bp-결재의 식으로 가른다. //
  // 곳들 — 부서·프로젝트 저장소 이름들(적어도됨()이 가린다) //
  async function 답파일만들기(저장소, 이름, 글, 메시지, { 붙잡기 = false, 곳들 = [] } = {}) {
    const 경로 = 답자리 + 이름;
    기록.log(`[GitHub 통로] START 답파일만들기 — ${저장소}/${경로}: ${메시지}`);
    if (!적어도됨(저장소, 경로, 글, 곳들)) {
      기록.log(`[GitHub 통로] ERROR 만들지 않는다 — 상황판이 만들어도 되는 답 파일이 아니다: ${저장소}/${경로}`);
      return { 결과: '적어도됨 거짓', 까닭: 못적는까닭(저장소, 경로) };
    }
    const 몸 = JSON.stringify({ message: 메시지, content: 글을b64(글) });
    const 붙잡음 = 붙잡기 && new TextEncoder().encode(몸).length <= 붙잡기한도;
    if (붙잡기 && !붙잡음) 기록.log(`[GitHub 통로] 몸이 keepalive 한도(${붙잡기한도}바이트)를 넘어 keepalive 없이 보낸다 — ${저장소}/${경로}`);
    let r;
    try { r = await 요청('PUT', `/repos/${주인}/${저장소}/contents/${경로감싸기(경로)}`, 몸, null, 붙잡음); }
    catch (e) { 기록.log(`[GitHub 통로] ERROR 답 파일을 못 보냈다(그물) — ${저장소}/${경로}: ${e.message}`); return { 결과: '못 보냄', 까닭: `GitHub에 못 닿았다 — ${e.message}` }; }
    if (r.상태 === 201 || r.상태 === 200) {
      기록.log(`[GitHub 통로] SUCCESS 답 파일을 만들었다 — ${저장소}/${경로}${r.값 && r.값.commit ? ' 커밋 ' + String(r.값.commit.sha).slice(0, 7) : ''}`);
      return { 결과: '만듦', 커밋: r.값 && r.값.commit ? r.값.commit.sha : null, 시각: r.값 && r.값.commit && r.값.commit.committer ? r.값.commit.committer.date : null };
    }
    if (r.상태 === 422) {
      // 같은 이름이 이미 있다 — 그 파일의 글을 읽어 알린다. 읽지 못하면 다음에 다시 보낸다 //
      try {
        const 있음 = await 파일읽기(저장소, 경로);
        if (있음) { 기록.log(`[GitHub 통로] SUCCESS 같은 이름의 답 파일이 이미 있다 — ${저장소}/${경로}`); return { 결과: '같은 이름 있음', 글: 있음.글 }; }
        return { 결과: '못 보냄', 까닭: `GitHub이 거절했는데(422) 그 이름의 파일이 없다${r.값 && r.값.message ? ': ' + r.값.message : ''}` };
      } catch (e) { 기록.log(`[GitHub 통로] ERROR 같은 이름의 답 파일을 못 읽었다 — ${e.message}`); return { 결과: '못 보냄', 까닭: `같은 이름의 답 파일을 못 읽었다 — ${e.message}` }; }
    }
    if (r.상태 === 404) {
      기록.log(`[GitHub 통로] ERROR 저장소가 없다(404) — ${저장소}`);
      return { 결과: '저장소 없음', 까닭: `GitHub에 ${저장소} 저장소가 없다(404)` };
    }
    기록.log(`[GitHub 통로] ERROR 답 파일을 못 만들었다(${r.상태}) — ${저장소}/${경로}`);
    return { 결과: '못 보냄', 까닭: 실패('GitHub이 받지 않았다', r).message };
  }

  return { 파일읽기, 파일목록, 저장소목록, 저장소커밋, 곳목록확인, 마지막커밋, 답파일만들기 };
}
