const Store = require("electron-store");

const store = new Store({
  name: "game-host-config",
  defaults: {
    localPort: 4000,
    matchSettings: {
      teamSize: 3, // 3:3 기본, 1~3 가변
      allowMultiCharacterPerPlayer: true,
      turnTimeLimitSec: 300,
      resolutionTimeLimitSec: 60,
      maxCharactersPerPlayer: 3,
      maxStat: 8,
      maxStatSum: 24,
      maxRound: 8,
      minRunRound: 6,
      maxAttackers: 2,
      allowAsymmetricBattles: true,
    },
    sheetConfig: {
      spreadsheetId: "https://docs.google.com/spreadsheets/d/1inaUp21mijBCxT5oafh47aV6z2MJlhO21ZE0wGjR0-E/edit?usp=sharing",
      sheetName: "2차",
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
