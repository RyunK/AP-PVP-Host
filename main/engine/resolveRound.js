// const { executeSkill } = require("./skillHandlers");
const fs = require("fs/promises");
const path = require("path");
// const characterHandler = require("./resolver/participantHandler.js");
const { Participant } = require("./resolver/participant.js");

const RULE_PATH = path.join(__dirname, "..", "..", "config", "gamedata.json");
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
    const data = await fs.readFile(RULE_PATH, "utf-8");
    const obj = JSON.parse(data);
    const skillTable = obj["skillTable"];
    const criticalTable = obj["criticalTable"];
    // console.log(skillTable);
    // console.log(criticalTable);

    // 캐릭터 객체 만들기
    let c_map = new Map();
    vanguard.forEach((c_act, cid) => {
        const c = characters.get(cid);
        const skillType = skillTable[c_act.skillName]["types"];
        let participant = new Participant( c, c_act, skillType)
        c_map.set(cid, participant);
    });


    // 판정값 계산하기
    
    // 체력 계산하기

    return { events };
}


module.exports = { resolveRound };