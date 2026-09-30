// 상황판 화면 — 홈·의회·설계실·작업 네 화면. PC 앱과 모바일 앱이 이 한 벌을 쓴다(관리부 설계 `bp-상황판` 제7조 ③). //
//
// 따르는 설계: 제1조 ①④⑤(GitHub에서 읽고, 읽을 문서는 파일 목록으로, `.claude` 있는 저장소만) · 제2조 ⑧⑨⑩(홈의 수 · 작업 목록) · //
//   제4조 ②③④⑤⑥(답 둘 · 다시 눌러 거두기 · 코멘트) · 제6조 ①②③⑤⑥⑬⑰(박스) · 제7조 ②(못 읽으면 멈추고 알린다) · //
//   제10조 ③④⑤(찍은 답을 바로 커밋 · 그사이 바뀌면 다시 적기 · 마지막 커밋 시각) · 제11조(설계실 화면). //
// 작업 화면은 읽기만 한다(사용자 결정 2026-09-29 「진행해」 — 폰 작업 화면은 지금 설계 제2조 ⑩ 그대로). //
import { 통로만들기 } from './github.mjs';
import { 표시붙인글, 코멘트붙인글 } from './doc-mark.mjs';
import { 법안읽기, 고를답, 곳이름 } from './bill-parse.mjs';
import { 항목분해, 상태줄읽기 } from './doc-parse.mjs';
import { 막기, 꾸미기, 달라진데, 지운데, 앞줄표시나누기, 항밖글, 앞글나누기, 자리벗기기, 같은글, 자리묶기, 묶은목록 } from './assembly-view.mjs';

const 기록 = (말) => console.log('[상황판] ' + 말);
const 열쇠자리 = 'sb.열쇠';
const 주소칸 = new URLSearchParams(location.search);
const API = 주소칸.get('api') || undefined;   // 시험 서버를 쓸 때만 준다(`dev-server.mjs`) //
const 의회자리 = { 저장소: 'management', 경로: 'docs/assembly.md' };
const 곳차례 = Object.keys(곳이름);

// 브라우저 저장소는 막혀 있을 수 있다(사생활 창 같은 곳) — 막혀도 화면은 열쇠 칸을 다시 보인다 //
const 열쇠읽기 = () => { try { return localStorage.getItem(열쇠자리) || ''; } catch (e) { 기록('열쇠를 못 읽었다: ' + e.message); return ''; } };
const 열쇠쓰기 = (v) => { try { v ? localStorage.setItem(열쇠자리, v) : localStorage.removeItem(열쇠자리); } catch (e) { 기록('ERROR 열쇠를 못 적었다: ' + e.message); } };

