const fs = require("fs/promises");
const path = require("path");
const RULE_PATH = path.join(__dirname, "..", "..", "..", "config", "gamedata.json");

async function getGameData(){
  const data = await fs.readFile(RULE_PATH, "utf-8");
  const obj = JSON.parse(data);
  const skillTable = obj["skillTable"];
  const criticalTable = obj["criticalTable"];

  return {skillTable, criticalTable};
}

module.exports = {getGameData};