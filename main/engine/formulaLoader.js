// "수식이 변경 가능하다"를 두 가지 레벨로 지원합니다.
//
//  A) 파라미터 방식(권장/기본): 공식의 "형태"는 damageCalc.js 등 JS 코드로 고정하고,
//     배율/계수 같은 숫자만 시트에서 가져와 주입합니다. 안전하고 디버깅이 쉽습니다.
//
//  B) 수식 문자열 방식: 시트 셀에 "atk * 1.5 - def * 0.8" 같은 수식 자체를 문자열로
//     저장해두고, mathjs로 런타임에 파싱/평가합니다. 기획자가 공식의 구조 자체를
//     자유롭게 바꾸고 싶을 때 사용합니다.
//
// 실제 API를 매 턴 호출하지 않고, syncFromSheet()로 한 번 받아온 결과를
// config/formulas.json에 스냅샷으로 저장한 뒤, 전투 중에는 이 캐시만 읽습니다.

const fs = require("fs");
const path = require("path");
const { evaluate } = require("mathjs");

const CACHE_PATH = path.join(__dirname, "..", "..", "config", "formulas.json");

let cache = null;

function ensureConfigDir() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadFormulas() {
  if (cache) return cache;
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } else {
    // 시트 동기화 전 기본값 (개발/테스트용)
    cache = {
      params: {
        atkMultiplier: 1.5,
        defMultiplier: 0.8,
        critChance: 0.15,
        critMultiplier: 1.5,
      },
      // key: 수식 이름, value: mathjs 수식 문자열
      expressions: {
        physicalDamage: "max(1, atk * atkMultiplier - def * defMultiplier)",
        healAmount: "power * 1.2",
      },
    };
  }
  return cache;
}

function saveFormulas(newCache) {
  ensureConfigDir();
  cache = newCache;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  return cache;
}

function reload() {
  cache = null;
  return loadFormulas();
}

/** 방식 A: JS 함수가 파라미터만 캐시에서 가져다 쓰는 형태 */
function getParams() {
  return loadFormulas().params;
}

/** 방식 B: 이름으로 등록된 수식 문자열을 변수와 함께 평가 */
function evalExpression(name, scope) {
  const formulas = loadFormulas();
  const expr = formulas.expressions[name];
  if (!expr) {
    throw new Error(`정의되지 않은 수식입니다: ${name}`);
  }
  try {
    return evaluate(expr, { ...formulas.params, ...scope });
  } catch (err) {
    throw new Error(`수식 평가 실패 [${name}]: "${expr}" - ${err.message}`);
  }
}

module.exports = { loadFormulas, saveFormulas, reload, getParams, evalExpression };
