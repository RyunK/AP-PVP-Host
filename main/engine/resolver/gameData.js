const fs = require("fs/promises");
const path = require("path");
const RULE_PATH = path.join(__dirname, "..", "..", "..", "config", "gamedata.json");

let skillTable;
let criticalTable;

async function getGameData(){
  if(!skillTable || !criticalTable){
    const data = await fs.readFile(RULE_PATH, "utf-8");
    const obj = JSON.parse(data);
    skillTable = obj["skillTable"];
    criticalTable = obj["criticalTable"];
  }
  
  return {skillTable, criticalTable};
}

module.exports = {getGameData};