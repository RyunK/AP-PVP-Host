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
        spreadsheetId: "여기에 실제 시트 링크를 넣어주세요",
        sheetName: "Formulas",
        isDefault: true,
      },
      {
        name: "최신",
        spreadsheetId: "여기에 실제 시트 링크를 넣어주세요",
        sheetName: "Formulas",
        isDefault: true,
      },
    ],
  },
});

module.exports = store;
