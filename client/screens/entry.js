import { socket } from "../js/socket.js";
import { saveIdentity, loadIdentity, clearIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";

export function init() {
  const errorEl = document.getElementById("entryError");

  document.getElementById("enterBtn").disabled = false;

  setupEntryForm();

  function setupEntryForm() {
    document.getElementById("enterBtn").addEventListener("click", () => {
        errorEl.textContent = "연결 중..."
        document.getElementById("enterBtn").disabled = true;
        const name = document.getElementById("nameInput").value.trim();
        if (!name){
          document.getElementById("enterBtn").disabled = false;
          return (errorEl.textContent = "닉네임을 입력해주세요.");
        } 

        socket.emit("room:enter", { name }, (res) => {
            document.getElementById("enterBtn").disabled = false;
            if (!res.ok) return (errorEl.textContent = res.error);
            saveIdentity({ name, playerId: res.playerId });
            renderScreen("lobby");
        });
    });
  }
}