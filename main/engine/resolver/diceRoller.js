class DiceRoller {
  static random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static loadSkillTable(values) {
    const result = {};

    values.forEach(row => {
      const skillName = row[0];

      if (!skillName) return;

      result[skillName] = {
        diceCount: Number(row[3]) || 0,
        statBonus: row[4] || "",
        extraDiceCount: Number(row[5]) || 0,
        extraDiceStat: row[6] || ""
      };
    });

    return result;
  }

  static loadCriticalTable(values) {
    const result = {};

    values.slice(1).forEach(row => {
      result[row[0]] = {
        chance: Number(row[1]),
        multiplier: Number(row[2])
      };
    });

    return result;
  }

  static rollBaseDice() {
    const max = 8 + this.runner.power;

    let value = this.random(1, max);

    if (value < this.runner.mental) {
      value = this.runner.mental;
    }

    return value;
  }

  static getStatValue(statName) {
    // statName이 숫자이거나, 숫자로 변환 가능한 문자열이면 그 값을 그대로 반환
    if (typeof statName === "number") {
      return statName;
    }
    if (typeof statName === "string" && statName.trim() !== "" && !isNaN(Number(statName))) {
      return Number(statName);
    }

    const map = {
      "체력": this.runner.hpStat,
      "이능력": this.runner.power,
      "민첩": this.runner.agility,
      "정신력": this.runner.mental,
      "행운": this.runner.luck
    };

    return map[statName] || 0;
  }

  static rollSkill(skillName) {
    const skill = this.skillTable[skillName];

    if (!skill) {
      throw new Error(`존재하지 않는 스킬: ${skillName}`);
    }

    const baseDice = [];
    const extraDice = [];

    let total = 0;
    let formulaParts = [];

    // 기본 주사위
    for (let i = 0; i < skill.diceCount; i++) {
      const value = this.rollBaseDice();

      baseDice.push(value);
      formulaParts.push(value);

      total += value;
    }

    // 스탯 추가
    let statBonus = null;

    if (skill.statBonus) {
      const value = this.getStatValue(skill.statBonus);

      statBonus = {
        stat: skill.statBonus,
        value: value
      };

      formulaParts.push(value);
      total += value;
    }

    // 추가 다이스
    if (skill.extraDiceCount > 0) {
      const diceSides =
        this.getStatValue(skill.extraDiceStat);

      for (let i = 0; i < skill.extraDiceCount; i++) {
        const value = this.random(1, diceSides);

        extraDice.push(value);
        formulaParts.push(value);

        total += value;
      }
    }

    return {
      skill: skillName,
      baseDice,
      statBonus,
      extraDice,
      total,
      formula: formulaParts.join(" + ")
    };
  }

  static applyCritical(result) {
    const agilityInfo =
      this.criticalTable[this.runner.agility];

    const luckInfo =
      this.criticalTable[this.runner.luck];

    const roll = this.random(1, 100);

    const critical =
      roll <= agilityInfo.chance;

    if (!critical) {
      return {
        ...result,
        critical: false,
        criticalRoll : roll,
        criticalMultiplier: 1,
        addedCrtValue: result.total,
        addedCrtFormula: result.formula
      };
    }

    const addedCrtValue =
      Math.round(
        result.total * luckInfo.multiplier
      );

    return {
      ...result,
      critical: true,
      criticalRoll : roll,
      criticalMultiplier: luckInfo.multiplier,
      addedCrtValue: addedCrtValue,
      addedCrtFormula:
        `(${result.formula}) × ${luckInfo.multiplier}`
    };
  }

  static applyBounusNPenalty(result){
    const bonusInfo = this.runner.bonus
    const penaltyInfo = this.runner.penalty
    const corval = this.runner.corVal

    let finalValue =
      Math.round(
        result.addedCrtValue + bonusInfo - penaltyInfo + corval
      );
    finalValue = finalValue>0? finalValue : 1

    if(bonusInfo == 0 && penaltyInfo == 0 && corval == 0){
      return {
        ...result,
        finalValue: finalValue,
        finalFormula: result.addedCrtFormula
      };
    } else if( bonusInfo == 0 && penaltyInfo == 0 && corval != 0){
      return {
        ...result,
        finalValue: finalValue,
        finalFormula:
          `${result.addedCrtFormula} + ${corval}`
      };
    } else if(corval != 0){
      return {
        ...result,
        finalValue: finalValue,
        finalFormula:
          `${result.addedCrtFormula} + ${bonusInfo} - ${penaltyInfo} + ${corval}`
      };
    }else{
      return {
        ...result,
        finalValue: finalValue,
        finalFormula:
          `${result.addedCrtFormula} + ${bonusInfo} - ${penaltyInfo}`
      };
    }  
  }

  static rollSkillWithCritical(skillName, runner, gameData) {
    this.runner = runner;
    this.skillTable = gameData.skillTable;
    this.criticalTable = gameData.criticalTable;

    let result = this.rollSkill(skillName);
    result = this.applyCritical(result)

    return this.applyBounusNPenalty(result);
  }

  static rollRunaway(skillName, runner, gameData) {
    this.runner = runner;
    this.skillTable = gameData.skillTable;
    this.criticalTable = gameData.criticalTable;

    return this.rollSkill(skillName);
  }
}
