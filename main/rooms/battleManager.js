/**
 * 전투(라운드/페이즈/액션 선언·확정) 진행을 전담.
 */
const { resolveRound } = require("../engine/resolveRound.js");


class BattleManager {
  constructor(room) {
    this.room = room; // roomManager가 들고 있는 그 room 객체를 그대로 참조 (복사 아님)
    this.room.battleLogs = [];
  }

  setTimestamp(){
    this.room.turn.startTime = new Date().getTime();
  }

  start() {
    this.room.turn = this._startRound(null);
    this.room.turn.phase = "orderCheck"
    this.setTimestamp();
    return this.room.turn;
  }

  

  _decideFirstTeamByDex() {
    const maxDex = (team) =>
      Math.max(0, ...this.room.teams[team].map((id) => this.room.characters.get(id)?.stats.dex ?? 0));

    const dexA = maxDex("A");
    const dexB = maxDex("B");
    if (dexA !== dexB) return { team: (dexA > dexB ? "A" : "B")};

    let rollA, rollB;
    do {
      rollA = 1 + Math.floor(Math.random() * 100);
      rollB = 1 + Math.floor(Math.random() * 100);
    } while (rollA === rollB);
    return {team: (rollA > rollB ? "A" : "B"), rollA, rollB};
  }

  _startRound(prevFirstTeam) {
    let decidedFirstTeam
    let firstTeam

    if(!prevFirstTeam){
      decidedFirstTeam = this._decideFirstTeamByDex();
      firstTeam = prevFirstTeam ? (prevFirstTeam === "A" ? "B" : "A") : decidedFirstTeam.team;
    }else{
      firstTeam =  (prevFirstTeam === "A" ? "B" : "A");
    }

    return {
      round: (this.room.turn?.round ?? 0) + 1,
      firstTeam,
      actingTeam: firstTeam,
      phase: "vanguard",
      phaseActions: new Map(),
      draft: new Map(),
      vanguardResult: null,
      rearguardResult: null,
      decidedFirstTeam,
      startTime:null,
    };
  }

  draftAction(playerId, characterId, skillName, targetIds, value) {
    this._assertCanAct(playerId, characterId);
    this.room.turn.draft.set(characterId, { skillName, targetIds, value });
    return this.room.turn.actingTeam;
  }

  async confirmAction(playerId, characterId, skillName, targetIds, value) {
    this._assertCanAct(playerId, characterId);
    this._checkValidAct(characterId, skillName, targetIds, value)

    this.room.turn.phaseActions.set(characterId, { skillName, targetIds, value });
    this.room.turn.draft.delete(characterId);

    const actingChars = this.room.teams[this.room.turn.actingTeam].filter(
      (id) => this.room.characters.get(id)?.alive
    );
    const allConfirmed = actingChars.every((id) => this.room.turn.phaseActions.has(id));

    // 생존자 전부 행동했다면 라운드 진행
    if (!allConfirmed) return { phaseComplete: false };
    return await this._advancePhase();
  }

  _checkValidAct(characterId, act, targetIds, value){
    if (!targetIds || targetIds.length <= 0) throw new Error("대상이 없습니다.");
    if (!act) throw new Error("행동이 없습니다.");
  }

  _assertCanAct(playerId, characterId) {
    if (!this.room || this.room.phase !== "battle") throw new Error("전투 중이 아닙니다.");
    const character = this.room.characters.get(characterId);
    if (!character || !character.alive) throw new Error("행동할 수 없는 캐릭터입니다.");
    if (character.ownerId !== playerId) throw new Error("본인 캐릭터만 조작할 수 있습니다.");
    if (character.team !== this.room.turn.actingTeam) throw new Error("지금은 이 캐릭터의 행동 차례가 아닙니다.");
    if (this.room.turn.phaseActions.has(characterId)) throw new Error("이미 확정된 행동입니다.");
  }

  async _advancePhase() {
    const turn = this.room.turn;

    if (turn.phase === "vanguard") {
      turn.vanguardResult = new Map(turn.phaseActions);
      turn.actingTeam = turn.actingTeam === "A" ? "B" : "A";
      turn.phase = "rearguard";
      turn.phaseActions = new Map();
      turn.draft = new Map();

      // 후공페이즈 타임 세팅
      this.setTimestamp();
      return { phaseComplete: true, roundComplete: false, roundLog:{firstTeam: turn.firstTeam} };
    }

    turn.rearguardResult = new Map(turn.phaseActions);
    
    // 실제 정산
    const characters = this.room.characters;
    const vanguard = turn.vanguardResult;
    const rearguard = turn.rearguardResult;
    const resultMap =  await resolveRound({characters, vanguard, rearguard });
    this.room.battleLogs.push(resultMap);

    const roundLog = {
      round: turn.round,
      firstTeam: turn.firstTeam,
      vanguard: [...turn.vanguardResult.entries()],
      rearguard: [...turn.rearguardResult.entries()],
      results: Object.fromEntries(resultMap),
    };

    // this.room.turn = this._startRound(turn.firstTeam);
    turn.phase = "resolution";
    // 정산 페이즈 타임 세팅
    this.setTimestamp();
    this.applyHp(resultMap);
    return { phaseComplete: true, roundComplete: true, roundLog };
  }

  /**
   * 계산만 했던 체력을 실제로 room.characters에 적용시킴
   * @param {Map} resultMap 
   */
  applyHp(resultMap){
    for ( const [id, char] of this.room.characters){
      char.stats.hp = resultMap.get(id).hpResult.value;
      if (char.stats.hp <= 0) char.alive = false;
    }
  }

  toNextRound(){
    this.setTimestamp();
    this.room.turn = this._startRound(turn.firstTeam);
  }

  getPlayerTeams(playerId) {
    const player = this.room?.players.get(playerId);
    if (!player) return [];
    const teams = new Set();
    for (const charId of player.characterIds) {
      const team = this.room.characters.get(charId)?.team;
      if (team) teams.add(team);
    }
    return [...teams];
  }

  endOrderCheck(){
    this.room.turn.phase = "vanguard";
    this.setTimestamp();
  }

  /** roomManager.serializeRoom이 room.turn을 공개용으로 변환할 때 씀 */
  serializeTurn() {
    const turn = this.room.turn;
    if (!turn) return null;
    return {
      round: turn.round,
      firstTeam: turn.firstTeam,
      actingTeam: turn.actingTeam,
      phase: turn.phase,
      confirmed: [...turn.phaseActions.entries()],
      decidedFirstTeam : [turn.decidedFirstTeam?.rollA, turn.decidedFirstTeam?.rollB],
      startTime: turn.startTime,
    };
  }
}

module.exports = { BattleManager };