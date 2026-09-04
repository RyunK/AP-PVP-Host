// 인메모리 방 관리자. 매치가 끝나면 사라지는 캐주얼 게임 특성상 DB 없이 메모리로 충분합니다.
// 호스트(Electron 앱을 실행 중인 사람)가 서버이자 유일한 "진실의 소스"이고,
// 클라이언트(플레이어 브라우저)는 액션만 보내고 결과는 항상 서버 계산을 받아 렌더링합니다.

const { resolveSkillAction } = require("../engine/damageCalc");

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 문자 제외
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

class RoomManager {
  constructor({ getMatchSettings }) {
    this.rooms = new Map(); // code -> room
    this.getMatchSettings = getMatchSettings;
  }

  createRoom(hostSocketId, hostProfile) {
    let code;
    do {
      code = randomRoomCode();
    } while (this.rooms.has(code));

    const settings = this.getMatchSettings();
    const room = {
      code,
      hostSocketId,
      createdAt: Date.now(),
      phase: "lobby", // lobby -> team_setup -> battle -> ended
      settings: { ...settings },
      players: new Map(), // playerId -> { id, socketId, name, characterIds: [] }
      characters: new Map(), // characterId -> { id, ownerId, name, stats, team, alive }
      teams: { A: [], B: [] }, // characterId 배열
      turn: { number: 0, pendingActions: new Map() },
    };

    this.rooms.set(code, room);
    return this._addPlayer(room, hostSocketId, hostProfile, { isHost: true });
  }

