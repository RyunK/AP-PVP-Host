// 메모리에만 저장, 방 관리자이자
// 호스트만이 항상 진실, 클라이언트는 호스트에게 요청을 보내고 받기만 함.
const crypto = require("crypto");
const RECONNECT_GRACE_MS = 30_000; // 30초
const { resolveSkillAction } = require("../engine/damageCalc");

function randomPlayerId() {
  return `p_${crypto.randomBytes(6).toString("hex")}`;
}

class RoomManager {
  constructor({ getMatchSettings, onRoomClosed }) {
    this.room = null;
    this.getMatchSettings = getMatchSettings;
    this.onRoomClosed = onRoomClosed || (() => {});
  }

   /** 방이 없으면 새로 만들고(이 사람이 호스트), 있으면 거기 참가시킴 */
  enterRoom(socketId, profile) {
    if (!this.room) {
      this.room = this._createRoom(socketId);
    }
    if (this.room.phase === "battle") {
      throw new Error("이미 전투가 시작된 방입니다.");
    }
    const isHost = ![...this.room.players.values()].some((p) => p.isHost); // 아무도 없고 호스트도 없으면 내가 호스트
    return this._addPlayer(this.room, socketId, profile, { isHost });
  }
  /**
   * 새로고침/재접속 등으로 끊어졌던 플레이어가 같은 playerId로 돌아왔을 때,
   * 기존 캐릭터/팀/연결 상태를 그대로 이어받게 합니다.
   */
  rejoinRoom(playerId, newSocketId) {
    if (!this.room) {
      throw new Error("방을 찾을 수 없습니다 (이미 종료되었거나 아직 생성되지 않음).");
    }
    const player = this.room.players.get(playerId);
    if (!player) {
      throw new Error("이 방에서 플레이어 정보를 찾을 수 없습니다.");
    }

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
    player.socketId = newSocketId;
    player.connected = true;
    if (player.isHost) this.room.hostSocketId = newSocketId;

    return { room: this.room, playerId };
  }


  _createRoom(hostSocketId) {
    const settings = this.getMatchSettings();
    return {
      hostSocketId,
      createdAt: Date.now(),
      phase: "lobby",
      settings: { ...settings },
      players: new Map(),
      characters: new Map(),
      teams: { A: [], B: [] },
      teamNames: { A: "A팀", B: "B팀" },
      turn: { number: 0, pendingActions: new Map() },
      chatHistory: [],
    };
  }

  _addPlayer(room, socketId, profile, { isHost }) {
    const playerId = randomPlayerId();
    room.players.set(playerId, {
      id: playerId,
      socketId,
      name: profile?.name || "이름없음",
      isHost,
      characterIds: [],
      connected: true,        
      disconnectTimer: null, 
      ready: false,
    });
    if (isHost) room.hostSocketId = socketId;
    return { room, playerId };
  }

  leavePlayer(socketId) {
    if (!this.room) return null;

    const player = [...this.room.players.values()].find(
      (p) => p.socketId === socketId && p.connected
    );
    if (!player) return null;

    player.connected = false;
    player.disconnectTimer = setTimeout(() => {
      this._removePlayerPermanently(this.room, player.id);
    }, RECONNECT_GRACE_MS);

    return { room: this.room, playerId: player.id, temporarilyDisconnected: true };
  }

  _removePlayerPermanently(room, playerId) {
    if(!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    for (const charId of player.characterIds) {
      room.characters.delete(charId);
      room.teams.A = room.teams.A.filter((id) => id !== charId);
      room.teams.B = room.teams.B.filter((id) => id !== charId);
    }
    room.players.delete(playerId);

    const stillConnected = [...room.players.values()].some((p) => p.connected);
    if (player.isHost || !stillConnected) {
      this.room = null;
      this.onRoomClosed( "재접속하지 않아 방이 종료되었습니다.");
    }
  }

  /**
   * 플레이어 준비 상태 전환
   * @param {*} playerId 
   * @param {*} ready 
   * @returns 
   */
  setReady(playerId, ready) {
    if (!this.room) throw new Error("방을 찾을 수 없습니다.");
    const player = this.room.players.get(playerId);
    if (!player) throw new Error("플레이어를 찾을 수 없습니다.");
    if (player.isHost) throw new Error("호스트는 준비 상태가 필요 없습니다.");

    player.ready = ready;
    return this.room;
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
        position: def.position || "아이기스",
        skill: def.skill  || "엄호",
        stats: {
          hp: def.hp || 1,
          hp_stat: def.hp_stat || 1,
          power: def.power || 1,
          dex: def.dex || 1,
          mnd: def.mnd || 1,
          luck: def.luck || 1,
        },
        team: null,
        alive: true,
      });
      player.characterIds.push(charId);
      return charId;
    });

    return created;
  }

  setTeamName(playerId, team, name) {
    if (!this.room) throw new Error("방을 찾을 수 없습니다.");
    const player = this.room.players.get(playerId);
    if (!player?.isHost) throw new Error("호스트만 팀 이름을 바꿀 수 있습니다.");
    if (!["A", "B"].includes(team)) throw new Error("잘못된 팀입니다.");

    const trimmed = (name || "").trim().slice(0, 20);
    this.room.teamNames[team] = trimmed || (team === "A" ? "A팀" : "B팀");
    return this.room;
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
    const nonHostPlayers = [...room.players.values()].filter((p) => !p.isHost);
    const allReady = nonHostPlayers.every((p) => p.ready);
    if (!allReady) {
      throw new Error("아직 준비를 완료하지 않은 플레이어가 있습니다.");
    }
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
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        characterIds: p.characterIds,
        connected: p.connected,
        ready: p.ready,
      })),
      characters: [...room.characters.values()],
      teams: room.teams,
      teamNames: room.teamNames,
      turnNumber: room.turn.number,
      chat: room.chatHistory,
    };
  }

  listSummaries() {
    if (!this.room) return [];
    return [
      {
        phase: this.room.phase,
        playerCount: [...this.room.players.values()].filter((p) => p.connected).length,
        characterCount: this.room.characters.size,
      },
    ];
  }

  getRoom(code="") {
    return this.room;
  }

  /**
   * 메시지를 전송하는 메서드
   * @param {*} playerId 
   * @param {*} text 
   * @param {*} speakAs 
   * @returns 
   */
  postChatMessage(playerId, text, speakAs) {
    if (!this.room) throw new Error("방을 찾을 수 없습니다.");
    const player = this.room.players.get(playerId);
    if (!player) throw new Error("플레이어를 찾을 수 없습니다.");

    const trimmed = (text || "").trim();
    if (!trimmed) throw new Error("빈 메시지는 보낼 수 없습니다.");

    let displayName = player.name;
    if (speakAs && speakAs !== "player") {
      const character = this.room.characters.get(speakAs);
      if (!character || character.ownerId !== playerId) {
        throw new Error("본인 소유 캐릭터로만 말할 수 있습니다.");
      }
      displayName = character.name;
    }

    const message = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      displayName,
      text: trimmed.slice(0, 300),
      timestamp: Date.now(),
    };

    this.room.chatHistory.push(message);
    if (this.room.chatHistory.length > 100) this.room.chatHistory.shift();

    return message;
  }
}

module.exports = { RoomManager };