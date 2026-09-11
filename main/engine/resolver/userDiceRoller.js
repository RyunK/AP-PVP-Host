const { getGameData } = require("./gameData.js")
const { DiceRoller } = require("./diceRoller.js")

class UserDiceRoller{
  /** 
   * 캐릭터 다이스 굴리는 거 정리해주는 클래스
   * @param {Map} c_map 캐릭터 들어있는 Map / cid -> Participant
   */
  constructor(c_map){
    this.actvie_runners = c_map;
  }

  async rollUserDices() {
    const actvie_runners = this.actvie_runners

    for (const [rid, runner] of actvie_runners) {
      if (!runner.useSkill) {
        continue;
      }

      const result = await DiceRoller.rollSkillWithCritical(
        runner.useSkill,
        runner,
      );
      runner.set_result(result)
    }

    this.applyHwanhee();
    this.applyNakhwa();

    // this.writeInSheet();
    return this.actvie_runners;
  }

  applyHwanhee() {
    const runners = this.actvie_runners;
    // const runner_map = this.runner_map;
    const skillUsers = new Map([...runners].filter((_, r) => r.useSkill == "환희" ));

    skillUsers.forEach((skillUser, skillUser_id) => {
      const targetRunner = runners.get(skillUser.target[0]);
      // const B = runner_map[A.target[0]]

      if (!targetRunner) return;
      
      // B 스킬 카운트 1 깎기
      targetRunner.skillCount = Math.max(targetRunner.skillCount -1, 0);

      targetRunner.bonus = (targetRunner.bonus || 0) + user.result.finalValue;
      targetRunner.result.finalValue += skillUser.result.finalValue;
      targetRunner.result.finalFormula += ` + 환희:${skillUser.result.finalValue}`;
    });
  }


  applyNakhwa() {
    // const nakhwaUsers = this.actvie_runners.filter(
    //   runner => runner.useSkill === "낙화"
    // );
    const runners = this.actvie_runners;
    const nakhwaUsers = new Map([...runners].filter((_, r) => r.useSkill == "낙화" ));

    if(nakhwaUsers.length < 1) return

    for (const [_, user] of nakhwaUsers) {
      const targetRunner = this.actvie_runners[user.target[0]];

      if (!targetRunner) continue;

      targetRunner.penalty = (targetRunner.penalty || 0) + user.result.finalValue;
      targetRunner.result.finalValue -= skillUser.result.finalValue;
      targetRunner.result.finalValue = Math.max(1, targetRunner.result.finalValue);
      targetRunner.result.finalFormula += ` - 낙화:${skillUser.result.finalValue}`;
    }
  }


  runAway(){
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("도주 판정")
    const values = sheet.getRange("B5:F6").getValues();

    const output = values.map(row => {
      const [name, power, agility, mental, luck] = row;

      const participantRow = Array(22).fill("");

      participantRow[4] = name;
      participantRow[12] = power;
      participantRow[13] = agility;
      participantRow[14] = mental;
      participantRow[15] = luck;

      let faction = new Participant(participantRow);
      const gameData = new GameData();
      const result = DiceRoller.rollSkillWithCritical("도주",faction,gameData);
      return [result.formula, "", result.total]
    });

    if (output.length > 0) {
      sheet.getRange("C10:E11") // I3부터
          .setValues(output);
    }
  }
}
module.exports = { UserDiceRoller }
