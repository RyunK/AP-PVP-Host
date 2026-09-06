// client/screens/entry.js
import { socket } from "../js/socket.js";
import { saveIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";

export function init() {
  const errorEl = document.getElementById("entryError");

  document.getElementById("createRoomBtn").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) return (errorEl.textContent = "닉네임을 입력해주세요.");

    socket.emit("room:create", { name }, (res) => {
      if (!res.ok) return (errorEl.textContent = res.error);
      saveIdentity({ name, roomCode: res.code, playerId: res.playerId });
      renderScreen("lobby");
    });
  });

  document.getElementById("joinRoomBtn").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const code = document.getElementById("codeInput").value.trim().toUpperCase();
    if (!name) return (errorEl.textContent = "닉네임을 입력해주세요.");
    if (!code) return (errorEl.textContent = "방 코드를 입력해주세요.");

    socket.emit("room:join", { code, profile: { name } }, (res) => {
      if (!res.ok) return (errorEl.textContent = res.error);
      saveIdentity({ name, roomCode: res.code, playerId: res.playerId });
      renderScreen("lobby");
    });
  });
}