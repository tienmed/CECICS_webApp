/**
 * Đồng bộ sự kiện lên Google Calendar của tài khoản trung tâm, mời giảng viên làm khách.
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

function applyCalendarEffects_(store, calendarSyncList) {
  if (!calendarSyncList || !calendarSyncList.length) return;
  var cal = getCenterCalendar_();
  if (!cal) return;

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

      var title = '[' + s.loai + ' - ' + s.he + '] ' + s.hoc_phan + ' — ' + s.bai_giang;
      var start = parseVnDateTime_(s.ngay, s.gio_bd);
      var end = parseVnDateTime_(s.ngay, s.gio_kt);
      var location = (item.roomName ? item.roomName + ' - ' : '') + (s.campus_id === 'HH' ? 'Cơ sở Hòa Hưng' : 'Trụ sở Tân Nhật');
      var desc = 'Mã buổi: ' + s.session_id + '\nGhi chú: ' + (s.ghi_chu || 'Không có');

      var ev = s.calendar_event_id ? cal.getEventById(s.calendar_event_id) : null;
      if (ev) {
        ev.setTitle(title);
        ev.setTime(start, end);
        ev.setLocation(location);
        ev.setDescription(desc);
        // Cập nhật khách mời nếu đổi giảng viên
        if (item.lecturerEmail) {
          var guests = ev.getGuestList();
          for (var g = 0; g < guests.length; g++) {
            if (guests[g].getEmail().toLowerCase() !== item.lecturerEmail.toLowerCase()) {
              ev.removeGuest(guests[g].getEmail());
            }
          }
          ev.addGuest(item.lecturerEmail);
        }
      } else {
        ev = cal.createEvent(title, start, end, {
          location: location,
          description: desc,
          guests: item.lecturerEmail || '',
          sendInvites: Boolean(item.lecturerEmail),
        });
        store.update('Sessions', s.session_id, { calendar_event_id: ev.getId() });
      }
    } catch (err) {
      Logger.log('Calendar sync error for ' + s.session_id + ': ' + err);
    }
  }
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
