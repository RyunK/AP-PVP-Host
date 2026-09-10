// 스크립트에 적혀있는 functions 참고용

function order1d100(){
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("참여자");
  sheet.getRange("C3").setValue(DiceRoller.random(1, 100))
  sheet.getRange("C6").setValue(DiceRoller.random(1, 100))
}

function rollFirstAttacker(){
  let diceRoller = new UserDiceRoller(0);
  diceRoller.rollUserDices();
}

function rollLastAttacker(){
  let diceRoller = new UserDiceRoller(1);
  diceRoller.rollUserDices();
}

function calculateHp(){
  let calc = new HpCalculator();

  calc.calcReceived()
  calc.calculatingHp()
  calc.writeResultOnSheet()
}

function updateHp(){
  let saver = new ParticipantSaver(ParticipantSaver.loadParticipants()[1]);
  saver.updateCurentHp().saveSheet();
}

function continueRound(){
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    "확인",
    "이번 라운드를 확정하고 다음 라운드로 진행할까요?",
    ui.ButtonSet.OK_CANCEL
  );

  if (result === ui.Button.OK) {
    updateHp();
    let setter = new BattleSetter();
    setter.nextRound();
  } else {
  }
  
}

function runAway(){
  let diceRoller = new UserDiceRoller(1);
  diceRoller.runAway();
}

function runConfirm(){
  let logWriter = new LogWriter();
  logWriter.appendRunLog();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("도주 판정");
  sheet.getRange("C10:E11").clearContent();

}

function resetBattle(){
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    "확인",
    "다음 라운드 버튼은 누르셨나요? 정말로 모든 전투를 끝내고 로그를 백업할까요?",
    ui.ButtonSet.OK_CANCEL
  );

  if (result === ui.Button.OK) {
    let setter = new BattleSetter();
    setter.quitBattle();
  } else {
  }
  
}


function newBattle(){
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    "확인",
    "이대로 전투를 시작할까요? 기존에 진행중이던 전투 데이터가 모두 삭제됩니다.",
    ui.ButtonSet.OK_CANCEL
  );

  if (result === ui.Button.OK) {
    let setter = new BattleSetter();
    setter.initBattle();
  } else {
  }
  
}

function emergencyDice(){
  // 21개짜리 배열을 만들고 0으로 채움
  const initArray = new Array(22).fill(0);
 
  // Participant 객체 생성
  const runner = new Participant(initArray);
 
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('전투 진행');
 
  // D39:H39 -> hpStat, power, agility, mental, luck
  const statValues = sheet.getRange('D39:H39').getValues()[0];
  runner.hpStat  = statValues[0];
  runner.power   = statValues[1];
  runner.agility = statValues[2];
  runner.mental  = statValues[3];
  runner.luck    = statValues[4];
 
  // D37:F37 -> name, useSkill, corVal
  const infoValues = sheet.getRange('D37:F37').getValues()[0];
  runner.name     = infoValues[0];
  runner.useSkill = infoValues[1];
  runner.corVal   = infoValues[2] === null ? 0 : infoValues[2];
 
  const gameData = new GameData();
 
  // useSkill 값이 없으면 종료
  if (!runner.useSkill) {
    return;
  }
 
  const result = DiceRoller.rollSkillWithCritical(
    runner.useSkill,
    runner,
    gameData
  );
  runner.set_result(result);
 
  // G37:H37에 finalFormula, finalValue 기록
  sheet.getRange('G37:H37').setValues([[runner.result.finalFormula, runner.result.finalValue]]);
  // Logger.log([runner.result.finalFormula, runner.result.finalValue])
}
