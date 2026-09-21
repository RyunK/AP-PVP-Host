// roomState.battleLogs(라운드별 캐릭터 판정/정산 기록)와 roomState.battleResult(최종 결과)를
// 사람이 읽기 좋은 텍스트로 정리해서 파일로 저장합니다.

/** 마지막 라운드 기준으로 거꾸로 계산해, 특정 라운드의 선공팀을 구합니다. */
function getFirstTeamOfRound(roundNumber, finalRound, finalFirstTeam) {
  const diff = finalRound - roundNumber;
  const flipped = diff % 2 === 1;
  if (!flipped) return finalFirstTeam;
  return finalFirstTeam === "A" ? "B" : "A";
}

function buildRoundSection(roundLog, roundNumber, firstTeam, teamNames) {
  const entries = Object.values(roundLog); // cid는 키일 뿐이라 값만 사용
  const lines = [];
  const cid2Name = new Map(entries.map(o => [o.info.id, o.info.name]));

  lines.push(`===== ${roundNumber}라운드 (선공: ${teamNames[firstTeam]}) =====`);
  lines.push("");

  lines.push("[판정 결과]");
  for (const c of entries) {
    if(!c.info) continue;
    const targets = (c.info?.targets || []).map(id => cid2Name.get(id) || id).join(", ") || "-";
    lines.push(
      `- ${c.info.name} (${teamNames[c.info.faction]}) | 스킬: ${c.info.useSkill || "-"}` +
        (c.info.corVal ? ` | 침식값: ${c.info.corVal}` : "") +
        ` | 대상: ${targets}`
    );
    lines.push(`    판정식: ${c.diceResult.formula || "-"} = ${c.diceResult.value}`);
  }
  lines.push("");

  lines.push("[체력 정산]");
  for (const c of entries) {
    if(!c.info) continue;
    lines.push(
      `- ${c.info.name} (${teamNames[c.info.faction]}) | ${c.hpResult.formula || "-"} = ${c.hpResult.value}`
    );
  }
  lines.push("");

  if(roundLog.runResult){
    lines.push("[도주 결과]")
      Object.entries(roundLog.runResult.rollResults).forEach(([key, value]) => {

        lines.push(` - ${teamNames[key]} : ${key == roundLog.runResult.triedFaction? "시도" : "저지"}`);
        lines.push(`    판정식: ${value.formula} = ${value.total}`)
      })
    lines.push(`도주 ${roundLog.runResult.success? "성공" : "실패"}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildResultSection(battleResult, fallbackTeamNames) {
  const lines = [];
  const teamNames = battleResult.teamNames || fallbackTeamNames || {};
  const teamAName = teamNames.A || "A팀";
  const teamBName = teamNames.B || "B팀";

  lines.push("===== 전투 결과 =====");
  lines.push("");

  if(battleResult.runSuccess){
    const runTeam = battleResult.winnerTeam == "A" ? "B" : "A"
    lines.push(`${teamNames[runTeam]}의 도주 성공.`)
  }
  if (!battleResult.winnerTeam) {
    // 결과 없음 - 아무것도 안 씀
  } else if (battleResult.winnerTeam === "draw") {
    lines.push("결과: 무승부");
  } else {
    const winnerName = teamNames[battleResult.winnerTeam] || `${battleResult.winnerTeam}팀`;
    lines.push(`결과: ${winnerName} 승리`);
  }
  lines.push("");

  const statsA = battleResult.stats?.A || {};
  const statsB = battleResult.stats?.B || {};
  const row = (label, key) => `${label} - ${teamAName}: ${statsA[key] ?? "-"} | ${teamBName}: ${statsB[key] ?? "-"}`;

  lines.push(row("생존자 수", "survivorCount"));
  lines.push(row("생존자 체력 합계", "survivorHpTotal"));
  lines.push(row("전체 판정값 합계", "diceTotal"));

  return lines.join("\n");
}

function buildBattleLogText(roomState) {
  const finalRound = roomState.turn.round;
  const finalFirstTeam = roomState.turn.firstTeam;

  const sections = roomState.battleLogs.map((roundLog, idx) => {
    const roundNumber = idx + 1;
    const firstTeam = getFirstTeamOfRound(roundNumber, finalRound, finalFirstTeam);
    return buildRoundSection(roundLog, roundNumber, firstTeam, roomState.teamNames);
  });

  sections.push(buildResultSection(roomState.battleResult || {}, roomState.teamNames));

  return sections.join("\n");
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function formatDateForFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportBattleLog(roomState) {
  const text = buildBattleLogText(roomState);
  downloadTextFile(text, `전투기록_${formatDateForFilename()}.txt`);
}