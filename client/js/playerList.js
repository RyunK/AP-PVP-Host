
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


export function renderPlayerList(container, players) {
  container.innerHTML = players
    .map(
      (p) => `
      <h3>플레이어 목록</h3>
      <div class="player-chip">
        <span>${escapeHtml(p.name)}</span>
        ${p.isHost ? '<span class="badge">호스트</span>' : renderReadyBadge(p.ready)}
        ${!p.connected ? '<span class="badge badge--offline">연결 끊김</span>' : ""}
      </div>`
    )
    .join("");
}

function renderReadyBadge(ready) {
  return ready
    ? '<span class="badge badge--ready">준비 완료</span>'
    : '<span class="badge badge--waiting">대기중</span>';
}