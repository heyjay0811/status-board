// 상황판 — 답 파일 한 벌의 셈. 사용자가 법안·설계안에 찍은 답과 코멘트를 누를 때마다 작은 답 파일 하나로 남기고, //
//   같은 자리의 답 파일이 여럿이면 가장 늦은 것을 최종으로 고른다. //
//
// 따르는 설계(관리부 bp-결재): //
//   「결재 모듈은 사용자가 찍은 답과 코멘트를 그 안이 있는 저장소에 답 파일로 남긴다」 조 ④⑤⑥ — 이름 꼴 · 칸 · 내놓는 최종 답과 코멘트. //
//   「답과 코멘트 찍기와 최종 답 고르기」 조 ④⑦ — 자리 · 더늦음 · 최종답 · 최종코멘트. 안 파일에 이미 적혀 있는 답 줄과 코멘트 줄은 //
//     그 자리에 답 파일이 없을 때만 쓴다(doc-mark.mjs 찍힌표시() · 코멘트달린줄들()로 읽는다). //
// ★파일을 읽지도 쓰지도 않는다 — 브라우저(상황판)와 node(AI의 의회 체크 · 설계실 체크 도구)가 같은 식을 쓰게, 둘 다에 있는 것만 쓴다. //
import { 찍힌표시, 코멘트달린줄들 } from './doc-mark.mjs';

export const 답자리 = 'docs/답/';
export const 안파일들 = ['docs/assembly.md', 'docs/설계실.md'];
export const 답값들 = ['승인', '취소', '거둠'];
const 칸들 = ['문서', '안', '무엇', '줄', '답', '글', '누른시각'];

