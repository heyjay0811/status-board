// 상황판 — 원격 켜기 한 벌의 셈. 폰이 누른 요청 파일과 PC가 만든 결과 파일의 이름 · 글을 짓고 읽고, //
//   PC가 처리할 요청과 폰 머리 줄 버튼에 보일 글을 고른다. //
//
// 따르는 설계(관리부 bp-원격켜기 · bp-백엔드 제5조 ③): //
//   요청 파일 = 원격 켜기 자리(docs/원격켜기/)의 <누른 시각>-<기기 표지>-<누른 번호>.json, 글 { 무엇: 요청, 누른시각 } //
//   결과 파일 = 같은 자리의 <요청 이름에서 .json을 뺀 것>-결과.json, 글 { 무엇: 결과, 요청, 켠, 이미켜짐, 못켠, 끝난시각 } //
// ★파일을 읽지도 쓰지도 않는다 — 폰 화면(app.mjs) · GitHub 통로(github.mjs) · PC 앱 본체(관리부 tools/remote-on.cjs)가 같은 식을 쓴다. //
import { 이름꼴맞음 } from './answer-file.mjs';

export const 원격자리 = 'docs/원격켜기/';
export const 원격저장소 = 'management';
// 한계: 30분 — 바꿀 때: PC가 30분 넘게 꺼져 있다 켜져도 요청을 처리해야 하면 늘린다(bp-원격켜기 제2조 ②) //
export const 요청유효 = 30 * 60 * 1000;

const 결과꼬리 = '-결과.json';
export const 결과이름 = (요청이름) => String(요청이름).replace(/\.json$/, '') + 결과꼬리;
export const 결과이름인가 = (이름) => String(이름 ?? '').endsWith(결과꼬리) && 이름꼴맞음(String(이름).slice(0, -결과꼬리.length) + '.json');
export const 요청이름인가 = (이름) => 이름꼴맞음(이름);

function json(글) {
  try { const v = JSON.parse(글); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; }
  catch (e) { console.log(`[원격 켜기] JSON으로 못 읽은 파일 글을 버린다 — ${e.message}`); return null; }
}
const 세션목록인가 = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const 못켠목록인가 = (v) => Array.isArray(v) && v.every((x) => x && typeof x.세션 === 'string' && typeof x.까닭 === 'string');

// 글을 읽어 맞으면 값을, 틀리면 null을 돌려준다 //
export function 요청읽기(이름, 글) {
  if (!요청이름인가(이름)) return null;
  const v = json(글);
  return v && v.무엇 === '요청' && typeof v.누른시각 === 'string' && !Number.isNaN(Date.parse(v.누른시각)) ? v : null;
}
export function 결과읽기(이름, 글) {
  if (!결과이름인가(이름)) return null;
  const v = json(글);
  return v && v.무엇 === '결과' && 결과이름(v.요청) === 이름 && 세션목록인가(v.켠) && 세션목록인가(v.이미켜짐) && 못켠목록인가(v.못켠)
    && typeof v.끝난시각 === 'string' ? v : null;
}
export const 요청글짓기 = (때) => JSON.stringify({ 무엇: '요청', 누른시각: new Date(때).toISOString() }, null, 2) + '\n';
export const 결과글짓기 = ({ 요청, 켠 = [], 이미켜짐 = [], 못켠 = [], 끝난시각 = new Date().toISOString() }) =>
  JSON.stringify({ 무엇: '결과', 요청, 켠, 이미켜짐, 못켠, 끝난시각 }, null, 2) + '\n';

// bp-백엔드 제5조 ③ — 원격켜기됨 = (저장소 = 관리부) AND (경로 = docs/원격켜기/ 바로 아래) AND //
//   ((이름이 답 파일 이름 꼴이고 무엇 = 요청) OR (이름이 답 파일 이름 꼴 뒤에 -결과를 붙인 꼴이고 무엇 = 결과)) //
export function 원격켜기됨(저장소, 경로, 글) {
  if (저장소 !== 원격저장소 || !String(경로 ?? '').startsWith(원격자리)) return false;
  const 이름 = String(경로).slice(원격자리.length);
  if (이름.includes('/')) return false;
  return !!(요청읽기(이름, 글) || 결과읽기(이름, 글));
}

// bp-원격켜기 제2조 ② — 처리할요청 = (결과 파일이 없는 요청 가운데 이름이 가장 늦은 것) AND (지금 − 그 요청의 누른시각 < 30분) //
//   파일들 = [{ 이름, 글 }]. 돌려주는 것: 그 요청 이름 또는 null //
export function 처리할요청(파일들, 지금 = Date.now()) {
  const 이름들 = new Set(파일들.map((f) => f.이름));
  const 남은 = 파일들.filter((f) => 요청읽기(f.이름, f.글) && !이름들.has(결과이름(f.이름))).sort((a, b) => (a.이름 < b.이름 ? 1 : -1));
  if (!남은.length) return null;
  const 누른 = Date.parse(요청읽기(남은[0].이름, 남은[0].글).누른시각);
  return 지금 - 누른 < 요청유효 ? 남은[0].이름 : null;
}

// bp-원격켜기 제1조 ⑤ — 마지막요청 = 이름이 가장 늦은 요청 파일(기기에 남아 아직 원본에 닿지 않은 요청도 든다). //
//   파일들 = [{ 이름, 글 }](원본) · 남은요청 = 기기에 남은 요청 이름 또는 null. //
//   돌려주는 것: { 버튼, 요청: 이름|null, 누른시각, 결과: 값|null } //
export function 원격상태(파일들, 남은요청 = null) {
  const 요청들 = 파일들.filter((f) => 요청읽기(f.이름, f.글)).map((f) => ({ 이름: f.이름, 누른시각: 요청읽기(f.이름, f.글).누른시각 }));
  if (남은요청 && 남은요청.이름 && !요청들.some((x) => x.이름 === 남은요청.이름)) 요청들.push({ 이름: 남은요청.이름, 누른시각: 남은요청.누른시각 });
  if (!요청들.length) return { 버튼: '원격 켜기', 요청: null, 누른시각: null, 결과: null };
  const 마지막 = 요청들.sort((a, b) => (a.이름 < b.이름 ? 1 : -1))[0];
  const f = 파일들.find((x) => x.이름 === 결과이름(마지막.이름));
  const 결과 = f ? 결과읽기(f.이름, f.글) : null;
  return { 버튼: 결과 ? `원격 켬 ${결과.켠.length}` : '원격 켜는 중', 요청: 마지막.이름, 누른시각: 마지막.누른시각, 결과 };
}
