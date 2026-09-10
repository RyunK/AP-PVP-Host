import { socket } from "../js/socket.js";
import { loadIdentity, clearIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";
import { mountChat, updateChatCharacterOptions } from "../js/chat.js";
import { renderPlayerList, escapeHtml, renderReadyBadge } from "../js/playerList.js";

import { getMyPlayerId } from "../js/state.js";
import { getMyCharacters, getMyPlayerName } from "../js/roomHelpers.js";

let roomState = null;
const myPlayerId = getMyPlayerId();
let orderChecked = false;

// const myCharactersEl = document.getElementById("myCharacters");
// const battleLogEl = document.getElementById("battleLog");
// const turnNumberEl = document.getElementById("turnNumber");
// const nowTurnEl = document.getElementById("nowTurn");
// const phaseLabelEl = document.getElementById("phaseLabel");
const turnTimerEl = document.getElementById("turnTimer");


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
  console.log("BattleState");
  console.log(state);
  // 전반적인 전투 갱신
  renderBattle();

  // 캐릭터들 스탯 상황
  renderRoster();

  // 1라운드 지금 막 시작했다면 순서 확인
  renderOrderCheck()
}

const ORDER_CHECK_DURATION_MS = 10_000;
let orderCheckIntervalId = null;

function renderOrderCheck() {
  if (orderChecked) return;
  if (
    !roomState ||
    roomState.turn.phase != "orderCheck" ||
    roomState.turn.round > 1 ||
    roomState.turn.decidedFirstTeam.length <= 0
  ) return;

  orderChecked = true; // 다시 안 그리게 잠금 (재렌더링 시 모달이 또 뜨는 것 방지)

  const modal = document.querySelector(".alert-modal");
  const dexA = maxDex("A");
  const dexB = maxDex("B");
  const isTie = dexA === dexB;

  const teamAName = roomState.teamNames?.A || "A팀";
  const teamBName = roomState.teamNames?.B || "B팀";
  const firstTeamName = roomState.teamNames?.[roomState.turn.firstTeam] || roomState.turn.firstTeam;

  const diceRow = isTie
    ? `
      <p class="hint">1d100 결과</p>
      <p>${escapeHtml(teamAName)}: ${roomState.turn.decidedFirstTeam[0]} · ${escapeHtml(teamBName)}: ${roomState.turn.decidedFirstTeam[1]}</p>`
    : "";

  modal.innerHTML = `
    <div class="alert-modal-box">
      <h2>선공 판정</h2>
      <p>${escapeHtml(teamAName)} 최고 민첩: ${dexA} · ${escapeHtml(teamBName)} 최고 민첩: ${dexB}</p>
      ${diceRow}
      <p class="order-result"><strong>${escapeHtml(firstTeamName)}</strong>이(가) 선공합니다.</p>
      <p class="hint" id="orderCheckCountdown"></p>
    </div>
  `;
  modal.style.display = "flex";

  startOrderCheckCountdown();
}

function maxDex(team) {
  const chars = roomState.characters.filter((c) => c.team === team && c.alive);
  return Math.max(0, ...chars.map((c) => c.stats.dex));
}

function startOrderCheckCountdown() {
  const countdownEl = document.getElementById("orderCheckCountdown");
  const startTime = roomState.turn.startTime;

  function tick() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, ORDER_CHECK_DURATION_MS - elapsed);
    const secondsLeft = Math.ceil(remaining / 1000);

    countdownEl.textContent = `${secondsLeft}초 뒤 전투를 시작합니다...`;

    if (remaining <= 0) {
      clearInterval(orderCheckIntervalId);
      orderCheckIntervalId = null;
      document.querySelector(".alert-modal").style.display = "none";
      
      // console.log("테스트1")
      socket.emit("orderCheck:ended",  (res) => {
        if (!res.ok) battleStatus.textContent = res.error;
      });
      // console.log("테스트2")
    }
  }

  tick(); // 첫 화면에 바로 반영 (1초 기다리지 않고)
  orderCheckIntervalId = setInterval(tick, 1000);
}

