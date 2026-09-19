// 로비/전투 화면 공통으로 쓰는 "방 설정 요약" 패널입니다.
// roomState.settings를 받아 접었다 펼 수 있는 박스에 표시합니다.

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function isSafeUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

const SETTINGS_LABELS = {
  resolutionTimeLimitSec: "정산 페이즈 시간(초)",
  turnTimeLimitSec: "턴 제한시간(초)",
  teamSize: "팀 인원",
  maxCharactersPerPlayer: "플레이어당 최대 캐릭터 수",
  maxStat: "스탯 최댓값",
  maxStatSum: "스탯 합 최댓값",
  maxRound: "최대 라운드",
  minRunRound: "최소 도주 라운드",
  maxAttackers: "1인 대상 공격 가능 인원",
  allowMultiCharacterPerPlayer: "다중 캐릭터 조작 허용",
  allowAsymmetricBattles: "비대칭 전투 허용",
};

function formatValue(key, value) {
  if (typeof value === "boolean") return value ? "허용" : "비허용";
  if (value === undefined || value === null || value === "") return "-";
  return value;
}

/** 최초 1회: 토글 버튼에 클릭 리스너를 걸어둡니다. (내용은 몇 번을 다시 그리든 안 사라짐) */
export function setupRoomSettingsPanel() {
  const toggle = document.getElementById("roomSettingsToggle");
  const panel = document.getElementById("roomSettingsPanel");
  const arrow = toggle?.querySelector(".room-settings-arrow");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    if (arrow) arrow.textContent = isOpen ? "▾" : "▴";
  });
}

/** roomState.settings가 바뀔 때마다(room:state 수신 시) 호출해서 내용만 갱신합니다. */
export function renderRoomSettingsPanel(settings, sheetConfig) {
  const panel = document.getElementById("roomSettingsPanel");
  if (!panel || !settings) return;

  const rows = Object.entries(SETTINGS_LABELS)
    .map(([key, label]) => {
      const value = formatValue(key, settings[key]);
      return `
        <div class="room-setting-row">
          <span class="room-setting-label">${escapeHtml(label)}</span>
          <span class="room-setting-value">${escapeHtml(value)}</span>
        </div>`;
    })
    .join("");

  const sheetRow = isSafeUrl(sheetConfig?.spreadsheetId)
  ? `
    <div class="room-setting-row">
      <span class="room-setting-label">수식 시트</span>
      <span class="room-setting-value">
        <a href="${escapeHtml(sheetConfig.spreadsheetId)}" target="_blank" rel="noopener">시트 열기</a>
        (${escapeHtml(sheetConfig.sheetName || "-")} 탭)
      </span>
    </div>`
  : `
    <div class="room-setting-row">
      <span class="room-setting-label">수식 시트</span>
      <span class="room-setting-value">아직 동기화 안 됨</span>
    </div>`;

  panel.innerHTML = rows + sheetRow;
}