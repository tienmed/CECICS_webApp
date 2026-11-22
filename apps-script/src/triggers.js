/**
 * Các hàm chạy định kỳ theo Time-driven Triggers của Google Apps Script (miễn phí).
 */

function triggerSyncRsvp() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    syncCalendarRsvp_();
  } finally {
    lock.releaseLock();
  }
}

function triggerDailyChecks() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    var ss = getTargetSpreadsheet_();
    var store = createSheetsStore_(ss);
    var systemActor = PropertiesService.getScriptProperties().getProperty('SYSTEM_ADMIN_EMAIL') || Session.getEffectiveUser().getEmail();
    CECICS_CORE.executeAction(store, 'runDailyChecks', {}, systemActor, new Date());
    flushOutbox_(ss);
  } finally {
    lock.releaseLock();
  }
}
