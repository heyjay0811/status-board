// GitHub 통로 `github.mjs`의 시험 — 메모리 안의 가짜 GitHub으로 돌리고, `--live`를 붙이면 공개 저장소를 실제로 읽는다. //
// 따르는 설계: bp-백엔드의 「상황판은 원본에서 그때그때 읽은 문서로 화면을 그린다」 · bp-부서프로젝트목록의 「상황판은 의회와 작업은 GitHub에서, 환경은 PC 폴더에서 그때그때 읽어서 보여 준다」 · bp-백엔드의 「상황판은 PC 앱과 모바일 앱 둘이고, 의회·설계실·작업 목록은 두 앱이 코드 한 벌을 함께 쓴다」 · bp-백엔드의 「문서 저장소는 비공개로 두고, 상황판은 관리부 의회 파일과 곳마다의 설계실 파일에만 적는다」 · bp-결재의 「상황판은 찍은 답을 그 안이 있는 의회 파일이나 설계실 파일에 바로 한 번 적고, 못 적으면 멈춘다」 //
import { 통로만들기, 적어도됨 } from './github.mjs';
import { 표시붙인글 } from './doc-mark.mjs';

let 통과 = 0; const 실패 = [];
const 확인 = (이름, 조건, 덧 = '') => { if (조건) { 통과++; console.log(`  ✓ ${이름}`); } else { 실패.push(이름); console.log(`  ✗ ${이름}${덧 ? ' — ' + 덧 : ''}`); } };
const 조용히 = { log: () => {} };
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const 글로 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));

// 가짜 GitHub — 저장소마다 { 경로: { 글, sha } } //
function 가짜GitHub(저장소들, { 끼어들기 } = {}) {
  let 번호 = 0; const 기록 = [];
  const 응답 = (상태, 값) => ({ status: 상태, text: async () => JSON.stringify(값) });
  const fetch = async (주소, 옵션) => {
    const u = new URL(주소); const 방법 = 옵션.method; 기록.push(`${방법} ${decodeURIComponent(u.pathname)}`);
    if (!옵션.headers.Authorization && u.pathname !== '/repos/heyjay0811/공개/contents/README.md') return 응답(404, { message: 'Not Found' });
    let m;
    if (u.pathname === '/user/repos') return 응답(200, Object.keys(저장소들).map((name) => ({ name })));
    if ((m = u.pathname.match(/^\/repos\/heyjay0811\/([^/]+)\/git\/trees\/HEAD$/)))
      return 응답(200, { truncated: false, tree: Object.keys(저장소들[decodeURIComponent(m[1])]).map((path) => ({ path, type: 'blob' })) });
    if ((m = u.pathname.match(/^\/repos\/heyjay0811\/([^/]+)\/commits$/))) return 응답(200, [{ commit: { committer: { date: '2026-09-29T11:22:33Z' } } }]);
    if ((m = u.pathname.match(/^\/repos\/heyjay0811\/([^/]+)\/contents\/(.+)$/))) {
      const 저장소 = 저장소들[decodeURIComponent(m[1])]; const 경로 = decodeURIComponent(m[2]);
      if (!저장소) return 응답(500, { message: '서버 오류' });   // 못 읽는 경우를 흉내 낸다 //
      if (방법 === 'GET') { const f = 저장소[경로]; return f ? 응답(200, { type: 'file', content: b64(f.글), sha: f.sha }) : 응답(404, { message: 'Not Found' }); }
      if (방법 === 'PUT') {
        const 몸 = JSON.parse(옵션.body);
        if (끼어들기 && 끼어들기.남은 > 0) { 끼어들기.남은--; 저장소[경로] = { 글: 끼어들기.바꾸기(저장소[경로].글), sha: 'x' + (++번호) }; }
        if (저장소[경로].sha !== 몸.sha) return 응답(409, { message: 'sha does not match' });
        저장소[경로] = { 글: 글로(몸.content), sha: 's' + (++번호) };
        // 진짜 GitHub처럼 새 파일 지문(content.sha)과 커밋 시각을 돌려준다 //
        return 응답(200, { content: { sha: 저장소[경로].sha }, commit: { sha: 'c0ffee' + 번호 + '0000000', committer: { date: '2026-09-30T01:02:03Z' } } });
      }
    }
    return 응답(500, { message: '가짜가 모르는 요청' });
  };
  return { fetch, 기록 };
}

