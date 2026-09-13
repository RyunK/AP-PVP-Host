
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

module.exports = { calcMessage }
