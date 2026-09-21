import { socket } from "./socket.js";

/**
 * div 새로 만들어서 str 넣어줌
 * @param {*} str 
 * @returns 
 */
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

let isPlayerListCollapsed = false; // 모듈 스코프에 상태 저장

export function renderPlayerList(container, players, roomPhase) {
  const listHtml = players
    .map((p) => {
      const roleBadge = p.characterIds.length <= 0
        ? '<span class="badge badge--waiting">관전</span>'
        : '<span class="badge badge--online">플레이</span>';

      const showReadyBadge = roomPhase === "lobby" && !p.isHost && p.characterIds.length > 0;

      return `
        <div class="player-chip">
          <span>${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="badge  badge--host">호스트</span>' : ""}
          ${roleBadge}
          ${showReadyBadge ? renderReadyBadge(p.ready) : ""}
          ${!p.connected ? '<span class="badge badge--offline">연결 끊김</span>' : ""}
        </div>`;
    })
    .join("");

  container.innerHTML =
    "<h3>플레이어 목록</h3>" +
    (isPlayerListCollapsed ? "" : listHtml) +
    `<span class="hint">${isPlayerListCollapsed ? "펼치기" : "접기"}</span>`;
}

export function setupPlayerListToggle(container, getRenderArgs) {
  container.addEventListener("click", () => {
    isPlayerListCollapsed = !isPlayerListCollapsed;
    const { players, roomPhase } = getRenderArgs();
    renderPlayerList(container, players, roomPhase);
  });
}

export function renderReadyBadge(ready) {
  return ready
    ? '<span class="badge badge--ready">준비 완료</span>'
    : '<span class="badge badge--waiting">대기중</span>';
}

export function showMyInfo(roomState, myPlayerId, myPlayerName) {
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost;
  
  const roleBadge = me.characterIds.length <= 0
    ? '<span class="badge badge--waiting">관전</span>'
    : '<span class="badge badge--online">플레이</span>';

  document.getElementById("myInfoLabel").innerHTML = `
  ${myPlayerName} 
  ${isHost ? '<span class="badge  badge--host">호스트</span>' : ""}
  ${roleBadge}
  <span id="badgeOnline" class="badge badge--offline">연결 끊김</span>

  
  `;
}

  // ${!me?.connected ? '<span id="badgeOnline" class="badge badge--offline">연결 끊김</span>' 
    // : '<span id="badgeOnline" class="badge badge--online">연결됨</span>'}

export function updateMyConnectionStatus(connected) {
  const badge = document.getElementById("badgeOnline");

  if (!badge) return;

  badge.textContent = connected ? "연결됨" : "연결 끊김";
  badge.classList.toggle("badge--online", connected);
  badge.classList.toggle("badge--offline", !connected);
}

/**
 * 실제 연결 상태에 따라 내 정보 연결 상태 뱃지 변경
 * @param {*} socket 
 */
export function myInfoConnetBadge(socket){

  const update = () => {
    updateMyConnectionStatus(socket.connected);
  };

  socket.off("connect", update);
  socket.off("disconnect", update);

  socket.on("connect", update);
  socket.on("disconnect", update);

  // 함수가 호출되는 순간의 상태도 바로 반영
  update();
}
