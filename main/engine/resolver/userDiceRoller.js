const { getGameData } = require("./gameData.js")
const { DiceRoller } = require("./diceRoller.js")
const { Participant } = require("./participant.js");

class UserDiceRoller{
  /** 
   * 캐릭터 다이스 굴리는 거 정리해주는 클래스
   * @param {Map} c_map 캐릭터 들어있는 Map / cid -> Participant
   */
  constructor(c_map){
    this.actvie_runners = c_map;
  }

  /**
   * 모든 캐릭터에 대한 판정 진행 후 Participant 객체에 결과 업데이트,
   * 반환값을 도주 판정 관련
   * @returns {selectedFaction, rollResults} 도주 결과를 반환
   */
  async rollUserDices() {
    const actvie_runners = this.actvie_runners
    let tryRunFaction = ""
    let runResult;

    for (const [rid, runner] of actvie_runners) {
      if (!runner.useSkill || runner.faction == tryRunFaction) {
        continue;
      }

      if(runner.useSkill == "도주"){
        tryRunFaction = runner.faction;
        runResult = await this.runAway(tryRunFaction);
        if(runResult.success){
          break;
        }else continue;
      }

      const result = await DiceRoller.rollSkillWithCritical(
        runner.useSkill,
        runner,
      );
      runner.set_result(result)
    }

    // 도주 시도한 진영 캐릭터들 행동 다 취소
    if (tryRunFaction !== "") {
        for (const runner of actvie_runners.values()) {
            if (runner.faction === tryRunFaction) {
                delete runner.result;
            }
        }
    }

    this.applyHwanhee();
    this.applyNakhwa();

    // this.writeInSheet();
    return runResult;
  }

  applyHwanhee() {
    const runners = this.actvie_runners;
    // const runner_map = this.runner_map;
    const skillUsers = new Map([...runners].filter((_, r) => r.useSkill == "환희" ));

    skillUsers.forEach((skillUser, skillUser_id) => {
      const targetRunner = runners.get(skillUser.target[0]);
      // const B = runner_map[A.target[0]]

      if (!targetRunner) return;
      
      // B 스킬 카운트 1 깎기
      targetRunner.skillCount = Math.max(targetRunner.skillCount -1, 0);

      targetRunner.bonus = (targetRunner.bonus || 0) + user.result.finalValue;
      targetRunner.result.finalValue += skillUser.result.finalValue;
      targetRunner.result.finalFormula += ` + 환희:${skillUser.result.finalValue}`;
    });
  }


  applyNakhwa() {
    // const nakhwaUsers = this.actvie_runners.filter(
    //   runner => runner.useSkill === "낙화"
    // );
    const runners = this.actvie_runners;
    const nakhwaUsers = new Map([...runners].filter((_, r) => r.useSkill == "낙화" ));

    if(nakhwaUsers.length < 1) return

    for (const [_, user] of nakhwaUsers) {
      const targetRunner = this.actvie_runners[user.target[0]];

      if (!targetRunner) continue;

      targetRunner.penalty = (targetRunner.penalty || 0) + user.result.finalValue;
      targetRunner.result.finalValue -= skillUser.result.finalValue;
      targetRunner.result.finalValue = Math.max(1, targetRunner.result.finalValue);
      targetRunner.result.finalFormula += ` - 낙화:${skillUser.result.finalValue}`;
    }
  }


  /**
   * 도주 발생 시 따로 계산해서 리턴
   */
  async runAway(triedFaction){
    const runners = this.actvie_runners;
    const rollResults = new Map();

    for (const faction of ["A", "B"]) {
      const aliveRunners = [...runners.values()].filter(
          runner => runner.faction === faction && runner.currentHp > 0
      );

      if (aliveRunners.length === 0) continue;

      const stats = Object.fromEntries(
          ["hpStat", "power", "agility", "mental", "luck"].map(stat => [
              stat,
              aliveRunners.reduce((sum, runner) => sum + runner[stat], 0)
                  / aliveRunners.length
          ])
      );

      const participant = new Participant(
          { stats },
          { skillName: "도주" },
          "도주"
      );

      const rollRunaway =  await DiceRoller.rollRunaway("도주", participant);

      rollResults.set(faction, rollRunaway);
    }

    const resultA = rollResults.get("A");
    const resultB = rollResults.get("B");

    const selectedFaction =
        resultA.total > resultB.total
            ? "A"
            : resultB.total > resultA.total
                ? "B"
                : triedFaction;

    return {selectedFaction, success: selectedFaction == triedFaction ,rollResults};
  }
}
module.exports = { UserDiceRoller }
