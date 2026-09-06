function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderAvatar(avatar) {
  if (avatar?.type === "url" && avatar.value) {
    return `<img class="avatar avatar--sm" src="${escapeHtml(avatar.value)}" onerror="this.style.display='none'" />`;
  }
  const color = avatar?.value || "#8b92a0";
  return `<div class="avatar avatar--sm avatar--color" style="background:${escapeHtml(color)}"></div>`;
}

export function renderPlayerList(container, players) {
  container.innerHTML = players
    .map(
      (p) => `
      <div class="player-chip">
        ${renderAvatar(p.avatar)}
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