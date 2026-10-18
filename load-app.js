// 상황판 화면 코드 싣개 — 모바일 앱(index.html)과 PC 앱(관리부 tools/progress.mjs)이 이 한 파일로 화면 코드(app.mjs)를 싣는다. //
// [관리부 작업 443] bp-백엔드의 「상황판은 PC 앱과 모바일 앱 둘이고, 의회·설계실·작업 목록은 두 앱이 코드 한 벌을 함께 쓴다」 — 읽을 코드를 못 찾거나 그 코드가 돌다 실패하면 그 자리에서 멈추고 //
//   무엇을 못 읽었는지 알린다. 모듈로 바로 실으면 부품 하나만 못 읽어도 화면이 「읽는 중…」에 그대로 멈춰, 고장인지 //
//   기다리는 중인지 갈리지 않는다. 그래서 여기서 app.mjs를 불러 보고, 못 불러오면 import 줄을 따라가며 //
//   어느 파일을 못 읽었는지 찾아 본문에 적는다. 파일을 다 읽었으면 코드가 돌다 실패한 것이라 그 오류를 적는다. //
// ★보통 스크립트다(모듈이 아니다) — 모듈이면 이 파일 자신이 못 불러온 모듈과 같이 멈춘다. 옛 브라우저 문법만 쓴다. //
(function () {
  var 여기 = document.currentScript && document.currentScript.src;
  var 첫주소 = new URL('app.mjs', 여기 || location.href).href;
  var 알리기 = function (말) {
    var 본문 = document.getElementById('본문');
    console.log('[상황판] ERROR ' + 말);
    if (본문) 본문.innerHTML = '<p class="오류"></p>', 본문.firstChild.textContent = 말;
  };
  // 파일 하나를 글로 읽는다 — fetch는 file:// 주소(PC 앱)를 못 읽어 XMLHttpRequest를 쓴다 //
  var 글읽기 = function (주소) {
    return new Promise(function (풀기) {
      var x = new XMLHttpRequest();
      x.open('GET', 주소);
      x.onload = function () { 풀기(x.status === 200 || (x.status === 0 && x.responseText) ? x.responseText : null); };
      x.onerror = function () { console.log('[상황판] 화면 코드 파일을 못 읽었다: ' + 주소); 풀기(null); };
      try { x.send(); } catch (e) { console.log('[상황판] 화면 코드 파일 읽기를 시작도 못 했다: ' + 주소 + ' — ' + e.message); 풀기(null); }
    });
  };
  // app.mjs에서 시작해 `from './x.mjs'` 줄을 따라가며 못 읽은 파일을 모은다 //
  var 못읽은파일찾기 = function () {
    var 본것 = {}, 못읽음 = [];
    var 걷기 = function (주소) {
      if (본것[주소]) return Promise.resolve();
      본것[주소] = true;
      return 글읽기(주소).then(function (글) {
        if (글 === null) { 못읽음.push(주소.split('/').pop()); return; }
        var 다음 = [], 짝, 꼴 = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
        while ((짝 = 꼴.exec(글))) 다음.push(new URL(짝[1], 주소).href);
        return Promise.all(다음.map(걷기));
      });
    };
    return 걷기(첫주소).then(function () { return { 못읽음: 못읽음, 주소들: Object.keys(본것) }; });
  };
  console.log('[상황판] START 화면 코드 싣기 — ' + 첫주소);
  // [관리부 작업 443 · 492] 화면 코드 파일은 GitHub Pages가 파일마다 10분까지 받아 둔 것을 쓰게 해, 새 판을 올린 직후에는 //
  //   새 파일과 옛 파일이 섞여 「…does not provide an export…」로 멈출 수 있다. 그때는 받아 둔 화면 코드를 모두 캐시를 무시하고 //
  //   새로 받은 뒤 한 번 다시 띄운다(같은 창에서 한 번만 — 기기 칸 sb.새로받음). 다시 띄워도 안 되면 알리고, 「↻」를 누르면 다시 해 본다. //
  //   「↻」를 받는 코드는 app.mjs 안에 있어 화면 코드가 멈추면 같이 멈추므로, 멈춘 때의 「↻」는 여기서 받는다. //
  //   PC 앱(file://)은 PC 폴더를 바로 읽어 섞이지 않으므로 하지 않는다. //
  var 칸 = 'sb.새로받음';
  var 칸읽기 = function () { try { return sessionStorage.getItem(칸); } catch (e) { console.log('[상황판] 기기 칸을 못 읽었다 — ' + e.message); return null; } };
  var 칸쓰기 = function (v) { try { if (v) sessionStorage.setItem(칸, v); else sessionStorage.removeItem(칸); } catch (e) { console.log('[상황판] 기기 칸을 못 썼다 — ' + e.message); } };
  var 새로받아띄우기 = function (주소들) {
    칸쓰기('1');
    console.log('[상황판] START 화면 코드를 캐시 없이 새로 받는다 — ' + 주소들.length + '개');
    var 받기 = 주소들.concat([여기 || '', location.href.split('#')[0]]).filter(Boolean).map(function (u) {
      return fetch(u, { cache: 'reload' }).catch(function (e) { console.log('[상황판] 새로 못 받았다: ' + u + ' — ' + e.message); });
    });
    return Promise.all(받기).then(function () { location.reload(); });
  };
  var 웹 = /^https?:/.test(location.protocol);
  import(첫주소).then(function () {
    칸쓰기(null);
    console.log('[상황판] SUCCESS 화면 코드를 실었다');
  }, function (e) {
    var 까닭 = e && e.message ? e.message : String(e);
    console.log('[상황판] ERROR 화면 코드를 못 실었다 — ' + 까닭);
    못읽은파일찾기().then(function (찾음) {
      if (웹 && !찾음.못읽음.length && !칸읽기()) return 새로받아띄우기(찾음.주소들);
      알리기(찾음.못읽음.length ? '화면 코드 ' + 찾음.못읽음.join(' · ') + '을(를) 못 읽었다 — 상황판을 띄우지 못했다'
        : '화면 코드가 돌다 실패했다 — ' + 까닭 + (웹 ? ' · 「↻」를 누르면 화면 코드를 새로 받아 다시 띄운다' : ''));
      var 단추 = document.getElementById('다시읽기');
      if (웹 && 단추) 단추.onclick = function () { 새로받아띄우기(찾음.주소들); };
    });
  });
})();
