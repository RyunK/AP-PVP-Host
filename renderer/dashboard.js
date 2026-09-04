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
  connText.textContent = "연결됨";
  tunnelHintEl.textContent =
    "이 링크는 앱을 껐다 켤 때마다 바뀝니다. 매치가 끝나기 전엔 새로고침하지 마세요.";
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

// ---- 전투 설정 ----
const settingsForm = document.getElementById("settingsForm");
const settingsToast = document.getElementById("settingsToast");

function fillSettingsForm(settings) {
  if (!settings) return;
  settingsForm.teamSize.value = settings.teamSize;
  settingsForm.turnTimeLimitSec.value = settings.turnTimeLimitSec;
  settingsForm.maxCharactersPerPlayer.value = settings.maxCharactersPerPlayer;
  settingsForm.allowMultiCharacterPerPlayer.checked = settings.allowMultiCharacterPerPlayer;
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(settingsForm);
  const settings = {
    teamSize: Number(formData.get("teamSize")),
    turnTimeLimitSec: Number(formData.get("turnTimeLimitSec")),
    maxCharactersPerPlayer: Number(formData.get("maxCharactersPerPlayer")),
    allowMultiCharacterPerPlayer: formData.get("allowMultiCharacterPerPlayer") === "on",
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
  roomCountEl.textContent = rooms.length;
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
          <span class="room-code">${r.code}</span>
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