const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const { RoomManager } = require("./rooms/roomManager");
const { reload: reloadFormulaCache } = require("./engine/formulaLoader");
const store = require("./store");



function startServer({ port, onRoomsChanged, onLog }) {
  return new Promise((resolve) => {
    const app = express();
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, { cors: { origin: "*" } });

    app.use(express.static(path.join(__dirname, "..", "client")));
    app.get("/health", (_req, res) => res.json({ ok: true }));

    // app.use(express.static(path.join(__dirname, 'public')));
    // app.use('/build', express.static(path.join(__dirname, '..',  'build')));

    let currentSettings = store.get("matchSettings");
    const roomManager = new RoomManager({
      getMatchSettings: () => currentSettings,
      onRoomClosed: (reason) => {
       io.to("main").emit("room:closed", { reason });
     },
     onRoomStateChanged: (room) => {
        io.to("main").emit("room:state", roomManager.serializeRoom(room));
        broadcastRooms();
      },
   });

    function broadcastRooms() {
      onRoomsChanged?.(roomManager.listSummaries());
    }

    function emitRoomState(room) {
      io.to("main").emit("room:state", roomManager.serializeRoom(room));
      // console.log("emitRoomState" + room.turn.phase)

    }

    function emitBattleState(room) {
      io.to("main").emit("battle:state", roomManager.serializeRoom(room));
      // console.log("emitBattleState" + room.turn.phase)

    }

    function sendSysMessage(text) {
      const message = roomManager.postSysMessage(text);
      io.to("main").emit("chat:message", message);
    };

    function sendBattleMessage(text) {
      const message = roomManager.postBattleMessage(text);
      io.to("main").emit("chat:message", message);
    }

    function syncPlayerTeamRooms(playerId) {
      const room = roomManager.getRoom();
      if (!room) return;
      const player = room.players.get(playerId);
      const socket = io.sockets.sockets.get(player?.socketId);
      if (!socket) return;
      const myTeams = roomManager.getPlayerTeams(playerId);
      ["A", "B"].forEach((t) => {
        myTeams.includes(t) ? socket.join(`team:${t}`) : socket.leave(`team:${t}`);
      });
    }

    io.on("connection", (socket) => {
      onLog?.(`플레이어 연결됨: ${socket.id}`);

      socket.on("room:enter", (profile, cb) => {
        try {
          const { room, playerId } = roomManager.enterRoom(socket.id, profile);
          socket.join("main"); // socket.io room 이름은 아무 문자열이나 상관없음, 고정값 사용
          socket.data.playerId = playerId;
          cb({ ok: true, playerId, state: roomManager.serializeRoom(room) });
          emitRoomState(room);
          sendSysMessage(`${profile.name}님이 입장했습니다.`);
          broadcastRooms();
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("chat:send", ({ text, speakAs }, cb) => {
        try {
          const message = roomManager.postChatMessage(socket.data.playerId, text, speakAs);
          io.to("main").emit("chat:message", message);
          cb({ ok: true });
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      

      socket.on("room:get-state", (_payload, cb) => {
        const room = roomManager.getRoom();
        if (!room) return cb({ ok: false, error: "방을 찾을 수 없습니다." });
        cb({ ok: true, state: roomManager.serializeRoom(room) });
      });

      socket.on("room:rejoin", ({ playerId }, cb) => {
        try {
          const { room } = roomManager.rejoinRoom(playerId, socket.id);
          socket.join("main");
          socket.data.playerId = playerId;
          cb({ ok: true, state: roomManager.serializeRoom(room) });
          emitRoomState(room);
          broadcastRooms();
          sendSysMessage(`${room.players.get(playerId).name}님이 재접속했습니다.`);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("characters:set", (characterDefs, cb) => {
        try {
          const room = roomManager.getRoom();
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          const created = roomManager.setCharacters(room, socket.data.playerId, characterDefs);
          cb({ ok: true, characterIds: created });
          emitRoomState(room);
          sendSysMessage(`캐릭터 ${created.map((id) => room.characters.get(id).name).join(", ")}가 저장되었습니다.`);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("character:delete", ({ characterId }, cb) => {
        try {
          const room = roomManager.deleteCharacter(socket.data.playerId, characterId);
          cb({ ok: true });
          emitRoomState(room);
          sendSysMessage(`캐릭터 ${room.characters.get(characterId).name}가 삭제되었습니다.`);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("team:assign", ({ characterId, team }, cb) => {
        try {
          const room = roomManager.getRoom();
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          roomManager.assignTeam(room, characterId, team);
          cb({ ok: true });
          emitRoomState(room);
          // sendSysMessage(`캐릭터 ${room.characters.get(characterId).name}의 팀이 ${team}으로 변경되었습니다.`);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("team:rename", ({ team, name }, cb) => {
        try {
          const room = roomManager.setTeamName(socket.data.playerId, team, name);
          cb({ ok: true });
          emitRoomState(room);
          // sendSysMessage(`팀 ${team}의 이름이 ${name}으로 변경되었습니다.`);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("player:ready", ({ ready }, cb) => {
        try {
          const room = roomManager.setReady(socket.data.playerId, ready);
          cb({ ok: true });
          emitRoomState(room);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("battle:start", (_payload, cb) => {
        try {
          const room = roomManager.getRoom();
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          if (room.hostSocketId !== socket.id) throw new Error("호스트만 전투를 시작할 수 있습니다.");
          roomManager.startBattle(room);
          cb({ ok: true });
          emitRoomState(room);
          sendBattleMessage("SYSTEM LOADING...");
          // sendBattleMessage("전투를 시작합니다.");
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("orderCheck:ended", (cb) => {
        try {
          const firstTeam = roomManager.getRoom().turn.firstTeam;
          const room = roomManager.getRoom();
          const beforePhase = room.turn.phase;
          roomManager.endOrderCheck();
          const afterPhase = room.turn.phase;

          cb({ ok: true });
          
          if(beforePhase == "orderCheck" && afterPhase == "vanguard" && !room.onceChecker){
            room.onceChecker = true;

            sendBattleMessage("...SYSTEM INITIALIZATION COMPLETE. 초기 순서 확인 완료.");
            sendBattleMessage("전투 시작.");
            sendBattleMessage(`선공페이즈 개시. ${room.teamNames[firstTeam]} 선언.`);
            emitRoomState(roomManager.getRoom());
            emitBattleState(roomManager.getRoom());
          }
          
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("action:draft", ({ characterId, skillName, targetIds, value }, cb) => {
        try {
          const team = roomManager.draftAction(socket.data.playerId, characterId, skillName, targetIds, value);
          cb({ ok: true });
          io.to(`main`).emit("battle:draft", { characterId, skillName, targetIds, value });
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("action:confirm", ({ characterId, skillName, targetIds, value }, cb) => {
        try {
          const {result, p_name, t_name} = roomManager.confirmAction(socket.data.playerId, characterId, skillName, targetIds, value);
          // console.log(result);
          cb({ ok: true });
          const firstTeam = result.roundLog?.firstTeam;
          const secondTeam = firstTeam == "A"? "B" : "A";
          const teamNames = roomManager.getRoom().teamNames;

          let skillLabel = skillName;
          if(skillName == "침식") skillLabel += `(${value})`

          emitBattleState(roomManager.serializeRoom(roomManager.getRoom()))
          // io.to("main").emit("battle:state", roomManager.serializeRoom(roomManager.getRoom()));
          sendBattleMessage(`선언 확인: ${p_name} → ${t_name} [${skillLabel}]`);

          if (result.roundComplete) {
            io.to("main").emit("round:resolved", result.roundLog);
            sendBattleMessage(`${teamNames[secondTeam]} 전원 선언 확인. 정산페이즈 시작.`);
          } else if (result.phaseComplete){
            sendBattleMessage(`${teamNames[firstTeam]} 전원 선언 확인. 후공페이즈 개시.`);
            sendBattleMessage(`${teamNames[secondTeam]} 선언.`);
          }
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("disconnect", () => {
        onLog?.(`플레이어 연결 종료: ${socket.id}`);
        const result = roomManager.leavePlayer(socket.id);
        if (result?.roomClosed) {
          io.to(result.code).emit("room:closed", { reason: "호스트 또는 마지막 플레이어가 나갔습니다." });
        } else if (result?.room) {
          emitRoomState(result.room);
          sendSysMessage(`${result.playerName}님이 나갔습니다.`);
        }
        broadcastRooms();
      });
    });

    httpServer.listen(port, () => resolve({
      httpServer,
      io,
      updateMatchSettings: (settings) => {
        currentSettings = settings;
      },
      reloadFormulas: () => reloadFormulaCache(),
      kickPlayer: (roomCode, playerId) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        const player = room.players.get(playerId);
        if (!player) return;
        io.sockets.sockets.get(player.socketId)?.disconnect(true);
      },
    }));
  });
}

function stopServer(handle) {
  return new Promise((resolve) => {
    handle.io.close();
    handle.httpServer.close(() => resolve());
  });
}

module.exports = { startServer, stopServer };