const 상태 = { 통로: null, 곳들: [], 의회: null, 화면: '홈', 작업곳: 'management', 열린: null, 쓰는줄: null, 알림: '', 읽는중: false };
const 본문 = document.getElementById('본문');
const 덮개 = document.getElementById('박스덮개');
const 박스 = document.getElementById('박스');
const 넓은화면 = matchMedia('(min-width: 900px)');
const 오늘 = () => new Date().toLocaleDateString('sv-SE');   // 그 기기의 날짜 — YYYY-MM-DD //
const 때 = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// ── 읽기 ─────────────────────────────────────────────────────────────── //
// 읽을 곳과 파일을 먼저 다 정하고, 전부 도착한 뒤에 그린다 — 먼저 온 것만 보고 「없다」를 그리지 않는다(개발 규칙 제2조 ②). //
async function 모두읽기() {
  상태.읽는중 = true; 그리기();
  기록('START 모두읽기');
  try {
    const 곳들 = (await 상태.통로.부서저장소들())
      .sort((a, b) => (곳차례.indexOf(a.이름) + 1 || 99) - (곳차례.indexOf(b.이름) + 1 || 99));
    상태.곳들 = await Promise.all(곳들.map(async (곳) => {
      const 결과 = { 저장소: 곳.이름, 이름: 곳이름[곳.이름] || 곳.이름, 작업: null, 설계안: null, 오류: [], 시각: {} };
      const 읽기 = async (경로, 넣기) => {
        if (!곳.목록.includes(경로)) return;   // 그 곳에 그 문서가 없다 — 정상 //
        try {
          const [f, 시각] = await Promise.all([상태.통로.파일읽기(곳.이름, 경로), 상태.통로.마지막커밋(곳.이름, 경로)]);
          if (f) { 넣기(f.글); 결과.시각[경로] = 시각; }
        } catch (e) { 결과.오류.push(`${경로}: ${e.message}`); 기록(`ERROR ${곳.이름}/${경로} 못 읽음 — ${e.message}`); }
      };
      await Promise.all([
        읽기('docs/work.md', (글) => { 결과.작업 = 항목분해(글, { 종류: '작업' }); }),
        읽기('docs/설계실.md', (글) => { 결과.설계안 = 법안읽기(글, '설계실.md'); }),
        곳.이름 === 의회자리.저장소 ? 읽기(의회자리.경로, (글) => { 상태.의회 = 법안읽기(글, 'assembly.md'); }) : null,
      ]);
      return 결과;
    }));
    상태.알림 = '';
    기록(`SUCCESS 모두읽기 — ${상태.곳들.length}곳 · 법안 ${상태.의회 ? 상태.의회.length : '못 읽음'}`);
  } catch (e) {
    상태.알림 = '못 읽었다: ' + e.message;
    기록('ERROR 모두읽기 — ' + e.message);
  }
  상태.읽는중 = false; 그리기();
}

// 답을 적은 파일의 글로 그 자리를 갈아 끼운다 — 답을 찍은 뒤 「찍었다」와 「문서에 있다」가 갈라지지 않게. //
// ★글과 시각은 커밋 응답에서 온 것(GitHub이 받아 적은 그 글)이라 파일을 다시 읽지 않는다 — 찍기가 GitHub을 두 번만 오간다([작업 395]). //
function 적은글넣기(저장소, 경로, 글, 시각) {
  const 곳 = 상태.곳들.find((x) => x.저장소 === 저장소);
  if (경로 === 의회자리.경로) 상태.의회 = 법안읽기(글, 'assembly.md');
  else if (곳) 곳.설계안 = 법안읽기(글, '설계실.md');
  if (곳 && 시각) 곳.시각[경로] = 시각;
}

// ── 그리기 ─────────────────────────────────────────────────────────────── //
function 그리기() {
  for (const a of document.querySelectorAll('[data-탭]')) a.classList.toggle('지금', a.dataset.탭 === 상태.화면);
  document.getElementById('시각').textContent = 시각글();
  if (!상태.통로) return 열쇠그리기();
  if (상태.읽는중 && !상태.곳들.length) { 본문.innerHTML = '<p class="안내">GitHub에서 읽는 중…</p>'; return; }
  const 알림 = 상태.알림 ? `<p class="오류">${막기(상태.알림)}</p>` : '';
  const 글 = { 홈: 홈글, 의회: 의회글, 설계실: 설계실글, 작업: 작업글 }[상태.화면]();
  // 넓은 화면은 박스를 열지 않아도 두 칸으로 세우고, 빈 박스 칸에 안내를 보인다(제12조 ③) //
  const 두칸 = 상태.화면 !== '홈' && (!!상태.열린 || 넓은화면.matches);
  본문.className = 두칸 ? '두칸' : '';
  const 빈칸 = 두칸 && !상태.열린 ? '<div class="빈칸">목록에서 하나를 고르면 여기 열린다</div>' : '';
  본문.innerHTML = 알림 + `<div class="목록칸">${글}</div>` + 빈칸;
  박스그리기();
}

