// 상황판 시험 서버 — 이 PC에서만(127.0.0.1) 돌며, 화면 파일을 보여 주고 GitHub API와 같은 모양으로 문서를 읽고 쓴다. //
//
// 무엇을 하나: 진짜 저장소의 `docs/` 문서만 임시 폴더로 복사해 그 사본을 GitHub처럼 내준다. 화면에서 답을 찍어 //
//   보아도 진짜 문서는 바뀌지 않는다. 쓰기는 GitHub처럼 sha(파일 지문)가 맞을 때만 받는다 — 옛 글 위에 쓰면 409. //
// 쓰는 법: `node dev-server.mjs` → 브라우저로 http://127.0.0.1:8787/?api=/api 를 연다. 열쇠는 아무 글자나 넣는다. //
// 한계: 저장소 여덟 곳의 docs 문서 몇백 개까지만 생각했다 · 바꿀 때: 시험할 문서가 수천 개가 되면 필요한 파일만 복사한다. //
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
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

// 사본 만들기 — docs/ 바로 아래 .md와 `.claude` 폴더가 있다는 표시만 옮긴다. //
const 뿌리 = mkdtempSync(join(tmpdir(), 'sb-dev-'));
const 저장소들 = 진짜저장소들();
for (const [이름, 폴더] of Object.entries(저장소들)) {
  const 사본 = join(뿌리, 이름);
  mkdirSync(join(사본, 'docs'), { recursive: true });
  const docs = join(폴더, 'docs');
  if (existsSync(docs)) for (const f of readdirSync(docs)) if (f.endsWith('.md')) copyFileSync(join(docs, f), join(사본, 'docs', f));
  if (existsSync(join(폴더, '.claude'))) { mkdirSync(join(사본, '.claude'), { recursive: true }); writeFileSync(join(사본, '.claude', 'settings.json'), '{}'); }
}
console.log(`[시험 서버] 사본을 만들었다 — ${Object.keys(저장소들).length}곳 → ${뿌리}`);

const 지문 = (글) => createHash('sha1').update(글).digest('hex');
const 모든파일 = (폴더) => readdirSync(폴더, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? 모든파일(join(폴더, d.name)) : [join(폴더, d.name)]);
const 종류표 = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const 서버 = createServer((요청, 응답) => {
  const u = new URL(요청.url, 'http://127.0.0.1');
  const 경로 = decodeURIComponent(u.pathname);
  const 답 = (상태, 값) => { 응답.writeHead(상태, { 'Content-Type': 'application/json; charset=utf-8' }); 응답.end(JSON.stringify(값)); };
  try {
    if (!경로.startsWith('/api/')) {   // 화면 파일 — 이 저장소 폴더 안만 내준다 //
      const 파일 = join(여기, 경로 === '/' ? 'index.html' : 경로);
      if (relative(여기, 파일).startsWith('..') || !existsSync(파일) || statSync(파일).isDirectory()) { 응답.writeHead(404); 응답.end('없다'); return; }
      응답.writeHead(200, { 'Content-Type': 종류표[extname(파일)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      응답.end(readFileSync(파일)); return;
    }
    const api = 경로.slice(4);
    if (api === '/user/repos') return 답(200, Object.keys(저장소들).map((name) => ({ name })));
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
        const 글 = readFileSync(파일);
        return 답(200, { type: 'file', content: 글.toString('base64'), sha: 지문(글) });
      }
      if (요청.method === 'PUT') {
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