// 이름 = <누른 시각>-<기기 표지>-<누른 번호>.json — 누른 시각은 세계 표준시 열아홉 글자(20261014T031522123Z), //
//   기기 표지는 영문 소문자와 숫자 여덟 글자, 누른 번호는 여섯 자리(같은 조 ④). //
// 한계: 누른 번호는 한 기기에서 999999번까지 · 바꿀 때: 넘으면 기기 표지를 새로 지어 번호를 1부터 다시 센다. //
const 이름꼴 = /^(\d{8}T\d{9}Z)-([a-z0-9]{8})-(\d{6})\.json$/;
const 표지꼴 = /^[a-z0-9]{8}$/;
export const 이름꼴맞음 = (이름) => 이름꼴.test(String(이름 ?? ''));
// 2026-10-14T03:15:22.123Z ↔ 20261014T031522123Z //
const 이름시각 = (iso) => iso.replace(/[-:.]/g, '');
const 시각풀기 = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}.${s.slice(15, 18)}Z`;

// 기기 표지 — 상황판이 그 기기에서 처음 켜질 때 한 번 짓는다 //
export function 기기표지짓기() {
  const 글자 = 'abcdefghijklmnopqrstuvwxyz0123456789', 수 = new Uint8Array(8);
  globalThis.crypto.getRandomValues(수);
  return [...수].map((n) => 글자[n % 글자.length]).join('');
}

// 누른 때(Date 또는 밀리초) · 기기 표지 · 누른 번호 → 답 파일 이름. 틀린 값이면 던진다 //
export function 이름짓기(때, 기기표지, 번호) {
  const d = new Date(때);
  if (Number.isNaN(d.getTime())) throw new Error(`누른 때가 시각이 아니다: ${때}`);
  if (!표지꼴.test(String(기기표지))) throw new Error(`기기 표지가 영문 소문자와 숫자 여덟 글자가 아니다: ${기기표지}`);
  if (!Number.isInteger(번호) || 번호 < 0 || 번호 > 999999) throw new Error(`누른 번호가 0~999999가 아니다: ${번호}`);
  const 이름 = `${이름시각(d.toISOString())}-${기기표지}-${String(번호).padStart(6, '0')}.json`;
  if (!이름꼴맞음(이름)) throw new Error(`답 파일 이름이 꼴에 안 맞는다: ${이름}`);
  return 이름;
}

// 안 제목 — 제목 줄에서 「## 」 뒤부터 첫 「 | 」 앞까지(같은 조 ⑤) //
export const 안이름 = (제목줄) => String(제목줄 ?? '').replace(/\r$/, '').replace(/^## /, '').split(' | ')[0];

// 답 파일의 글을 읽어 칸을 잰다 — 맞으면 { 값 }, 칸이 모자라거나 값이 틀리면 { 까닭 }(그 파일은 버린다) //
export function 글읽기(이름, 글) {
  const 틀림 = (까닭) => ({ 까닭: `${이름}: ${까닭}` });
  const m = 이름꼴.exec(String(이름 ?? ''));
  if (!m) return 틀림('이름이 <누른 시각>-<기기 표지>-<누른 번호>.json 꼴이 아니다');
  let v;
  try { v = JSON.parse(글); } catch (e) { console.log(`[답 파일] ERROR ${이름}: JSON으로 못 읽었다 — ${e.message}`); return 틀림(`JSON이 아니다 — ${e.message}`); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 틀림('JSON 덩어리가 아니다');
  const 빠짐 = 칸들.filter((k) => typeof v[k] !== 'string');
  if (빠짐.length) return 틀림(`칸이 없거나 글이 아니다 — ${빠짐.join(' · ')}`);
  if (!안파일들.includes(v.문서)) return 틀림(`문서 칸이 ${안파일들.join(' · ')} 가운데 하나가 아니다(${v.문서})`);
  if (!v.안 || v.안.includes(' | ') || /[\r\n]/.test(v.안)) return 틀림(`안 칸이 제목 하나가 아니다(${v.안})`);
  if (v.무엇 === '답') {
    if (!답값들.includes(v.답)) return 틀림(`답 칸이 ${답값들.join(' · ')} 가운데 하나가 아니다(${v.답})`);
    if (v.줄 !== '') return 틀림('답의 줄 칸은 빈 값이어야 한다');
  } else if (v.무엇 === '코멘트') {
    if (!v.줄) return 틀림('코멘트의 줄 칸이 비었다');
    if (v.답 !== '') return 틀림('코멘트의 답 칸은 빈 값이어야 한다');
  } else return 틀림(`무엇 칸이 답이나 코멘트가 아니다(${v.무엇})`);
  if (v.누른시각 !== 시각풀기(m[1])) return 틀림(`누른시각 칸(${v.누른시각})이 이름의 누른 시각과 다르다`);
  const 값 = {};
  for (const k of 칸들) 값[k] = v[k];
  return { 값 };
}

// 답 파일의 글을 짓는다 — 누른시각은 이름에서 받는다. 지은 글이 글읽기()를 못 지나면 던진다(틀린 파일을 보내지 않는다) //
export function 글짓기(이름, { 문서, 안, 무엇, 줄 = '', 답 = '', 글 = '' }) {
  const m = 이름꼴.exec(String(이름 ?? ''));
  if (!m) throw new Error(`답 파일 이름이 꼴에 안 맞는다: ${이름}`);
  const 값 = { 문서, 안, 무엇, 줄: 무엇 === '코멘트' ? 줄 : '', 답: 무엇 === '답' ? 답 : '', 글: 무엇 === '코멘트' ? 글 : '', 누른시각: 시각풀기(m[1]) };
  const 지은 = JSON.stringify(값, null, 2) + '\n';
  const r = 글읽기(이름, 지은);
  if (!r.값) throw new Error(`답 파일을 못 지었다 — ${r.까닭}`);
  return 지은;
}

// 자리 = 문서 · 안 · 무엇 · (무엇이 코멘트면 줄) — 같은 자리의 답 파일 가운데 가장 늦은 것이 최종이다(같은 조 ⑦) //
export const 자리 = (값) => [값.문서, 값.안, 값.무엇, 값.무엇 === '코멘트' ? 값.줄 : ''].join('\n');
// 더늦음(가, 나) = 가의 파일 이름 > 나의 파일 이름(글자 차례) //
export const 더늦음 = (가, 나) => String(가) > String(나);
// 그 자리의 가장 늦은 답 파일 — 답파일들 = [{ 이름, 값 }]. 없으면 null //
function 가장늦은(답파일들, 자리값) {
  let 늦은 = null;
  for (const f of 답파일들 || []) if (자리(f.값) === 자리값 && (!늦은 || 더늦음(f.이름, 늦은.이름))) 늦은 = f;
  return 늦은;
}

// 안 파일에서 그 안의 제목 줄 — 「## 」로 시작하고 제목이 안과 글자까지 같은 줄. 없으면 null //
export function 안줄찾기(안파일글, 안) {
  for (const l of String(안파일글 ?? '').split('\n')) {
    const 줄 = l.replace(/\r$/, '');
    if (줄.startsWith('## ') && 안이름(줄) === 안) return 줄;
  }
  return null;
}

// 최종답(안) = 그 안의 답 자리에 답 파일이 있으면 가장 늦은 답 파일의 답(거둠이면 답 없음), 없으면 안 파일에서 그 안 제목 줄 아래의 답 줄 //
//   (없으면 답 없음). 돌려주는 것: '승인' · '취소' · '없음'. 제목 줄(안줄)을 넘기면 안 파일에서 다시 찾지 않는다 //
export function 최종답(안파일글, 문서, 안, 답파일들, 안줄 = undefined) {
  const 늦은 = 가장늦은(답파일들, 자리({ 문서, 안, 무엇: '답' }));
  if (늦은) return 늦은.값.답 === '거둠' ? '없음' : 늦은.값.답;
  const 줄 = 안줄 === undefined ? 안줄찾기(안파일글, 안) : 안줄;
  if (!줄) return '없음';
  const 옛 = 찍힌표시(안파일글, 줄);
  return 옛 === '승인' || 옛 === '취소' ? 옛 : '없음';
}

// 최종코멘트(안, 줄) = 그 줄의 코멘트 자리에 답 파일이 있으면 가장 늦은 답 파일의 글(빈 글이면 코멘트 없음), //
//   없으면 안 파일에서 그 줄에 단 코멘트 줄. 그 안의 모든 줄을 한 번에 돌려준다 — { 줄: 글 }(코멘트 없는 줄은 들지 않는다) //
export function 최종코멘트(안파일글, 문서, 안, 답파일들, 안줄 = undefined) {
  const 결과 = {};
  const 줄 = 안줄 === undefined ? 안줄찾기(안파일글, 안) : 안줄;
  if (줄) {
    // 코멘트 줄 모양: 「> 💬 **줄** | 날짜 | 글」 — 옛 「 · 」도 읽는다(bill-parse.mjs 법안읽기()와 같은 자) //
    for (const l of 코멘트달린줄들(안파일글, 줄)) {
      const 조각 = l.slice(4).trim().split(/ [·|] /);
      const 키 = String(조각[0] || '').split('**').join('').trim();
      if (키) 결과[키] = 조각.slice(2).join(' | ').trim();
    }
  }
  const 줄들 = new Set((답파일들 || []).filter((f) => f.값.무엇 === '코멘트' && f.값.문서 === 문서 && f.값.안 === 안).map((f) => f.값.줄));
  for (const 키 of 줄들) {
    const 늦은 = 가장늦은(답파일들, 자리({ 문서, 안, 무엇: '코멘트', 줄: 키 }));
    if (늦은.값.글) 결과[키] = 늦은.값.글; else delete 결과[키];
  }
  return 결과;
}
