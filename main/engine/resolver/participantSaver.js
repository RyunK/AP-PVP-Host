class ParticipantSaver{
  constructor(runnerMap){
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("참여자");
    const values = sheet.getRange("E2:V7").getValues();

    this.sheet = sheet;
    this.values = values;
    this.runner_map = runnerMap;
  }

  static loadParticipants(){
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("참여자");
    const values = sheet.getDataRange().getValues().slice(1);

    const runners = values.map(row => new Participant(row));

    for(const runner of runners){
      runner.addSkillUsingData()
    }

    const runnerMap = Object.fromEntries(
      runners.map(r => [r.name, r])
    );

    return [runners, runnerMap];
  }

  setPenalty(){
    this.values.forEach(row => {
      const runner = this.runner_map[row[0]]; // 이름(E열)

      if (runner) {
        row[17] = runner.penalty; // V열 (E 기준 18번째)
      }
    });
    return this
  }

  resetPenalty(){
    this.values.forEach(row => { row[17] = 0 });
    return this
  }

  setSkillCount(){
    const dataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("data");
    const skillList = dataSheet.getRange("E2:E8").getValues().flat();   

    this.values.forEach(row => {
      const runner = this.runner_map[row[0]]; // 이름(E열)
      if (row[0] != "" && skillList.includes(runner.useSkill)) {
        row[15] += 1; // T열 (E 기준 15번째)
      }
    });
    return this
  }
  
  resetSkillCount(){ 
    this.values.forEach(row => {
        row[15]= 0; // T열 (E 기준 15번째)
    });
    return this
  }

  reduceSkillCount(name){
    // this.values는 E2:V7 범위
    for (let i = 0; i < this.values.length; i++) {
      const row = this.values[i];

      if (row[0] === name) { // E열
        const currentCount = Number(row[15]) || 0; // T열

        const newCount = Math.max(0, currentCount - 1);

        // 메모리상의 값 갱신
        row[15] = newCount;

        // 실제 시트 갱신
        this.sheet.getRange(i + 2, 20).setValue(newCount); // T열 = 20

        return this;
      }
    }

    throw new Error(`참여자 '${name}'을 찾을 수 없습니다.`);
  }

  resetNames(){
    this.values.forEach(row => {
        row[0]= ""; // E열
    });
    return this
  }

  /**
   * 최종적으로 현재 체력을 러너 목록에 적용
   */
  confirmLastHp(){
    const targetSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName("러너전체목록");

    const runnerValues = targetSheet.getDataRange().getValues();

    // H열 데이터 복사본
    const hValues = runnerValues.map(row => [row[7]]);

    // 이름 -> 배열 인덱스 매핑
    const rowMap = {};
    for (let i = 1; i < runnerValues.length; i++) {
      rowMap[runnerValues[i][2]] = i;
    }

    for (const row of this.values) {
      const name = row[0];   // E열
      const valueK = row[6]; // K열

      if (rowMap[name] !== undefined) {
        hValues[rowMap[name]][0] = valueK;
      }
    }
    targetSheet.getRange(1, 8, hValues.length, 1).setValues(hValues);

    Logger.log(hValues);

  }

  resetHp(){
    this.values.forEach(row => {
        row[6]= ""; // K열
    });
    return this
  }

  updateCurentHp(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const battleSheet = ss.getSheetByName("전투 진행");
    // J13:J18 값 읽기
    const hpValues = battleSheet.getRange("J13:J18").getValues();
    this.values.forEach((row,i) =>{
      row[6] = hpValues[i][0]
    })

    battleSheet.getRange("B13").setValue(true);
    return this
  }

  initCurrentHp(){
    this.values.forEach((row,i) =>{
      row[6] = row[5]
    })
  }

  saveSheet(){
    const eValues = this.values.map(row => [row[0]]);
    const kValues = this.values.map(row => [row[6]]);
    const rvValues = this.values.map(row => row.slice(13, 18));

    this.sheet.getRange("E2:E7").setValues(eValues);
    this.sheet.getRange("K2:K7").setValues(kValues);
    this.sheet.getRange("R2:V7").setValues(rvValues);
  }
}