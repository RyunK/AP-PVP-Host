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
    const roomManager = new RoomManager({ getMatchSettings: () => currentSettings });

    function broadcastRooms() {
      onRoomsChanged?.(roomManager.listSummaries());
    }

    function emitRoomState(room) {
      io.to(room.code).emit("room:state", roomManager.serializeRoom(room));
    }

    io.on("connection", (socket) => {
      onLog?.(`플레이어 연결됨: ${socket.id}`);

      socket.on("room:create", (profile, cb) => {
        try {
          const { room, playerId } = roomManager.createRoom(socket.id, profile);
          socket.join(room.code);
          socket.data.playerId = playerId;
          socket.data.roomCode = room.code;
          cb({ ok: true, code: room.code, playerId, state: roomManager.serializeRoom(room) });
          broadcastRooms();
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("room:join", ({ code, profile }, cb) => {
        try {
          const { room, playerId } = roomManager.joinRoom(code.toUpperCase(), socket.id, profile);
          socket.join(room.code);
          socket.data.playerId = playerId;
          socket.data.roomCode = room.code;
          cb({ ok: true, code: room.code, playerId, state: roomManager.serializeRoom(room) });
          emitRoomState(room);
          broadcastRooms();
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("characters:set", (characterDefs, cb) => {
        try {
          const room = roomManager.getRoom(socket.data.roomCode);
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          const created = roomManager.setCharacters(room, socket.data.playerId, characterDefs);
          cb({ ok: true, characterIds: created });
          emitRoomState(room);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("team:assign", ({ characterId, team }, cb) => {
        try {
          const room = roomManager.getRoom(socket.data.roomCode);
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          roomManager.assignTeam(room, characterId, team);
          cb({ ok: true });
          emitRoomState(room);
        } catch (err) {
          cb({ ok: false, error: err.message });
        }
      });

      socket.on("battle:start", (_payload, cb) => {
        try {
          const room = roomManager.getRoom(socket.data.roomCode);
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
          const room = roomManager.getRoom(socket.data.roomCode);
          if (!room) throw new Error("방을 찾을 수 없습니다.");
          const result = roomManager.submitAction(room, characterId, action);
          cb({ ok: true, waiting: !result.resolved });
          if (result.resolved) {
            io.to(room.code).emit("turn:resolved", result);
            emitRoomState(room);
          } else {
            io.to(room.code).emit("turn:waiting", { waitingFor: result.waitingFor });
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
