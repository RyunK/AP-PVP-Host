// 구글 시트("data" 탭)에서 동기화한 스킬표/크리티컬표를 로컬에 캐싱하고 읽어오는 모듈입니다.
// 원본 Apps Script GameData 클래스가 하던 역할(생성자에서 시트를 읽어 this.skillTable /
// this.criticalTable로 들고 있던 것)을, "동기화 시 파일로 저장 → 전투 중엔 파일만 읽기"
// 구조로 바꾼 버전입니다. 매 턴 시트 API를 호출하지 않아 지연/쿼터 걱정이 없습니다.

const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", "..", "config", "gamedata.json");

let cache = null;

function ensureConfigDir() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadGameData() {
  if (cache) return cache;

  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } else {
    // 시트 동기화 전 기본값 (개발/테스트용) — 예시로 몇 개만 채워둠
    cache = {
      skillTable: {
        공격: { uses: null, types: ["공격"], diceCount: 3, statBonus: "", extraDiceCount: 0, extraDiceStat: "" },
        방어: { uses: null, types: ["방어"], diceCount: 2, statBonus: "", extraDiceCount: 0, extraDiceStat: "" },
      },
      criticalTable: {
        1: { chance: 10, multiplier: 1.1 },
        2: { chance: 18, multiplier: 1.2 },
      },
    };
  }
  return cache;
}

function saveGameData(newCache) {
  ensureConfigDir();
  cache = newCache;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  return cache;
}

function reload() {
  cache = null;
  return loadGameData();
}

/** 스킬 이름으로 스킬 데이터 조회 (엄호, 수호, 확산 ... 공격/방어/회복/도주 포함) */
function getSkill(name) {
  return loadGameData().skillTable[name] || null;
}

/** 민첩/행운 등으로 환산된 "치명 스탯 등급"으로 확률/배율 조회 */
function getCriticalStat(statLevel) {
  return loadGameData().criticalTable[statLevel] || null;
}

module.exports = {
  loadGameData,
  saveGameData,
  reload,
  getSkill,
  getCriticalStat,
};