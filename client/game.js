const socket = io();

// 포지션별로 고를 수 있는 선택 스킬 목록
const POSITION_SKILLS = {
  "아이기스": ["엄호", "수호"],
  "드레파논": ["확산", "침식"],
  "카두케우스": ["성호", "환희", "낙화"],
};

const screens = {
  entry: document.getElementById("screen-entry"),
  lobby: document.getElementById("screen-lobby"),
  battle: document.getElementById("screen-battle"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

let myPlayerId = null;
let roomState = null;

// ---------------------------------------------------------------------
// 1단계: 접속 (방 생성 / 참가)
// ---------------------------------------------------------------------

const entryError = document.getElementById("entryError");

document.getElementById("createRoomBtn").addEventListener("click", () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return (entryError.textContent = "닉네임을 입력해주세요.");

  socket.emit("room:create", { name }, (res) => {
    if (!res.ok) return (entryError.textContent = res.error);
    myPlayerId = res.playerId;
    roomState = res.state;
    enterLobby();
  });
});

document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const name = document.getElementById("nameInput").value.trim();
  const code = document.getElementById("codeInput").value.trim().toUpperCase();
  if (!name) return (entryError.textContent = "닉네임을 입력해주세요.");
  if (!code) return (entryError.textContent = "방 코드를 입력해주세요.");

  socket.emit("room:join", { code, profile: { name } }, (res) => {
    if (!res.ok) return (entryError.textContent = res.error);
    myPlayerId = res.playerId;
    roomState = res.state;
    enterLobby();
  });
});

// ---------------------------------------------------------------------
// 2단계: 대기실 (캐릭터 / 팀 설정)
// ---------------------------------------------------------------------

const characterForm = document.getElementById("characterForm");
const teamBoard = document.getElementById("teamBoard");
const startBattleBtn = document.getElementById("startBattleBtn");
const lobbyStatus = document.getElementById("lobbyStatus");

function enterLobby() {
  document.getElementById("roomCodeLabel").textContent = roomState.code;
  showScreen("lobby");
  addCharacterRow();
  renderTeamBoard();
  const me = roomState.players.find((p) => p.id === myPlayerId);
  startBattleBtn.style.display = me?.isHost ? "block" : "none";
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

document.getElementById("addCharacterBtn").addEventListener("click", addCharacterRow);

document.getElementById("saveCharactersBtn").addEventListener("click", () => {
  const defs = [...characterForm.querySelectorAll(".char-row")].map((row) => ({
    name: row.querySelector(".c-name").value.trim() || "이름없음",
    hp: Number(row.querySelector(".c-hp").value) || 100,
    atk: Number(row.querySelector(".c-atk").value) || 10,
    def: Number(row.querySelector(".c-def").value) || 5,
    power: 10,
  }));

  socket.emit("characters:set", defs, (res) => {
    if (!res.ok) return (lobbyStatus.textContent = res.error);
    lobbyStatus.textContent = "캐릭터가 저장되었습니다. 아래에서 팀을 배정하세요.";
  });
});

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

startBattleBtn.addEventListener("click", () => {
  socket.emit("battle:start", {}, (res) => {
    if (!res.ok) lobbyStatus.textContent = res.error;
  });
});

// ---------------------------------------------------------------------
// 3단계: 전투
// ---------------------------------------------------------------------

const myCharactersEl = document.getElementById("myCharacters");
const battleLogEl = document.getElementById("battleLog");
const turnNumberEl = document.getElementById("turnNumber");

function logLine(text) {
  const div = document.createElement("div");
  div.textContent = text;
  battleLogEl.appendChild(div);
  battleLogEl.scrollTop = battleLogEl.scrollHeight;
}

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

// ---------------------------------------------------------------------
// 서버 이벤트 구독
// ---------------------------------------------------------------------

socket.on("room:state", (state) => {
  roomState = state;
  if (state.phase === "battle" || state.phase === "ended") {
    if (screens.battle.classList.contains("is-active") === false) showScreen("battle");
    renderBattle();
  } else {
    renderTeamBoard();
  }
});

socket.on("turn:resolved", ({ events, winner, nextTurn }) => {
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
});

socket.on("turn:waiting", ({ waitingFor }) => {
  logLine(`${waitingFor.length}명의 행동을 기다리는 중...`);
});

socket.on("room:closed", ({ reason }) => {
  alert(`방이 종료되었습니다: ${reason}`);
  location.reload();
});