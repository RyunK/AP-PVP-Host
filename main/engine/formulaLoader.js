// 밸런스 시트에서 다이스 규칙 로드해서 저장. 읽는 건 resolver 내부에서 거의 다 알아서 함.
// loadGameData()는 쓰는 함수인지 모르겠음.

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
    throw new Error("설정 정보를 찾을 수 없습니다.");
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


module.exports = {
  loadGameData,
  saveGameData,
  reload,
};