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

/**
 * Hàm công khai (Public Function) để chạy thủ công trên thanh công cụ Apps Script:
 * Quét và cập nhật lại toàn bộ sự kiện từ đầu tuần này (23/11/2026) lên Google Calendar
 * kèm danh sách khách mời (attendees) và TUYỆT ĐỐI KHÔNG GỬI EMAIL MỜI (sendInvites: false).
 */
function retrofitCalendarEvents() {
  var res = retrofitCalendarEventsFromDate_('2026-11-23');
  Logger.log(JSON.stringify(res));
  return res;
}