// 화면 맨 위의 마지막 커밋 시각 — 지금 화면이 읽은 문서 가운데 가장 늦은 것(제10조 ⑤) //
function 시각글() {
  const 곳들 = 상태.화면 === '작업' ? 상태.곳들.filter((x) => x.저장소 === 상태.작업곳) : 상태.곳들;
  const 경로 = { 의회: [의회자리.경로], 설계실: ['docs/설계실.md'], 작업: ['docs/work.md'], 홈: [의회자리.경로, 'docs/설계실.md', 'docs/work.md'] }[상태.화면];
  const 모두 = 곳들.flatMap((x) => 경로.map((p) => x.시각[p]).filter(Boolean)).sort();
  return 모두.length ? '마지막 커밋 ' + 때(모두[모두.length - 1]) : '';
}

function 열쇠그리기() {
  본문.className = '';
  본문.innerHTML = `<div class="열쇠칸"><h2>GitHub 열쇠 넣기</h2>
    <p class="안내">문서가 든 저장소는 비공개라, 사용자의 GitHub 열쇠(토큰)로 읽고 씁니다. 열쇠는 이 기기 안에만 둡니다(설계 제10조 ②).</p>
    <p class="안내">GitHub → Settings → Developer settings → Fine-grained tokens에서 만들고, 부서·프로젝트 저장소를 고른 뒤 권한은 <b>Contents: Read and write</b> 하나만 줍니다. 상황판은 의회 파일(<code>docs/assembly.md</code>)과 설계실 파일(<code>docs/설계실.md</code>)에만 적습니다.</p>
    <input id="열쇠" type="password" autocomplete="off" placeholder="github_pat_…">
    <p><button type="button" class="답단추" data-일="열쇠저장">넣고 읽기</button></p></div>`;
}

const 곳수 = (곳) => {
  const 법안 = (상태.의회 || []).filter((b) => (b.곳 || 'management') === 곳.저장소).length;
  return { 작업: 곳.작업 ? 곳.작업.length : null, 법안, 설계안: 곳.설계안 ? 곳.설계안.length : 0 };
};

// 홈 — 맨 위에 찍을 법안·찍을 설계안·진행 중 작업, 그 아래 곳마다 한 줄(제2조 ⑧⑨) //
function 홈글() {
  const 찍을법안 = (상태.의회 || []).filter((b) => !b.표시).length;
  const 찍을설계안 = 상태.곳들.reduce((n, 곳) => n + (곳.설계안 || []).filter((b) => !b.표시).length, 0);
  const 진행 = 상태.곳들.reduce((n, 곳) => n + (곳.작업 || []).filter((w) => /^▶/.test(w.제목)).length, 0);
  const 줄들 = 상태.곳들.map((곳) => {
    const 수 = 곳수(곳);
    return `<button type="button" class="곳줄" data-곳="${막기(곳.저장소)}"><span class="이름">${막기(곳.이름)}</span>
      <span class="수">작업 <b>${수.작업 == null ? '–' : 수.작업}</b> · 법안 <b>${수.법안}</b> · 설계안 <b>${수.설계안}</b></span>
      ${곳.오류.length ? '<span class="딱지 판단" title="' + 막기(곳.오류.join(' / ')) + '">못 읽은 문서 있음</span>' : ''}</button>`;
  }).join('');
  return `<div class="요약"><div><b>${상태.의회 ? 찍을법안 : '–'}</b><span>찍을 법안</span></div>
    <div><b>${찍을설계안}</b><span>찍을 설계안</span></div><div><b>${진행}</b><span>진행 중 작업</span></div></div><div class="곳들">${줄들}</div>`;
}

