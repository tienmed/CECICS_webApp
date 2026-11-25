/**
 * Đồng bộ sự kiện lên Google Calendar của tài khoản trung tâm cecics@pnt.edu.vn,
 * Tự động add người liên quan vào event và TUYỆT ĐỐI KHÔNG GỬI EMAIL MỜI (sendInvites: false).
 */
function getCenterCalendar_() {
  var calId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  return calId ? CalendarApp.getCalendarById(calId) : CalendarApp.getDefaultCalendar();
}

function parseVnDateTime_(ymd, hhmm) {
  var parts = String(ymd).split('-');
  var t = String(hhmm).split(':');
  // Apps Script project đặt timeZone Asia/Ho_Chi_Minh nên new Date(y, m-1, d, h, min) dùng giờ VN
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(t[0]), Number(t[1]), 0);
}

/**
 * Lấy danh sách email cần add vào event tùy theo loại buổi học/họp/coi thi.
 */
function getSessionAttendeesEmails_(session, db, additionalEmail) {
  var emails = [];
  var seen = {};

  function addEmail(em) {
    if (!em) return;
    var clean = String(em).trim().toLowerCase();
    if (clean && clean.indexOf('@') !== -1 && !seen[clean]) {
      seen[clean] = true;
      emails.push(clean);
    }
  }

  // 1. Nếu là Cuộc họp CECICS hoặc phân công U-CECICS-ALL: Thêm toàn bộ nhân sự CECICS và Lãnh đạo
  if (session.loai === 'Họp' || session.giang_vien_id === 'U-CECICS-ALL') {
    if (db && db.Users) {
      for (var u = 0; u < db.Users.length; u++) {
        var user = db.Users[u];
        var roles = user.vai_tro || [];
        var isCecics = user.don_vi === 'CECICS' ||
                       user.don_vi === 'BAN_LANH_DAO' ||
                       roles.indexOf('ADMIN') !== -1 ||
                       roles.indexOf('LANH_DAO') !== -1 ||
                       roles.indexOf('DIEU_PHOI') !== -1;
        if (isCecics) {
          addEmail(user.email);
          if (user.email_ca_nhan) addEmail(user.email_ca_nhan);
        }
      }
    }
    // Đảm bảo có email admin & cecics
    addEmail('cecics@pnt.edu.vn');
    addEmail('bstien@pnt.edu.vn');
    addEmail('thunnp@pnt.edu.vn');
    return emails;
  }

  // 2. Nếu là Giảng dạy hoặc Coi thi thông thường
  if (db && db.Users && session.giang_vien_id) {
    for (var i = 0; i < db.Users.length; i++) {
      if (db.Users[i].user_id === session.giang_vien_id) {
        addEmail(db.Users[i].email);
        if (db.Users[i].email_ca_nhan) addEmail(db.Users[i].email_ca_nhan);
        break;
      }
    }
  }

  if (additionalEmail) {
    addEmail(additionalEmail);
  }

  return emails;
}

function applyCalendarEffects_(store, calendarSyncList) {
  if (!calendarSyncList || !calendarSyncList.length) return;
  var cal = getCenterCalendar_();
  if (!cal) return;

  var db = store.getAll();

  for (var i = 0; i < calendarSyncList.length; i++) {
    var item = calendarSyncList[i];
    var s = item.session;
    try {
      if (item.op === 'delete') {
        if (s.calendar_event_id) {
          var delEv = cal.getEventById(s.calendar_event_id);
          if (delEv) delEv.deleteEvent();
        }
        continue;
      }

      var badgePrefix = s.loai === 'Coi thi' ? '[Coi thi] ' : s.loai === 'Họp' ? '[Họp CECICS] ' : '[Lịch giảng] ';
      var classLabel = s.lop ? '[' + s.lop + '] ' : '';
      var title = badgePrefix + classLabel + (s.bai_giang || s.hoc_phan);

      var start = parseVnDateTime_(s.ngay, s.gio_bd);
      var end = parseVnDateTime_(s.ngay, s.gio_kt);
      var location = (item.roomName ? item.roomName + ' — ' : '') + (s.campus_id === 'HH' ? 'Cơ sở Hòa Hưng' : 'Trụ sở Tân Nhựt');
      var desc = [
        'TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)',
        'Trường Đại học Y khoa Phạm Ngọc Thạch',
        '--------------------------------------------------',
        '• Mã buổi: ' + s.session_id,
        '• Loại buổi: ' + s.loai + ' (' + s.he + ')',
        '• Học phần: ' + s.hoc_phan,
        '• Nội dung: ' + (s.bai_giang || 'Theo kế hoạch bộ môn'),
        '• Đối tượng / Lớp: ' + (s.lop || 'Chưa phân lớp'),
        '• Địa điểm: ' + location,
        '• Ghi chú: ' + (s.ghi_chu || 'Không có'),
        '--------------------------------------------------',
        'Sự kiện được đồng bộ tự động từ Hệ thống CECICS Web App.'
      ].join('\n');

      var attendeeEmails = getSessionAttendeesEmails_(s, db, item.lecturerEmail);
      var guestsString = attendeeEmails.join(',');

      var ev = s.calendar_event_id ? cal.getEventById(s.calendar_event_id) : null;
      if (ev) {
        ev.setTitle(title);
        ev.setTime(start, end);
        ev.setLocation(location);
        ev.setDescription(desc);

        // Đồng bộ danh sách khách mà KHÔNG gửi email mời
        var existingGuests = ev.getGuestList();
        var existingMap = {};
        for (var g = 0; g < existingGuests.length; g++) {
          var gem = existingGuests[g].getEmail().toLowerCase();
          existingMap[gem] = true;
          // Nếu khách cũ không còn trong danh sách mới thì xóa
          if (attendeeEmails.indexOf(gem) === -1) {
            try { ev.removeGuest(gem); } catch (e) {}
          }
        }
        for (var a = 0; a < attendeeEmails.length; a++) {
          if (!existingMap[attendeeEmails[a]]) {
            try { ev.addGuest(attendeeEmails[a]); } catch (e) {}
          }
        }
      } else {
        // TẠO EVENT MỚI VỚI sendInvites: false
        ev = cal.createEvent(title, start, end, {
          location: location,
          description: desc,
          guests: guestsString,
          sendInvites: false, // TUYỆT ĐỐI KHÔNG GỬI EMAIL MỜI
        });
        store.update('Sessions', s.session_id, { calendar_event_id: ev.getId() });
      }
    } catch (err) {
      Logger.log('Calendar sync error for ' + s.session_id + ': ' + err);
    }
  }
}

