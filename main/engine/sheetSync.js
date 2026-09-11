const { saveGameData } = require("./formulaLoader");

const SKILL_RANGE = "A1:G12";
const CRITICAL_RANGE = "A16:C23";
s
function extractSpreadsheetId(urlOrId) {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

function buildCsvExportUrl(spreadsheetId, sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}

/**
 * 따옴표(멀티라인 셀 포함)를 제대로 처리하는 CSV 파서.
 * 줄 단위로 먼저 자르지 않고 문자 단위로 읽어서, 따옴표 안의 줄바꿈을
 * 새 행으로 착각하지 않습니다.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // 이스케이프된 큰따옴표
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // 무시 (CRLF의 \r)
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function colLetterToIndex(letters) {
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1; // 0-based
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

/** 전체 시트 CSV(rows)에서 A1 표기 범위(예: "E1:K12")만 잘라냅니다. */
function extractRange(rows, range) {
  const { startRow, endRow, startCol, endCol } = parseA1Range(range);
  const sliced = [];
  for (let r = startRow; r <= endRow; r++) {
    const sourceRow = rows[r] || [];
    const cols = [];
    for (let c = startCol; c <= endCol; c++) cols.push(sourceRow[c] ?? "");
    sliced.push(cols);
  }
  return sliced;
}

/**
 * 스킬표 파싱 
 * 열 순서: [이름, 횟수, 유형, [다이스], 추가/고정, 추가주사위 개수, 추가주사위 눈 수]
 */
function parseSkillTable(rows) {
  const result = {};

  rows.forEach((row) => {
    if (!row[0]) return; // 이름이 없는 행(헤더 포함)은 건너뜀 — 원본과 동일한 방식

    result[row[0]] = {
      uses: row[1] ? Number(row[1]) : null, // 횟수: 비어있으면 무제한(null)
      types: row[2] ? row[2].split(",").map((t) => t.trim()) : [], // 유형: 콤마로 여러 개 가능
      diceCount: Number(row[3]) || row[3], // [다이스]
      statBonus: Number(row[4]) || row[3], // 추가/고정 (스탯명 또는 "체력*2" 같은 수식)
      extraDiceCount: Number(row[5]) || row[5], // 추가주사위 개수
      extraDiceStat: Number(row[6]) || row[6], // 추가주사위 눈 수 (기준이 되는 스탯명)
    };
  });

  return result;
}

/** 크리티컬표 파싱  */
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
 * @param {{ spreadsheetId: string, sheetName?: string }} sheetConfig
 *   spreadsheetId 자리에 전체 시트 URL을 넣어도 자동으로 ID만 추출합니다.
 *   sheetName은 원본과 동일하게 기본값 "data" 탭을 씁니다.
 */
async function syncFromSheet(sheetConfig) {
  const id = extractSpreadsheetId(sheetConfig.spreadsheetId);
  const url = buildCsvExportUrl(id, sheetConfig.sheetName || "data");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `시트를 불러오지 못했습니다 (HTTP ${res.status}). 시트 공유 설정이 ` +
        `"링크가 있는 모든 사용자 - 뷰어"로 되어 있는지, 탭 이름이 맞는지 확인해주세요.`
    );
  }

  const csvText = await res.text();
  const allRows = parseCsv(csvText);

  const skillTable = parseSkillTable(extractRange(allRows, SKILL_RANGE));
  const criticalTable = parseCriticalTable(extractRange(allRows, CRITICAL_RANGE));

  const saved = saveGameData({ skillTable, criticalTable });

  return {
    skillCount: Object.keys(skillTable).length,
    criticalCount: Object.keys(criticalTable).length,
    snapshot: saved,
  };
}

module.exports = { syncFromSheet, extractSpreadsheetId, parseSkillTable, parseCriticalTable };