// 목록 줄 하나 — 의회 법안과 설계안이 같이 쓴다 //
function 항목줄(it, 열쇠) {
  const 수 = Object.keys(it.코멘트).length;
  const 열림 = 상태.열린 && 상태.열린.열쇠 === 열쇠 ? ' 열림' : '';
  return `<button type="button" class="줄${열림}" data-열기="${막기(열쇠)}"><span class="딱지">${막기(종류글(it.종류))}</span>
    <span class="제목">${꾸미기(it.이름)}<br><span class="자리딱지">${꾸미기(it.문서)}</span></span>
    ${it.표시 ? `<span class="딱지 답">${막기(it.표시)}</span>` : ''}${수 ? `<span class="딱지">코멘트 ${수}</span>` : ''}</button>`;
}
const 종류글 = (종류) => (종류 === '항추가' ? '항 추가' : 종류);

// 의회 — 들어갈 자리의 주인과 종류로 크게 묶고, 문서마다 작게 묶는다(제6조 ⑮) //
function 의회글() {
  if (!상태.의회) return '<p class="오류">의회 파일을 못 읽었다 — 관리부 저장소의 docs/assembly.md</p>';
  if (!상태.의회.length) return '<p class="안내">대기 중인 법안이 없다 — 다 처리됐다.</p>';
  const 묶음 = 자리묶기(상태.의회.map((b) => b.제목), []);
  return `<p class="안내">법안 ${상태.의회.length}건 · 답은 법안 끝의 둘이고, 찍힌 단추를 다시 누르면 거둔다.</p>`
    + 묶은목록(묶음, (i) => 항목줄(상태.의회[i], '의회:' + i));
}

// 설계실 — 곳마다 큰 머리 줄을 세우고 그 곳의 설계안을 모은다. 설계안이 없는 곳은 머리 줄만 선다(제11조 ①) //
function 설계실글() {
  return 상태.곳들.map((곳) => {
    const 안 = 곳.설계안 || [];
    return `<details class="자리큰" open><summary>${막기(곳.이름)} <span class="자리수">${안.length}</span></summary>`
      + 안.map((it, i) => 항목줄(it, `설계실:${곳.저장소}:${i}`)).join('') + '</details>';
  }).join('');
}

// 작업 — 곳을 고르고, 판단 필요 → 진행 중(▶) → 나머지 차례로 상태 줄과 함께 보인다(제2조 ⑩). 읽기만 한다. //
function 작업글() {
  const 곳 = 상태.곳들.find((x) => x.저장소 === 상태.작업곳) || 상태.곳들[0];
  const 고르개 = '<div class="고르개">' + 상태.곳들.map((x) =>
    `<button type="button" data-작업곳="${막기(x.저장소)}" class="${x === 곳 ? '지금' : ''}">${막기(x.이름)}</button>`).join('') + '</div>';
  if (!곳) return 고르개;
  if (!곳.작업) return 고르개 + `<p class="${곳.오류.length ? '오류' : '안내'}">${곳.오류.length ? '작업 목록을 못 읽었다 — ' + 막기(곳.오류.join(' / ')) : '이 곳에는 작업 목록이 없다'}</p>`;
  const 차례 = (w) => (w.상태줄 && w.상태줄.판단필요 ? 0 : /^▶/.test(w.제목) ? 1 : 2);
  const 목록 = 곳.작업.map((w, i) => ({ ...w, 번째: i, 상태줄: 상태줄읽기(w.본문) })).sort((a, b) => 차례(a) - 차례(b));
  return 고르개 + 목록.map((w) => {
    const s = w.상태줄;
    const 열쇠 = `작업:${곳.저장소}:${w.번째}`;
    return `<button type="button" class="줄${상태.열린 && 상태.열린.열쇠 === 열쇠 ? ' 열림' : ''}" data-열기="${막기(열쇠)}"><span class="제목">
      ${s && s.판단필요 ? '<span class="딱지 판단">판단 필요</span> ' : ''}<b>[작업 ${w.번호}]</b> ${꾸미기(w.제목)}
      ${s ? `<span class="상태줄"><b>지금</b> ${꾸미기(s.지금)}<br><b>남음</b> ${꾸미기(s.남음)}<br><b>판단</b> ${꾸미기(s.판단)}</span>` : '<span class="상태줄">상태 줄 없음</span>'}
      </span></button>`;
  }).join('');
}