function onTurnResolved(payload) {
  const turnNumberEl = document.getElementById("turnNumber");
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



function showMyInfo(myPlayerId, myPlayerName) {
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost;
  
  document.getElementById("myInfoLabel").innerHTML = `
  ${myPlayerName} 
  ${isHost ? '<span class="badge badge--host">호스트</span>' : renderReadyBadge(me?.ready)}
  ${!me?.connected ? '<span class="badge badge--offline">연결 끊김</span>' : '<span class="badge badge--online">연결됨</span>'}
  
  `;
}

let liveDrafts = new Map(); // characterId -> {skillName, targetId, value} (team:${team} room에서 실시간 수신)



function onBattleDraft({ characterId, skillName, targetId, value }) {
  liveDrafts.set(characterId, { skillName, targetId, value });
  const c = roomState.characters.find((ch) => ch.id === characterId);
  if (!c || c.ownerId === myPlayerId) return;

  updateSingleCard(characterId);
}

function updateSingleCard(characterId) {
const myCharactersEl = document.getElementById("myCharacters");
  const oldCard = myCharactersEl.querySelector(`.char-card[data-char="${characterId}"]`);
  if (!oldCard) return; // 지금 화면에 안 보이는 캐릭터(다른 팀 차례 등)면 무시

  const turn = roomState.turn;
  const c = roomState.characters.find((ch) => ch.id === characterId);
  if (!c) return;

  const confirmedMap = new Map(turn?.confirmed || []);
  const myCharacters = roomState.characters.filter((ch) => ch.ownerId === myPlayerId);
  const myTeams = myCharacters.map((ch) => ch.team);
  const isMyTeamActing = myTeams.includes(turn?.actingTeam);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderActionCard(c, confirmedMap, isMyTeamActing).trim();
  const newCard = wrapper.firstElementChild;

  oldCard.replaceWith(newCard);
  attachCardHandlers(newCard); // 새로 생긴 카드에만 이벤트 다시 연결
}

function onRoundResolved(roundLog) {
  liveDrafts.clear(); // 새 라운드 시작이니 이전 임시 선언 정리
  // TODO: roundLog.events가 나중에 채워지면 여기서 battleLog에 출력
}



/**
 * 캐릭터 정보 렌더링
 */
function renderRoster() {
  const container = document.getElementById("rosterBoard");
  const teamAName = roomState.teamNames?.A || "A팀";
  const teamBName = roomState.teamNames?.B || "B팀";

  const renderTeamTable = (team, teamName) => {
    const chars = roomState.characters.filter((c) => c.team === team);

    const rows = chars
      .map((c) => {
        const maxHp = 100 + c.stats.hp_stat * 5;
        const hpPct = Math.max(0, Math.round((c.stats.hp / maxHp) * 100));
        const owner = roomState.players.find((p) => p.id === c.ownerId);
        return `
          <tr class="${c.alive ? "" : "is-dead"}">
            <td class="roster-name-cell">
              <span class="char-name" data-char="${c.id}">${escapeHtml(c.name)}</span>
              <span class="owner-tag">${escapeHtml(owner?.name || "")}</span>
            </td>
            <td class="roster-hp-cell">
              <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
              <span class="hint">${c.stats.hp}/${maxHp}</span>
            </td>
            <td>${c.stats.hp_stat}</td>
            <td>${c.position}</td>
            <td>${c.skill}</td>
            <td>${c.stats.dex}</td>
            <td>${c.stats.mnd}</td>
            <td>${c.stats.luck}</td>
            <td>${c.stats.power}</td>
            <td>${!c.alive ? '<span class="badge badge--offline">전투불능</span>' : ""}</td>
          </tr>`;
      })
      .join("");

    return `
      <h3>${escapeHtml(teamName)}</h3>
      <table class="roster-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>HP</th>
            <th>포지션</th>
            <th>선택스킬</th>
            <th>체력</th>
            <th>민첩</th>
            <th>정신력</th>
            <th>행운</th>
            <th>이능력</th>
            <th>남은 스킬</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  container.innerHTML = renderTeamTable("A", teamAName) + renderTeamTable("B", teamBName);
}

function renderBattle() {
  const turn = roomState.turn;

  const myCharactersEl = document.getElementById("myCharacters");
  const turnNumberEl = document.getElementById("turnNumber");
  const phaseLabelEl = document.getElementById("phaseLabel");

  console.log("renderBattle - roomState : ", roomState)
  turnNumberEl.textContent = turn?.round ?? 0;
  let nowTurnTeam = turn?.actingTeam ?? "-";
  document.getElementById("nowTurn").textContent = roomState.teamNames?.[nowTurnTeam] || nowTurnTeam;
  switch(turn?.phase){
    case "vanguard": 
      phaseLabelEl.textContent = "선공";
      break;
    case "rearguard": 
      phaseLabelEl.textContent = "후공";
      break;
    case "calculating": 
      phaseLabelEl.textContent = "정산";
      break;
    default:
      phaseLabelEl.textContent = "-";
  }
  const myCharacters = roomState.characters.filter((c) => c.ownerId === myPlayerId);
  const myTeams = myCharacters.map((c) => c.team);

  const isMyTeamActing = myTeams.includes(turn?.actingTeam);

  // "이번 페이즈에 행동 차례인 팀"의 캐릭터만 카드로 보여줌.
  const actingTeamChars = roomState.characters.filter((c) => c.team === turn?.actingTeam);

  const confirmedMap = new Map(turn?.confirmed || []);
  const totalActing = actingTeamChars.filter((c) => c.alive).length;
  const confirmedCount = actingTeamChars.filter((c) => confirmedMap.has(c.id)).length;

  const cardsHtml = actingTeamChars.map((c) => renderActionCard(c, confirmedMap, isMyTeamActing)).join("");

  myCharactersEl.innerHTML = `
    <div class="confirm-progress hint">확정: ${confirmedCount}/${totalActing}</div>
    ${cardsHtml}
  `;

  attachActionCardHandlers();
}

function renderActionCard(c, confirmedMap, isMyTeamActing) {
  if (!c.alive) {
    return `<div class="char-card"><strong>${escapeHtml(c.name)}</strong> — 전투불능</div>`;
  }

  const isMine = c.ownerId === myPlayerId;
  const confirmed = confirmedMap.get(c.id);
  const maxHp = 100 + c.stats.hp_stat * 5;

  // 실시간 행동중인 데이터가 있는가?
  let drafted;
  if(!confirmed && liveDrafts.has(c.id) && isMyTeamActing ) {
    drafted = liveDrafts.get(c.id);
  }

  // 내 캐릭터가 아니면 모든 입력을 잠금. 이미 확정됐어도 잠금.
  const disabled = !isMine || !!confirmed ? "disabled" : "";
  
  const realdata = confirmed || drafted;

  const targetOptions = roomState.characters
    .filter((e) => e.alive)
    .map((e) => `<option value="${e.id}" ${realdata?.targetId === e.id ? "selected" : ""}>${escapeHtml(e.name)}</option>`)
    .join("");
  
  const btnText = confirmed ? "확정됨" : disabled ? "선언 중..." : "선언 확정";


  return `
    <div class="char-card" data-char="${c.id}">
      <div class="char-card-row char-card-name-row">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="hint">(${c.stats.hp}/${maxHp})</span>
        ${confirmed ? '<span class="badge badge--ready">확정됨</span>' : ""}
        ${!isMyTeamActing ? '<span class="badge badge--waiting">적군</span>' : ""}
        ${!isMine && isMyTeamActing ? '<span class="badge badge--waiting">아군</span>' : ""}
      </div>

      <div class="char-card-row char-card-default-row">
        <select class="action-type" ${disabled}>
          <option value="attack" ${realdata?.skillName === "attack" ? "selected" : ""}>공격</option>
          <option value="heal" ${realdata?.skillName === "heal" ? "selected" : ""}>회복</option>
        </select>
        <input type="number" class="action-value" placeholder="침식 값" value="${realdata?.value ?? ''}" ${disabled} style="width: 100px;" />
        <select class="action-target" ${disabled}>${targetOptions}</select>
        <button class="btn btn-${confirmed || disabled ? "ghost" : "primary"} submit-action" ${disabled}>
          ${btnText}
        </button>
      </div>
    </div>`;
}


function attachCardHandlers(card) {
  const submitBtn = card.querySelector(".submit-action:not([disabled])");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const characterId = card.dataset.char;
      const skillName = card.querySelector(".action-type").value;
      const targetId = card.querySelector(".action-target").value;
      const value = card.querySelector(".action-value").value;

      socket.emit("action:confirm", { characterId, skillName, targetId, value }, (res) => {
        if (!res.ok) battleStatus.textContent = res.error;
      });
    });
  }

  card.querySelectorAll(".action-type:not([disabled]), .action-target:not([disabled]), .action-value:not([disabled])")
    .forEach((el) => {
      el.addEventListener("input", () => {
        const characterId = card.dataset.char;
        socket.emit("action:draft", {
          characterId,
          skillName: card.querySelector(".action-type").value,
          targetId: card.querySelector(".action-target").value,
          value: card.querySelector(".action-value").value,
        }, 
        (res) => {
          if (!res.ok) return (battleStatus.textContent = res.error);
        }
      );
      });
    });
}

function attachActionCardHandlers() {
const myCharactersEl = document.getElementById("myCharacters");
  
  myCharactersEl.querySelectorAll(".char-card").forEach(attachCardHandlers);
}
