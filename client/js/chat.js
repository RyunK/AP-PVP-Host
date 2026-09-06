
import { socket } from "./socket.js";
import { loadIdentity } from "../js/state.js";

const messages = [];
let logEl = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderLog() {
  if (!logEl) return;
  logEl.innerHTML = messages
    .map((m) => `<div><strong>${escapeHtml(m.displayName)}</strong>: ${escapeHtml(m.text)}</div>`)
    .join("");
  logEl.scrollTop = logEl.scrollHeight;
}

// 모듈이 로드되는 순간 딱 한 번만 등록 — 어느 화면에 있든 메시지를 놓치지 않음
socket.on("chat:message", (msg) => {
  messages.push(msg);
  if (messages.length > 100) messages.shift();
  renderLog();
});

// room:state에 실려오는 기록으로 최초 1회 동기화 (새로고침 후 기록 복구용)
socket.on("room:state", (state) => {
  if (messages.length === 0 && Array.isArray(state.chat)) {
    messages.push(...state.chat);
    renderLog();
  }
});

export function mountChat(container, myCharacters = []) {
  container.innerHTML = `
    <div class="chat-log" id="chatLog"></div>
    <div class="chat-input-row">
      <select id="speakAsSelect">
        <option value="player">내 닉네임으로</option>
        ${myCharacters.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}(으)로</option>`).join("")}
      </select>
      <input type="text" id="chatInput" placeholder="메시지 입력..." maxlength="300" />
      <button id="chatSendBtn">보내기</button>
    </div>
  `;
  logEl = document.getElementById("chatLog");
  renderLog();

  const input = document.getElementById("chatInput");
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    const speakAs = document.getElementById("speakAsSelect").value;
    socket.emit("chat:send", { text, speakAs }, (res) => {
      if (res.ok) input.value = "";
      else alert(res.error);
    });
  };
  document.getElementById("chatSendBtn").addEventListener("click", send);
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());
}

export function updateChatCharacterOptions(myCharacters = [], myPlayerName = "") {
  const select = document.getElementById("speakAsSelect");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `
    <option value="player">${escapeHtml(myPlayerName) || "내 닉네임"}(으)로</option>
    ${myCharacters.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}(으)로</option>`).join("")}
  `;
  if ([...select.options].some((o) => o.value === currentValue)) {
    select.value = currentValue;
  }
}