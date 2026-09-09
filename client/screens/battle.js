// client/screens/battle.js
import { socket } from "../js/socket.js";
import { loadIdentity, clearIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";
import { mountChat, updateChatCharacterOptions } from "../js/chat.js";
import { renderPlayerList, escapeHtml, renderReadyBadge } from "../js/playerList.js";

import { getMyPlayerId } from "../js/state.js";
import { getMyCharacters, getMyPlayerName } from "../js/roomHelpers.js";

let roomState = null;
const myPlayerId = getMyPlayerId();

// export function init() {
//   socket.off("room:state", onRoomState);
//   socket.off("turn:resolved", onTurnResolved);
//   socket.off("turn:waiting", onTurnWaiting);
//   socket.off("room:closed", onRoomClosed);

//   socket.on("room:state", onRoomState);
//   socket.on("turn:resolved", onTurnResolved);
//   socket.on("turn:waiting", onTurnWaiting);
//   socket.on("room:closed", onRoomClosed);

//   socket.emit("room:get-state", {}, (res) => {
//     if (res.ok) onRoomState(res.state);
//   });

//   mountChat(document.getElementById("chatContainer"), getMyCharacters());
// }

export function init() {
  socket.off("room:state", onRoomState);
  socket.off("battle:state", onBattleState);
  socket.off("battle:draft", onBattleDraft);
  socket.off("round:resolved", onRoundResolved);

  socket.on("room:state", onRoomState);
  socket.on("battle:state", onBattleState);
  socket.on("battle:draft", onBattleDraft);
  socket.on("round:resolved", onRoundResolved);

  socket.emit("room:get-state", {}, (res) => {
    if (res.ok){
      onBattleState(res.state);
      onRoomState(res.state);
    } 
  });
}

function onRoomState(state) {
  roomState = state;
  
  mountChat(document.getElementById("chatContainer"), getMyCharacters(), state.chat || []);
  updateChatCharacterOptions(getMyCharacters(roomState, myPlayerId), getMyPlayerName(roomState, myPlayerId));  
  renderPlayerList(document.getElementById("playerListContainer"), state.players);


  renderBattle();
  showMyInfo(myPlayerId, getMyPlayerName(roomState, myPlayerId));
  
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

function showMyInfo(myPlayerId, myPlayerName) {
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost;
  
  document.getElementById("myInfoLabel").innerHTML = `
  ${myPlayerName} 
  ${isHost ? '<span class="badge badge--host">호스트</span>' : renderReadyBadge(me?.ready)}
  ${!me?.connected ? '<span class="badge badge--offline">연결 끊김</span>' : '<span class="badge badge--online">연결됨</span>'}
  
  `;
}

let liveDrafts = new Map(); // characterId -> {skillName, targetId} (team:${team} room에서 실시간 수신)

function onBattleState(state) {
  roomState = state;

  // 캐릭터들 스탯 상황
  renderRoster();
  
  // 선언 상황 확인
  renderMyTeamActions();
  renderEnemyActions();
}

function onBattleDraft({ characterId, skillName, targetId }) {
  liveDrafts.set(characterId, { skillName, targetId });
  renderMyTeamActions(); // 실시간 갱신
}

function onRoundResolved(roundLog) {
  liveDrafts.clear(); // 새 라운드 시작이니 이전 임시 선언 정리
  // TODO: roundLog.events가 나중에 채워지면 여기서 battleLog에 출력
}


function renderMyTeamActions() {
  const myTeam = getMyCharacters(roomState, myPlayerId)[0]?.team;
  const teamChars = roomState.characters.filter((c) => c.team === myTeam);
  const confirmedMap = new Map(roomState.turn?.confirmed || []);

  document.getElementById("myTeamActions").innerHTML = teamChars
    .map((c) => {
      const confirmed = confirmedMap.get(c.id);
      const draft = liveDrafts.get(c.id);
      const status = confirmed
        ? `확정: ${confirmed.skillName}`
        : draft
        ? `(선언 중) ${draft.skillName}`
        : "대기 중";
      return `<div>${escapeHtml(c.name)} - ${escapeHtml(status)}</div>`;
    })
    .join("");
}

function renderEnemyActions() {
  const myTeam = getMyCharacters(roomState, myPlayerId)[0]?.team;
  const enemyTeam = myTeam === "A" ? "B" : "A";
  const enemyChars = roomState.characters.filter((c) => c.team === enemyTeam);
  const confirmedMap = new Map(roomState.turn?.confirmed || []);

  document.getElementById("enemyTeamActions").innerHTML = enemyChars
    .map((c) => {
      const confirmed = confirmedMap.get(c.id);
      return `<div>${escapeHtml(c.name)} - ${confirmed ? `확정: ${escapeHtml(confirmed.skillName)}` : "미확정"}</div>`;
    })
    .join("");
}

function renderRoster() {
  const container = document.getElementById("rosterBoard");
  const teamAName = roomState.teamNames?.A || "A팀";
  const teamBName = roomState.teamNames?.B || "B팀";

  const renderTeamRoster = (team, teamName) => {
    const chars = roomState.characters.filter((c) => c.team === team);
    const cards = chars
      .map((c) => {
        const hpPct = Math.max(0, Math.round((c.stats.hp / c.stats.maxHp) * 100));
        const owner = roomState.players.find((p) => p.id === c.ownerId);
        return `
          <div class="roster-card ${c.alive ? "" : "is-dead"}">
            <div class="roster-card-header">
              <span class="char-name" data-char="${c.id}">${escapeHtml(c.name)}</span>
              <span class="owner-tag">${escapeHtml(owner?.name || "")}</span>
            </div>
            <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
            <div class="hint">HP ${c.stats.hp}/${c.stats.maxHp}</div>
            <div class="hint">
              민첩 ${c.stats.dex} · 정신력 ${c.stats.mnd} · 행운 ${c.stats.luck} · 이능력 ${c.stats.power}
            </div>
            ${!c.alive ? '<span class="badge badge--offline">전투불능</span>' : ""}
          </div>`;
      })
      .join("");
    return `<div class="roster-team"><h3>${escapeHtml(teamName)}</h3>${cards}</div>`;
  };

  container.innerHTML = renderTeamRoster("A", teamAName) + renderTeamRoster("B", teamBName);
}

function renderBattle() {
  turnNumberEl.textContent = roomState.turnNumber;
  const myChars = roomState.characters.filter((c) => c.ownerId === myPlayerId);
  const enemies = roomState.characters.filter(
    (c) => c.ownerId !== myPlayerId && c.alive
  );

  myCharactersEl.innerHTML = myChars
    .map((c) => {
      const maxHp = 100 + (c.stats.hp_stat * 5);
      const hpPct = Math.max(0, Math.round((c.stats.hp / maxHp) * 100));
      if (!c.alive) {
        return `<div class="char-card"><strong>${c.name}</strong> — 전투불능</div>`;
      }
      return `
        <div class="char-card" data-char="${c.id}">
          <strong>${c.name}</strong> (${c.stats.hp}/${maxHp})
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