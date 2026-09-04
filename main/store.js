const Store = require("electron-store");

const store = new Store({
  name: "game-host-config",
  defaults: {
    localPort: 4000,
    matchSettings: {
      teamSize: 3, // 3:3 기본, 1~3 가변
      allowMultiCharacterPerPlayer: true,
      turnTimeLimitSec: 300,
      maxCharactersPerPlayer: 3,
      allowAsymmetricBattles: true,
    },
    sheetConfig: {
      spreadsheetId: "",
      formulaRange: "Formulas!A2:D200",
      serviceAccountKeyPath: "",
    },
    sheetPresets: [
      {
        name: "2차",
        spreadsheetId: "https://docs.google.com/spreadsheets/d/1inaUp21mijBCxT5oafh47aV6z2MJlhO21ZE0wGjR0-E/edit?usp=sharing",
        sheetName: "2차",
        isDefault: true,
      },
      {
        name: "최신",
        spreadsheetId: "https://docs.google.com/spreadsheets/d/1inaUp21mijBCxT5oafh47aV6z2MJlhO21ZE0wGjR0-E/edit?usp=sharing",
        sheetName: "최신",
        isDefault: true,
      },
    ],
  },
});

module.exports = store;
