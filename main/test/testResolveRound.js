const { resolveRound } = require("../engine/resolveRound");

async function main() {
    const result = await resolveRound({
        characters: new Map(),
        vanguard: new Map(),
        rearguard: new Map()
    });

    console.log(result);
}

main();