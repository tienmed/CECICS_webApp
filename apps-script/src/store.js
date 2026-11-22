/**
 * Triển khai DataStore chạy trực tiếp trên Google Sheets (bên trong LockService).
 */
function createSheetsStore_(spreadsheet) {
  var core = CECICS_CORE;

  function getSheet_(tableName) {
    var sheet = spreadsheet.getSheetByName(tableName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(tableName);
      sheet.appendRow(core.columnsOf(tableName));
    }
    return sheet;
  }

  function readTable_(tableName) {
    var sheet = getSheet_(tableName);
    var lastRow = sheet.getLastRow();
    var cols = core.columnsOf(tableName);
    if (lastRow <= 1) return [];
    var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (!row[0] && row[0] !== 0) continue;
      out.push(core.fromRow(tableName, row));
    }
    return out;
  }

  return {
    getAll: function () {
      var snap = {};
      var names = core.TABLE_NAMES;
      for (var i = 0; i < names.length; i++) {
        snap[names[i]] = readTable_(names[i]);
      }
      return snap;
    },

    append: function (tableName, record) {
      var sheet = getSheet_(tableName);
      sheet.appendRow(core.toRow(tableName, record));
    },

    update: function (tableName, id, patch) {
      var sheet = getSheet_(tableName);
      var cols = core.columnsOf(tableName);
      var idColIdx = cols.indexOf(core.idFieldOf(tableName));
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) throw new Error('NOT_FOUND:' + tableName + ':' + id);
      var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][idColIdx]) === String(id)) {
          var current = core.fromRow(tableName, values[i]);
          var merged = Object.assign({}, current, patch);
          sheet.getRange(i + 2, 1, 1, cols.length).setValues([core.toRow(tableName, merged)]);
          return merged;
        }
      }
      throw new Error('NOT_FOUND:' + tableName + ':' + id);
    },

    removeByPredicate: function (tableName, predicate) {
      var sheet = getSheet_(tableName);
      var cols = core.columnsOf(tableName);
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;
      var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
      // Xóa từ dưới lên để không lệch chỉ số dòng
      for (var i = values.length - 1; i >= 0; i--) {
        var rec = core.fromRow(tableName, values[i]);
        if (predicate(rec)) {
          sheet.deleteRow(i + 2);
        }
      }
    },
  };
}
