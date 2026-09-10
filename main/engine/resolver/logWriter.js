class LogWriter {
  constructor() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    this.battleSheet = ss.getSheetByName("전투 진행");
    this.logSheet = ss.getSheetByName("현재 전투 로그");

    this.header = this.getGameInfoHeader();
  }

  getGameInfoHeader() {
    const date = this.battleSheet.getRange("A1").getValue();
    const round = this.battleSheet.getRange("A3").getValue();
    const firstAttack = this.battleSheet.getRange("A6").getValue();

    return [date, round, firstAttack];
  }
  /**
   * 현재 로그 모두 삭제
   */
  static deleteCurrentLogs(){
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("현재 전투 로그").getDataRange().clearContent();
  }

  /**
   * 현재 로그 백업
   */
  static backupAllLogs(){
    let values = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("현재 전투 로그").getDataRange().getValues();
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("백업로그")

    const startRow = sheet.getLastRow() + 1;

    sheet.getRange(
      startRow,
      1,
      values.length,
      values[0].length
    ).setValues(values);
  }


  /**
   * 로그용 데이터 생성
   */
  buildLogData() {
    const targetRows = [3, 4, 5, 8, 9, 10, 13, 14, 15, 16, 17, 18];

    const result = [];

    // 맨 위 정보 (헤더 + C:J만큼 빈칸 + M2)
    const topData = [
      ...this.header,
      ...Array(8).fill(""), // C:J = 8칸
      this.battleSheet.getRange("M2").getValue()
    ];

    result.push(topData);

    // 전투 데이터
    for (const row of targetRows) {
      const battleData = this.battleSheet
        .getRange(row, 3, 1, 8) // C:J
        .getValues()[0];

      const mValue = this.battleSheet
        .getRange(row, 13) // M열
        .getValue();

      result.push([
        ...this.header,
        ...battleData,
        mValue
      ]);
    }

    return result;
  }

  /**
   * 현재 전투 로그 시트 맨 아래에 추가
   */
  appendLog(data) {

    const startRow = this.logSheet.getLastRow() + 1;

    this.logSheet.getRange(
      startRow,
      1,
      data.length,
      data[0].length
    ).setValues(data);
  }

  appendBattleLog(){
    const data = this.buildLogData();
    this.appendLog(data);
  }

  /**
   * 도주 로그 추가
   */
  appendRunLog() {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("도주 판정");

    const result = [];

    const topData = [
      ...this.header,
      ...Array(8).fill(""), // C:J = 8칸
      sheet.getRange("H8").getValue()
    ];
    result.push(topData);
    
    let data = sheet.getRange("B10:E11").getValues()
    let rollData = [
      ...this.header,
      "",
      data[0][0],
      "도주 판정",
      ...Array(2).fill(""),
      "도주",
      data[0][1],
      data[0][3],
      sheet.getRange("H10").getValue()
    ];
    result.push([...rollData]);

    rollData[4] = data[1][0];
    rollData[9] = data[1][1];
    rollData[10] = data[1][3];
    rollData[11] = sheet.getRange("H11").getValue();
    result.push([...rollData]);

    const bottomData = [
      ...this.header,
      ...Array(8).fill(""), // C:J = 8칸
      sheet.getRange("H12").getValue()
    ];
    result.push(bottomData);

    this.appendLog(result);

  }
}