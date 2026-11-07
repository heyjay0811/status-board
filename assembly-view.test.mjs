// 규칙안목록 박스 미리보기 부품(assembly-view.mjs 파일미리보기·마크다운그리기)의 회귀 테스트 //
//
// 왜 필요한가: 스킬·담당·훅 규칙안은 승인되면 생길 파일 모양대로 보여야 한다(bp-규칙안목록의 「상황판 규칙안목록 화면은 조문을 팝업 박스 하나로 열고, 갈 자리와 바뀔 내용을 함께 보여준다」). //
//   미리보기가 고장 나 인용 표시(>)나 머리 칸(---)이 날글자로 돌아가도 화면 말고는 알 길이 없어, //
//   그릴 모양을 여기 못박는다. //
//
//   돌리기: 인자 없이 이 파일을 실행한다. //

import { 파일미리보기, 마크다운그리기, 앞글나누기 } from './assembly-view.mjs';

let 통과 = 0, 실패 = 0;
const 확인 = (이름, 조건, 실제) => {
  if (조건) { 통과++; console.log(`  ✅ ${이름}`); }
  else { 실패++; console.log(`  ❌ ${이름}\n     실제: ${실제}`); }
};
const 울 = '```';

console.log('\n[담당·스킬 규칙안 미리보기]');
{
  const 글 = ['> ---', '> name: dam-audit', '> description: 점검 담당. 메인 세션이 점검을 맡길 때 부른다.', '> tools: Read, Grep', '> skills:', '>   - resource-audit', '> ---', '>',
    '> 너는 **점검** 담당이다.', '>', '> 1. 자원 점검을 맡으면 `resource-audit`을 부른다.', '> 2. 어긋난 것을 적는다.'].join('\n');
  const 조각 = 앞글나누기(글, '전역 담당 `dam-audit` · 새 파일 신설');
  확인('담당 규칙안의 인용 본문을 될 글로 가른다', 조각.length === 1 && 조각[0].종류 === '될', JSON.stringify(조각.map((q) => q.종류)));
  const h = 파일미리보기(글, '전역 담당 `dam-audit` · 새 파일 신설');
  확인('인용 표시를 걷는다', h && !h.includes('&gt; ') && !h.includes('&gt;---'), h);
  확인('머리 칸을 표로 그리고 이름표를 한국어로 붙인다', h.includes('<table class="머리칸">') && h.includes('<th>이름</th><td>dam-audit</td>') && h.includes('<th>언제 부르나</th>') && h.includes('<th>쓸 도구</th>'), h);
  확인('머리 칸의 목록(skills)을 한 칸에 모은다', h.includes('<th>미리 싣는 스킬</th><td>resource-audit</td>'), h);
  확인('본문의 번호 목록을 목록으로 그린다', h.includes('<span class="마표지">1.</span>') && h.includes('<code>resource-audit</code>'), h);
  확인('목록 글은 코드 표시가 끼어도 한 칸(마글)에 든다 — 칸이 쪼개지면 글이 세로로 잘린다', h.includes('<span class="마글">자원 점검을 맡으면 <code>resource-audit</code>을 부른다.</span>'), h);
  확인('본문의 굵게를 그린다', h.includes('<b>점검</b>'), h);
  확인('스킬 규칙안도 미리보기로 그린다', 파일미리보기('> ---\n> name: a\n> ---\n> # 제목', '전역 스킬 `a`').includes('마제목1'), '');
  확인('규칙 규칙안은 미리보기를 안 한다(null)', 파일미리보기('① 항', '전역 규칙 · 제1조') === null, '');
  // [관리부 작업 456] 지울 글은 줄 머리의 「(제거)」로 적는다 — 「삭제:」 줄을 지울 글로 가르지 않는다(bp-규칙안목록) //
  const 옛삭제 = 앞글나누기('설명 줄\n삭제: 옛 글', '전역 규칙 · 제1조 변경');
  확인('「삭제:」로 시작하는 줄을 지울 글로 가르지 않는다', 옛삭제.length === 1 && 옛삭제[0].종류 === '', JSON.stringify(옛삭제));
}

