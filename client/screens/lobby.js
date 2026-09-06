// client/screens/lobby.js
import { socket } from "../js/socket.js";
import { loadIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";

let roomState = null;
const myPlayerId = loadIdentity()?.playerId;

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
    if (res.ok) onRoomState(res.state);
  });

  // document.getElementById("roomCodeLabel").textContent = loadIdentity()?.roomCode || "";
  document.getElementById("addCharacterBtn").addEventListener("click", addCharacterRow);
  document.getElementById("saveCharactersBtn").addEventListener("click", saveCharacters);
  document.getElementById("startBattleBtn").addEventListener("click", startBattle);
}

function onRoomState(state) {
  roomState = state;
  if (state.phase === "battle" || state.phase === "ended") {
    renderScreen("battle"); // 전투가 시작되면 자동으로 화면 전환
    return;
  }
  renderTeamBoard();
}

function addCharacterRow() {
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
    <input type="number" placeholder="체력(스탯)" class="c-hp-stat"/>
    <label for="c-power">이능력</label>
    <input type="number" placeholder="이능력" class="c-power" />
    <label for="c-dex">민첩</label>
    <input type="number" placeholder="민첩" class="c-dex" />
    <label for="c-mnd">정신력</label>
    <input type="number" placeholder="정신력" class="c-mnd" />
    <label for="c-luck">행운</label>
    <input type="number" placeholder="행운" class="c-luck" />
  `;
  characterForm.appendChild(row);

  refreshSkillSelect(row); // 기본 선택된 포지션(아이기스)에 맞춰 스킬 목록 초기 세팅
  row.querySelector(".c-position").addEventListener("change", () => refreshSkillSelect(row));
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
  const defs = [...characterForm.querySelectorAll(".char-row")].map((row) => ({
    name: row.querySelector(".c-name").value.trim() || "이름없음",
    position: row.querySelector(".c-position").value.trim() || "아이기스",
    skill: row.querySelector(".c-skill").value.trim()  || "엄호",
    hp: Number(row.querySelector(".c-hp").value) || 1,
    hp_stat: Number(row.querySelector(".c-hp-stat").value) || 1,
    power: Number(row.querySelector(".c-power").value) || 1,
    dex: Number(row.querySelector(".c-dex").value) || 1,
    mnd: Number(row.querySelector(".c-mnd").value) || 1,
    luck: Number(row.querySelector(".c-luck").value) || 1,
  }));

  socket.emit("characters:set", defs, (res) => {
    if (!res.ok) return (lobbyStatus.textContent = res.error);
    lobbyStatus.textContent = "캐릭터가 저장되었습니다. 아래에서 팀을 배정하세요.";
  });
}

function renderTeamBoard() {
  const teamCol = (team) => {
    const ids = roomState.teams[team] || [];
    const chips = ids
      .map((id) => {
        const c = roomState.characters.find((ch) => ch.id === id);
        if (!c) return "";
        return `<div class="team-chip"><span>${c.name}</span></div>`;
      })
      .join("");
    return `<div class="team-col"><h3>${team}팀 (${ids.length}/${roomState.settings.teamSize})</h3>${chips}</div>`;
  };
  teamBoard.innerHTML = teamCol("A") + teamCol("B");

  // 미배정 캐릭터에 대한 배정 버튼
  const unassigned = roomState.characters.filter((c) => !c.team);
  if (unassigned.length > 0) {
    const picker = document.createElement("div");
    picker.style.marginTop = "8px";
    picker.innerHTML = unassigned
      .map(
        (c) => `
        <div class="team-chip">
          <span>${c.name} (미배정)</span>
          <span>
            <button data-char="${c.id}" data-team="A">A팀</button>
            <button data-char="${c.id}" data-team="B">B팀</button>
          </span>
        </div>`
      )
      .join("");
    teamBoard.appendChild(picker);

    picker.querySelectorAll("button").forEach((btn) => {
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
}

function startBattle(){
  socket.emit("battle:start", {}, (res) => {
    if (!res.ok) lobbyStatus.textContent = res.error;
  });
}
