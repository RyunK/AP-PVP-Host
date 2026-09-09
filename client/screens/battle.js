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

  showMyInfo(myPlayerId, getMyPlayerName(roomState, myPlayerId));
  
}

function onBattleState(state) {
  roomState = state;

  // 전반적인 전투 갱신
  renderBattle();

  // 캐릭터들 스탯 상황
  renderRoster();
  
  // 선언 상황 확인
  renderMyTeamActions();
  renderEnemyActions();
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
const nowTurnEl = document.getElementById("nowTurn");
const turnTimerEl = document.getElementById("turnTimer");

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
  const turn = roomState.turn;
  turnNumberEl.textContent = turn?.round ?? 0;
  let nowTurnTeam = turn?.actingTeam ?? "-";
  nowTurnEl.textContent = roomState.teamNames?.[nowTurnTeam] || nowTurnTeam;

  const myCharacters = roomState.characters.filter((c) => c.ownerId === myPlayerId);
  const myTeams = myCharacters.map((c) => c.team);

  // console.log("myTeam:", myTeam, "myCharacter:", myCharacter);
  const isMyTeamActing = myTeams.includes(turn?.actingTeam);

  // "이번 페이즈에 행동 차례인 팀"의 캐릭터만 카드로 보여줌.
  const actingTeamChars = roomState.characters.filter((c) => c.team === turn?.actingTeam);
  // const enemies = roomState.characters.filter((c) => c.team !== myTeam && c.alive);

  const confirmedMap = new Map(turn?.confirmed || []);
  const totalActing = actingTeamChars.filter((c) => c.alive).length;
  const confirmedCount = actingTeamChars.filter((c) => confirmedMap.has(c.id)).length;

  myCharactersEl.innerHTML = `
    <div class="confirm-progress hint">확정: ${confirmedCount}/${totalActing}</div>
    ${actingTeamChars.map((c) => renderActionCard(c,  confirmedMap, isMyTeamActing)).join("")}
  `;

  attachActionCardHandlers();
}

function renderActionCard(c,  confirmedMap, isMyTeamActing) {
  if (!c.alive) {
    return `<div class="char-card"><strong>${escapeHtml(c.name)}</strong> — 전투불능</div>`;
  }

  const isMine = c.ownerId === myPlayerId;
  const confirmed = confirmedMap.get(c.id);
  const maxHp = 100 + c.stats.hp_stat * 5;

  // 내 캐릭터가 아니면 모든 입력을 잠금. 이미 확정됐어도 잠금.
  const disabled = !isMine || !!confirmed ? "disabled" : "";

  const targetOptions = roomState.characters
    .filter((e) => e.alive)
    .map((e) => `<option value="${e.id}" ${confirmed?.targetId === e.id ? "selected" : ""}>${escapeHtml(e.name)}</option>`)
    .join("");
  
  const btnText = confirmed ? "확정됨" : disabled ? "선언 중..." : "선언 확정";

  return `
    <div class="char-card" data-char="${c.id}">
      <div class="char-card-row char-card-name-row">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="hint">(${c.stats.hp}/${maxHp})</span>
        ${confirmed ? '<span class="badge badge--ready">확정됨</span>' : ""}
        ${!isMyTeamActing ? '<span class="badge badge--waiting">상대팀</span>' : ""}
        ${!isMine && isMyTeamActing ? '<span class="badge badge--waiting">팀원</span>' : ""}
      </div>

      <div class="char-card-row char-card-default-row">
        <select class="action-type" ${disabled}>
          <option value="attack" ${confirmed?.skillName === "attack" ? "selected" : ""}>공격</option>
          <option value="heal" ${confirmed?.skillName === "heal" ? "selected" : ""}>회복</option>
        </select>
        <select class="action-target" ${disabled}>${targetOptions}</select>
        <button class="btn btn-${confirmed || disabled ? "ghost" : "primary"} submit-action" ${disabled}>
          ${btnText}
        </button>
      </div>
    </div>`;
}

function attachActionCardHandlers() {
  myCharactersEl.querySelectorAll(".submit-action:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".char-card");
      const characterId = card.dataset.char;
      const skillName = card.querySelector(".action-type").value;
      const targetId = card.querySelector(".action-target").value;

      socket.emit("action:confirm", { characterId, skillName, targetId }, (res) => {
        if (!res.ok) return (battleStatus.textContent = res.error);
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