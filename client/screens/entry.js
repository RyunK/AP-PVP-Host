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
        setupEntryForm(); // 실패하면 다시 입장할 수 있도록
      }
    });
    return; 
  }

  setupEntryForm();

  function setupEntryForm() {
    document.getElementById("enterBtn").addEventListener("click", () => {
        const name = document.getElementById("nameInput").value.trim();
        if (!name) return (errorEl.textContent = "닉네임을 입력해주세요.");

        const avatar ={
            type: document.getElementById("avatarType").value ,
            value: document.getElementById("avatarValue").value
        }
        socket.emit("room:enter", { name, avatar }, (res) => {
            if (!res.ok) return (errorEl.textContent = res.error);
            saveIdentity({ name, playerId: res.playerId });
            renderScreen("lobby");
        });
    });
  }
}