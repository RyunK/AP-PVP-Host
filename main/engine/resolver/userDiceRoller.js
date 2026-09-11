class UserDiceRoller{
  /** 
   * 캐릭터 다이스 굴리는 거 정리해주는 클래스
   * @param {Map} c_map 캐릭터 들어있는 Map / cid -> Participant
   */
  constructor(c_map){
    this.actvie_runners = c_map;
  }

  // loadActiveRunners(){
  //   let order = this.order
  //   const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("전투 진행");
  //   const names = sheet.getRange(`D${3+5*order}:D${5+5*order}`).getValues().flat();

  //   const activeRunners = names
  //     .map(name => this.runner_map[name])
  //     .filter(Boolean);
    
  //   return activeRunners;
  // }

  rollUserDices() {
    const actvie_runners = this.actvie_runners
    const gameData = new GameData();


    for (const runner of actvie_runners) {
      if (runner.useSkill == 0) {
        continue;
      }

      const result = DiceRoller.rollSkillWithCritical(
        runner.useSkill,
        runner,
        gameData
      );
      runner.set_result(result)
    }

    this.applyHwanhee();
    this.applyNakhwa();

    this.writeInSheet();
  }

  applyHwanhee() {
    const runners = this.actvie_runners
    const runner_map = this.runner_map
    const useSkill = runners.filter(runner => runner.useSkill === "환희");

    useSkill.forEach(A => {
      const B = runner_map[A.target[0]]
      // const B = runners.find(runner => runner.name === A.target[0]);

      if (!B) return;
      
      // B 데이터 전달해서 스킬 카운트 1 깎아야함
      new ParticipantSaver(runner_map).reduceSkillCount(B.name);

      B.result.finalValue += A.result.finalValue;
      B.result.finalFormula += ` + ${A.result.finalValue}`;
    });


  }

  applyNakhwa() {
    const nakhwaUsers = this.actvie_runners.filter(
      runner => runner.useSkill === "낙화"
    );

    if(nakhwaUsers.length < 1) return

    for (const user of nakhwaUsers) {
      const targetRunner = this.runner_map[user.target[0]];

      if (!targetRunner) continue;

      targetRunner.penalty = (targetRunner.penalty || 0) + user.result.finalValue;
    }
  }

  // 시트에 적기
  writeInSheet(){
    const order = this.order;
    // const runners = this.runners;
    const runeer_map = this.runner_map;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("전투 진행");
    const names = sheet.getRange(`D${3+5*order}:D${5+5*order}`).getValues().flat();

    const output = names.map(name => {
      const runner = runeer_map[name];

      if(!runner || !runner.result){
        return ["", ""];
      } else{
        return [runner.result.finalFormula, runner.result.finalValue]
      }
    });

    // const output = names.map(name => {
    //   const runner = runners.find(r => r.name === name);

    //   return runner
    //     ? [runner.result.finalFormula, runner.result.finalValue]
    //     : ["", ""];
    // });

    
    if (output.length > 0) {
      sheet.getRange(3+order*5 , 9, output.length,2) // I3부터
          .setValues(output);
    }

    let saver = new ParticipantSaver(runeer_map).setPenalty().saveSheet();
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
