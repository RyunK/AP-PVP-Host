// 기존에 구글 시트 계산기로 만들어두었던 로직을 이 파일(및 이 폴더)로 마이그레이션합니다.
// 실제 전투 규칙이 정해지면 이 파일들을 규칙에 맞게 채워 넣으면 됩니다.
// 지금은 "파라미터 방식"과 "수식 문자열 방식"이 실제로 동작하는 걸 보여주는 예시입니다.

const { getParams, evalExpression } = require("./formulaLoader");

/** 방식 A 예시: 공식 구조는 코드에 고정, 배율만 시트에서 주입 */
function calcPhysicalDamageParamStyle({ atk, def, isCrit }) {
  const p = getParams();
  let dmg = Math.max(1, atk * p.atkMultiplier - def * p.defMultiplier);
  if (isCrit) dmg *= p.critMultiplier;
  return Math.round(dmg);
}

/** 방식 B 예시: 시트에 저장된 수식 문자열("physicalDamage")을 그대로 평가 */
function calcPhysicalDamageExpressionStyle({ atk, def }) {
  const dmg = evalExpression("physicalDamage", { atk, def });
  return Math.round(dmg);
}

function rollCrit() {
  const p = getParams();
  return Math.random() < p.critChance;
}

function calcHeal({ power }) {
  const dmg = evalExpression("healAmount", { power });
  return Math.round(dmg);
}

/** 캐릭터 하나의 액션을 계산해 결과 이벤트로 반환 (턴 처리 파이프라인에서 호출) */
function resolveAction({ actorStats, targetStats, action }) {
  if (action.type === "attack") {
    const isCrit = rollCrit();
    const damage = calcPhysicalDamageParamStyle({
      atk: actorStats.atk,
      def: targetStats.def,
      isCrit,
    });
    return { type: "damage", amount: damage, isCrit, targetId: action.targetId };
  }
  if (action.type === "heal") {
    const amount = calcHeal({ power: actorStats.power });
    return { type: "heal", amount, targetId: action.targetId };
  }
  return { type: "noop" };
}

module.exports = {
  calcPhysicalDamageParamStyle,
  calcPhysicalDamageExpressionStyle,
  calcHeal,
  resolveAction,
};
