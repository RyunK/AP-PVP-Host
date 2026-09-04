const Store = require("electron-store");

const store = new Store({
  name: "game-host-config",
  defaults: {
    localPort: 4000,
    matchSettings: {
      teamSize: 3, // 3:3 기본, 1~3 가변
      allowMultiCharacterPerPlayer: true,
      turnTimeLimitSec: 60,
      maxCharactersPerPlayer: 3,
    },
    sheetConfig: {
      spreadsheetId: "",
      formulaRange: "Formulas!A2:D200",
      serviceAccountKeyPath: "",
    },
  },
});

module.exports = store;
