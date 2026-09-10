// client/screens/lobby.js
import { socket } from "../js/socket.js";
import { loadIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";
import { mountChat, updateChatCharacterOptions } from "../js/chat.js";
import { renderPlayerList, escapeHtml, renderReadyBadge } from "../js/playerList.js";

import { getMyPlayerId } from "../js/state.js";
import { getMyCharacters, getMyPlayerName } from "../js/roomHelpers.js";

let roomState = null;
const myPlayerId = getMyPlayerId();

const teamBoard = document.getElementById("teamBoard");
const unassignedBoard = document.getElementById("unassignedBoard");
const characterAlert = document.getElementById("characterAlert");

// 포지션별로 고를 수 있는 선택 스킬 목록
const POSITION_SKILLS = {
  "아이기스": ["엄호", "수호"],
  "드레파논": ["확산", "침식"],
  "카두케우스": ["성호", "환희", "낙화"],
};


export function init() {
  socket.off("room:state", onRoomState); // 중복 등록 방지
  socket.on("room:state", onRoomState);


  socket.emit("room:get-state", {}, (res) => {
    console.log("room:get-state 응답:", res);
    if (res.ok) onRoomState(res.state);
  });
  

  document.getElementById("addCharacterBtn").addEventListener("click", addCharacterRow);
  document.getElementById("saveCharactersBtn").addEventListener("click", saveCharacters);
  document.getElementById("startBattleBtn").addEventListener("click", startBattle);
  document.getElementById("readyBtn").addEventListener("click", toggleReady);

  // mountChat(document.getElementById("chatContainer"), getMyCharacters());

  teamBoard.addEventListener("click", handleBoardClick);
  unassignedBoard.addEventListener("click", handleBoardClick);
}

export function destroy() {
    socket.off("room:state", onRoomState);
}

function handleBoardClick(e) {
  const nameEl = e.target.closest(".char-name");
  if (nameEl) {
    showCharacterInfo(nameEl.dataset.char);
    return;
  }
  const teamBtn = e.target.closest("[data-team]");
  if (teamBtn && teamBtn.dataset.char) {
    socket.emit(
      "team:assign",
      { characterId: teamBtn.dataset.char, team: teamBtn.dataset.team },
      (res) => {
        if (!res.ok) lobbyStatus.textContent = res.error;
      }
    );
  }
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

function renderMyCharacterList() {
  const container = document.getElementById("myCharacterList");
  const myChars = getMyCharacters(roomState, myPlayerId);

  if (myChars.length === 0) {
    container.innerHTML = '<p class="hint">아직 등록한 캐릭터가 없습니다.</p>';
    return;
  }

  container.innerHTML = myChars
    .map(
      (c) => `
      <div class="char-chip">
        <span>${escapeHtml(c.name)}</span>
        <button class="delete-char-btn" data-id="${c.id}">삭제</button>
      </div>`
    )
    .join("");

  container.querySelectorAll(".delete-char-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ok = confirm(`"${btn.previousElementSibling?.textContent || "이 캐릭터"}"를 삭제할까요?`);
      if (!ok) return;

      socket.emit("character:delete", { characterId: btn.dataset.id }, (res) => {
        if (!res.ok) lobbyStatus.textContent = res.error;
      });
    });
  });
}

function toggleReady() {
  const me = roomState?.players?.find((p) => p.id === myPlayerId);
  const nextReady = !me?.ready;
  socket.emit("player:ready", { ready: nextReady }, (res) => {
    if (!res.ok) lobbyStatus.textContent = res.error;
  });
}

