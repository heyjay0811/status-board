// GitHub 통로 `github.mjs`의 시험 — 메모리 안의 가짜 GitHub으로 돌리고, `--live`를 붙이면 공개 저장소를 실제로 읽는다. //
// 따르는 설계: 관리부 설계 `bp-상황판` 제1조 ④⑤ · 제7조 ② · 제10조 ③④⑤ //
import { 통로만들기 } from './github.mjs';
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
        return 응답(200, { commit: { sha: 'c0ffee' + 번호 + '0000000' } });
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
{ // 쓰기 — 커밋 하나, 그사이 바뀌면 다시 읽어 그 위에 적는다 //
  const 저장소들 = { management: { 'docs/assembly.md': { 글: 의회, sha: 's0' } } };
  const 끼어들기 = { 남은: 1, 바꾸기: (글) => 글 + '\n## 다른 기기가 올린 법안 | #규칙 | 소속: 전역 규칙\n' };
  const g = 가짜GitHub(저장소들, { 끼어들기 }); const 통로 = 통로만들기({ 열쇠: '가짜열쇠', fetch: g.fetch, 기록: 조용히 });
  const r = await 통로.고쳐쓰기('management', 'docs/assembly.md', (글) => 표시붙인글(글, '어떤 법안', '신설', '2026-09-29'), '상황판: 어떤 법안에 신설');
  const 끝글 = 저장소들.management['docs/assembly.md'].글;
  확인('그사이 다른 곳에서 바뀌어도 찍은 답이 적힌다', 끝글.includes('> 📌 🆕 **신설** | 2026-09-29'));
  확인('그사이 바뀐 글이 사라지지 않는다', 끝글.includes('다른 기기가 올린 법안'));
  확인('커밋 하나를 돌려준다', r.바뀜 && r.커밋.startsWith('c0ffee'));
  확인('두 번째 시도에서 다시 읽었다(GET이 두 번)', g.기록.filter((x) => x.startsWith('GET')).length === 2, g.기록.join(' / '));
  const 같음 = await 통로.고쳐쓰기('management', 'docs/assembly.md', (글) => 글, '바뀐 것 없음');
  확인('바뀐 것이 없으면 커밋하지 않는다', 같음.바뀜 === false && 같음.커밋 === null);
}
{ // 열쇠 없이는 비공개 저장소가 안 읽힌다 — 없음(null)이 아니라 실패로 알려야 한다 //
  const g = 가짜GitHub({ management: {} }); const 통로 = 통로만들기({ fetch: g.fetch, 기록: 조용히 });
  let 던짐 = ''; try { await 통로.부서저장소들(); } catch (e) { console.log(`    (던짐: ${e.message})`); 던짐 = e.message; }
  확인('열쇠 없이 저장소 목록을 부르면 「열쇠가 맞는지」를 알리며 던진다', 던짐.includes('열쇠'), 던짐);
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
