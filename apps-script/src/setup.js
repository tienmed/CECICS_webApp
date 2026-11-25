/**
 * Chạy HÀM NÀY 1 LẦN trong Apps Script Editor để:
 * 1) Khởi tạo đủ 17 tab Google Sheets kèm dòng tiêu đề chuẩn.
 * 2) Nạp sẵn 2 cơ sở (Hòa Hưng, Tân Nhựt) và cấu hình mặc định.
 * 3) Cài đặt trigger 15 phút (đồng bộ RSVP) và trigger 07:00 hằng ngày (quét leo thang).
 */
function setupCecicsSheets() {
  var ss = getTargetSpreadsheet_();
  var core = CECICS_CORE;

  // 1. Tạo toàn bộ tab & tiêu đề
  for (var i = 0; i < core.TABLE_NAMES.length; i++) {
    var name = core.TABLE_NAMES[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var cols = core.columnsOf(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#e6f4f1');
    }
  }

  // 2. Nạp 2 cơ sở mặc định nếu tab Campuses đang trống
  var campusSheet = ss.getSheetByName('Campuses');
  if (campusSheet.getLastRow() <= 1) {
    campusSheet.appendRow(['HH', 'Cơ sở A — Hòa Hưng', 'Hòa Hưng, Quận 10, TP.HCM']);
    campusSheet.appendRow(['TN', 'Trụ sở chính — Tân Nhựt', 'Tân Nhựt, Bình Chánh, TP.HCM']);
  }

  // 3. Nạp Settings mặc định nếu đang trống
  var setSheet = ss.getSheetByName('Settings');
  if (setSheet.getLastRow() <= 1) {
    var defaults = [
      ['GAN_PHONG_TRUOC_NGAY', '7', 'Số ngày trước buổi học cần gán phòng'],
      ['CANH_BAO_CHUA_GAN_PHONG_NGAY', '2', 'Cảnh báo/leo thang nếu còn <= N ngày chưa gán phòng'],
      ['HAN_DANG_KY_MO_PHONG_NGAY', '14', 'Hạn đăng ký lớp mô phỏng tối thiểu trước N ngày'],
      ['THIET_BI_HONG_LEO_THANG_NGAY', '7', 'Thiết bị hỏng quá N ngày tự động leo thang Lãnh đạo'],
      ['LOP_TRE_LEO_THANG_NGAY', '3', 'Lớp đăng ký trễ chưa xử lý quá N ngày tự động leo thang'],
      ['LECH_TAI_PHAN_TRAM', '30', 'Ngưỡng % vượt trung bình để cảnh báo lệch tải giảng viên'],
      ['GIO_LAM_VIEC_BD', '07:00', 'Giờ bắt đầu làm việc tính công suất phòng'],
      ['GIO_LAM_VIEC_KT', '17:00', 'Giờ kết thúc làm việc tính công suất phòng'],
      ['NGAY_LAM_VIEC', '1,2,3,4,5,6', 'Ngày làm việc trong tuần (1=T2..6=T7)'],
    ];
    setSheet.getRange(2, 1, defaults.length, 3).setValues(defaults);
  }

  // 4. Cài đặt Trigger (xóa trigger cũ trùng tên trước)
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    var fn = triggers[t].getHandlerFunction();
    if (fn === 'triggerSyncRsvp' || fn === 'triggerDailyChecks') {
      ScriptApp.deleteTrigger(triggers[t]);
    }
  }
  ScriptApp.newTrigger('triggerSyncRsvp').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('triggerDailyChecks').timeBased().atHour(7).everyDays(1).create();

  Logger.log('Khởi tạo Google Sheets & Triggers cho CECICS hoàn tất!');
}
