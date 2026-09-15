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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function init(params = {}) {
  const summary = params.summary || {};

  renderWinnerLine(summary);
  renderStatsTable(summary);
  attachSummaryHandlers(summary);
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
  el.innerHTML = `<h2 class="summary-winner">${escapeHtml(winnerName)} 승리!</h2>`;
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
        ${row("전체 다이스 합계", "diceTotal")}
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