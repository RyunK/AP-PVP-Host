const app = document.getElementById("app");

export async function renderScreen(screenName, params = {}) {
  const res = await fetch(`screens/${screenName}.html`);
  // console.log("fetch 상태:", res.status, "screen:", screenName); // ← 임시 로그
  const html = await res.text();
  // console.log("받은 html 길이:", html.length);
  app.innerHTML = html;
  const mod = await import(`../screens/${screenName}.js`);
  mod.init(params);

  const url = new URL(location.href);
  url.searchParams.set("screen", screenName);
  history.pushState({ screenName }, "", url);
}

function getScreenFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get("screen") || "entry";
}

// 페이지가 열리자마자 URL의 ?screen= 값(없으면 entry)으로 화면을 그림
renderScreen(getScreenFromUrl());

// 브라우저 뒤로가기/앞으로가기 시에도 그에 맞는 화면을 다시 그림
window.addEventListener("popstate", () => {
  renderScreen(getScreenFromUrl());
});