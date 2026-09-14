/**
 * 전투(라운드/페이즈/액션 선언·확정) 진행을 전담.
 */
const { resolveRound } = require("../engine/resolveRound.js");


class BattleManager {
  constructor(room, { onAutoAdvance } = {}) {
    this.room = room;
    this.onAutoAdvance = onAutoAdvance || (() => {}); // 타이머가 스스로 다음 단계로 넘어갈 때 서버 통신 보내는 용도
    this._timer = null;
  }

  setTimestamp(durationms = 30_000){
    this.room.turn.startTime = new Date().getTime();
    this.room.turn.durationMs = durationms;
  }

  /**
   * 타임아웃 걸어줌
   * @param {string} expectedPhase 현재 페이즈 (타임아웃 거는 시점에 시작할 페이즈)
   * @param {number} delayMs 타임아웃 걸 milli seconds
   */
  _scheduleTimeout(expectedPhase, delayMs) {
    clearTimeout(this._timer); // 이전에 걸어둔 타이머가 있으면 먼저 취소 (중복 방지)

    this._timer = setTimeout(() => {
      if (this.room.turn.phase !== expectedPhase) return; // 이미 다른 방법으로 넘어갔으면 무시

      if (expectedPhase === "rearguard" || expectedPhase === "vanguard") {
        this._advancePhase(); // 원래 행동 확인 -> 페이즈 전환 하던 함수
      } else if (expectedPhase === "resolution") {
        this.toNextRound(); 
      } else if (expectedPhase === "orderCheck"){
        this.endOrderCheck();
      }

      this.onAutoAdvance?.(expectedPhase); // 타임아웃 끝나면 현재 상태 emit
    }, delayMs);
  }
 
  _clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
 
  /** 방이 닫히는 등 전투 자체가 사라질 때 반드시 호출 - 안 하면 타이머가 죽은 방을 대상으로 계속 돌 수 있음 */
  destroy() {
    this._clearTimer();
  }

  start() {
    this.room.turn = this._startRound(null);
    this.room.turn.phase = "orderCheck"

    const duration = this._getPhaseDuration("orderCheck")
    this.setTimestamp(duration);
    this._scheduleTimeout("orderCheck", duration);
    return this.room.turn;
  }

  _getPhaseDuration(phase) {
    const ORDER_CHECK_MS = 10_000;
    const RESOLUTION_MS = 30_000;

    switch (phase) {
      case "orderCheck":
        return ORDER_CHECK_MS;
      case "resolution":
        return RESOLUTION_MS;
      case "vanguard":
      case "rearguard":
        return (this.room.settings.turnTimeLimitSec || 60) * 1000;
      default:
        return null; // 타이머가 필요 없는 페이즈
    }
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
      durationMs: null,
    };
  }

  toNextRound(){
    const durationMs = this._getPhaseDuration('vanguard')

    this.setTimestamp(durationMs);
    this._scheduleTimeout('vanguard', durationMs);
    this.room.turn = this._startRound(this.room.turn.firstTeam);
  }

  endOrderCheck(){
    const durationMs = this._getPhaseDuration('vanguard')

    this.room.turn.phase = "vanguard";
    this._scheduleTimeout('vanguard', durationMs);
    this.setTimestamp(durationMs);
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
      const durationMs = this._getPhaseDuration("rearguard")
      this.setTimestamp(durationMs);
      this._scheduleTimeout("rearguard", durationMs);
      return { phaseComplete: true, roundComplete: false, roundLog:{firstTeam: turn.firstTeam} };
    }

    turn.rearguardResult = new Map(turn.phaseActions);
    
    // 실제 정산
    const characters = this.room.characters;
    const vanguard = turn.vanguardResult;
    const rearguard = turn.rearguardResult;
    const resultMap =  await resolveRound({characters, vanguard, rearguard });

    const roundLog = {
      round: turn.round,
      firstTeam: turn.firstTeam,
      vanguard: [...turn.vanguardResult.entries()],
      rearguard: [...turn.rearguardResult.entries()],
      results: Object.fromEntries(resultMap),
    };

    
    // this.room.turn = this._startRound(turn.firstTeam);
    turn.phase = "resolution";
    this.room.battleLogs.push(Object.fromEntries(resultMap));
    this.applyHp(resultMap);
    // 정산 페이즈 타임 세팅
    const durationMs = this._getPhaseDuration("resolution")
    this.setTimestamp(durationMs);
    this._scheduleTimeout("resolution", durationMs);
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
      durationMs: turn.durationMs
    };
  }
}

module.exports = { BattleManager };