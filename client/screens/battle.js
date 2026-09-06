// client/screens/battle.js
import { socket } from "../js/socket.js";
import { loadIdentity, clearIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";
import { mountChat } from "../js/chat.js";
import { renderPlayerList } from "../js/playerList.js";

let roomState = null;
const myPlayerId = loadIdentity()?.playerId;

function getMyCharacters() {
  return (roomState?.characters || []).filter((c) => c.ownerId === myPlayerId);
}

export function init() {
  socket.off("room:state", onRoomState);
  socket.off("turn:resolved", onTurnResolved);
  socket.off("turn:waiting", onTurnWaiting);
  socket.off("room:closed", onRoomClosed);

  socket.on("room:state", onRoomState);
  socket.on("turn:resolved", onTurnResolved);
  socket.on("turn:waiting", onTurnWaiting);
  socket.on("room:closed", onRoomClosed);

  socket.emit("room:get-state", {}, (res) => {
    if (res.ok) onRoomState(res.state);
  });

  mountChat(document.getElementById("chatContainer"), getMyCharacters());
}

function onRoomState(state) {
  roomState = state;
  renderPlayerList(document.getElementById("playerListContainer"), state.players);
  renderBattle();
}

function onTurnResolved(payload) {
  events.forEach((ev) => {
    const actor = roomState.characters.find((c) => c.id === ev.actorId);
    const target = roomState.characters.find((c) => c.id === ev.targetId);
    if (ev.type === "damage") {
      logLine(
        `${actor?.name ?? "?"} → ${target?.name ?? "?"}: ${ev.amount} 피해${ev.isCrit ? " (치명타!)" : ""}`
      );
    } else if (ev.type === "heal") {
      logLine(`${actor?.name ?? "?"} → ${target?.name ?? "?"}: ${ev.amount} 회복`);
    }
  });
  if (winner) {
    logLine(winner === "draw" ? "무승부입니다." : `${winner}팀 승리!`);
  }
  turnNumberEl.textContent = nextTurn;
}

function onTurnWaiting({ waitingFor }) {
  logLine(`${waitingFor.length}명의 행동을 기다리는 중...`);
}

function onRoomClosed({ reason }) {
  clearIdentity();
  alert(`방이 종료되었습니다: ${reason}`);
  renderScreen("entry");
}

const myCharactersEl = document.getElementById("myCharacters");
const battleLogEl = document.getElementById("battleLog");
const turnNumberEl = document.getElementById("turnNumber");

function renderBattle() {
  turnNumberEl.textContent = roomState.turnNumber;
  const myChars = roomState.characters.filter((c) => c.ownerId === myPlayerId);
  const enemies = roomState.characters.filter(
    (c) => c.ownerId !== myPlayerId && c.alive
  );

  myCharactersEl.innerHTML = myChars
    .map((c) => {
      const hpPct = Math.max(0, Math.round((c.stats.hp / c.stats.maxHp) * 100));
      if (!c.alive) {
        return `<div class="char-card"><strong>${c.name}</strong> — 전투불능</div>`;
      }
      return `
        <div class="char-card" data-char="${c.id}">
          <strong>${c.name}</strong> (${c.stats.hp}/${c.stats.maxHp})
          <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
          <select class="action-type">
            <option value="attack">공격</option>
            <option value="heal">회복</option>
          </select>
          <select class="action-target">
            ${enemies.map((e) => `<option value="${e.id}">${e.name}</option>`).join("")}
          </select>
          <button class="submit-action">행동 제출</button>
        </div>`;
    })
    .join("");

  myCharactersEl.querySelectorAll(".submit-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".char-card");
      const characterId = card.dataset.char;
      const type = card.querySelector(".action-type").value;
      const targetId = card.querySelector(".action-target").value;

      socket.emit("action:submit", { characterId, action: { type, targetId } }, (res) => {
        if (!res.ok) return logLine(`오류: ${res.error}`);
        btn.textContent = res.waiting ? "제출됨 (상대 대기중)" : "제출됨";
        btn.disabled = true;
      });
    });
  });
}

function logLine(text) {
  const div = document.createElement("div");
  div.textContent = text;
  battleLogEl.appendChild(div);
  battleLogEl.scrollTop = battleLogEl.scrollHeight;
}