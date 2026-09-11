const { getGameData } = require("./gameData.js")

class DiceRoller {
  static random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    if(!statName) return 0;
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

    if (typeof statName !== "string") {
      return 0;
    }

    // 순수 스탯 이름이면 기존 방식대로 처리
    if (statName in map) {
      return map[statName] || 0;
    }

    // 계산식 처리: 긴 이름부터 치환해야 부분 문자열 충돌을 방지할 수 있음
    const statNames = Object.keys(map).sort((a, b) => b.length - a.length);
    let expr = statName;
    for (const name of statNames) {
      if (expr.includes(name)) {
        const value = map[name] || 0;
        expr = expr.split(name).join(`(${value})`);
      }
    }

    // 안전성 검사: 숫자, 공백, 괄호, 사칙연산자, 소수점만 허용
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return 0; // 알 수 없는 문자가 남아있으면 계산하지 않음
    }

    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr});`)();
      return (typeof result === "number" && !isNaN(result)) ? result : 0;
    } catch (e) {
      return 0;
    }
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
    const defaultDice = this.getStatValue(skill.diceCount);
    for (let i = 0; i < defaultDice; i++) {
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
      // 다이스 눈 수 
      const diceSides = this.getStatValue(skill.extraDiceStat);
      // 다이스 개수
      const diceCounts = this.getStatValue(skill.extraDiceCount);

      for (let i = 0; i < diceCounts; i++) {
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
    const agilityInfo = this.criticalTable[`${this.runner.agility}`];

    const luckInfo = this.criticalTable[`${this.runner.luck}`];

    const roll = this.random(1, 100);

    const critical = roll <= agilityInfo["chance"];

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
          `${result.addedCrtFormula} + 침식:${corval}`
      };
    } else if(corval != 0){
      return {
        ...result,
        finalValue: finalValue,
        finalFormula:
          `${result.addedCrtFormula} + ${bonusInfo} - ${penaltyInfo} + 침식:${corval}`
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

  static async rollSkillWithCritical(skillName, runner) {
    this.runner = runner;
    const {skillTable, criticalTable} = await getGameData();
    this.skillTable = skillTable;
    this.criticalTable = criticalTable;

    let result = this.rollSkill(skillName);
    result = this.applyCritical(result)

    return this.applyBounusNPenalty(result);
  }

  static async rollRunaway(skillName, runner) {
    this.runner = runner;
    const {skillTable, criticalTable} = await getGameData();
    this.skillTable = skillTable;
    this.criticalTable = criticalTable;

    return this.rollSkill(skillName);
  }
}

module.exports = {DiceRoller}