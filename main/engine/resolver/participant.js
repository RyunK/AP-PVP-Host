class Participant {
  /**
   * 캐릭터 객체를 만듦.
   * 
   * @param { Object } c 캐릭터 정보가 들어있는 Dictionary
   * @param { Object } c_act 행동 정보가 들어있는 Dictionary
   * @param { Array } skillType 스킬 유형 문자열이 들어있는 배열
   */
  constructor(c, c_act, skillType ) {
    this.no = c.id;
    this.name = c.name;
    this.faction = c.team;
    this.position = c.position;
    this.skill = c.skill;                  //  선택 스킬
    this.maxHp = 100 + (c.stats.hp_stat * 5);
    // this.preBattleHp = v[9];       // J열 전투 전 체력
    this.currentHp = c.stats.hp;            // K열 현재 체력
    this.hpStat = c.stats.hp_stat;          // L열 체력(스탯)
    this.power = c.stats.power;             // M열 이능력
    this.agility = c.stats.dex;             // N열 민첩
    this.mental = c.stats.mnd;              // O열 정신력
    this.luck = c.stats.luck;              // P열 행운

    this.skillCount = c.skillCount;    // 스킬 사용한 횟수
    this.bonus = 0;            // U열 보너스
    this.penalty = 0;          // V열 패널티

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

    this.useSkill = c_act.skillName;
    this.corVal = c_act.value || 0;
    this.target = c_act.targetIds;
    this.skillType = skillType;
  }
  
  set_result(result){
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

module.exports = { Participant }
