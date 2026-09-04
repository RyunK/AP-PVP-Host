const { app, BrowserWindow, ipcMain, shell, clipboard } = require("electron");
const path = require("path");

const { startServer, stopServer } = require("./server");
const { startTunnel, stopTunnel } = require("./tunnel");
const store = require("./store");

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
    backgroundColor: "#14171c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

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
  });
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
      `터널 생성 실패: ${err.message} (같은 와이파이라면 로컬 IP로도 접속 가능합니다)`
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
  if (serverHandle) serverHandle.reloadFormulas();
  return result;
});

ipcMain.handle("kick-player", (_evt, { roomCode, playerId }) => {
  if (serverHandle) serverHandle.kickPlayer(roomCode, playerId);
  return true;
});
