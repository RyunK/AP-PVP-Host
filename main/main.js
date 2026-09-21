const { app, BrowserWindow, ipcMain, shell, clipboard } = require("electron");
const path = require("path");

require('dotenv').config();

const { startServer, stopServer } = require("./server");
const { startTunnel, stopTunnel } = require("./tunnel");
const store = require("./store");
const crypto = require("crypto");

let mainWindow = null;
let serverHandle = null;
let tunnelHandle = null;

const LOCAL_PORT = store.get("localPort") || 4000;

function createWindow() {
  

  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: "#F1F1F1",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // 관리자 창 안에서 외부 링크로 이동하려는 시도를 전부 차단하고, 대신 시스템 브라우저로 엶
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" }; // 새 Electron 창을 띄우지 않음
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    // 우리가 로드한 그 파일(index.html) 자체로의 이동이 아니면 전부 외부로 돌림
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function bootstrap() {
  // 1) 로컬 서버(Express + Socket.io) 시작
  serverHandle = await startServer({
    port: LOCAL_PORT,
    onRoomsChanged: (rooms) => send("rooms:update", rooms),
    onLog: (line) => send("log:line", line),
    initialPasswordHash: store.get("roomPasswordHash"),
  });
  serverHandle.setSheetConfig(store.get("sheetConfig"));
  send("log:line", `로컬 서버 시작됨 (포트 ${LOCAL_PORT})`);

  // 2) Cloudflare Quick Tunnel 시작 → 외부에서 접속 가능한 URL 발급
  try {
    tunnelHandle = await startTunnel(LOCAL_PORT, {
      onLog: (line) => send("log:line", line),
    });
    send("tunnel:ready", { url: tunnelHandle.url });
    send("log:line", `공개 링크 발급됨: ${tunnelHandle.url}`);
  } catch (err) {
    send("tunnel:error", { message: err.message });
    send(
      "log:line",
      `터널 생성 실패: ${err.message} `
    );
  }
}

app.whenReady().then(() => {
  createWindow();
  bootstrap();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  if (tunnelHandle) await stopTunnel(tunnelHandle);
  if (serverHandle) await stopServer(serverHandle);
});

// ---- 렌더러(관리자 UI) ↔ 메인 프로세스 IPC ----

ipcMain.handle("get-initial-state", () => ({
  localPort: LOCAL_PORT,
  tunnelUrl: tunnelHandle ? tunnelHandle.url : null,
  settings: store.get("matchSettings"),
  sheetConfig: store.get("sheetConfig"),
}));

ipcMain.handle("copy-to-clipboard", (_evt, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle("open-external", (_evt, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle("save-match-settings", (_evt, settings) => {
  store.set("matchSettings", settings);
  if (serverHandle) serverHandle.updateMatchSettings(settings);
  return store.get("matchSettings");
});

ipcMain.handle("sync-formulas-from-sheet", async (_evt, sheetConfig) => {
  const { syncFromSheet } = require("./engine/sheetSync");
  const result = await syncFromSheet(sheetConfig);
  store.set("sheetConfig", sheetConfig);
  if (serverHandle) {
    serverHandle.reloadFormulas();
    serverHandle.setSheetConfig(sheetConfig);
  }
  return result;
});

ipcMain.handle("get-sheet-presets", () => store.get("sheetPresets"));
 
ipcMain.handle("add-sheet-preset", (_evt, { name, spreadsheetId, sheetName }) => {
  const presets = store.get("sheetPresets");
  presets.push({ name, spreadsheetId, sheetName, isDefault: false });
  store.set("sheetPresets", presets);
  return presets;
});
 
ipcMain.handle("delete-sheet-preset", (_evt, index) => {
  const presets = store.get("sheetPresets");
  if (presets[index] && !presets[index].isDefault) {
    presets.splice(index, 1);
    store.set("sheetPresets", presets);
  }
  return presets;
});

ipcMain.handle("kick-player", (_evt, { playerId }) => {
  if (serverHandle) serverHandle.kickPlayer(playerId);
  return true;
});

ipcMain.handle("remake-tunnel", async () => {
  try {
    if (tunnelHandle) {
      await stopTunnel(tunnelHandle);
    }
    tunnelHandle = await startTunnel(LOCAL_PORT, {
      onLog: (line) => send("log:line", line),
    });
    send("log:line", `링크 재발급됨: ${tunnelHandle.url}`);
    return { ok: true, url: tunnelHandle.url };
  } catch (err) {
    send("log:line", `터널 재발급 실패: ${err.message}`);
    return { ok: false, error: err.message };
  }
});


function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`; // salt와 hash를 한 문자열에 같이 저장
}

ipcMain.handle("set-room-password", (_evt, password) => {
  try {
    if (!password) {
      store.set("roomPasswordHash", null); // 빈 값이면 비밀번호 해제
    } else {
      store.set("roomPasswordHash", hashPassword(password));
    }
    if (serverHandle) serverHandle.updateRoomPassword(store.get("roomPasswordHash"));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
