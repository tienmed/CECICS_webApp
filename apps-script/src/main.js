/**
 * Cửa ghi duy nhất (Web App Endpoint) bảo vệ bằng HMAC-SHA256 + LockService.
 */

function getTargetSpreadsheet_() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
}

function computeHmacHex_(secret, message) {
  var raw = Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16);
    hex += b.length === 1 ? '0' + b : b;
  }
  return hex;
}

function verifySignature_(req) {
  var secret = PropertiesService.getScriptProperties().getProperty('HMAC_SECRET');
  if (!secret) throw new Error('SERVER_NOT_CONFIGURED: Thiếu Script Property HMAC_SECRET');
  var ts = Number(req.ts || 0);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    throw new Error('EXPIRED_SIGNATURE: Yêu cầu quá hạn 5 phút');
  }
  var canonical = req.action + '|' + req.actor + '|' + ts + '|' + JSON.stringify(req.payload || {});
  var expected = computeHmacHex_(secret, canonical);
  if (expected !== String(req.sig || '')) {
    throw new Error('INVALID_SIGNATURE: Chữ ký HMAC không hợp lệ');
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonOut_({ ok: true, service: 'CECICS-GAS-Write-Gateway', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    verifySignature_(req);

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return jsonOut_({ ok: false, code: 'LOCK_TIMEOUT', error: 'Hệ thống đang bận ghi dữ liệu, vui lòng thử lại sau vài giây.' });
    }

    try {
      var ss = getTargetSpreadsheet_();
      var store = createSheetsStore_(ss);
      var res = CECICS_CORE.executeAction(store, req.action, req.payload || {}, req.actor, new Date());

      if (res.effects && res.effects.calendarSync) {
        applyCalendarEffects_(store, res.effects.calendarSync);
      }
      flushOutbox_(ss);

      return jsonOut_({ ok: true, data: res.data });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return jsonOut_({
      ok: false,
      code: err && err.code ? err.code : 'INTERNAL_ERROR',
      error: String((err && err.message) || err),
      details: err && err.details ? err.details : undefined,
    });
  }
}