  joinRoom(code, socketId, profile) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("존재하지 않는 방 코드입니다.");
    if (room.phase === "battle") throw new Error("이미 전투가 시작된 방입니다.");
    return this._addPlayer(room, socketId, profile, { isHost: false });
  }

  _addPlayer(room, socketId, profile, { isHost }) {
    const playerId = `p_${socketId}`;
    room.players.set(playerId, {
      id: playerId,
      socketId,
      name: profile?.name || "이름없음",
      isHost,
      characterIds: [],
    });
    return { room, playerId };
  }

  leavePlayer(socketId) {
    for (const room of this.rooms.values()) {
      const player = [...room.players.values()].find((p) => p.socketId === socketId);
      if (!player) continue;

      // 해당 플레이어의 캐릭터도 정리
      for (const charId of player.characterIds) {
        room.characters.delete(charId);
        room.teams.A = room.teams.A.filter((id) => id !== charId);
        room.teams.B = room.teams.B.filter((id) => id !== charId);
      }
      room.players.delete(player.id);

      if (player.isHost || room.players.size === 0) {
        this.rooms.delete(room.code);
        return { roomClosed: true, code: room.code };
      }
      return { roomClosed: false, room };
    }
    return null;
  }

  /** 한 플레이어가 여러 캐릭터를 설정할 수 있습니다 (복수 조작 지원) */
  setCharacters(room, playerId, characterDefs) {
    const player = room.players.get(playerId);
    if (!player) throw new Error("플레이어를 찾을 수 없습니다.");

    const max = room.settings.maxCharactersPerPlayer || 3;
    if (characterDefs.length > max) {
      throw new Error(`한 플레이어는 최대 ${max}명의 캐릭터만 설정할 수 있습니다.`);
    }

    // 기존 캐릭터 제거 후 재등록
    for (const charId of player.characterIds) {
      room.characters.delete(charId);
      room.teams.A = room.teams.A.filter((id) => id !== charId);
      room.teams.B = room.teams.B.filter((id) => id !== charId);
    }
    player.characterIds = [];

    const created = characterDefs.map((def, idx) => {
      const charId = `c_${playerId}_${idx}`;
      room.characters.set(charId, {
        id: charId,
        ownerId: playerId,
        name: def.name || `캐릭터${idx + 1}`,
        stats: {
          hp: def.hp ?? 100,
          maxHp: def.hp ?? 100,
          atk: def.atk ?? 10,
          def: def.def ?? 5,
          power: def.power ?? 10,
        },
        team: null,
        alive: true,
      });
      player.characterIds.push(charId);
      return charId;
    });

    return created;
  }

  assignTeam(room, characterId, team) {
    if (!["A", "B"].includes(team)) throw new Error("팀은 A 또는 B여야 합니다.");
    const character = room.characters.get(characterId);
    if (!character) throw new Error("캐릭터를 찾을 수 없습니다.");

    room.teams.A = room.teams.A.filter((id) => id !== characterId);
    room.teams.B = room.teams.B.filter((id) => id !== characterId);

    const teamSize = room.settings.teamSize || 3;
    if (room.teams[team].length >= teamSize) {
      throw new Error(`${team}팀은 이미 ${teamSize}명이 가득 찼습니다.`);
    }

    room.teams[team].push(characterId);
    character.team = team;
  }

  startBattle(room) {
    const aCount = room.teams.A.length;
    const bCount = room.teams.B.length;
    if (aCount === 0 || bCount === 0 || aCount !== bCount) {
      throw new Error("양 팀 인원이 같아야 전투를 시작할 수 있습니다 (예: 3:3, 2:2, 1:1).");
    }
    room.phase = "battle";
    room.turn = { number: 1, pendingActions: new Map() };
  }

  /** 액션을 큐에 넣고, 생존한 모든 캐릭터의 액션이 모이면 턴을 계산합니다 */
  submitAction(room, characterId, action) {
    if (room.phase !== "battle") throw new Error("전투 중이 아닙니다.");
    const actor = room.characters.get(characterId);
    if (!actor || !actor.alive) throw new Error("행동할 수 없는 캐릭터입니다.");

    room.turn.pendingActions.set(characterId, action);

    const aliveCharIds = [...room.characters.values()]
      .filter((c) => c.alive)
      .map((c) => c.id);
    const allSubmitted = aliveCharIds.every((id) => room.turn.pendingActions.has(id));

    if (!allSubmitted) {
      return { resolved: false, waitingFor: aliveCharIds.filter((id) => !room.turn.pendingActions.has(id)) };
    }

    const turnResult = this._resolveTurn(room);
    return { resolved: true, ...turnResult };
  }

  _resolveTurn(room) {
    const events = [];
    for (const [characterId, action] of room.turn.pendingActions.entries()) {
      const actor = room.characters.get(characterId);
      if (!actor || !actor.alive) continue;
      const target = action.targetId ? room.characters.get(action.targetId) : null;

      // action은 이제 { skillName, targetId } 형태입니다 (예: skillName: "엄호").
      // 실제 주사위/피해 계산 공식은 아직 미구현(TODO)이라, 지금은 에러 없이
      // "todo" 이벤트만 기록하고 다음 턴으로 넘어갑니다. HP는 아직 변하지 않습니다.
      let result;
      try {
        result = resolveSkillAction({
          actorStats: actor.stats,
          targetStats: target ? target.stats : {},
          skillName: action.skillName,
        });
      } catch (err) {
        result = { type: "error", message: err.message };
      }

      if (result.type === "damage" && target) {
        target.stats.hp = Math.max(0, target.stats.hp - result.amount);
        if (target.stats.hp === 0) target.alive = false;
      }
      if (result.type === "heal" && target) {
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + result.amount);
      }

      events.push({ actorId: characterId, targetId: action.targetId, ...result });
    }

    const aWiped = room.teams.A.every((id) => !room.characters.get(id)?.alive);
    const bWiped = room.teams.B.every((id) => !room.characters.get(id)?.alive);

    room.turn = { number: room.turn.number + 1, pendingActions: new Map() };

    let winner = null;
    if (aWiped && !bWiped) winner = "B";
    if (bWiped && !aWiped) winner = "A";
    if (aWiped && bWiped) winner = "draw";
    if (winner) room.phase = "ended";

    return { events, winner, nextTurn: room.turn.number };
  }

  serializeRoom(room) {
    return {
      code: room.code,
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        characterIds: p.characterIds,
      })),
      characters: [...room.characters.values()],
      teams: room.teams,
      turnNumber: room.turn.number,
    };
  }

  listSummaries() {
    return [...this.rooms.values()].map((room) => ({
      code: room.code,
      phase: room.phase,
      playerCount: room.players.size,
      characterCount: room.characters.size,
    }));
  }

  getRoom(code) {
    return this.rooms.get(code);
  }
}

module.exports = { RoomManager };