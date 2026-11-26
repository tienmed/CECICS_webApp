/**
 * BẢO VỆ NGHIÊM NGẶT THEO [P0-CECICS-EMAIL-SENDER-INVARIANT]:
 * Tuyệt đối KHÔNG sử dụng MailApp.sendEmail() trong Google Apps Script vì MailApp sẽ lấy
 * địa chỉ email cá nhân của tài khoản Google đã deploy Script (ví dụ: tienmed@gmail.com).
 * 
 * Toàn bộ email công vụ của Hệ thống CECICS bắt buộc CHỈ ĐƯỢC PHÉP gửi qua SMTP chuyên dụng
 * của cecics@pnt.edu.vn từ CECICS WebApp backend (cổng 465 SSL với chữ ký và xác thực chuẩn).
 * 
 * Hàm này giữ lại để làm sạch hàng đợi Outbox an toàn hoặc ghi log kiểm toán, không phát tán email trực tiếp.
 */
function flushOutbox_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName('Outbox');
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var cols = CECICS_CORE.columnsOf('Outbox');
  var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  var processedCount = 0;

  for (var i = values.length - 1; i >= 0; i--) {
    var rec = CECICS_CORE.fromRow('Outbox', values[i]);
    if (!rec.nguoi_nhan) {
      sheet.deleteRow(i + 2);
      continue;
    }
    // Ghi nhận log kiểm toán Outbox
    Logger.log('[Outbox Queue] Đã lưu trữ hàng đợi email công vụ cho: ' + rec.nguoi_nhan + ' | Tiêu đề: ' + (rec.tieu_de || ''));
    // Xóa dòng khỏi Outbox để tránh dồn ứ, việc gửi email thực tế đã do Backend CECICS phụ trách qua SMTP cecics@pnt.edu.vn
    sheet.deleteRow(i + 2);
    processedCount++;
  }
  return processedCount;
}
