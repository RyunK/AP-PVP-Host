class GameData {
  constructor() {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("data");

    this.skillTable = this.loadSkillTable(
      sheet.getRange("E1:K12").getValues()
    );

    this.criticalTable = this.loadCriticalTable(
      sheet.getRange("A12:C20").getValues()
    );
  }

  loadSkillTable(values) {
    const result = {};

    values.forEach(row => {
      if (!row[0]) return;

      result[row[0]] = {
        diceCount: Number(row[3]) || 0,
        statBonus: row[4] || "",
        extraDiceCount: Number(row[5]) || 0,
        extraDiceStat: row[6] || ""
      };
    });

    return result;
  }

  loadCriticalTable(values) {
    const result = {};

    values.slice(1).forEach(row => {
      result[row[0]] = {
        chance: Number(row[1]),
        multiplier: Number(row[2])
      };
    });

    return result;
  }
}

