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

    // 플레이어는 이 서버가 내려주는 client/ 정적 페이지를 브라우저로 열기만 하면 됩니다.
    app.use(express.static(path.join(__dirname, "..", "client")));
    app.get("/health", (_req, res) => res.json({ ok: true }));

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
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("character:delete", ({ characterId }, cb) => {
        try {
          const room = roomManager.deleteCharacter(socket.data.playerId, characterId);
          cb({ ok: true });
          emitRoomState(room);
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
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("team:rename", ({ team, name }, cb) => {
        try {
          const room = roomManager.setTeamName(socket.data.playerId, team, name);
          cb({ ok: true });
          emitRoomState(room);
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
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("action:submit", ({ characterId, action }, cb) => {
        try {
          const room = roomManager.getRoom();
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          const result = roomManager.submitAction(room, characterId, action);
          cb({ ok: true, waiting: !result.resolved });
          if (result.resolved) {
            io.to("main").emit("turn:resolved", result);
            emitRoomState(room);
          } else {
            io.to("main").emit("turn:waiting", { waitingFor: result.waitingFor });
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