/**
 * Hàm quét và cập nhật lại toàn bộ sự kiện từ 1 mốc ngày trở về sau.
 * Gọi trực tiếp trong Apps Script hoặc qua Action 'retrofitCalendar'.
 */
function retrofitCalendarEventsFromDate_(fromDateStr) {
  var targetDate = fromDateStr || '2026-11-23';
  var ss = getTargetSpreadsheet_();
  var store = createSheetsStore_(ss);
  var db = store.getAll();
  var cal = getCenterCalendar_();
  if (!cal) throw new Error('Không tìm thấy Calendar mặc định của tài khoản cecics@pnt.edu.vn');

  var roomMap = {};
  for (var r = 0; r < db.Rooms.length; r++) {
    roomMap[db.Rooms[r].room_id] = db.Rooms[r].ten;
  }
  var userMap = {};
  for (var u = 0; u < db.Users.length; u++) {
    userMap[db.Users[u].user_id] = db.Users[u];
  }

  var syncList = [];
  for (var i = 0; i < db.Sessions.length; i++) {
    var s = db.Sessions[i];
    if (s.trang_thai === 'Đã hủy') continue;
    if (s.ngay >= targetDate) {
      var rids = (s.room_id || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
      var roomName = rids.length > 0 ? rids.map(function(id) { return roomMap[id] || id; }).join(', ') : 'Chưa gán phòng';
      var gv = userMap[s.giang_vien_id];
      syncList.push({
        op: 'upsert',
        session: s,
        lecturerEmail: gv ? gv.email : undefined,
        roomName: roomName
      });
    }
  }

  applyCalendarEffects_(store, syncList);
  return {
    ok: true,
    targetDate: targetDate,
    totalProcessed: syncList.length,
    message: 'Đã hoàn tất đồng bộ ' + syncList.length + ' sự kiện trên Google Calendar từ ' + targetDate + ' (không gửi email).'
  };
}

/**
 * Trigger 15 phút/lần: đọc trạng thái xác nhận tham dự (RSVP) từ Calendar về tab Sessions.
 */
function syncCalendarRsvp_() {
  var ss = getTargetSpreadsheet_();
  var store = createSheetsStore_(ss);
  var db = store.getAll();
  var cal = getCenterCalendar_();
  if (!cal) return;

  var userById = {};
  for (var i = 0; i < db.Users.length; i++) {
    userById[db.Users[i].user_id] = db.Users[i];
  }
  var today = CECICS_CORE.todayVnYmd(new Date());

  for (var j = 0; j < db.Sessions.length; j++) {
    var s = db.Sessions[j];
    if (s.trang_thai === 'Đã hủy' || !s.calendar_event_id || s.ngay < today) continue;
    try {
      var ev = cal.getEventById(s.calendar_event_id);
      if (!ev) continue;
      var lec = userById[s.giang_vien_id];
      if (!lec) continue;
      var guest = ev.getGuestByEmail(lec.email);
      if (!guest) continue;
      var st = guest.getGuestStatus();
      var mapped = 'Chờ phản hồi';
      if (st === CalendarApp.GuestStatus.YES) mapped = 'Đã đồng ý';
      else if (st === CalendarApp.GuestStatus.NO) mapped = 'Từ chối';
      else if (st === CalendarApp.GuestStatus.MAYBE) mapped = 'Chưa chắc';
      if (mapped !== s.rsvp) {
        store.update('Sessions', s.session_id, { rsvp: mapped });
      }
    } catch (err) {
      Logger.log('RSVP sync error ' + s.session_id + ': ' + err);
    }
  }
}
