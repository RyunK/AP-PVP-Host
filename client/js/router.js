import { loadIdentity } from "../js/state.js";


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

// 브라우저 뒤로가기/앞으로가기 시에도 그에 맞는 화면을 다시 그림
window.addEventListener("popstate", () => {
  renderScreen(getScreenFromUrl());
});

async function start() {
  const identity = loadIdentity();

  if (identity?.playerId) {
    const res = await new Promise((resolve) =>
      socket.emit("room:rejoin", { playerId: identity.playerId }, resolve)
    );
    if (res.ok) {
      const phase = res.state.phase;
      renderScreen(phase === "battle" || phase === "ended" ? "battle" : "lobby");
      return;
    }
    clearIdentity();
  }

  renderScreen("entry"); // 재접속 대상이 없으면 그냥 entry로 (URL은 무시)
}

start();