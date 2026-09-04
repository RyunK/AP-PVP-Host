const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("host", {
  getInitialState: () => ipcRenderer.invoke("get-initial-state"),
  copyToClipboard: (text) => ipcRenderer.invoke("copy-to-clipboard", text),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  saveMatchSettings: (settings) =>
    ipcRenderer.invoke("save-match-settings", settings),
  syncFormulasFromSheet: (sheetConfig) =>
    ipcRenderer.invoke("sync-formulas-from-sheet", sheetConfig),
  getSheetPresets: () => ipcRenderer.invoke("get-sheet-presets"),
  addSheetPreset: (preset) => ipcRenderer.invoke("add-sheet-preset", preset),
  deleteSheetPreset: (index) => ipcRenderer.invoke("delete-sheet-preset", index),
  kickPlayer: (roomCode, playerId) =>
    ipcRenderer.invoke("kick-player", { roomCode, playerId }),

  onTunnelReady: (cb) =>
    ipcRenderer.on("tunnel:ready", (_e, data) => cb(data)),
  onTunnelError: (cb) =>
    ipcRenderer.on("tunnel:error", (_e, data) => cb(data)),
  onRoomsUpdate: (cb) =>
    ipcRenderer.on("rooms:update", (_e, data) => cb(data)),
  onLogLine: (cb) => ipcRenderer.on("log:line", (_e, line) => cb(line)),
});
