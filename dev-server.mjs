// 상황판 시험 서버 — 이 PC에서만(127.0.0.1) 돌며, 화면 파일을 보여 주고 GitHub API와 같은 모양으로 문서를 읽고 쓴다. //
//
// 무엇을 하나: 진짜 저장소의 `docs/` 문서만 임시 폴더로 복사해 그 사본을 GitHub처럼 내준다. 화면에서 답을 찍어 //
//   보아도 진짜 문서는 바뀌지 않는다. 쓰기는 GitHub처럼 sha(파일 지문)가 맞을 때만 받는다 — 옛 글 위에 쓰면 409. //
// 쓰는 법: `node dev-server.mjs` → 브라우저로 http://127.0.0.1:8787/?api=/api 를 연다. 열쇠는 아무 영문 글자나 넣는다. //
//   「wrong」으로 시작하는 열쇠를 넣으면 읽기는 되고 쓰기만 401로 막힌다 — 못 적었을 때의 화면을 잰다. //
//   `SB_HIDE=yessoft`면 그 저장소를 열쇠가 못 보는 것처럼 404로, `SB_SCREEN_FAIL=bill-parse.mjs`면 그 화면 코드 파일을 404로 준다. //
//   `SB_READ_FAIL=작업-448`처럼 주면 경로에 그 조각이 든 파일은 목록에는 있고 읽기만 500이다 — 못 읽었을 때의 화면을 잰다. //
// 한계: 저장소 여덟 곳의 docs 문서 몇백 개까지만 생각했다 · 바꿀 때: 시험할 문서가 수천 개가 되면 필요한 파일만 복사한다. //
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 관리부 = process.env.SB_MANAGEMENT || join(여기, '..', 'management');
// 쓰기를 일부러 늦춘다(밀리초) — 진짜 GitHub이 커밋에 2~3초 걸리는 것을 흉내 내어, 찍자마자 벗어나는 경우를 잰다 //
const 쓰기지연 = Number(process.env.SB_WRITE_DELAY_MS || 0);
const 포트 = Number(process.env.PORT || 8787);

// 저장소 이름 → 진짜 폴더. 관리부 · 관리부 아래 부서 둘 · projects 아래 프로젝트. //
function 진짜저장소들() {
  const 표 = { management: 관리부 };
  for (const 부서 of ['knowledge', 'yessoft']) if (existsSync(join(관리부, 부서, '.git'))) 표[부서] = join(관리부, 부서);
  const 프 = join(관리부, 'projects');
  if (existsSync(프)) for (const 이름 of readdirSync(프)) if (existsSync(join(프, 이름, '.git'))) 표[이름] = join(프, 이름);
  return 표;
}