function onRoomState(state) {
  console.log("전체 roomState:", state);
  roomState = state;

  if (state.phase === "battle" || state.phase === "ended") {
    renderScreen("battle"); // 전투가 시작되면 자동으로 화면 전환
    return;
  }
  
  mountChat(document.getElementById("chatContainer"), getMyCharacters(), state.chat || []);

  updateChatCharacterOptions(getMyCharacters(roomState, myPlayerId), getMyPlayerName(roomState, myPlayerId));
  updateReadyUI();

  renderMyCharacterList();
  renderTeamBoard();
  renderPlayerList(document.getElementById("playerListContainer"), state.players);
  showMyInfo(myPlayerId, getMyPlayerName(roomState, myPlayerId));

  
}

function updateReadyUI() {
  const me = roomState?.players?.find((p) => p.id === myPlayerId);
  const startBtn = document.getElementById("startBattleBtn");
  const readyBtn = document.getElementById("readyBtn");

  if (me?.isHost) {
    startBtn.style.display = "block";
    readyBtn.style.display = "none";
  } else {
    startBtn.style.display = "none";
    readyBtn.style.display = "block";
    readyBtn.textContent = me?.ready ? "준비 취소" : "준비 완료";
  }
}

function addCharacterRow() {
  if (!roomState) {
    lobbyStatus.textContent = "방 정보를 아직 불러오는 중입니다. 잠시 후 다시 시도해주세요.";
    return;
  }
  const max = roomState.settings.maxCharactersPerPlayer || 3;
  if (characterForm.children.length >= max) return;
  const row = document.createElement("div");
  row.className = "char-row";
  row.innerHTML = `
    <label for="c-name">이름</label>
    <input type="text" placeholder="이름" class="c-name" />

    <label for="c-position">포지션</label>
    <select class="c-position">
      <option value="아이기스">아이기스</option>
      <option value="드레파논">드레파논</option>
      <option value="카두케우스">카두케우스</option>
    </select>

    <label for="c-skill">선택 스킬</label>
    <select class="c-skill"></select>

    <label for="c-hp">현재체력</label>
    <input type="number" placeholder="현재체력" class="c-hp" />
    <label for="c-hp-stat">체력(스탯)</label>
    <input type="number" placeholder="체력(스탯)" class="c-hp-stat" value="0" />
    <label for="c-power">이능력</label>
    <input type="number" placeholder="이능력" class="c-power" value="1" />
    <label for="c-dex">민첩</label>
    <input type="number" placeholder="민첩" class="c-dex" value="1" />
    <label for="c-mnd">정신력</label>
    <input type="number" placeholder="정신력" class="c-mnd" value="1" />
    <label for="c-luck">행운</label>
    <input type="number" placeholder="행운" class="c-luck" value="1" />
    <label class="hint stat-summary" style="grid-column: 3 / -1;">최대체력: 100 | 스탯합: 0</label>
    <button type="button" class="remove-row-btn">✕</button>
  `;

  row.querySelector(".remove-row-btn").addEventListener("click", () => {
      row.remove();
  });
  characterForm.appendChild(row);

  refreshSkillSelect(row); // 기본 선택된 포지션(아이기스)에 맞춰 스킬 목록 초기 세팅
  row.querySelector(".c-position").addEventListener("change", () => refreshSkillSelect(row));

  row.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener("input", () => updateStatSummary(row));
  });
  updateStatSummary(row); // 처음 만들어졌을 때(빈 값 기준) 한 번 표시
}

function updateStatSummary(row) {
  const getVal = (selector) => Number(row.querySelector(selector).value) || 0;

  const hpStat = getVal(".c-hp-stat");
  const power = getVal(".c-power");
  const dex = getVal(".c-dex");
  const mnd = getVal(".c-mnd");
  const luck = getVal(".c-luck");

  const maxHp = 100 + hpStat * 5;
  const statSum = hpStat + power + dex + mnd + luck;

  row.querySelector(".stat-summary").textContent = `최대체력: ${maxHp} | 스탯합: ${statSum}`;
}

function buildSkillOptions(position) {
  const skills = POSITION_SKILLS[position] || [];
  return skills.map((s) => `<option value="${s}">${s}</option>`).join("");
}

