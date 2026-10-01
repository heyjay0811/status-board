// 의회 박스 미리보기 부품(assembly-view.mjs 파일미리보기·마크다운그리기)의 회귀 테스트 //
//
// 왜 필요한가: 스킬·담당·훅 법안은 승인되면 생길 파일 모양대로 보여야 한다(관리부 설계 bp-상황판 제6조 ㉓). //
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

console.log('\n[담당·스킬 법안 미리보기]');
{
  const 글 = ['> ---', '> name: dam-audit', '> description: 점검 담당. 메인 세션이 점검을 맡길 때 부른다.', '> tools: Read, Grep', '> skills:', '>   - resource-audit', '> ---', '>',
    '> 너는 **점검** 담당이다.', '>', '> 1. 자원 점검을 맡으면 `resource-audit`을 부른다.', '> 2. 어긋난 것을 적는다.'].join('\n');
  const 조각 = 앞글나누기(글, '전역 담당 `dam-audit` · 새 파일 신설');
  확인('담당 법안의 인용 본문을 될 글로 가른다', 조각.length === 1 && 조각[0].종류 === '될', JSON.stringify(조각.map((q) => q.종류)));
  const h = 파일미리보기(글, '전역 담당 `dam-audit` · 새 파일 신설');
  확인('인용 표시를 걷는다', h && !h.includes('&gt; ') && !h.includes('&gt;---'), h);
  확인('머리 칸을 표로 그리고 이름표를 한국어로 붙인다', h.includes('<table class="머리칸">') && h.includes('<th>이름</th><td>dam-audit</td>') && h.includes('<th>언제 부르나</th>') && h.includes('<th>쓸 도구</th>'), h);
  확인('머리 칸의 목록(skills)을 한 칸에 모은다', h.includes('<th>미리 싣는 스킬</th><td>resource-audit</td>'), h);
  확인('본문의 번호 목록을 목록으로 그린다', h.includes('<span class="마표지">1.</span>') && h.includes('<code>resource-audit</code>'), h);
  확인('목록 글은 코드 표시가 끼어도 한 칸(마글)에 든다 — 칸이 쪼개지면 글이 세로로 잘린다', h.includes('<span class="마글">자원 점검을 맡으면 <code>resource-audit</code>을 부른다.</span>'), h);
  확인('본문의 굵게를 그린다', h.includes('<b>점검</b>'), h);
  확인('스킬 법안도 미리보기로 그린다', 파일미리보기('> ---\n> name: a\n> ---\n> # 제목', '전역 스킬 `a`').includes('마제목1'), '');
  확인('규칙 법안은 미리보기를 안 한다(null)', 파일미리보기('① 항', '전역 규칙 · 제1조') === null, '');
}

console.log('\n[훅 법안 미리보기]');
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
}

console.log(`\n통과 ${통과} · 실패 ${실패}`);
if (실패) process.exit(1);