// ── 박스 ─────────────────────────────────────────────────────────────── //
function 열린것() {
  const k = 상태.열린 && 상태.열린.열쇠;
  if (!k) return null;
  const [종류, a, b] = k.split(':');
  if (종류 === '의회') return 상태.의회 && 상태.의회[+a] ? { 종류, 항목: 상태.의회[+a], 저장소: 의회자리.저장소, 경로: 의회자리.경로, 문서: 'assembly.md' } : null;
  const 곳 = 상태.곳들.find((x) => x.저장소 === a);
  if (!곳) return null;
  if (종류 === '설계실') return 곳.설계안 && 곳.설계안[+b] ? { 종류, 항목: 곳.설계안[+b], 저장소: a, 경로: 'docs/설계실.md', 문서: '설계실.md' } : null;
  return 곳.작업 && 곳.작업[+b] ? { 종류, 항목: 곳.작업[+b], 저장소: a } : null;
}

function 박스그리기() {
  const 열린 = 열린것();
  덮개.hidden = !열린;
  // 넓은 화면은 목록 옆 칸, 좁은 화면은 화면 전체(제6조 ①) //
  const 옆칸 = 넓은화면.matches && !!열린;
  덮개.classList.toggle('옆칸', 옆칸);
  if (옆칸 && 덮개.parentNode !== 본문) 본문.appendChild(덮개);
  if (!옆칸 && 덮개.parentNode !== document.body) document.body.appendChild(덮개);
  if (!열린) { 박스.innerHTML = ''; return; }
  if (열린.종류 === '작업') {
    const w = 열린.항목;
    박스.innerHTML = `<div class="박스머리"><h2>[작업 ${w.번호}] ${꾸미기(w.제목)}</h2><button type="button" class="작은단추 닫기" data-일="닫기">✕</button></div>
      <div class="박스몸 본문글">${꾸미기(w.본문)}</div>`;
    return;
  }
  const it = 열린.항목;
  const 줄 = (키) => 코멘트줄(it, 키);
  // 항 밖 줄 — 적힌 차례 그대로(제6조 ⑰). 표시 블록((변경)·(신설)·(추가))은 지금 → 고칠 글로 칠한다 //
  const 앞 = 앞줄표시나누기(it.앞줄).map((p) => {
    if (p.종류 === '글') {
      const g = 항밖글(p.글.split('\n'));
      return g ? 앞글나누기(g, it.소속).map((q) => `<div class="앞글${q.종류 === '될' ? ' 될' : q.종류 === '지울' ? ' 지울' : ''}">${꾸미기(q.글)}</div>`).join('') : '';
    }
    const 자리 = `<b>${막기(p.자리)}</b> `;
    if (p.표 === '신설') return `<div class="항 될">${자리}${꾸미기(p.고칠)}</div>`;
    if (p.표 === '삭제') return `<div class="항 지울">${자리}${꾸미기(p.지금)}</div>`;
    return `<div class="항 지울">${자리}${지운데(p.지금, p.고칠)}</div><div class="화살">↓</div><div class="항 될">${자리}${달라진데(p.지금, p.고칠)}</div>`;
  }).join('');
  // 항 — (변경)은 지금 빨강 ↓ 고칠 초록, (신설)은 초록, (삭제)는 빨강, 표시 없는 항은 흐리게(제6조 ⑤⑥). //
  //   표시가 하나도 없는 신설 법안(새 조·새 스킬)은 항 전부가 새로 생기는 글이다. //
  const 표있음 = it.항.some((x) => x.표);
  const 항들 = it.항.map((x) => {
    const 기호 = `<span class="기호">${x.기호}</span>`;
    let 몸;
    if (it.종류 === '삭제') 몸 = `<div class="항 지울">${기호}${꾸미기(x.글)}</div><div class="까닭">왜 지우나: ${꾸미기(x.까닭 || '(적혀 있지 않다)')}</div>`;
    else if (x.표 === '변경' && x.지금글 !== null) {
      const 지금 = 자리벗기기(x.지금글), 새 = 자리벗기기(x.글);
      몸 = 같은글(지금, 새) ? `<div class="항">${기호}${꾸미기(새)}</div>`
        : `<div class="항 지울">${기호}${지운데(지금, 새)}</div><div class="화살">↓</div><div class="항 될">${기호}${달라진데(지금, 새)}</div>`;
    } else if (x.표 === '신설' || (!표있음 && ['신설', '추가', '항추가'].includes(it.종류))) 몸 = `<div class="항 될">${기호}${꾸미기(x.글)}</div>`;
    else if (x.표 === '삭제') 몸 = `<div class="항 지울">${기호}${꾸미기(x.지금글 !== null ? x.지금글 : x.글)}</div>`;
    else 몸 = `<div class="항 흐림">${기호}${꾸미기(x.글)}</div>`;
    return 몸 + 줄(x.기호);
  }).join('');
  const 계획 = it.계획.length ? `<div class="계획"><h3>구현 계획 초안</h3><div>${꾸미기(it.계획.join('\n'))}</div></div>` : '';
  const 답들 = 고를답(it.종류).map((답) => {
    const 찍힘 = it.표시 === 답;
    return `<button type="button" class="답단추${찍힘 ? ' 찍힘' : ''}" data-답="${찍힘 ? '' : 답}" title="${찍힘 ? '다시 누르면 거둔다' : 답 + '을 찍는다'}">${답}${찍힘 ? ' ✓' : ''}</button>`;
  }).join('');
  const 수 = Object.keys(it.코멘트).length;
  const 안내 = 상태.알림 || (it.표시 ? `${it.표시} 찍힘 — 같은 단추를 다시 누르면 거둔다` : '') + (수 ? ` · 코멘트 ${수}개 — ${it.표시 ? '찍은 답에 딸려 AI가 반영한다' : '답 없이 단 코멘트는 물음이다'}` : '');
  박스.innerHTML = `<div class="박스머리"><span class="딱지">${막기(종류글(it.종류))}</span><h2>${꾸미기(it.이름)}</h2>
      <button type="button" class="작은단추 닫기" data-일="닫기">✕</button></div>
    <div class="자리딱지">${열린.종류 === '설계실' ? '확정하면 들어갈 자리' : '찍으면 글이 갈 자리'}: ${꾸미기(it.소속)}</div>
    <div><button type="button" class="달기" data-달기="제목">제목에 코멘트</button></div>${줄('제목')}
    <div class="박스몸">${앞}${항들}${계획}</div>
    <div class="박스발">${답들}<span class="알림">${막기(안내)}</span></div>`;
}

