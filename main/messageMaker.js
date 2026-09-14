
/**
 * 정산 메시지 생성해줌
 * @param {Object} roundLog 
 * @returns 
 */
function calcMessage(roundLog) {
    const damageA = [];
    const damageB = [];

    const remainHpA = [];
    const remainHpB = [];

    for (const c of Object.values(roundLog)) {
        // console.log(c.info.name);
        if(!c || !c.info) continue;
        if (c.info.faction == "A") {
            damageA.push(`${c.info.name}:  ${c.diceResult.value}`);
            remainHpA.push(`${c.info.name}:   ${c.hpResult.value}`);
        } else {
            damageB.push(`${c.info.name}:  ${c.diceResult.value}`);
            remainHpB.push(`${c.info.name}:  ${c.hpResult.value}`);
        }
    }

    const damageSection =
        `[판정값]\n` +
        `${damageA.join('\n')}\n\n` +
        `${damageB.join('\n')}`;

    const remainHpSection =
        `[남은 체력]\n` +
        `${remainHpA.join('\n')}\n\n` +
        `${remainHpB.join('\n')}`;

    return `${damageSection}\n\n\n${remainHpSection}`;
}

/**
 * 페이즈 전환 등의 처리를 모두 한 뒤 호출할 것.
 * 자동 진행에 따른 메시지를 반환함.
 * @param {*} room 
 * @param {*} expectedPhase 타임아웃 걸기 시작했던 페이즈
 * @returns 
 */
function autoPhaseForwarding(room, expectedPhase){
    const firstTeam = room.turn.firstTeam;
    const secondTeam = firstTeam == "A" ? "B" : "A";
    const teamNames = room.teamNames;
    switch(expectedPhase){
        case "vanguard":
            return ["시간 종료. 후공 페이즈 개시.", `${teamNames[secondTeam]} 선언.`];
        case "rearguard":
            const resolutionMessage = calcMessage(room.battleLogs[room.turn.round -1]);
            return ["시간 종료. 정산 페이즈 개시.", "정산 완료.\n" + resolutionMessage];
        case "resolution":
            return [`정산 확인 완료. 라운드 ${room.turn.round}. ${teamNames[firstTeam]}의 선공.`, 
                `선공 페이즈 개시. ${teamNames[firstTeam]} 선언.` ];
        case "orderCheck":
            return [
                "...SYSTEM INITIALIZATION COMPLETE. 초기 순서 확인 완료.",
                "전투 시작.",
                `선공 페이즈 개시. ${teamNames[firstTeam]} 선언.`
            ]
    }   
}

module.exports = { calcMessage, autoPhaseForwarding }
