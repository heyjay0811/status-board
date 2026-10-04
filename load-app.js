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
    return 걷기(첫주소).then(function () { return 못읽음; });
  };
  console.log('[상황판] START 화면 코드 싣기 — ' + 첫주소);
  import(첫주소).then(function () {
    console.log('[상황판] SUCCESS 화면 코드를 실었다');
  }, function (e) {
    var 까닭 = e && e.message ? e.message : String(e);
    console.log('[상황판] ERROR 화면 코드를 못 실었다 — ' + 까닭);
    못읽은파일찾기().then(function (못읽음) {
      알리기(못읽음.length ? '화면 코드 ' + 못읽음.join(' · ') + '을(를) 못 읽었다 — 상황판을 띄우지 못했다'
        : '화면 코드가 돌다 실패했다 — ' + 까닭);
    });
  });
})();