function 코멘트줄(it, 키) {
  if (상태.쓰는줄 === 키) {
    return `<div class="코멘트칸"><textarea id="코멘트쓰기" rows="3" placeholder="무엇을 어떻게 — 답을 찍었으면 그 답에 딸리고, 안 찍었으면 물음이다">${막기(it.코멘트[키] || '')}</textarea>
      <button type="button" class="작은단추" data-저장="${막기(키)}">붙이기</button> <button type="button" class="작은단추" data-일="그만">그만</button></div>`;
  }
  const 있음 = it.코멘트[키];
  return (있음 ? `<div class="코멘트"><span>💬 ${꾸미기(있음)}</span><button type="button" class="달기" data-지움="${막기(키)}">✕</button></div>` : '')
    + (키 !== '제목' ? `<button type="button" class="달기" data-달기="${막기(키)}">${있음 ? '코멘트 고치기' : '코멘트'}</button>` : '');
}

// ── 쓰기 ─────────────────────────────────────────────────────────────── //
// 답이나 코멘트를 그 파일 그 줄에 적고 바로 커밋한다(제10조 ③). 그사이 바뀌면 통로가 다시 읽어 그 위에 적는다(④). //
async function 적기(바꾸기, 메시지) {
  const 열린 = 열린것();
  if (!열린 || !열린.경로) return;
  상태.알림 = '적는 중…'; 박스그리기();
  기록(`START 적기 — ${열린.저장소}/${열린.경로}: ${메시지}`);
  try {
    const r = await 상태.통로.고쳐쓰기(열린.저장소, 열린.경로, 바꾸기, 메시지);
    if (r.바뀜) 적은글넣기(열린.저장소, 열린.경로, r.글, r.시각);
    상태.알림 = r.바뀜 ? '' : '바뀐 것이 없다';
    상태.쓰는줄 = null;
    기록(`SUCCESS 적기 — ${r.커밋 ? r.커밋.slice(0, 7) : '커밋 없음'}`);
  } catch (e) {
    상태.알림 = '못 적었다: ' + e.message;
    기록('ERROR 적기 — ' + e.message);
  }
  그리기();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;
  if (d.탭) { return; }   // 주소 # 바뀜으로 처리한다 //
  if (d.곳) { 상태.작업곳 = d.곳; location.hash = '#작업'; return; }
  if (d.작업곳) { 상태.작업곳 = d.작업곳; 상태.열린 = null; 그리기(); return; }
  if (d.열기) { 상태.열린 = { 열쇠: d.열기 }; 상태.쓰는줄 = null; 상태.알림 = ''; 그리기(); if (!넓은화면.matches) 덮개.scrollTop = 0; return; }
  if (d.일 === '닫기') { 상태.열린 = null; 상태.쓰는줄 = null; 그리기(); return; }
  if (d.일 === '그만') { 상태.쓰는줄 = null; 박스그리기(); return; }
  if (d.일 === '열쇠저장') { const v = document.getElementById('열쇠').value.trim(); if (v) { 열쇠쓰기(v); 시작(); } return; }
  if (d.달기) { 상태.쓰는줄 = d.달기; 박스그리기(); const a = document.getElementById('코멘트쓰기'); if (a) a.focus(); return; }
  const 열린 = 열린것();
  if (!열린) return;
  const 표식 = 열린.항목.제목;
  if (d.저장 !== undefined) { const 글 = (document.getElementById('코멘트쓰기') || {}).value || ''; 적기((원문) => 코멘트붙인글(원문, 표식, d.저장, 글, 오늘()), `상황판: 「${열린.항목.이름}」 ${d.저장}에 코멘트`); return; }
  if (d.지움) { 적기((원문) => 코멘트붙인글(원문, 표식, d.지움, '', 오늘()), `상황판: 「${열린.항목.이름}」 ${d.지움} 코멘트 걷음`); return; }
  // 답 — 찍힌 단추는 빈 답을 보내 거둔다(제4조 ③) //
  if (d.답 !== undefined) { 적기((원문) => 표시붙인글(원문, 표식, d.답, 오늘(), 열린.문서), `상황판: 「${열린.항목.이름}」에 ${d.답 || '답 거둠'}`); }
});
document.getElementById('다시읽기').addEventListener('click', () => { if (상태.통로) 모두읽기(); });
window.addEventListener('hashchange', () => { 상태.화면 = 화면이름(); 상태.열린 = null; 상태.쓰는줄 = null; 그리기(); });
넓은화면.addEventListener('change', 그리기);
function 화면이름() { const h = decodeURIComponent(location.hash.slice(1)); return ['홈', '의회', '설계실', '작업'].includes(h) ? h : '홈'; }

function 시작() {
  상태.화면 = 화면이름();
  const 열쇠 = 열쇠읽기();
  if (!열쇠) { 상태.통로 = null; 그리기(); return; }
  상태.통로 = 통로만들기({ 열쇠, API, 기록: { log: 기록 } });
  모두읽기();
}
시작();
