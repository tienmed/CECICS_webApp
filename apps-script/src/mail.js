/**
 * Gửi email từ hàng đợi Outbox bằng MailApp của tài khoản trung tâm.
 * Xóa dòng đã gửi thành công khỏi Outbox để tránh gửi trùng.
 */
function flushOutbox_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName('Outbox');
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var quota = MailApp.getRemainingDailyQuota();
  if (quota <= 5) return 0;

  var cols = CECICS_CORE.columnsOf('Outbox');
  var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  var sentCount = 0;

  for (var i = values.length - 1; i >= 0; i--) {
    if (sentCount >= quota - 5) break;
    var rec = CECICS_CORE.fromRow('Outbox', values[i]);
    if (!rec.nguoi_nhan) {
      sheet.deleteRow(i + 2);
      continue;
    }
    try {
      MailApp.sendEmail({
        to: rec.nguoi_nhan,
        subject: rec.tieu_de || '[CECICS] Thông báo hệ thống',
        body: rec.noi_dung + '\n\n— Hệ thống Vận hành CECICS',
      });
      sheet.deleteRow(i + 2);
      sentCount++;
    } catch (err) {
      Logger.log('MailApp error to ' + rec.nguoi_nhan + ': ' + err);
    }
  }
  return sentCount;
}
