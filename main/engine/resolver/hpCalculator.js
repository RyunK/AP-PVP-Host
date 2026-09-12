class HpCalculator{
  constructor(c_map){
    // [this.runners,  this.runner_map] = ParticipantSaver.loadParticipants();
    this.runners = c_map;
    this.suho = this.getSuhoMap();
  }

  /**
   * suho = {
        "러너5": "러너4",
        "러너6": "러너4"
      };
      
      suho[대상] = 시전자
   */
  getSuhoMap(){
    let suho = {};
    for (const [_, runner] of this.runners) {

      if (runner.useSkill !== "수호") continue;

      for (const target of runner.target) {
        suho[target] = runner.no;
      }
    }
  
    return suho;
  }

  // 받은 대미지, 방어, 회복 계산
  calcReceived(){
    for (const runner of this.runners.values()) {
      if(runner.name == "" || !runner.skillType) continue;
      if (runner.skillType.includes("공격")){
        this.applyDamages(runner)
      } else if (runner.skillType.includes("방어")){
        this.applyProtections(runner)
      }
      else if (runner.skillType.includes("회복")){
        this.applyHeals(runner)
      }
    }
  }
  
  applyDamages(runner){
    // 공격 유형 스킬을 시전한 시전자의 대상을 찾아서 대미지 추가
    let damage = runner.result.finalValue;

    for (const target of runner.target) {
      const guardian = this.suho[target];
      if (guardian) {
        this.runners.get(guardian).add_damage(damage);
      } else {
        this.runners.get(target).add_damage(damage);
      }
    }
  }

  applyProtections(runner){
    // 방어 유형 스킬을 시전한 시전자의 대상을 찾아서 경감 추가
    let protection = runner.result.finalValue;

    // 수호 시전자가 아니면 대상에게 방어 추가, 수호 시전자면 본인에게 추가
    if(runner.useSkill != "수호"){
      for (const target of runner.target) {
        this.runners.get(target).add_protection(protection);
      }
    } else{
      runner.add_protection(protection);
    }
  }

  applyHeals(runner){
    // 회복 유형 스킬을 시전한 시전자의 대상을 찾아서 회복 추가
    let heal = runner.result.finalValue;
    for (const target of runner.target) {
      this.runners.get(target).add_heal(heal);
    }
  }

  suhoUserDeathCheck(){
    for(const runner of this.runners.values()){
      if(runner.useSkill != "수호") continue;
      let calc_hp = runner.currentHp - (runner.damage.value - runner.protection.value)
      if( calc_hp < 0){
          const share = Math.floor( -calc_hp / runner.target.length);
          for (const member of runner.target) {
            this.runners.get(member).add_damage(share);
          }
        }
      }
    }

  calculatingHp(){
    // 수호 시전자 사망 및 대미지 체크
    this.suhoUserDeathCheck();

    for (const runner of this.runners.values()) {
      let corVal = runner.corVal? runner.corVal : 0
      let c_hp = runner.currentHp - Math.max(0, runner.damage.value - runner.protection.value) - corVal;

      let calcedHp ={}
      calcedHp.formula =`${runner.currentHp} - (대미지: ${runner.damage.value} - 경감: ${runner.protection.value})`

      if(corVal > 0){
        calcedHp.formula += ` - 침식: ${corVal}`
      }

      if(c_hp >0 ){
        // 회복
        calcedHp.formula += ` + 회복: ${runner.heal.value}`
        c_hp = Math.max(runner.maxHp , c_hp + runner.heal.value)
      }
      calcedHp.value = c_hp
      
      runner.set_calcedHp(calcedHp);
    }
  }

}

module.exports = { HpCalculator }