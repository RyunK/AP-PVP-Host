// 수식 데이터 읽어와서 적용

// const fs = require("fs/promises");
// const path = require("path");
// const RULE_PATH = path.join(__dirname, "..", "..", "..", "config", "gamedata.json");

const { loadGameData } = require("../formulaLoader");

let skillTable;
let criticalTable;

function getGameData(){
  if(!skillTable || !criticalTable){
    const data = loadGameData()
    skillTable = data["skillTable"];
    criticalTable = data["criticalTable"];
  }
  
  return {skillTable, criticalTable};
}

module.exports = {getGameData};