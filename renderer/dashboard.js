const navItems = document.querySelectorAll(".nav-item");
const panes = document.querySelectorAll(".pane");

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("is-active"));
    panes.forEach((p) => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.getElementById(`pane-${btn.dataset.tab}`).classList.add("is-active");
  });
});

const tunnelUrlEl = document.getElementById("tunnelUrl");
const tunnelHintEl = document.getElementById("tunnelHint");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const logBox = document.getElementById("logBox");
const roomList = document.getElementById("roomList");
const roomCountEl = document.getElementById("roomCount");
const playerCountEl = document.getElementById("playerCount");

let currentLink = "";

function appendLog(line) {
  const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  logBox.textContent += `[${time}] ${line}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function setLink(url) {
  currentLink = url;
  tunnelUrlEl.textContent = url;
  connDot.className = "dot ok";
  connText.textContent = "링크 생성됨";
  tunnelHintEl.textContent =
    "몇 분 기다려도 링크가 열리지 않는다면 링크를 재발급 받으세요.";
  
  startRemakeLock(Date.now());
}

document.getElementById("copyLinkBtn").addEventListener("click", async () => {
  if (!currentLink) return;
  await window.host.copyToClipboard(currentLink);
  const btn = document.getElementById("copyLinkBtn");
  const original = btn.textContent;
  btn.textContent = "복사됨";
  setTimeout(() => (btn.textContent = original), 1200);
});

document.getElementById("openLinkBtn").addEventListener("click", () => {
  if (currentLink) window.host.openExternal(currentLink);
});

const REMAKE_LOCK_MS = 3 * 60 * 1000; // 3분
let lastLinkIssuedAt = null;
let remakeIntervalId = null;

const remakeBtn = document.getElementById("remakeLink");

function startRemakeLock(issuedAt) {
  lastLinkIssuedAt = issuedAt;
  remakeBtn.disabled = true;

  if (remakeIntervalId) clearInterval(remakeIntervalId);

  function tick() {
    const elapsed = Date.now() - lastLinkIssuedAt;
    const remaining = Math.max(0, REMAKE_LOCK_MS - elapsed);

    if (remaining <= 0) {
      remakeBtn.textContent = "링크 재발급";
      remakeBtn.disabled = false;
      clearInterval(remakeIntervalId);
      remakeIntervalId = null;
      return;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    remakeBtn.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  tick();
  remakeIntervalId = setInterval(tick, 1000);
}

remakeBtn.addEventListener("click", async () => {
  if (remakeBtn.disabled) return; // 이중 클릭 방지

  remakeBtn.disabled = true;
  remakeBtn.textContent = "발급 중...";

  try {
    const result = await window.host.remakeTunnel();
    if (result.ok) {
      setLink(result.url);
      startRemakeLock(Date.now());
    } else {
      appendLog(`터널 재발급 실패: ${result.error}`);
      remakeBtn.textContent = "링크 재발급";
      remakeBtn.disabled = false;
    }
  } catch (err) {
    appendLog(`터널 재발급 실패: ${err.message}`);
    remakeBtn.textContent = "링크 재발급";
    remakeBtn.disabled = false;
  }
});


document.getElementById("pwToggleBtn").addEventListener("click", () => {
  const input = document.getElementById("roomPasswordInput");
  const btn = document.getElementById("pwToggleBtn");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  btn.innerHTML = isPassword ? `<i class="fas fa-eye-slash"></i>` : `<i class="fas fa-eye"></i>`;
});

document.getElementById("pwConfirm").addEventListener("click", async () => {
  const input = document.getElementById("roomPasswordInput");
  const status = document.getElementById("pwStatus");
  const password = input.value; // 빈 문자열이면 "비밀번호 사용 안 함"으로 처리

  const result = await window.host.setRoomPassword(password);
  if (result.ok) {
    status.textContent = password ? "비밀번호가 설정되었습니다." : "비밀번호가 해제되었습니다.";
    input.value = "";
  } else {
    status.textContent = `오류: ${result.error}`;
  }
});

// ---- 전투 설정 ----
const settingsForm = document.getElementById("settingsForm");
const settingsToast = document.getElementById("settingsToast");

function fillSettingsForm(settings) {
  if (!settings) return;
  settingsForm.teamSize.value = settings.teamSize;
  settingsForm.turnTimeLimitSec.value = settings.turnTimeLimitSec;
  settingsForm.resolutionTimeLimitSec.value = settings.resolutionTimeLimitSec;
  settingsForm.maxCharactersPerPlayer.value = settings.maxCharactersPerPlayer;
  settingsForm.maxStat.value = settings.maxStat;
  settingsForm.maxStatSum.value = settings.maxStatSum;
  settingsForm.maxRound.value = settings.maxRound;
  settingsForm.minRunRound.value = settings.minRunRound;
  settingsForm.maxAttackers.value = settings.maxAttackers;
  settingsForm.allowMultiCharacterPerPlayer.checked = settings.allowMultiCharacterPerPlayer;
  settingsForm.allowAsymmetricBattles.checked = settings.allowAsymmetricBattles;
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(settingsForm);
  const settings = {
    teamSize: Number(formData.get("teamSize")),
    turnTimeLimitSec: Number(formData.get("turnTimeLimitSec")),
    resolutionTimeLimitSec :Number(formData.get("resolutionTimeLimitSec")),
    maxCharactersPerPlayer: Number(formData.get("maxCharactersPerPlayer")),
    maxStat: Number(formData.get("maxStat")),
    maxStatSum: Number(formData.get("maxStatSum")),
    maxRound: Number(formData.get("maxRound")),
    minRunRound: Number(formData.get("minRunRound")),
    maxAttackers: Number(formData.get("maxAttackers")),
    allowMultiCharacterPerPlayer: formData.get("allowMultiCharacterPerPlayer") === "on",
    allowAsymmetricBattles: formData.get("allowAsymmetricBattles") === "on",
  };
  await window.host.saveMatchSettings(settings);
  settingsToast.textContent = "저장되었습니다.";
  setTimeout(() => (settingsToast.textContent = ""), 1800);
});

// ---- 수식 동기화 ----
const sheetForm = document.getElementById("sheetForm");
const syncResult = document.getElementById("syncResult");

sheetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(sheetForm);
  const sheetConfig = {
    spreadsheetId: formData.get("spreadsheetId"),
    sheetName: formData.get("sheetName") || "data",
    apiKey: "AIzaSyDmyez6nWxZRP2cwGsf4cVigXo1GhvaPvM",
  };
  syncResult.className = "sync-result";
  syncResult.textContent = "설정 반영 중...";
  try {
    const result = await window.host.syncFormulasFromSheet(sheetConfig);
    syncResult.textContent = `반영이 완료되었습니다.`;
  } catch (err) {
    syncResult.className = "sync-result is-error";
    syncResult.textContent = `실패: ${err.message}`;
  }
});

// ---- 수식 프리셋 ----
const presetRow = document.getElementById("presetRow");
const addPresetForm = document.getElementById("addPresetForm");

function renderPresets(presets) {
  presetRow.innerHTML = presets
    .map(
      (p, idx) => `
      <div class="preset-chip">
        <button type="button" class="preset-btn" data-idx="${idx}">${p.name}</button>
        ${p.isDefault ? "" : `<button type="button" class="preset-delete" data-idx="${idx}" title="삭제">×</button>`}
      </div>`
    )
    .join("");

  presetRow.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = presets[Number(btn.dataset.idx)];
      sheetForm.spreadsheetId.value = preset.spreadsheetId;
      sheetForm.sheetName.value = preset.sheetName;
    });
  });

  presetRow.querySelectorAll(".preset-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const updated = await window.host.deleteSheetPreset(Number(btn.dataset.idx));
      renderPresets(updated);
    });
  });
}

addPresetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(addPresetForm);
  const preset = {
    name: formData.get("presetName"),
    spreadsheetId: formData.get("presetSpreadsheetId"),
    sheetName: formData.get("presetSheetName"),
  };
  const updated = await window.host.addSheetPreset(preset);
  renderPresets(updated);
  addPresetForm.reset();
});

// ---- 참가자 목록 ----
function renderRooms(rooms) {
  console.log("받은 rooms:", rooms);
  // roomCountEl.textContent = rooms.length;
  playerCountEl.textContent = rooms.reduce((sum, r) => sum + r.playerCount, 0);

  if (rooms.length === 0) {
    roomList.innerHTML = '<div class="empty-state">아직 열린 방이 없습니다.</div>';
    return;
  }
  roomList.innerHTML = rooms
    .map(
      (r) => `
      <div class="room-row">
        <div>
          <div class="room-meta">${r.playerCount}명 접속 · 캐릭터 ${r.characterCount}명 · ${phaseLabel(r.phase)}</div>
        </div>
      </div>`
    )
    .join("");
}

function phaseLabel(phase) {
  return { lobby: "대기중", team_setup: "팀 구성중", battle: "전투중", ended: "종료" }[phase] || phase;
}

// ---- IPC 이벤트 구독 ----
window.host.onTunnelReady(({ url }) => setLink(url));
window.host.onTunnelError(({ message }) => {
  connDot.className = "dot err";
  connText.textContent = "터널 연결 실패";
  tunnelUrlEl.textContent = "링크 생성 실패";
  tunnelHintEl.textContent = `${message}`;
});
window.host.onRoomsUpdate((rooms) => renderRooms(rooms));
window.host.onLogLine((line) => appendLog(line));



// ---- 초기 상태 로드 ----
(async () => {
  const state = await window.host.getInitialState();
  console.log("1")
  fillSettingsForm(state.settings);
  console.log("2")
  if (state.tunnelUrl) setLink(state.tunnelUrl);
  console.log("3")
  if (state.sheetConfig?.spreadsheetId) {
    sheetForm.spreadsheetId.value = state.sheetConfig.spreadsheetId;
    sheetForm.sheetName.value = state.sheetConfig.sheetName;
  }
  console.log("4")

  const presets = await window.host.getSheetPresets();
  console.log("5")
  renderPresets(presets);
  console.log("6")

  appendLog(`관리자 창 로드됨 (로컬 포트 ${state.localPort})`);
})();
