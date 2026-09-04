// 비개발자 배포를 고려해, 기본적으로는 Google Cloud 서비스 계정/API 키 발급 없이
// 동작하는 "공개 CSV 내보내기" 방식을 사용합니다.
//
//   1) 구글 시트에서 [공유] → "링크가 있는 모든 사용자에게 보기 권한" 설정
//   2) 관리자 UI에 시트 URL만 붙여넣으면 동기화 가능
//
// 시트의 특정 탭(예: "Formulas")에 아래와 같은 3열 형식을 권장합니다:
//
//   key              | type       | value
//   atkMultiplier    | param      | 1.5
//   defMultiplier    | param      | 0.8
//   physicalDamage   | expression | max(1, atk*atkMultiplier - def*defMultiplier)
//
// 비공개 시트를 꼭 써야 한다면(사내용 등) googleapis + 서비스 계정 키를 쓰는
// syncFromSheetPrivate()를 대신 사용하세요 (하단 참고, 기본 UI에는 노출하지 않음).

const { saveFormulas } = require("./formulaLoader");

function extractSpreadsheetId(urlOrId) {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

function buildCsvExportUrl(spreadsheetId, sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) =>
      // 아주 단순한 CSV 파서: 큰따옴표로 감싸진 값의 콤마는 보존
      line
        .match(/(".*?"|[^",]+)(?=,|$)/g)
        .map((cell) => cell.replace(/^"|"$/g, "").trim())
    );
}

/**
 * @param {{ spreadsheetId: string, sheetName?: string }} sheetConfig
 *   spreadsheetId 자리에 전체 시트 URL을 넣어도 자동으로 ID만 추출합니다.
 */
async function syncFromSheet(sheetConfig) {
  const id = extractSpreadsheetId(sheetConfig.spreadsheetId);
  const url = buildCsvExportUrl(id, sheetConfig.sheetName || "Formulas");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `시트를 불러오지 못했습니다 (HTTP ${res.status}). 시트 공유 설정이 ` +
        `"링크가 있는 모든 사용자 - 뷰어"로 되어 있는지 확인해주세요.`
    );
  }
  const csvText = await res.text();
  const rows = parseCsv(csvText);

  const header = rows[0].map((h) => h.toLowerCase());
  const keyIdx = header.indexOf("key");
  const typeIdx = header.indexOf("type");
  const valueIdx = header.indexOf("value");

  // if (keyIdx === -1 || typeIdx === -1 || valueIdx === -1) {
  //   throw new Error('시트 헤더에 "key", "type", "value" 열이 모두 있어야 합니다.');
  // }

  const params = {};
  const expressions = {};

  for (const row of rows.slice(1)) {
    const key = row[keyIdx];
    const type = row[typeIdx];
    const value = row[valueIdx];
    if (!key || !type) continue;

    if (type === "param") {
      const num = Number(value);
      params[key] = Number.isNaN(num) ? value : num;
    } else if (type === "expression") {
      expressions[key] = value;
    }
  }

  const saved = saveFormulas({ params, expressions });
  return { paramCount: Object.keys(params).length, expressionCount: Object.keys(expressions).length, snapshot: saved };
}


module.exports = { syncFromSheet, syncFromSheetPrivate, extractSpreadsheetId };
