class BattleSetter{
  constructor(){
    this.sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("전투 진행");
    this.saver = new ParticipantSaver(ParticipantSaver.loadParticipants()[1]);
    this.participantSheet = SpreadsheetApp.getActive().getSheetByName("참여자");

  }

  setBattleOrder(faction) {
    const sheet = this.participantSheet;
    const battleSheet = this.sheet;
    const values = sheet.getRange("C2:F7").getValues();

    const firstNames = values
      .filter(row => row[3] === faction)
      .map(row => [row[2]]);

    const secondNames = values
      .filter(row => row[3] !== faction)
      .map(row => [row[2]]);

    battleSheet.getRange("A6").setValue(faction);
    battleSheet.getRange(`D3:D${3 + firstNames.length - 1}`).setValues(firstNames);
    battleSheet.getRange(`D8:D${8 + secondNames.length - 1}`).setValues(secondNames);
  }

  setAttackOrder() {
    const sheet = this.participantSheet;
    const values = sheet.getRange("C2:F7").getValues();

    const trueFaction = values.find(row => row[0] === true)?.[3];
    this.setBattleOrder(trueFaction);
  }

  switchAttackOrder() {
    const currentFaction = this.sheet.getRange("A6").getValue();
    this.setBattleOrder(
      currentFaction === "아이테르" ? "어비스" : "아이테르"
    );
  }
  
  resetSkillValues(){
    this.sheet.getRange("E3:G5").clearContent();
    this.sheet.getRange("I3:J5").clearContent();
    this.sheet.getRange("E8:G10").clearContent();
    this.sheet.getRange("I8:J10").clearContent();
    this.sheet.getRange("F13:J18").clearContent();
    this.sheet.getRange("B13").setValue(false);
  }

  backupLogs(){
    let log_writer = new LogWriter();
    log_writer.appendBattleLog();
  }

  nextRound(){
    this.backupLogs()
    
    this.saver.setSkillCount();
    this.saver.resetPenalty();
    this.saver.saveSheet();
    this.resetSkillValues();
    this.switchAttackOrder();

    let round = this.sheet.getRange("A3").getValue();
    this.sheet.getRange("A3").setValue(round+1);
  }

  quitBattle(){
    this.saver.confirmLastHp();
    this.saver.resetNames();
    this.saver.resetHp();
    this.saver.resetSkillCount();
    this.saver.resetPenalty();
    this.saver.saveSheet();
    this.resetSkillValues();

    LogWriter.backupAllLogs();
    LogWriter.deleteCurrentLogs();

    this.sheet.getRange("D3:D10").setValue("");
    this.sheet.getRange("A6").setValue("");
    this.sheet.getRange("A3").setValue(0);
  }

  initBattle(){
    this.saver.initCurrentHp();
    this.saver.resetSkillCount();
    this.saver.resetPenalty();
    this.saver.saveSheet();

    this.setAttackOrder();
    LogWriter.deleteCurrentLogs();
    
    this.sheet.getRange("A3").setValue(1);
  }
}