// 사본 만들기 — docs/ 바로 아래 .md, 작업 파일(docs/작업/*.md — bp-작업의 「상황판은 작업 제목을 누르면 그 작업의 작업 파일을 펼치고, 진행 현황의 지시를 누르면 그 지시의 보고를 펼친다」), `.claude` 폴더가 있다는 표시만 옮긴다. //
const 뿌리 = mkdtempSync(join(tmpdir(), 'sb-dev-'));
const 저장소들 = 진짜저장소들();
for (const [이름, 폴더] of Object.entries(저장소들)) {
  const 사본 = join(뿌리, 이름);
  mkdirSync(join(사본, 'docs'), { recursive: true });
  const docs = join(폴더, 'docs');
  if (existsSync(docs)) for (const f of readdirSync(docs)) if (f.endsWith('.md')) copyFileSync(join(docs, f), join(사본, 'docs', f));
  const 작업 = join(docs, '작업');
  if (existsSync(작업)) {
    mkdirSync(join(사본, 'docs', '작업'), { recursive: true });
    for (const f of readdirSync(작업)) if (f.endsWith('.md')) copyFileSync(join(작업, f), join(사본, 'docs', '작업', f));
  }
  if (existsSync(join(폴더, '.claude'))) { mkdirSync(join(사본, '.claude'), { recursive: true }); writeFileSync(join(사본, '.claude', 'settings.json'), '{}'); }
  // [관리부 작업 443] 의회 박스가 맞댈 갈 곳 파일 — 저장소 규칙 파일(CLAUDE.md)도 옮긴다(관리부 설계 bp-의회 「의회 박스는 …맞대 바뀐 곳을 칠한다」 조) //
  if (existsSync(join(폴더, 'CLAUDE.md'))) copyFileSync(join(폴더, 'CLAUDE.md'), join(사본, 'CLAUDE.md'));
}
// 회장실 저장소(yessoftbook — 회장실 CLAUDE.md)와 전역 환경 저장소(claude-config — 전역 규칙·경로 규칙·매 턴 규칙·스킬)도 사본으로 둔다. //
//   두 저장소에는 `.claude` 표시를 두지 않는다 — 부서·프로젝트가 아니라 상황판 단추에 서지 않는다. //
{
  const 회장실 = join(관리부, '..');
  if (existsSync(join(회장실, 'CLAUDE.md'))) { mkdirSync(join(뿌리, 'yessoftbook'), { recursive: true }); copyFileSync(join(회장실, 'CLAUDE.md'), join(뿌리, 'yessoftbook', 'CLAUDE.md')); 저장소들.yessoftbook = 회장실; }
  const 전역 = process.env.SB_CLAUDE_CONFIG || join(homedir(), '.claude');
  if (existsSync(join(전역, 'CLAUDE.md'))) {
    const 사본 = join(뿌리, 'claude-config');
    mkdirSync(사본, { recursive: true }); copyFileSync(join(전역, 'CLAUDE.md'), join(사본, 'CLAUDE.md'));
    for (const 폴더 of ['rules', 'hooks']) if (existsSync(join(전역, 폴더))) { mkdirSync(join(사본, 폴더), { recursive: true }); for (const f of readdirSync(join(전역, 폴더))) if (f.endsWith('.md')) copyFileSync(join(전역, 폴더, f), join(사본, 폴더, f)); }
    if (existsSync(join(전역, 'skills'))) for (const s of readdirSync(join(전역, 'skills'))) if (existsSync(join(전역, 'skills', s, 'SKILL.md'))) { mkdirSync(join(사본, 'skills', s), { recursive: true }); copyFileSync(join(전역, 'skills', s, 'SKILL.md'), join(사본, 'skills', s, 'SKILL.md')); }
    저장소들['claude-config'] = 전역;
  }
}
console.log(`[시험 서버] 사본을 만들었다 — ${Object.keys(저장소들).length}곳 → ${뿌리}`);

const 지문 = (글) => createHash('sha1').update(글).digest('hex');
const 모든파일 = (폴더) => readdirSync(폴더, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? 모든파일(join(폴더, d.name)) : [join(폴더, d.name)]);
const 종류표 = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

