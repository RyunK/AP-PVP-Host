
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


export function renderPlayerList(container, players, roomPhase) {
  container.innerHTML = players
    .map((p) => {
      const roleBadge = p.characterIds.length <= 0
        ? '<span class="badge badge--waiting">관전</span>'
        : '<span class="badge badge--online">플레이</span>';

      const showReadyBadge = roomPhase === "lobby" && !p.isHost;

      return `
        <div class="player-chip">
          <span>${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="badge  badge--host">호스트</span>' : roleBadge}
          ${showReadyBadge ? renderReadyBadge(p.ready) : ""}
          ${!p.connected ? '<span class="badge badge--offline">연결 끊김</span>' : ""}
        </div>`;
    })
    .join("");
}

export function renderReadyBadge(ready) {
  return ready
    ? '<span class="badge badge--ready">준비 완료</span>'
    : '<span class="badge badge--waiting">대기중</span>';
}