// 정산 로직 입구&출구

const { Participant } = require("./resolver/participant.js");
const { UserDiceRoller } = require("./resolver/userDiceRoller.js");
const { HpCalculator } = require('./resolver/hpCalculator.js');
const {getGameData} = require("./resolver/gameData.js")


/**
 * 전달하면 전투 관련 계산해서 로그 전달해줌
 *
 * @param {Object} params
 * @param {Map} params.characters room.characters
 * @param {Map} params.vanguard characterId -> { skillName, targetIds, value }
 * @param {Map} params.rearguard characterId -> { skillName, targetIds, value }
 * @returns {Promise<Map>} id -> Calcs, "runResult" -> { selectedFaction, success, rollResult }
 */
async function resolveRound({ characters, vanguard, rearguard }) {

    // 스킬 수식 다 가져오기
    const { skillTable, criticalTable }  = await getGameData();

    // 캐릭터 객체 만들기
    const actionMap = new Map([...vanguard, ...rearguard]); // characterId -> action, 조회용

    let c_map = new Map();
    characters.forEach((c, cid) => {
        const c_act = actionMap.get(cid); // 행동을 선언했으면 그 액션, 안 했으면 undefined
        const source = vanguard.has(cid) ? "vanguard" : "rearguard";
        validCheck(characters, actionMap, cid, source);

        const skillType = c_act?.skillName ? skillTable[c_act.skillName]?.["types"] : "";
        const participant = new Participant(c, c_act, skillType);
        c_map.set(cid, participant);
    });

    // 판정값 계산하기
    const userDiceRoller = new UserDiceRoller(c_map);
    const runResult = await userDiceRoller.rollUserDices();
    
    // 체력 계산하기
    const hpCalculator = new HpCalculator(c_map);
    hpCalculator.calcReceived();
    hpCalculator.calculatingHp();

    // 다 계산한 후에 스킬 사용량 증가
    for (const [_, c] of c_map ){
        if(c.useSkill == c.skill) c.skillCount += 1;
    }

    // 리턴 생성하기
    const resultMap = new Map();

    for (const [id, c] of c_map) {
        resultMap.set(id, makeReturnObj(c, skillTable[c.skill]["uses"]));
    }

    resultMap.set("runResult", runResult);

    return resultMap;
}

/**
 * 객체 받아서 return할 수 있는 이벤트 만들어 돌려줌
 * @param {Participant} c 캐릭터 객체 하나 
 * @returns {Calcs}
 */
function makeReturnObj(c, skillMaxCnt){
    /**@type Info */
    const charInfo = {
        id: c.no,
        name: c.name,
        faction: c.faction,
        useSkill: c.useSkill  || "",
        corVal: c.corVal,
        targets: c.target  || [],
        skillLeft: skillMaxCnt - c.skillCount || 0,
    }

    /**@type DiceResult */
    const diceResult = {
        criticalMultiplier: c.result?.criticalMultiplier || 1,
        formula: c.result?.finalFormula || "",
        value: c.result?.finalValue || 0
    }

    /**@type HpResult */
    const hpResult = {
        formula: c.calcedHp.formula || "",
        value: c.calcedHp.value || 0,
        before: c.currentHp,
    }

    /**@type Calcs */
    const calcs = {
        info: charInfo,
        diceResult: diceResult,
        hpResult: hpResult,
    }

    return calcs
}

function validCheck(characters, actionMap, characterId, source){
    const c_act = actionMap.get(characterId);

    if(!c_act) return;

    const skillTargetMax = {
      엄호: 1, 수호: 2, 확산: 3, 침식: 1, 성호: 2, 환희: 1, 낙화: 1, 공격: 1, 방어: 1, 회복: 1, 도주: 10
    }

    if(c_act.targetIds.length > skillTargetMax[c_act.skillName]){
        c_act.targetIds = c_act.targetIds.slice(0, skillTargetMax[c_act.skillName]);
    }
    const character = characters.get(characterId);
    if ((character.skillCount >= character.skillMax) 
    || (c_act.skillName == "낙화" && source == "rearguard") 
    || (c_act.skillName == "도주" && source == "vanguard" ) ){
        c_act.skillName = "";
        c_act.targetIds = [];
    }

    
    const value = c_act.value;
    if(c_act.skillName == "침식" && (character.stats.hp <= value || value > 20) ) actionMap.value = Math.min(character.stats.hp, 20);

    if(c_act.skillName == "환희"){
      c_act.targetIds.forEach(targetId => {
        const target_skill = characters.get(targetId).skill;
        if (target_skill == "낙화" || target_skill == "환희"){
            c_act.skillName = "";
            c_act.targetIds = [];
        }
      });
    }
}

module.exports = { resolveRound };