// 문서 읽기를 일부러 늦춘다(밀리초) — 화면이 기기에 둔 글로 먼저 그리는지 잰다(bp-백엔드의 「상황판은 의회·설계실·작업과 확정된 설계는 GitHub에서, 환경은 PC 폴더에서 그때그때 읽어서 보여 준다」) //
const 읽기지연 = Number(process.env.SB_READ_DELAY_MS || 0);
// 일부러 못 읽게 할 파일 — 경로에 이 조각(쉼표로 여럿)이 든 파일은 파일 목록에는 두고 읽기(GET)만 500을 돌려준다. //
//   파일 목록에 있는데 못 읽을 때 화면이 무엇을 못 읽었는지 알리는지 잰다(bp-작업의 「상황판은 작업 제목을 누르면 그 작업의 작업 파일을 펼치고, 진행 현황의 지시를 누르면 그 지시의 보고를 펼친다」 · bp-백엔드의 「상황판은 PC 앱과 모바일 앱 둘이고, 의회·설계실·작업 목록은 두 앱이 코드 한 벌을 함께 쓴다」). //
const 못읽을것 = String(process.env.SB_READ_FAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
// 열쇠가 못 보는 저장소 흉내 — 이 이름(쉼표로 여럿)의 저장소는 저장소 목록에서 빠지고 파일 목록·파일 읽기가 404다(bp-부서프로젝트목록의 「상황판은 의회와 작업은 GitHub에서, 환경은 PC 폴더에서 그때그때 읽어서 보여 준다」 · bp-백엔드의 「상황판은 PC 앱과 모바일 앱 둘이고, 의회·설계실·작업 목록은 두 앱이 코드 한 벌을 함께 쓴다」). //
const 숨길저장소 = String(process.env.SB_HIDE || '').split(',').map((s) => s.trim()).filter(Boolean);
// 못 읽게 할 화면 코드 파일 — 이 이름(쉼표로 여럿)의 화면 파일은 404다. 화면 모듈을 못 불러올 때 알리는지 잰다(제7조 ②). //
const 못줄화면 = String(process.env.SB_SCREEN_FAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
const 서버 = createServer((요청, 응답) => {
  const u = new URL(요청.url, 'http://127.0.0.1');
  const 경로 = decodeURIComponent(u.pathname);
  if (읽기지연 && 요청.method === 'GET' && 경로.startsWith('/api/') && !요청.늦췄음) {
    요청.늦췄음 = true; setTimeout(() => 서버.emit('request', 요청, 응답), 읽기지연); return;
  }
  const 답 = (상태, 값) => { 응답.writeHead(상태, { 'Content-Type': 'application/json; charset=utf-8' }); 응답.end(JSON.stringify(값)); };
  try {
    if (!경로.startsWith('/api/')) {   // 화면 파일 — 이 저장소 폴더 안만 내준다 //
      const 파일 = join(여기, 경로 === '/' ? 'index.html' : 경로);
      if (못줄화면.some((이름) => 경로.endsWith('/' + 이름))) { console.log(`[시험 서버] 화면 파일을 일부러 안 준다(404) — ${경로}`); 응답.writeHead(404); 응답.end('없다'); return; }
      if (relative(여기, 파일).startsWith('..') || !existsSync(파일) || statSync(파일).isDirectory()) { 응답.writeHead(404); 응답.end('없다'); return; }
      응답.writeHead(200, { 'Content-Type': 종류표[extname(파일)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      응답.end(readFileSync(파일)); return;
    }
    const api = 경로.slice(4);
    if (api === '/user/repos') return 답(200, Object.keys(저장소들).filter((name) => !숨길저장소.includes(name)).map((name) => ({ name })));
    const 숨김 = 숨길저장소.find((name) => api.startsWith(`/repos/heyjay0811/${name}/`));
    if (숨김) { console.log(`[시험 서버] 열쇠가 못 보는 저장소 흉내(404) — ${숨김}`); return 답(404, { message: 'Not Found' }); }
    let m;
    if ((m = api.match(/^\/repos\/[^/]+\/([^/]+)\/git\/trees\/HEAD$/))) {
      const 폴더 = join(뿌리, m[1]);
      if (!existsSync(폴더)) return 답(404, { message: 'Not Found' });
      return 답(200, { truncated: false, tree: 모든파일(폴더).map((f) => ({ path: relative(폴더, f).split(sep).join('/'), type: 'blob' })) });
    }
    if ((m = api.match(/^\/repos\/[^/]+\/([^/]+)\/commits$/))) {
      const 파일 = join(뿌리, m[1], u.searchParams.get('path') || '');
      return 답(200, existsSync(파일) ? [{ commit: { committer: { date: statSync(파일).mtime.toISOString() } } }] : []);
    }
    if ((m = api.match(/^\/repos\/[^/]+\/([^/]+)\/contents\/(.+)$/))) {
      const 파일 = join(뿌리, m[1], m[2]);
      if (relative(join(뿌리, m[1]), 파일).startsWith('..')) return 답(400, { message: '경로가 이상하다' });
      if (요청.method === 'GET') {
        if (!existsSync(파일)) return 답(404, { message: 'Not Found' });
        if (못읽을것.some((조각) => `${m[1]}/${m[2]}`.includes(조각))) {
          console.log(`[시험 서버] 일부러 못 읽게 했다(500) — ${m[1]}/${m[2]}`);
          return 답(500, { message: '시험 서버가 일부러 못 읽게 한 파일' });
        }
        const 글 = readFileSync(파일);
        // 진짜 GitHub처럼 지문(ETag)을 붙이고, 「이 지문과 같으면 보내지 마라」면 304만 보낸다(bp-백엔드의 「상황판은 의회·설계실·작업과 확정된 설계는 GitHub에서, 환경은 PC 폴더에서 그때그때 읽어서 보여 준다」) //
        const etag = `"${지문(글)}"`;
        if (요청.headers['if-none-match'] === etag) { 응답.writeHead(304, { ETag: etag }); 응답.end(); return; }
        응답.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag });
        응답.end(JSON.stringify({ type: 'file', content: 글.toString('base64'), sha: 지문(글) }));
        return;
      }
      if (요청.method === 'PUT') {
        // 쓰기만 막히는 열쇠 — 열쇠가 「wrong」으로 시작하면 쓰기(PUT)에만 401을 돌려준다(bp-결재의 「상황판은 비공개 저장소를 열쇠로 읽고, 찍은 답을 GitHub의 의회 파일과 설계실 파일에 바로 적는다」 시험). //
        //   이 서버는 어떤 열쇠든 읽기를 받아 주고, 진짜 GitHub에서 열쇠를 틀리면 읽기부터 막혀 찍을 화면이 안 서기 때문이다. //
        // ★표지는 영문이다 — 브라우저와 Node의 fetch는 요청 머리(Authorization)에 한글이 들면 요청을 보내지 않고 던진다. //
        if (/^Bearer wrong/.test(요청.headers.authorization || '')) {
          요청.resume();
          console.log(`[시험 서버] 쓰기 거절(401, 쓰기만 막히는 열쇠) — ${m[1]}/${m[2]}`);
          return setTimeout(() => 답(401, { message: 'Bad credentials' }), 쓰기지연);
        }
        let 몸 = ''; 요청.on('data', (c) => { 몸 += c; });
        요청.on('end', () => setTimeout(() => {
          try {
            const 값 = JSON.parse(몸);
            if (!existsSync(파일) || 지문(readFileSync(파일)) !== 값.sha) return 답(409, { message: 'sha does not match' });
            const 새글 = Buffer.from(값.content, 'base64');
            writeFileSync(파일, 새글);
            console.log(`[시험 서버] 커밋 — ${m[1]}/${m[2]}: ${값.message}`);
            // 진짜 GitHub처럼 새 파일 지문과 커밋 시각을 돌려준다 — 화면이 이 값으로 다시 읽지 않고 그린다 //
            답(200, { content: { sha: 지문(새글) }, commit: { sha: 지문(새글), committer: { date: new Date().toISOString() } } });
          } catch (e) { console.error(`[시험 서버] ERROR 쓰기 실패: ${e.message}`); 답(500, { message: e.message }); }
        }, 쓰기지연));
        return;
      }
    }
    답(404, { message: '시험 서버가 모르는 요청' });
  } catch (e) {
    console.error(`[시험 서버] ERROR ${요청.method} ${경로}: ${e.message}`);
    답(500, { message: e.message });
  }
});
서버.listen(포트, '127.0.0.1', () => console.log(`[시험 서버] SUCCESS http://127.0.0.1:${포트}/?api=/api`));