console.log('\n[훅 규칙안 미리보기]');
{
  const 글 = [울 + 'js', '// 담당에게 규칙을 싣는다 //', '// 담당이 시작될 때 규칙을 싣는다 //', '// [제정 ___] 승인 ____-__-__ //', '//', "import { x } from 'y';", 'if (a < b) run();', 울].join('\n');
  const h = 파일미리보기(글, '전역 훅 `subagent-start-rules` · 신설');
  확인('맨 위 세 줄 주석을 글로 뗀다', h.includes('<div class="훅머리"><div>담당에게 규칙을 싣는다</div>') && (h.match(/<div>/g) || []).length === 3, h);
  확인('나머지를 코드 칸에 막아서 넣는다', h.includes('<pre class="코드칸"><code>//\nimport') && h.includes('a &lt; b'), h);
  확인('코드 울타리 줄은 걷는다', !h.includes(울), h);
}

console.log('\n[마크다운 그리기]');
{
  const h = 마크다운그리기(['## 1. 절', '', '| 가 | 나 |', '|---|---|', '| 1 | 2 |', '', '- 하나', '  - 안쪽', '', '> 인용 글', '', 울, 'a<b', 울, '', '그냥 문단', '이어진 줄'].join('\n'));
  확인('제목', h.includes('<div class="마제목 마제목2">1. 절</div>'), h);
  확인('표(구분 줄은 뺀다)', h.includes('<table class="마표"><tr><th>가</th><th>나</th></tr><tr><td>1</td><td>2</td></tr></table>'), h);
  확인('글머리 목록과 안쪽 목록', h.includes('<span class="마표지">•</span><span class="마글">하나</span>') && h.includes('마목 마목안'), h);
  확인('인용', h.includes('<div class="마인용"><p class="마문">인용 글</p></div>'), h);
  확인('코드 칸(막아서 넣음)', h.includes('<pre class="코드칸"><code>a&lt;b</code></pre>'), h);
  확인('문단은 이어진 줄을 한 문단으로', h.includes('<p class="마문">그냥 문단 이어진 줄</p>'), h);
  const 조 = 마크다운그리기(['① 칸이다.', '둘째 줄.', '', '- `식`', '  풀이 줄.'].join('\n'), true);
  확인('줄살림 — 문단 안의 줄을 끊는다', 조.includes('<p class="마문">① 칸이다.<br>둘째 줄.</p>'), 조);
  확인('목록 줄 밑에 들여 쓴 줄은 그 목록 줄의 풀이로 붙는다', 조.includes('<span class="마글"><code>식</code><br>풀이 줄.</span>') && !조.includes('<p class="마문">풀이 줄.'), 조);
  // [관리부 작업계획 555] 표 안의 「(변경)」·「(제거)」·「(신설)」 줄은 한 표 안에서 그 줄만 칠한다 //
  const 표 = 마크다운그리기(['| 표 | 하는 일 |', '|---|---|', '| 휴무 | 쉬는 날 |', '| 신청 | 예약 신청 |', '(변경) | 신청 | 예약 신청 · 원래 예약 |', '| 업장 | 가게 |', '(제거) | 메모 | 적음 |', '(신설) | 알림 | 보냄 |'].join('\n'), true);
  확인('표 안의 표시 줄이 있어도 표는 하나다', (표.match(/<table/g) || []).length === 1, 표);
  확인('(변경) 줄의 바로 앞 표 줄만 빨강, (변경) 줄은 초록, 같은 칸은 칠하지 않는다', 표.includes('<tr class="지울"><td>신청</td><td>') && 표.includes('<tr class="될"><td>신청</td><td>') && 표.includes('<tr><td>휴무</td><td>쉬는 날</td></tr>') && 표.includes('<tr><td>업장</td><td>가게</td></tr>'), 표);
  확인('(제거) 줄은 빨강, (신설) 줄은 초록 — 그 줄 하나만', 표.includes('<tr class="지울"><td>메모</td><td>적음</td></tr>') && 표.includes('<tr class="될"><td>알림</td><td>보냄</td></tr>'), 표);
}

console.log(`\n통과 ${통과} · 실패 ${실패}`);
if (실패) process.exit(1);
