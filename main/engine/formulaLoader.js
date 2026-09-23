// 밸런스 시트에서 다이스 규칙 로드해서 저장. 읽는 건 resolver 내부에서 거의 다 알아서 함.
// loadGameData()는 쓰는 함수인지 모르겠음.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULT_PATH = path.join(
  app.getAppPath(),
  "config",
  "gamedata.json"
);

const CACHE_PATH = path.join(
  app.getPath("userData"),
  "config",
  "gamedata.json"
);

let cache = null;

function ensureConfigDir() {
  const dir = path.dirname(CACHE_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 최초 실행 시 기본 데이터를 userData로 복사
  if (!fs.existsSync(CACHE_PATH)) {
    fs.copyFileSync(DEFAULT_PATH, CACHE_PATH);
  }
}

function loadGameData() {
  if (cache) return cache;

  ensureConfigDir();

  cache = JSON.parse(
    fs.readFileSync(CACHE_PATH, "utf-8")
  );

  checkDataValidation(cache);

  return cache;
}

function saveGameData(newCache) {
  ensureConfigDir();

  cache = newCache;

  checkDataValidation(cache);

  fs.writeFileSync(
    CACHE_PATH,
    JSON.stringify(cache, null, 2),
    "utf-8"
  );

  return cache;
}

function reload() {
  cache = null;
  return loadGameData();
}


// 필수 스킬 이름 목록 (샘플 JSON 기준)
const REQUIRED_SKILLS = [
  "엄호", "수호", "확산", "침식", "성호",
  "환희", "낙화", "공격", "방어", "회복", "도주"
];

// 각 스킬 객체가 가져야 할 키 목록
const REQUIRED_SKILL_KEYS = [
  "uses", "types", "diceCount",
  "statBonus", "extraDiceCount", "extraDiceStat"
];

// criticalTable에 존재해야 하는 레벨(1~8)
const REQUIRED_CRITICAL_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// criticalTable 각 레벨 객체가 가져야 할 키 목록
const REQUIRED_CRITICAL_KEYS = ["chance", "multiplier"];

function checkDataValidation(cache) {
  // console.log("checking");

  if (!cache || typeof cache !== "object") {
    throw new Error("파일이 잘못되었습니다.");
  }

  const { skillTable, criticalTable } = cache;

  // 1. skillTable 검증
  if (!skillTable || typeof skillTable !== "object") {
    throw new Error("스킬 목록을 읽을 수 없습니다.");
  }

  for (const skillName of REQUIRED_SKILLS) {
    if (!(skillName in skillTable)) {
      throw new Error(`스킬목록에 "${skillName}"이(가) 없습니다.`);
    }

    const skill = skillTable[skillName];
    if (!skill || typeof skill !== "object" || Array.isArray(skill)) {
      throw new Error(`스킬목록에 "${skillName}"를(을) 찾을 수 없습니다.`);
    }

    for (const key of REQUIRED_SKILL_KEYS) {
      if (!(key in skill)) {
        throw new Error(`스킬목록의 "${skillName}"에 "${key}"가 없습니다.`);
      }
    }

    // uses는 숫자여야 함
    if (skill.uses !== null && (typeof skill.uses !== "number" || !Number.isFinite(skill.uses))) {
      throw new Error(
        `스킬목록의 "${skillName}" 횟수는 숫자거나 빈 칸이어야 합니다. (현재 값: ${skill.uses})`
      );
    }

    // types는 배열이어야 하며, 배열 내부는 모두 문자열이어야 함
    if (!Array.isArray(skill.types)) {
      throw new Error(`"${skillName}" 스킬의 유형 읽기에 실패했습니다.`);
    }
    for (const t of skill.types) {
      if (typeof t !== "string") {
        throw new Error(
          `"${skillName}" 스킬 유형의 값은 모두 문자열이어야 합니다.`
        );
      }
    }
  }

  // 2. criticalTable 검증
  if (!criticalTable || typeof criticalTable !== "object") {
    throw new Error("크리티컬 표 읽기에 실패했습니다.");
  }

  for (const level of REQUIRED_CRITICAL_LEVELS) {
    if (!(level in criticalTable)) {
      throw new Error(`크리티컬 표에 "${level}"이(가) 없습니다.`);
    }

    const entry = criticalTable[level];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`크리티컬 표에 "${level}"을(를) 찾을 수 없습니다.`);
    }

    for (const key of REQUIRED_CRITICAL_KEYS) {
      if (!(key in entry)) {
        throw new Error(`크리티컬 표의"${level}"에 "${key}"가 없습니다.`);
      }
      if (typeof entry[key] !== "number" || !Number.isFinite(entry[key])) {
        throw new Error(
          `크리티컬 표"${level}"의 값들은 숫자(실수)여야 합니다.`
        );
      }
    }
  }

  // console.log("모든 검증을 통과했습니다.");
  return true;
}


module.exports = {
  loadGameData,
  saveGameData,
  reload,
};