function refreshSkillSelect(row) {
  const position = row.querySelector(".c-position").value;
  const skillSelect = row.querySelector(".c-skill");
  skillSelect.innerHTML = buildSkillOptions(position);
}

function saveCharacters(){
  const rows = [...characterForm.querySelectorAll(".char-row")];

  for (const row of rows) {
    if (!row.querySelector(".c-name").value.trim()) {
      characterAlert.textContent = "캐릭터 이름을 입력해주세요.";
      return;
    }
    if (!row.querySelector(".c-position").value.trim()) {
      characterAlert.textContent = "캐릭터 포지션을 선택해주세요.";
      return;
    }
    if (!row.querySelector(".c-skill").value.trim()) {
      characterAlert.textContent = "캐릭터 스킬을 선택해주세요.";
      return;
    }
    if (!row.querySelector(".c-hp").value.trim()) {
      characterAlert.textContent = "캐릭터 현재체력을 입력해주세요.";
      return;
    }
  }

  const defs = [...characterForm.querySelectorAll(".char-row")].map((row) => ({
    name: row.querySelector(".c-name").value.trim() || "이름없음",
    position: row.querySelector(".c-position").value.trim() || "아이기스",
    skill: row.querySelector(".c-skill").value.trim()  || "엄호",
    hp: Number(row.querySelector(".c-hp").value) || 1,
    hp_stat: Number(row.querySelector(".c-hp-stat").value) || 0,
    power: Number(row.querySelector(".c-power").value) || 1,
    dex: Number(row.querySelector(".c-dex").value) || 1,
    mnd: Number(row.querySelector(".c-mnd").value) || 1,
    luck: Number(row.querySelector(".c-luck").value) || 1,
  }));

  socket.emit("characters:set", defs, (res) => {
    if (!res.ok) return (characterAlert.textContent = res.error);
    characterAlert.classList.remove("warning");
    characterAlert.classList.add("alert");
    characterAlert.textContent = "캐릭터가 저장되었습니다. 아래에서 팀을 배정하세요.";
    renderTeamBoard();
  });

}

function renderTeamBoard() {
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost;

  const teamCol = (team) => {
    const teamName = roomState.teamNames?.[team] || `${team}팀`;
    const teamSize = roomState.settings.teamSize;

    const header = isHost
      ? `<input class="team-name-input" data-team="${team}" value="${escapeHtml(teamName)}" maxlength="20" />`
      : `<h3>${escapeHtml(teamName)}</h3>`;

    const ids = roomState.teams[team] || [];
    const chips = ids
      .map((id) => {
        const c = roomState.characters.find((ch) => ch.id === id);
        if (!c) return "";
        const owner = roomState.players.find((p) => p.id === c.ownerId);
        if (!c) return "";
        return `
        <div class="team-chip">
          <span class="char-name" data-char="${c.id}">${escapeHtml(c.name)}</span>
          <span class="owner-tag"> 오너 : ${escapeHtml(owner?.name || "알 수 없음")}</span>
        </div>
        `;
      })
      .join("");

    return `
      <div class="team-col">
        ${header}
        <p class="team-count">${ids.length}/${teamSize}</p>
        ${chips}
      </div>`;
  };

  teamBoard.innerHTML = teamCol("A") + teamCol("B");

  /**
   * 호스트면 팀 이름 바꿀 수 있음.
   */
  if (isHost) {
    teamBoard.querySelectorAll(".team-name-input").forEach((input) => {
      input.addEventListener("change", () => {
        socket.emit("team:rename", { team: input.dataset.team, name: input.value }, (res) => {
          if (!res.ok) lobbyStatus.textContent = res.error;
        });
      });
    });
  }

  // 미배정 캐릭터에 대한 배정 버튼
  const unassignedBoard = document.getElementById("unassignedBoard");
  const unassigned = roomState.characters.filter((c) => !c.team);

  if (unassigned.length === 0) {
    unassignedBoard.innerHTML = "";
    return;
  }

  unassignedBoard.innerHTML = `
    <h3 class="unassigned-title">미배정 캐릭터</h3>
    ${unassigned
      .map((c) => {
        const owner = roomState.players.find((p) => p.id === c.ownerId);
        const teamAName = roomState.teamNames?.A || "A팀";
        const teamBName = roomState.teamNames?.B || "B팀";
        return `
          <div class="team-chip">
            <span class="char-name" data-char="${c.id}">${escapeHtml(c.name)}</span>
            <span class="owner-tag"> 오너 : ${escapeHtml(owner?.name || "알 수 없음")}</span>
            <span>
              <button data-char="${c.id}" data-team="A">${escapeHtml(teamAName)}</button>
              <button data-char="${c.id}" data-team="B">${escapeHtml(teamBName)}</button>
            </span>
          </div>`;
      })
      .join("")}
  `;

  unassignedBoard.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      socket.emit(
        "team:assign",
        { characterId: btn.dataset.char, team: btn.dataset.team },
        (res) => {
          if (!res.ok) lobbyStatus.textContent = res.error;
        }
      );
    });
  });

}