const 의회 = '# 의회\n\n## 어떤 법안 | #규칙 | 소속: 전역 규칙\n\n① 항.\n\n---\n';
console.log('[github 시험] START');

{ // 읽기 — 한글 경로와 글이 그대로, 없음은 null, 실패는 던짐 //
  const 저장소들 = { management: { 'docs/assembly.md': { 글: 의회, sha: 's0' }, 'docs/설계실.md': { 글: '# 설계실 — 한글\n', sha: 's1' }, '.claude/settings.json': { 글: '{}', sha: 's2' } },
    배포만: { 'index.html': { 글: '<p>', sha: 's3' } } };
  const g = 가짜GitHub(저장소들); const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: g.fetch, 기록: 조용히 });
  const 읽음 = await 통로.파일읽기('management', 'docs/설계실.md');
  확인('한글 이름 파일을 읽어 한글 글을 그대로 돌려준다', 읽음 && 읽음.글 === '# 설계실 — 한글\n' && 읽음.sha === 's1');
  확인('없는 파일은 null이다(없음)', (await 통로.파일읽기('management', 'docs/없다.md')) === null);
  let 던짐 = ''; try { await 통로.파일읽기('모르는저장소', 'a.md'); } catch (e) { console.log(`    (던짐: ${e.message})`); 던짐 = e.message; }
  확인('못 읽으면 없음으로 덮지 않고 던진다', 던짐.includes('못 읽었다') && 던짐.includes('500'), 던짐);
  const 목록 = await 통로.파일목록('management');
  확인('파일 목록에 설계실 파일이 있다(이름을 코드에 안 적고 찾는다)', 목록.includes('docs/설계실.md'));
  const 부서 = await 통로.부서저장소들();
  확인('`.claude` 폴더가 있는 저장소만 부서·프로젝트로 센다', 부서.map((x) => x.이름).join() === 'management');
  확인('마지막 커밋 시각을 돌려준다', (await 통로.마지막커밋('management', 'docs/assembly.md')) === '2026-09-29T11:22:33Z');
}
{ // 쓰기 — 한 번 읽고 한 번 적어 커밋 하나 //
  const 저장소들 = { management: { 'docs/assembly.md': { 글: 의회, sha: 's0' } } };
  const g = 가짜GitHub(저장소들); const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: g.fetch, 기록: 조용히 });
  const r = await 통로.고쳐쓰기('management', 'docs/assembly.md', (글) => 표시붙인글(글, '어떤 법안', '승인', '2026-09-29'), '상황판: 어떤 법안에 승인');
  const 끝글 = 저장소들.management['docs/assembly.md'].글;
  확인('찍은 답이 적힌다', 끝글.includes('> 📌 **승인** | 2026-09-29'));
  확인('커밋 하나를 돌려준다', r.바뀜 && r.커밋.startsWith('c0ffee'));
  확인('한 번 읽고 한 번 적는다(GET 하나 · PUT 하나)', g.기록.filter((x) => x.startsWith('GET')).length === 1 && g.기록.filter((x) => x.startsWith('PUT')).length === 1, g.기록.join(' / '));
  // ★적은 뒤 파일을 다시 읽지 않아도 되게, 커밋 응답에서 적은 글·새 지문·커밋 시각을 돌려준다(찍기가 GitHub을 두 번만 오간다) //
  확인('적은 글을 돌려준다(다시 읽은 글과 같다)', r.글 === 끝글, r.글 === undefined ? '글 없음' : '글 다름');
  확인('새 파일 지문과 커밋 시각을 돌려준다', r.sha === 저장소들.management['docs/assembly.md'].sha && r.시각 === '2026-09-30T01:02:03Z', `sha ${r.sha} · 시각 ${r.시각}`);
  const 같음 = await 통로.고쳐쓰기('management', 'docs/assembly.md', (글) => 글, '바뀐 것 없음');
  확인('바뀐 것이 없으면 커밋하지 않는다', 같음.바뀜 === false && 같음.커밋 === null);
}
{ // 쓰기 — 그사이 바뀌면 다시 읽지 않고 오류를 던진다(제10조 ⑧) //
  const 저장소들 = { management: { 'docs/assembly.md': { 글: 의회, sha: 's0' } } };
  const 끼어들기 = { 남은: 1, 바꾸기: (글) => 글 + '\n## 다른 기기가 올린 법안 | #규칙 | 소속: 전역 규칙\n' };
  const g = 가짜GitHub(저장소들, { 끼어들기 }); const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: g.fetch, 기록: 조용히 });
  let 던짐 = '';
  try { await 통로.고쳐쓰기('management', 'docs/assembly.md', (글) => 표시붙인글(글, '어떤 법안', '승인', '2026-09-29'), '상황판: 어떤 법안에 승인'); }
  catch (e) { console.log(`    (던짐: ${e.message})`); 던짐 = e.message; }
  const 끝글 = 저장소들.management['docs/assembly.md'].글;
  확인('그사이 바뀌면 까닭(그사이 바뀜 · 409)을 담은 오류를 던진다', 던짐.includes('그사이') && 던짐.includes('409'), 던짐);
  확인('그사이 바뀌면 다시 읽지 않는다(GET 한 번 · PUT 한 번)', g.기록.filter((x) => x.startsWith('GET')).length === 1 && g.기록.filter((x) => x.startsWith('PUT')).length === 1, g.기록.join(' / '));
  확인('그사이 바뀌면 GitHub의 글은 그사이 바뀐 그대로다(찍은 답이 안 적힌다)', 끝글.includes('다른 기기가 올린 법안') && !끝글.includes('**승인**'));
}
{ // 쓰기 — 열쇠가 쓰기를 못 하면(401) 다시 해 보지 않고 응답 번호를 담아 던진다 //
  const 저장소들 = { management: { 'docs/assembly.md': { 글: 의회, sha: 's0' } } };
  const g = 가짜GitHub(저장소들);
  const 막는fetch = async (주소, 옵션) => (옵션.method === 'PUT' ? { status: 401, text: async () => JSON.stringify({ message: 'Bad credentials' }) } : g.fetch(주소, 옵션));
  const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: 막는fetch, 기록: 조용히 });
  let 던짐 = ''; try { await 통로.고쳐쓰기('management', 'docs/assembly.md', (글) => 글 + 'x', '시험'); } catch (e) { console.log(`    (던짐: ${e.message})`); 던짐 = e.message; }
  확인('쓰기가 401로 막히면 응답 번호와 까닭을 담아 던진다', 던짐.includes('401') && 던짐.includes('Bad credentials'), 던짐);
  확인('쓰기가 401로 막히면 글이 그대로다', 저장소들.management['docs/assembly.md'].글 === 의회);
}
{ // 저장소 파일 목록은 한꺼번에 받는다 — 한 곳씩 차례로 받으면 17곳에 5.7초, 한꺼번에 0.6초(2026-09-30 실제 GitHub) //
  const 저장소들 = {}; for (let i = 0; i < 5; i++) 저장소들['곳' + i] = { '.claude/x': { 글: '', sha: 'a' } };
  const g = 가짜GitHub(저장소들);
  let 날아가는중 = 0, 가장많이 = 0;
  const 느린fetch = async (주소, 옵션) => {
    if (!주소.includes('/git/trees/')) return g.fetch(주소, 옵션);
    날아가는중++; 가장많이 = Math.max(가장많이, 날아가는중);
    await new Promise((r) => setTimeout(r, 20)); 날아가는중--;
    return g.fetch(주소, 옵션);
  };
  const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: 느린fetch, 기록: 조용히 });
  const 부서 = await 통로.부서저장소들();
  확인('파일 목록 다섯 곳을 동시에 받는다', 가장많이 === 5, `동시에 가장 많이 ${가장많이}곳`);
  확인('한꺼번에 받아도 저장소 차례는 목록 차례 그대로다', 부서.map((x) => x.이름).join() === '곳0,곳1,곳2,곳3,곳4', 부서.map((x) => x.이름).join());
}
{ // 적어도 되는 파일 — bp-백엔드의 「문서 저장소는 비공개로 두고, 상황판은 관리부 의회 파일과 곳마다의 설계실 파일에만 적는다」 · [관리부 작업 454] 시험 ② //
  // 적어도됨(저장소, 경로) = (저장소 = 관리부 AND 경로 = docs/assembly.md) OR (저장소 ∈ 부서·프로젝트 목록 AND 경로 = docs/설계실.md) //
  const 곳들 = ['management', 'knowledge', 's36524-app', 'ilgongil-app'];
  확인('적어도됨: 관리부 설계실 파일은 참', 적어도됨('management', 'docs/설계실.md', 곳들) === true && 적어도됨('management', 'docs/설계실.md') === true);
  확인('적어도됨: 관리부 의회 파일은 참', 적어도됨('management', 'docs/assembly.md', 곳들) === true);
  확인('적어도됨: 부서·프로젝트(모든예약)의 설계실 파일은 참', 적어도됨('s36524-app', 'docs/설계실.md', 곳들) === true);
  확인('적어도됨: 모든예약이라도 작업 목록(docs/work.md)은 거짓', 적어도됨('s36524-app', 'docs/work.md', 곳들) === false);
  확인('적어도됨: 모든예약의 의회 같은 이름 파일(docs/assembly.md)은 거짓', 적어도됨('s36524-app', 'docs/assembly.md', 곳들) === false);
  확인('적어도됨: 관리부라도 작업 목록(docs/work.md)은 거짓', 적어도됨('management', 'docs/work.md', 곳들) === false);
  확인('적어도됨: 전역 환경(claude-config)의 파일은 목록에 넣어도 거짓', 적어도됨('claude-config', 'docs/설계실.md', [...곳들, 'claude-config']) === false && 적어도됨('claude-config', 'CLAUDE.md', 곳들) === false);
  확인('적어도됨: 부서·프로젝트 목록에 없는 저장소의 설계실 파일은 거짓', 적어도됨('status-board', 'docs/설계실.md', 곳들) === false);
  { // 부서·프로젝트 설계실 파일 — 고쳐쓰기()가 그 저장소에 커밋 하나로 적는다 //
    const 저장소들 = { 's36524-app': { 'docs/설계실.md': { 글: 의회, sha: 's0' } } };
    const g = 가짜GitHub(저장소들); const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: g.fetch, 기록: 조용히 });
    const r = await 통로.고쳐쓰기('s36524-app', 'docs/설계실.md', (글) => 표시붙인글(글, '어떤 법안', '승인', '2026-10-06', 'docs/설계실.md'), '상황판: 시험', 곳들);
    확인('고쳐쓰기() — 모든예약 설계실 파일에 승인이 적히고 PUT은 그 저장소 그 파일 하나', r.바뀜 && 저장소들['s36524-app']['docs/설계실.md'].글.includes('> 📌 **승인** | 2026-10-06') && g.기록.filter((x) => x.startsWith('PUT')).join() === 'PUT /repos/heyjay0811/s36524-app/contents/docs/설계실.md', g.기록.join(' / '));
  }
  { // 적어도 되는 파일이 아니면 GitHub에 묻지도 적지도 않는다 //
    const 저장소들 = { 's36524-app': { 'docs/work.md': { 글: 의회, sha: 's0' }, 'docs/설계실.md': { 글: 의회, sha: 's1' } } };
    const g = 가짜GitHub(저장소들); const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: g.fetch, 기록: 조용히 });
    let 던짐 = ''; try { await 통로.고쳐쓰기('s36524-app', 'docs/work.md', (글) => 글 + 'x', '시험', 곳들); } catch (e) { console.log(`    (던짐: ${e.message})`); 던짐 = e.message; }
    확인('고쳐쓰기()도 적어도 되는 파일이 아니면(모든예약 작업 목록) GitHub에 묻지도 적지도 않고 던진다', 던짐.includes('관리부 의회 파일과 부서·프로젝트마다의 설계실 파일에만') && g.기록.length === 0 && 저장소들['s36524-app']['docs/work.md'].글 === 의회, `${던짐} · 요청 ${g.기록.length}개`);
    let 던짐2 = ''; try { await 통로.고쳐쓰기('s36524-app', 'docs/설계실.md', (글) => 글 + 'x', '시험'); } catch (e) { console.log(`    (던짐: ${e.message})`); 던짐2 = e.message; }
    확인('고쳐쓰기()에 부서·프로젝트 목록을 안 넘기면 관리부 밖 설계실 파일에는 적지 않는다', 던짐2.includes('설계실 파일에만') && g.기록.length === 0, `${던짐2} · 요청 ${g.기록.length}개`);
  }
}
{ // 열쇠 없이는 비공개 저장소가 안 읽힌다 — 없음(null)이 아니라 실패로 알려야 한다 //
  const g = 가짜GitHub({ management: {} }); const 통로 = 통로만들기({ fetch: g.fetch, 기록: 조용히 });
  let 던짐 = ''; try { await 통로.부서저장소들(); } catch (e) { console.log(`    (던짐: ${e.message})`); 던짐 = e.message; }
  확인('열쇠 없이 저장소 목록을 부르면 「열쇠가 맞는지」를 알리며 던진다', 던짐.includes('열쇠'), 던짐);
}
// ── 지문(ETag)으로 묻기 — bp-백엔드의 「상황판은 원본에서 그때그때 읽은 문서로 화면을 그린다」 ───────────────────────── //
{
  const 보낸지문 = [];
  const 가짜 = async (주소, 옵션) => {
    보낸지문.push(옵션.headers['If-None-Match'] || '');
    const 지금지문 = '"e2"';
    if (옵션.headers['If-None-Match'] === 지금지문) return { status: 304, headers: { get: () => 지금지문 }, text: async () => '' };
    return { status: 200, headers: { get: (h) => (h.toLowerCase() === 'etag' ? 지금지문 : null) }, text: async () => JSON.stringify({ type: 'file', content: b64('새 글'), sha: 's2' }) };
  };
  const 통로 = 통로만들기({ 열쇠: 'k', fetch: 가짜, 기록: 조용히 });
  const 처음 = await 통로.파일읽기('a', 'docs/work.md');
  확인('지문 없이 읽으면 글과 함께 지문을 돌려준다', 처음 && 처음.글 === '새 글' && 처음.지문 === '"e2"', JSON.stringify(처음));
  const 같음 = await 통로.파일읽기('a', 'docs/work.md', '"e2"');
  확인('같은 지문으로 물으면 304를 받아 「안 바뀜」을 돌려준다', 같음 && 같음.안바뀜 === true && !같음.글, JSON.stringify(같음));
  확인('지문을 If-None-Match에 실어 보낸다', 보낸지문[1] === '"e2"', 보낸지문.join(','));
  const 다름 = await 통로.파일읽기('a', 'docs/work.md', '"e1"');
  확인('옛 지문으로 물으면 새 글과 새 지문을 받는다', 다름 && 다름.글 === '새 글' && 다름.지문 === '"e2"' && !다름.안바뀜, JSON.stringify(다름));
}

