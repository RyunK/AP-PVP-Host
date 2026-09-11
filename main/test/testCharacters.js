const { resolveRound } = require("../engine/resolveRound");

let characters = new Map();
let vanguard = new Map();
let rearguard = new Map();

const def1 = {
    name: "abc",
    position: "아이기스",
    skill : "엄호",
    hp: 100,
    hp_stat: 3,
    power: 2,
    dex: 1,
    mnd: 4,
    luck: 5,
}

const def2 = {
    name: "def",
    position: "드레파논",
    skill : "침식",
    hp: 100,
    hp_stat: 2,
    power: 3,
    dex: 4,
    mnd: 5,
    luck: 1,
}

function addCharacter(charId, playerId, def, team){
    characters.set(charId, {
        id: charId,
        ownerId: playerId,
        name: def.name || `캐릭터${idx + 1}`,
        position: def.position || "아이기스",
        skill: def.skill  || "엄호",
        skillCount : 0,
        stats: {
          hp: def.hp || 1,
          hp_stat: def.hp_stat || 0,
          power: def.power || 1,
          dex: def.dex || 1,
          mnd: def.mnd || 1,
          luck: def.luck || 1,
        },
        team: team,
        alive: true,
      });
}

function makeCharacterMap(){
    addCharacter("cid_abc", "pid_abc", def1, "A");
    addCharacter("cid_def", "pid_def", def2, "B");
}

function makeActionMap(){
    vanguard.set("cid_abc", { skillName: "엄호", targetIds: ["cid_abc"], value:0 });
    rearguard.set("cid_def", { skillName: "침식", targetIds: ["cid_abc"], value:15 });
}


async function main(){
    makeCharacterMap();
    makeActionMap();
    await resolveRound({characters, vanguard, rearguard});
}

main();