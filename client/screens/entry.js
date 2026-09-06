import { socket } from "../js/socket.js";
import { saveIdentity, loadIdentity, clearIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";

export function init() {
  const errorEl = document.getElementById("entryError");

  const identity = loadIdentity();
  if (identity?.playerId) {
    socket.emit("room:rejoin", { playerId: identity.playerId }, (res) => {
      if (res.ok) {
        const phase = res.state.phase;
        renderScreen(phase === "battle" || phase === "ended" ? "battle" : "lobby");
      } else {
        clearIdentity(); 
      }
    });
    return; // 재접속 시도 중엔 아래 버튼 로직 안 걸어도 됨 (또는 걸어도 무방)
  }

  document.getElementById("enterBtn").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) return (errorEl.textContent = "닉네임을 입력해주세요.");

    socket.emit("room:enter", { name }, (res) => {
        if (!res.ok) return (errorEl.textContent = res.error);
        saveIdentity({ name, playerId: res.playerId });
        renderScreen("lobby");
    });
  });
}