if (process.argv.includes('--live')) { // 공개 저장소를 실제로 읽는다 — 열쇠 없이 //
  const 통로 = 통로만들기({ 주인: 'heyjay0811', 기록: 조용히 });
  const 읽음 = await 통로.파일읽기('status-board', 'README.md');
  확인('실제 GitHub에서 공개 저장소 README를 열쇠 없이 읽는다', 읽음 && 읽음.글.length > 0, 읽음 ? 읽음.글.slice(0, 40) : 'null');
  const 목록 = await 통로.파일목록('status-board');
  확인('실제 GitHub에서 파일 목록에 doc-parse.mjs가 있다', 목록.includes('doc-parse.mjs'), 목록.join(','));
  확인('실제 GitHub에서 마지막 커밋 시각을 받는다', /^\d{4}-\d\d-\d\dT/.test(await 통로.마지막커밋('status-board', 'README.md') || ''));
}
console.log(실패.length ? `[github 시험] ERROR 통과 ${통과} · 실패 ${실패.length} — ${실패.join(' · ')}` : `[github 시험] SUCCESS ${통과}건 통과`);
// 끝내기는 종료 코드만 둔다 — 실제 GitHub에 붙은 연결이 닫히는 도중에 process.exit()로 끊으면 //
//   Windows의 Node가 「Assertion failed … UV_HANDLE_CLOSING」을 찍고 죽는다(2026-09-29 실측). //
process.exitCode = 실패.length ? 1 : 0;
