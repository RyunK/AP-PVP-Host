// 정산 로직 입구&출구

const { Participant } = require("./resolver/participant.js");
const { UserDiceRoller } = require("./resolver/userDiceRoller.js");
const { HpCalculator } = require('./resolver/hpCalculator.js');
const {getGameData} = require("./resolver/gameData.js")


/**
 * 전달하면 전투 관련 계산해서 로그 전달해줌
 *
 * @param {Map} characters  room.characters (id -> character 객체, 여기서 직접 변경됨)
 * @param {Map} vanguard  [characterId -> {skillName, targetIds, value}, ...]
 * @param {Map} rearguard 위와 동일한 형태
 */
async function resolveRound({ characters, vanguard, rearguard }) {
    const events = [];    

    // 스킬 수식 다 가져오기
    const { skillTable, criticalTable }  = await getGameData();

    // 캐릭터 객체 만들기
    let c_map = new Map();
    [...vanguard, ...rearguard].forEach(([cid, c_act]) => {
        const c = characters.get(cid);
        const skillType = skillTable[c_act.skillName]["types"];
        let participant = new Participant( c, c_act, skillType)
        c_map.set(cid, participant);
    });

    // 판정값 계산하기
    const userDiceRoller = new UserDiceRoller(c_map);
    await userDiceRoller.rollUserDices();
    
    // 체력 계산하기
    const hpCalculator = new HpCalculator(c_map);
    hpCalculator.calcReceived();
    hpCalculator.calculatingHp();

    // 리턴 생성하기
    const resultMap = new Map();

    for (const [id, c] of c_map) {
        resultMap.set(id, makeReturnObj(c));
    }

    return resultMap;
}

/**
 * 객체 받아서 return할 수 있는 이벤트 만들어 돌려줌
 * @param {Participant} c 캐릭터 객체 하나 
 * @returns {Calcs}
 */
function makeReturnObj(c){
    /**@type Info */
    const charInfo = {
        id: c.no,
        name: c.name,
        faction: c.faction,
        useSkill: c.useSkill,
        corVal: c.corVal,
        targets: c.target
    }

    /**@type DiceResult */
    const diceResult = {
        criticalMultiplier: c.result.criticalMultiplier,
        formula: c.result.finalFormula,
        value: c.result.finalValue
    }

    /**@type HpResult */
    const hpResult = {
        formula: c.calcedHp.formula,
        value: c.calcedHp.value
    }

    /**@type Calcs */
    const calcs = {
        info: charInfo,
        diceResult: diceResult,
        hpResult: hpResult
    }

    return calcs
}

module.exports = { resolveRound };