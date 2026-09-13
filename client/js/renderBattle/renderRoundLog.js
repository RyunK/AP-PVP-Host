// roundLog(캐릭터별 판정/정산 결과 리스트)를 "판정 결과" / "체력 정산" 두 개의 표로
// #myCharacters 안에 그립니다. faction(진영) 값 기준으로 정렬해서 표시합니다.

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/** faction 값 기준으로 정렬된 복사본을 반환 (원본 배열은 건드리지 않음) */
function sortByFaction(roundLog) {
  return Object.values(roundLog).sort((a, b) => {
    const fa = a.info.faction ?? "";
    const fb = b.info.faction ?? "";
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
}

function buildRollTable(sortedLog, roomState) {
  const rows = sortedLog
    .map((c) => {
      c.info.targets = c.info.targets.map(id => {
          const character = roomState.characters.find(c => c.id === id);
          return character ? character.name : id;
      });
      const targets = (c.info.targets || []).join(", ");
      return `
        <tr>
          <td>${escapeHtml(c.info.name)}</td>
          <td>${escapeHtml(c.info.useSkill)}</td>
          <td>${escapeHtml(c.info.corVal)}</td>
          <td>${escapeHtml(targets)}</td>
          <td>${escapeHtml(c.diceResult.formula)}</td>
          <td>${escapeHtml(c.diceResult.value)}</td>
        </tr>`;
    })
    .join("");

  return `
    <h2>판정 결과</h2>
    <table class="round-log-table">
      <thead>
        <tr>
          <th>이름</th>
          <th>행동</th>
          <th>침식값</th>
          <th>대상</th>
          <th>계산식</th>
          <th>결과</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildHpTable(sortedLog) {
  const rows = sortedLog
    .map(
      (c) => `
        <tr>
          <td>${escapeHtml(c.info.name)}</td>
          <td>${escapeHtml(c.hpResult.before)}</td>
          <td>${escapeHtml(c.hpResult.formula)}</td>
          <td>${escapeHtml(c.hpResult.value)}</td>
        </tr>`
    )
    .join("");

  return `
    <h2>체력 정산</h2>
    <table class="round-log-table">
      <thead>
        <tr>
          <th>이름</th>
          <th>기존 체력</th>
          <th>계산식</th>
          <th>결과</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderRoundLog(roundLog, roomState) {
  const container = document.getElementById("myCharacters");
  const sortedLog = sortByFaction(roundLog);

  container.innerHTML = buildRollTable(sortedLog, roomState) + buildHpTable(sortedLog);
}