
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
    .map((m) => {
      if(m.system) {
        return `<div class="chat-message system-message">${escapeHtml(m.text)} 
        <span class="chat-timestamp">
        ${m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ""}
        </span> </div>`;
      }else if(m.battleMessage){
        return `<div class="chat-message battle-message">[NECTAR] ${escapeHtml(m.text)} 
        <span class="chat-timestamp">
        ${m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ""}
        </span> </div>`;
      } else if (!m.displayName) {
        return `<div class="chat-message system-message">(알 수 없음)</strong>: ${escapeHtml(m.text)} 
        <span class="chat-timestamp">
        ${m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ""}
        </span> </div>`;
      } else {
        return `<div class="chat-message"><strong>${escapeHtml(m.displayName)}</strong>: ${escapeHtml(m.text)} 
        <span class="chat-timestamp">
        ${m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ""}
        </span> </div>`;
      }
    })
    .join("");
  logEl.scrollTop = logEl.scrollHeight;
}

// 모듈이 로드될 때 등록
socket.on("chat:message", (msg) => {
  messages.push(msg);
  // if (messages.length > 100) messages.shift();
  renderLog();
});

// room:state에 실려오는 기록으로 최초 1회 동기화 (새로고침 후 기록 복구용)
socket.on("room:state", (state) => {
  if (messages.length < 1 && Array.isArray(state.chat)) {
    messages.push(...state.chat);
    renderLog();
  }
});

export function mountChat(container, myCharacters = [], newChats=[]) {
  container.innerHTML = `
    <h3>채팅</h3>
    <div class="chat-log" id="chatLog"></div>
    <div class="chat-input-row">
      <select id="speakAsSelect">
        <option value="player">내 닉네임으로</option>
        ${myCharacters.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}(으)로</option>`).join("")}
      </select>
      <input type="text" id="chatInput" placeholder="메시지 입력..." maxlength="300" />
      <button id="chatSendBtn" class="btn btn-primary">전송</button>
    </div>
  `;
  logEl = document.getElementById("chatLog");

  if (newChats.length > 0) {
    messages.length = 0; // 새로고침 후 기록 복구 시 기존 메시지 초기화
    messages.push(...newChats);
    // messages = [...newChats]; // 새로고침 후 기록 복구 시 기존 메시지 초기화
  }

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