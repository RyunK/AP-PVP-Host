/**
 * 전투(라운드/페이즈/액션 선언·확정) 진행을 전담합니다.
 * roomManager가 들고 있는 room 객체(캐릭터/팀 정보)를 참조는 하되,
 * 방/플레이어/캐릭터 자체의 생성·삭제는 여기서 다루지 않습니다.
 */
class BattleManager {
  constructor(room) {
    this.room = room; // roomManager가 들고 있는 그 room 객체를 그대로 참조 (복사 아님)
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
      // phase: "vanguard",
      phase: "vanguard",
      phaseActions: new Map(),
      draft: new Map(),
      vanguardResult: null,
      rearguardResult: null,
      decidedFirstTeam,
      startTime:null,
    };
  }

  draftAction(playerId, characterId, skillName, targetId, value) {
    this._assertCanAct(playerId, characterId);
    this.room.turn.draft.set(characterId, { skillName, targetId, value });
    return this.room.turn.actingTeam;
  }

  confirmAction(playerId, characterId, skillName, targetId, value) {
    this._assertCanAct(playerId, characterId);

    this.room.turn.phaseActions.set(characterId, { skillName, targetId, value });
    this.room.turn.draft.delete(characterId);

    const actingChars = this.room.teams[this.room.turn.actingTeam].filter(
      (id) => this.room.characters.get(id)?.alive
    );
    const allConfirmed = actingChars.every((id) => this.room.turn.phaseActions.has(id));

    if (!allConfirmed) return { phaseComplete: false };
    return this._advancePhase();
  }

  _assertCanAct(playerId, characterId) {
    if (!this.room || this.room.phase !== "battle") throw new Error("전투 중이 아닙니다.");
    const character = this.room.characters.get(characterId);
    if (!character || !character.alive) throw new Error("행동할 수 없는 캐릭터입니다.");
    if (character.ownerId !== playerId) throw new Error("본인 캐릭터만 조작할 수 있습니다.");
    if (character.team !== this.room.turn.actingTeam) throw new Error("지금은 이 캐릭터의 행동 차례가 아닙니다.");
    if (this.room.turn.phaseActions.has(characterId)) throw new Error("이미 확정된 행동입니다.");
  }

  _advancePhase() {
    const turn = this.room.turn;

    if (turn.phase === "vanguard") {
      turn.vanguardResult = new Map(turn.phaseActions);
      turn.actingTeam = turn.actingTeam === "A" ? "B" : "A";
      turn.phase = "rearguard";
      turn.phaseActions = new Map();
      turn.draft = new Map();
      return { phaseComplete: true, roundComplete: false };
    }

    turn.rearguardResult = new Map(turn.phaseActions);
    // TODO: 실제 정산(엔진 계산)은 여기서 나중에 채워 넣습니다.
    const roundLog = {
      round: turn.round,
      firstTeam: turn.firstTeam,
      vanguard: [...turn.vanguardResult.entries()],
      rearguard: [...turn.rearguardResult.entries()],
      events: [],
    };

    this.room.turn = this._startRound(turn.firstTeam);
    return { phaseComplete: true, roundComplete: true, roundLog };
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