// 전투 종료 후 정산 화면. router.js가 renderScreen("summary", { summary })로
// 진입시킬 때 params.summary를 받아 그립니다.
//
// summary 예상 형태 (서버가 나중에 채워줄 값):
// {
//   winnerTeam: "A" | "B" | "draw",
//   teamNames: { A: "...", B: "..." },
//   stats: {
//     A: { survivorCount: 0, survivorHpTotal: 0, diceTotal: 0 },
//     B: { survivorCount: 0, survivorHpTotal: 0, diceTotal: 0 },
//   },
// }
import { socket } from "../js/socket.js";
import { loadIdentity } from "../js/state.js";
import { renderScreen } from "../js/router.js";
import { mountChat, updateChatCharacterOptions } from "../js/chat.js";
import { renderPlayerList, escapeHtml, renderReadyBadge } from "../js/playerList.js";
import { getMyPlayerId } from "../js/state.js";
import { getMyCharacters, getMyPlayerName } from "../js/roomHelpers.js";

import { exportBattleLog } from "../js/exportBattleLogs.js"

const myPlayerId = getMyPlayerId();
let roomState = null;


export function init(params = {}) {
  
  // const summary = params.summary || {};
  // const state = params.state || {};
  // roomState = state;

  socket.off("room:state", onRoomState);
  socket.on("room:state", onRoomState);


  socket.emit("room:get-state", {}, (res) => {
      if (res.ok){
        const state = res.state || {};
        roomState = state;
        const summary = state.battleResult;

        renderRunResult(summary);
        renderWinnerLine(summary);
        renderStatsTable(summary);
        attachSummaryHandlers(summary);
        mountChat(document.getElementById("chatContainer"), getMyCharacters(), state.chat || []);
        updateChatCharacterOptions(getMyCharacters(roomState, myPlayerId), getMyPlayerName(roomState, myPlayerId));  
        renderPlayerList(document.getElementById("playerListContainer"), state.players, state.phase);
        showMyInfo(myPlayerId, getMyPlayerName(roomState, myPlayerId));
        renderRoster();

        setupRestartButton(); 
        attachEventListeners();
      } 
    });
}

function onRoomState(state) {
  roomState = state;
  if (state.phase === "lobby" && state.restarted) {
    renderScreen("lobby"); // 호스트가 재시작했으니 자동으로 따라감
  }
}

function setupRestartButton() {
  const identity = loadIdentity(); 
  const me = roomState?.players?.find((p) => p.id === identity?.playerId);

  const wrap = document.getElementById("restartWrap");
  if (!me?.isHost) {
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "block";
  document.getElementById("restartBtn").addEventListener("click", () => {
    socket.emit("room:restart", {}, (res) => {
      if (!res.ok) return alert(res.error);
      renderScreen("lobby");
    });
  });
}

function renderRunResult(summary){
  const el = document.getElementById("runResult");
  if(summary.runSuccess){
    const runFaction = summary.winnerTeam == "A" ? "B" : "A";
    const teamNames = summary.teamNames || {};

    el.innerHTML = `<p class="">${teamNames[runFaction]}이 도주했습니다...</p>`
  } else el.innerHTML = "";
}

function renderWinnerLine(summary) {
  const el = document.getElementById("summaryWinner");
  const teamNames = summary.teamNames || {};

  if (!summary.winnerTeam) {
    el.innerHTML = "";
    return;
  }
  if (summary.winnerTeam === "draw") {
    el.innerHTML = `<h2 class="summary-winner">무승부</h2>`;
    return;
  }

  const winnerName = teamNames[summary.winnerTeam] || `${summary.winnerTeam}팀`;
  el.innerHTML = `<h2 class="summary-winner">${escapeHtml(winnerName)} 승리</h2>`;
}

function renderStatsTable(summary) {
  const el = document.getElementById("summaryTable");
  const teamNames = summary.teamNames || {};
  const teamAName = teamNames.A || "A팀";
  const teamBName = teamNames.B || "B팀";
  const statsA = summary.stats?.A || {};
  const statsB = summary.stats?.B || {};

  const row = (label, key) => `
    <tr>
      <td class="summary-row-label">${escapeHtml(label)}</td>
      <td>${escapeHtml(statsA[key] ?? "-")}</td>
      <td>${escapeHtml(statsB[key] ?? "-")}</td>
    </tr>`;

  el.innerHTML = `
    <table class="summary-table">
      <thead>
        <tr>
          <th></th>
          <th>${escapeHtml(teamAName)}</th>
          <th>${escapeHtml(teamBName)}</th>
        </tr>
      </thead>
      <tbody>
        ${row("생존자 수", "survivorCount")}
        ${row("생존자 체력 합계", "survivorHpTotal")}
        ${row("전체 판정값 합계", "diceTotal")}
      </tbody>
    </table>`;
}

function attachSummaryHandlers(summary) {
  // TODO: 실제 저장 로직 (Blob + 다운로드 등)은 로그 데이터 형태가 정해지면 채웁니다.
  document.getElementById("saveBattleLogBtn")?.addEventListener("click", () => {
    console.log("TODO: 전투 경과 저장", summary);
  });
  document.getElementById("saveChatLogBtn")?.addEventListener("click", () => {
    console.log("TODO: 전체 채팅 저장");
  });
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

function renderRoster() {
  const container = document.getElementById("final-status");
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
            <td>${c.stats.power}</td>
            <td>${c.stats.dex}</td>
            <td>${c.stats.mnd}</td>
            <td>${c.stats.luck}</td>
            <td>${c.skillMax - c.skillCount}</td>
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
            <th>이능력</th>
            <th>민첩</th>
            <th>정신력</th>
            <th>행운</th>
            <th>남은 스킬</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  container.innerHTML = "<h2>최종 상태</h2>" + renderTeamTable("A", teamAName) + renderTeamTable("B", teamBName);
}

function saveChatLogAsHtml() {
  const chatLogEl = document.getElementById("chatLog"); // 채팅 내역이 담긴 요소
  if (!chatLogEl) return;

  // 지금 페이지에 적용된 CSS를 그대로 긁어와서 같이 저장 (색상/배지 등 유지)
  const styles = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        return ""; // 외부(CDN) 스타일시트는 보안 정책상 못 읽어올 수 있음, 그런 건 건너뜀
      }
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>채팅 로그</title>
  <style>${styles}</style>
</head>
<body style="background:#14171c; padding:20px;">
  ${chatLogEl.outerHTML}
</body>
</html>`;

  downloadFile(html, `채팅로그_${formatDate()}.html`, "text/html");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url); // 메모리 정리
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function attachEventListeners(){
  document.getElementById("saveChatLogBtn")?.addEventListener("click", () => {
    saveChatLogAsHtml();
  });
  document.getElementById("saveBattleLogBtn")?.addEventListener("click", () => {
    exportBattleLog(roomState); // roomState는 이 화면이 접근 가능한 최신 상태여야 함
  });
  document.getElementById("restartBtn")?.addEventListener("click", () => {
    socket.emit("room:restart", {}, (res) => {
      if (!res.ok) return alert(res.error);
      renderScreen("lobby"); // 초기화된 방의 로비로 이동
    });
  });
}