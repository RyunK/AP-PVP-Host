const { executeSkill } = require("./skillHandlers");

/**
 * 한 라운드(선공+후공)의 확정된 액션들을 순서대로 실행해 HP 등을 실제로 변경하고,
 * 화면에 보여줄 이벤트 로그를 만들어 반환합니다.
 *
 * @param {Map} characters  room.characters (id -> character 객체, 여기서 직접 변경됨)
 * @param {Array} vanguard  [[characterId, {skillName, targetIds, value}], ...]
 * @param {Array} rearguard 위와 동일한 형태
 */
function resolveRound({ characters, vanguard, rearguard }) {
  const events = [];

  // 선공 먼저, 그다음 후공. 각 페이즈 안에서는 그냥 확정된 순서대로 처리합니다.
  // (동시 판정이 필요하면 여기서 정렬 기준을 추가하면 됩니다 - 예: 민첩 높은 순)
  for (const [actorId, action] of [...vanguard, ...rearguard]) {
    const actor = characters.get(actorId);
    if (!actor || !actor.alive) continue; // 이미 죽었으면 행동 무효

    const result = executeSkill({ characters, actorId: actor, action });
    events.push(...result.events);
  }

  return { events };
}

module.exports = { resolveRound };