function startBattle(){
  socket.emit("battle:start", {}, (res) => {
    if (!res.ok) lobbyStatus.textContent = res.error;
  });
}

function showCharacterInfo(characterId) {
  const c = roomState.characters.find((ch) => ch.id === characterId);
  if (!c) return;

  const owner = roomState.players.find((p) => p.id === c.ownerId);
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isOwner = c.ownerId === myPlayerId;
  const isHost = me?.isHost;
  const canDelete = isOwner || isHost; // 삭제 권한만 이렇게 판단

  const teamAName = roomState.teamNames?.A || "A팀";
  const teamBName = roomState.teamNames?.B || "B팀";

  const modal = document.getElementById("charInfoModal");
  modal.innerHTML = `
    <div class="modal-box">
      <h3>${escapeHtml(c.name)}</h3>
      <p class="hint">오너 : ${escapeHtml(owner?.name || "알 수 없음")}</p>
      <p>포지션: ${escapeHtml(c.position || "-")} · 스킬: ${escapeHtml(c.skill || "-")}</p>
      <p>HP: ${c.stats.hp} / ${100 + (c.stats.hp_stat*5)}</p>
      <p>체력(스탯) ${c.stats.hp_stat} · 민첩 ${c.stats.dex} · 정신력 ${c.stats.mnd} · 행운 ${c.stats.luck} · 이능력 ${c.stats.power}</p>
        
      <span class="hint">팀 이동</span>
      <div class="modal-actions">
          <button class="btn btn-primary" data-modal-team="A">${escapeHtml(teamAName)}</button>
          <button class="btn btn-primary" data-modal-team="B">${escapeHtml(teamBName)}</button>
      </div>
      <div class="modal-actions">
          ${canDelete ? '<button id="modalDeleteBtn" class="btn btn-danger">삭제</button>' : ""}
          <button id="modalCloseBtn" class="btn btn-ghost">닫기</button>
      </div>
      
    </div>
  `;
  modal.style.display = "flex";

  modal.querySelectorAll("[data-modal-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      socket.emit(
        "team:assign",
        { characterId: c.id, team: btn.dataset.modalTeam },
        (res) => {
          if (!res.ok) return alert(res.error);
          modal.style.display = "none";
        }
      );
    });
  });

  const deleteBtn = document.getElementById("modalDeleteBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const ok = confirm(`"${c.name}"를 삭제할까요?`);
      if (!ok) return;
      socket.emit("character:delete", { characterId: c.id }, (res) => {
        if (!res.ok) return alert(res.error);
        modal.style.display = "none";
      });
    });
  }

  document.getElementById("modalCloseBtn").addEventListener("click", () => {
    modal.style.display = "none";
  });
}