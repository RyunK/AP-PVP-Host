// 시트 읽어서 json 파일로 저장

const { saveGameData } = require("./formulaLoader");

const SKILL_RANGE = "A1:G12";
const CRITICAL_RANGE = "A14:C23";

function extractSpreadsheetId(urlOrId) {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

/**
 * Sheets API v4의 batchGet으로 두 범위를 한 번에 가져옵니다.
 * valueRenderOption=FORMATTED_VALUE는 "화면에 보이는 그대로"의 값을
 * 반환하며, gviz와 달리 열 단위 타입 추론이 없어서 같은 열에
 * 숫자와 텍스트가 섞여 있어도 셀 값이 날아가지 않습니다.
 * 시트 이름을 range에 직접 쓸 수 있어 gid 조회가 필요 없습니다.
 */
function buildBatchGetUrl(spreadsheetId, sheetName, ranges, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    valueRenderOption: "FORMATTED_VALUE",
    majorDimension: "ROWS",
  });
  ranges.forEach((r) => params.append("ranges", `${sheetName}!${r}`));

  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params.toString()}`;
}

/**
 * Sheets API는 각 행의 마지막에 있는 빈 셀들을 잘라내서 반환하므로,
 * (예: 실제로는 7열인데 뒤쪽이 비어있으면 3개만 옴) targetCols 길이만큼
 * 빈 문자열로 채워 인덱스가 항상 일정하게 맞도록 만듭니다.
 */
function padRows(values, targetCols) {
  return (values || []).map((row) => {
    const padded = row.slice(0, targetCols);
    while (padded.length < targetCols) padded.push("");
    return padded.map((v) => (v == null ? "" : String(v)));
  });
}

function colLetterToIndex(letters) {
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

function parseA1Range(range) {
  const [startRef, endRef] = range.split(":");
  const [, startCol, startRow] = startRef.match(/([A-Z]+)(\d+)/);
  const [, endCol, endRow] = endRef.match(/([A-Z]+)(\d+)/);
  return {
    startCol: colLetterToIndex(startCol),
    endCol: colLetterToIndex(endCol),
    startRow: Number(startRow) - 1,
    endRow: Number(endRow) - 1,
  };
}

function colCount(range) {
  const { startCol, endCol } = parseA1Range(range);
  return endCol - startCol + 1;
}

function parseSkillTable(rows) {
  const result = {};

  rows.forEach((row) => {
    if (!row[0]) return;

    result[row[0]] = {
      uses: row[1] ? Number(row[1]) : null,
      types: row[2] ? row[2].split(",").map((t) => t.trim()) : [],
      diceCount: Number(row[3]) || row[3],
      statBonus: Number(row[4]) || row[4],
      extraDiceCount: Number(row[5]) || row[5],
      extraDiceStat: Number(row[6]) || row[6],
    };
  });

  return result;
}

function parseCriticalTable(rows) {
  const result = {};

  rows.slice(1).forEach((row) => {
    if (!row[0]) return;
    result[row[0]] = {
      chance: Number(row[1]),
      multiplier: Number(row[2]),
    };
  });

  return result;
}

/**
 * @param {{ spreadsheetId: string, sheetName?: string, apiKey: string }} sheetConfig
 *   spreadsheetId 자리에 전체 시트 URL을 넣어도 자동으로 ID만 추출합니다.
 *   apiKey는 Google Cloud Console에서 발급한 Sheets API 키입니다.
 */
async function syncFromSheet(sheetConfig) {
  if (!sheetConfig.apiKey) {
    throw new Error(
      "apiKey가 필요합니다. Google Cloud Console에서 Sheets API를 사용 설정하고 API 키를 발급받아 전달해주세요."
    );
  }

  const id = extractSpreadsheetId(sheetConfig.spreadsheetId);
  const sheetName = sheetConfig.sheetName || "data";

  const url = buildBatchGetUrl(id, sheetName, [SKILL_RANGE, CRITICAL_RANGE], sheetConfig.apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `시트를 불러오지 못했습니다 (HTTP ${res.status}). 시트 공유 설정("링크가 있는 모든 사용자 - 뷰어"), ` +
        `탭 이름, API 키가 유효한지 확인해주세요. ${body}`
    );
  }

  const data = await res.json();
  const [skillRangeResult, criticalRangeResult] = data.valueRanges || [];

  const skillRows = padRows(skillRangeResult?.values, colCount(SKILL_RANGE));
  const criticalRows = padRows(criticalRangeResult?.values, colCount(CRITICAL_RANGE));

  const skillTable = parseSkillTable(skillRows);
  const criticalTable = parseCriticalTable(criticalRows);

  const saved = saveGameData({ skillTable, criticalTable });

  return {
    skillCount: Object.keys(skillTable).length,
    criticalCount: Object.keys(criticalTable).length,
    snapshot: saved,
  };
}

module.exports = { syncFromSheet, extractSpreadsheetId, parseSkillTable, parseCriticalTable };