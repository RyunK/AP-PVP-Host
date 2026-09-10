class Participant {
  constructor(row) {
    // 빈 셀은 모두 0으로 처리
    const v = row.map(cell =>
      cell === "" || cell === null || cell === undefined
        ? 0
        : cell
    );
    this.no = v[3];                // D열 번호
    this.name = v[4]               // E열 이름
    this.faction = v[5]
    this.position = row[6]
    this.skill = row[7]
    this.maxHp = v[8];             // I열 최대 체력
    this.preBattleHp = v[9];       // J열 전투 전 체력
    this.currentHp = v[10];         // K열 현재 체력
    this.hpStat = v[11];            // L열 체력(스탯)
    this.power = v[12];             // M열 이능력
    this.agility = v[13];           // N열 민첩
    this.mental = v[14];            // O열 정신력
    this.luck = v[15];              // P열 행운

    this.shieldState = v[17];       // R열 보호막 상태
    this.shieldStartRound = v[18]; // S열 보호막 시작 라운드
    this.skillCount = v[19];       // T열 남은 스킬 횟수
    this.bonus = v[20];            // U열 보너스
    this.penalty = v[21];          // V열 패널티

    this.protection = {
      value: 0,
      formula: ""
    }
    this.damage = {
      value: 0,
      formula: ""
    };
    this.heal = {
      value: 0,
      formula: ""
    };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("전투 진행");
    this.skillvalues = sheet.getRange(`D3:J10`).getValues();
  }
  
  

  addSkillUsingData(){
    const values = this.skillvalues
    const rowData = values.find(row => row[0] === this.name);

    if(!rowData) return

    const v = rowData.map(cell =>
      cell === "" || cell === null || cell === undefined
        ? 0
        : cell
    );
    this.useSkill = rowData[1]
    this.corVal = v[2];
    this.target = v[3]? v[3].split(/\s*,\s*/): "";
    this.skillType = v[4];

  }

  set_result(result){
    this.result = result;
  }

  readSkillResult(){
    const values = this.skillvalues
    const rowData = values.find(row => row[0] === this.name);

    if(!rowData) return

    const v = rowData.map(cell =>
      cell === "" || cell === null || cell === undefined
        ? 0
        : cell
    );
    let result = {
      finalFormula : v[5],
      finalValue : v[6]
    }
    this.result = result;
  }

  add_damage(val){
    this.damage.value += val
    this.damage.formula += this.damage.formula === ""
        ? `${val}`
        : ` + ${val}`;
  }

  add_protection(val){
    this.protection.value += val
    this.protection.formula += this.protection.formula === ""
        ? `${val}`
        : ` + ${val}`;
  }

  add_heal(val){
    this.heal.value += val
    this.heal.formula += this.heal.formula === ""
        ? `${val}`
        : ` + ${val}`;
  }

  set_calcedHp(calcedHp){
    this.calcedHp = calcedHp;
  }

}

