import { socket } from "../js/socket.js";
import { loadIdentity, clearIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";
import { mountChat, updateChatCharacterOptions } from "../js/chat.js";
import { renderPlayerList, escapeHtml, renderReadyBadge } from "../js/playerList.js";

import { getMyPlayerId } from "../js/state.js";
import { getMyCharacters, getMyPlayerName } from "../js/roomHelpers.js";

import { showPhaseAlert } from "../modals/battleModal.js"

import {renderRoundLog} from "../js/renderBattle/renderRoundLog.js"

let roomState = null;
const myPlayerId = getMyPlayerId();
let orderChecked = false;



export function init() {
  socket.off("room:state", onRoomState);
  socket.off("battle:state", onBattleState);
  socket.off("battle:draft", onBattleDraft);
  socket.off("round:resolved", onRoundResolved);
  socket.off("resolution:result", onResult);

  socket.on("room:state", onRoomState);
  socket.on("battle:state", onBattleState);
  socket.on("battle:draft", onBattleDraft);
  socket.on("round:resolved", onRoundResolved);
  socket.on("resolution:result", onResult);

  socket.emit("room:get-state", {}, (res) => {
    if (res.ok){
      onBattleState(res.state);
      onRoomState(res.state);
    } 
  });

}

function onResult(roundLog){
  console.log("onResult");
  console.log(roundLog);
  renderRoundLog(roundLog.results);
}

export function destroy() {
    socket.off("room:state", onRoomState);
    socket.off("battle:state", onBattleState);
    socket.off("battle:draft", onBattleDraft);
    socket.off("round:resolved", onRoundResolved);
}

/**
 * 채팅과 플레이어리스트, 내 정보만 업데이트
 * @param {Object} state 
 */
function onRoomState(state) {
  roomState = state;
  
  mountChat(document.getElementById("chatContainer"), getMyCharacters(), state.chat || []);
  updateChatCharacterOptions(getMyCharacters(roomState, myPlayerId), getMyPlayerName(roomState, myPlayerId));  
  renderPlayerList(document.getElementById("playerListContainer"), state.players);

  showMyInfo(myPlayerId, getMyPlayerName(roomState, myPlayerId));
}

let phase_state;
let round = 0;

async function onBattleState(state) {
  roomState = state;

  // 전반적인 전투 갱신
  renderBattle();

  // 캐릭터들 스탯 상황
  renderRoster();

  // 1라운드 지금 막 시작했다면 순서 확인
  await renderOrderCheck()

  const now_phase = state.turn?.phase;
  const now_round = state.turn?.round;
  let phase_kr;
  switch(now_phase){
    case "vanguard" : phase_kr = "선공"; break;
    case "rearguard" : phase_kr = "후공"; break;
    case "resolution" : phase_kr = "정산"; break;
    default: phase_kr = "-"; 
  }
  if(phase_state != now_phase && round == now_round ){
    showPhaseAlert(`${now_phase.toUpperCase()} PHASE`, `${phase_kr} 페이즈 시작.`, now_round);
  } else if (round != now_round && round != 0){
    showPhaseAlert(`ROUND ${now_round}`, `${phase_kr} 페이즈 시작.`, now_round);
  }
  phase_state = now_phase;
  round = now_round;
}

const ORDER_CHECK_DURATION_MS = 10_000;
let orderCheckIntervalId = null;

async function renderOrderCheck() {
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
      <p class="">1d100 결과</p>
      <p>${escapeHtml(teamAName)}: ${roomState.turn.decidedFirstTeam[0]} · ${escapeHtml(teamBName)}: ${roomState.turn.decidedFirstTeam[1]}</p>`
    : "";

  modal.innerHTML = `
    <div class="alert-modal-box">
      <h2 id="loadingModalHead">SYSTEM LOADING...</h2>
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

  let tick_num = 0;
  function tick() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, ORDER_CHECK_DURATION_MS - elapsed);
    const secondsLeft = Math.ceil(remaining / 1000);
    const dots = ".".repeat(tick_num % 4);
    tick_num += 1;
    countdownEl.textContent = `${secondsLeft}초 뒤 전투를 시작합니다...`;
    document.getElementById("loadingModalHead").textContent = "SYSTEM LOADING" + dots;
    if (remaining <= 0) {
      clearInterval(orderCheckIntervalId);
      orderCheckIntervalId = null;
      document.querySelector(".alert-modal").style.display = "none";
      
      socket.emit("orderCheck:ended",  (res) => {
        if (!res.ok) battleStatus.textContent = res.error;
      });
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



function onBattleDraft({ characterId, skillName, targetIds, value }) {
  liveDrafts.set(characterId, { skillName, targetIds, value });
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
            <td>${c.position}</td>
            <td>${c.skill}</td>
            <td>${c.stats.hp_stat}</td>
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
  const myCharactersEl = document.getElementById("myCharacters");
  const turnNumberEl = document.getElementById("turnNumber");
  const phaseLabelEl = document.getElementById("phaseLabel");

  const turn = roomState.turn;
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
    case "resolution": 
      phaseLabelEl.textContent = "정산";
      document.getElementById("nowTurn").textContent = "-";  
      return;
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

/**
 * 해당 캐릭터가 사용할 수 있는 스킬들을 매핑함.
 * label이 표시 값, value가 서버로 보내는 값.
 * @param {string} c 캐릭터 id 
 * @returns 
 */
function buildSkillOptions(c) {
  const phase = roomState.turn.phase;
  const round = roomState.turn.round;

  const options = [
    { value: "공격", label: "공격" },
    { value: "방어", label: "방어" },
  ];

  // 낙화는 선공에만 사용 가능
  if (c.skill && !(phase != "vanguard" && c.skill == "낙화")) {
    options.push({ value: c.skill, label: c.skill });
  }

  if (c.position === "카두케우스") {
    options.push({ value: "회복", label: "회복" });
  }

  if(round >= 6 && phase == "rearguard"){
    options.push({ value: "도주", label: "도주" });
  }

  return options;
}

function renderActionCard(c, confirmedMap, isMyTeamActing) {
  if (!c.alive) {
    return `<div class="char-card"><strong>${escapeHtml(c.name)}</strong> — 전투불능</div>`;
  }

  const isMine = c.ownerId === myPlayerId;
  const confirmed = confirmedMap.get(c.id);
  const maxHp = 100 + c.stats.hp_stat * 5;

  let drafted;
  if (!confirmed && liveDrafts.has(c.id) && isMyTeamActing) {
    drafted = liveDrafts.get(c.id);
  }

  const disabled = !isMine || !!confirmed;
  const disabledAttr = disabled ? "disabled" : "";

  const realdata = confirmed || drafted;
  const selectedTargetIds = realdata?.targetIds || [];

  const selectedNames = selectedTargetIds
    .map((id) => roomState.characters.find((e) => e.id === id)?.name)
    .filter(Boolean);
  const targetSummary = selectedNames.length > 0
    ? selectedNames.map((n) => `(${escapeHtml(n)})`).join(" ")
    : "대상 선택";

  const btnText = confirmed ? "확정됨" : disabled ? "선언 중..." : "선언 확정";

  const skillOptions = buildSkillOptions(c);
  const skillOptionsHtml = skillOptions
    .map((opt) => `<option value="${escapeHtml(opt.value)}" ${realdata?.skillName === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`)
    .join("");

  const teamAName = roomState.teamNames?.A || "A팀";
  const teamBName = roomState.teamNames?.B || "B팀";
  const buildGroup = (team, teamName) => {
    const chars = roomState.characters.filter((e) => e.team === team && e.alive);
    if (chars.length === 0) return "";
    const items = chars
      .map(
        (e) => `
        <label class="target-option">
          <input type="checkbox" class="target-checkbox" value="${e.id}"
            ${selectedTargetIds.includes(e.id) ? "checked" : ""} ${disabledAttr} />
            ${escapeHtml(e.name)}${e.id === c.id ? " (나)" : ""}
        </label>`
      )
      .join("");
    return `<div class="target-group"><div class="target-group-title">${escapeHtml(teamName)}</div>${items}</div>`;
  };

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
        <select class="action-type" ${disabledAttr}>
          ${skillOptionsHtml}
        </select>
        <input type="number" class="action-value" placeholder="침식 값" value="${realdata?.value ?? ""}" ${disabledAttr} style="width: 100px;" />

        <div class="target-multiselect ${disabled ? "is-disabled" : ""}">
          <button type="button" class="target-multiselect-toggle" ${disabledAttr}>${targetSummary}</button>
          <div class="target-multiselect-panel" style="display:none;">
            ${buildGroup("A", teamAName)}
            ${buildGroup("B", teamBName)}
          </div>
        </div>

        <button class="btn btn-${confirmed || disabled ? "ghost" : "primary"} submit-action" ${disabledAttr}>
          ${btnText}
        </button>
      </div>
    </div>`;
}


function attachActionCardHandlers() {
  const myCharactersEl = document.getElementById("myCharacters");
  
  myCharactersEl.querySelectorAll(".char-card").forEach(attachCardHandlers);
}

function attachCardHandlers(card) {
  const battleStatus = document.getElementById("battleStatus");

  // 다중선택 드롭다운 토글
  const toggleBtn = card.querySelector(".target-multiselect-toggle:not([disabled])");
  const panel = card.querySelector(".target-multiselect-panel");
  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.style.display !== "none";
      panel.style.display = isOpen ? "none" : "block";
    });
  }

  const submitBtn = card.querySelector(".submit-action:not([disabled])");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const characterId = card.dataset.char;
      const skillName = card.querySelector(".action-type").value;
      const targetIds = [...card.querySelectorAll(".target-checkbox:checked")].map((cb) => cb.value);
      const value = card.querySelector(".action-value").value;

      battleStatus.textContent = "";

      socket.emit("action:confirm", { characterId, skillName, targetIds, value }, (res) => {
        if (!res.ok) battleStatus.textContent = res.error;
      });
    });
  }

  card.querySelectorAll(".action-type:not([disabled]), .target-checkbox:not([disabled]), .action-value:not([disabled])")
    .forEach((el) => {
      el.addEventListener(el.classList.contains("target-checkbox") ? "change" : "input", () => {
        const characterId = card.dataset.char;
        const targetIds = [...card.querySelectorAll(".target-checkbox:checked")].map((cb) => cb.value);

        socket.emit("action:draft", {
          characterId,
          skillName: card.querySelector(".action-type").value,
          targetIds,
          value: card.querySelector(".action-value").value,
        },
        (res) => {
          if (!res.ok) return (battleStatus.textContent = res.error);
        });

        // 드롭다운 요약 텍스트도 즉시 갱신
        if (toggleBtn) {
          const names = targetIds
            .map((id) => roomState.characters.find((c) => c.id === id)?.name)
            .filter(Boolean);
          toggleBtn.textContent = names.length > 0 ? names.map((n) => `${escapeHtml(n)}`).join(", ") : "대상 선택";
        }
      });
    });
}

function collectCardData(card) {
  const characterId = card.dataset.char;
  const skillName = card.querySelector(".action-type").value;
  const value = card.querySelector(".action-value").value;
  const targetIds = [...card.querySelectorAll(".target-checkbox:checked")].map((cb) => cb.value);
  return { characterId, skillName, targetIds, value };
}

function sendDraft(card) {
  const { characterId, skillName, targetIds, value } = collectCardData(card);
  socket.emit("action:draft", { characterId, skillName, targetIds, value });

  // 선택한 이름 요약 텍스트만 즉시 갱신 (카드 전체를 다시 그리진 않음)
  const summaryBtn = card.querySelector(".target-multiselect-toggle");
  const names = targetIds
    .map((id) => roomState.characters.find((c) => c.id === id)?.name)
    .filter(Boolean);
  summaryBtn.textContent = names.length > 0 ? names.map((n) => `(${escapeHtml(n)})`).join(" ") : "대상 선택";
}

document.addEventListener("click", (e) => {
  document.querySelectorAll(".target-multiselect-panel").forEach((panel) => {
    if (!panel.parentElement.contains(e.target)) {
      panel.style.display = "none";
    }
  });
});
