/**
 * Tiện ích thanh toán VietQR và sinh tệp iCalendar (.ics) / Google Calendar link cho lớp đào tạo CME.
 * Phục vụ Trung tâm CECICS — Trường Đại học Y khoa Phạm Ngọc Thạch.
 * 
 * Quy chuẩn Calendar:
 * Thêm email học viên và giảng viên vào ATTENDEE của sự kiện Calendar thuộc tài khoản cecics@pnt.edu.vn
 * (ORGANIZER: cecics@pnt.edu.vn, ATTENDEE: mailto:email_hoc_vien, mailto:cecics@pnt.edu.vn)
 */

export interface CmeBankConfig {
  bankId: string;       // 970403 (Sacombank)
  bankName: string;
  accountNo: string;
  accountName: string;
}

export const OFFICIAL_CME_BANK: CmeBankConfig = {
  bankId: '970403', // Sacombank
  bankName: 'Sacombank - CN Quận 10 TP.HCM',
  accountNo: '060012345678',
  accountName: 'TRUONG DAI HOC Y KHOA PHAM NGOC THACH',
};

/**
 * Sinh cú pháp nội dung chuyển khoản chuẩn hóa
 * Cú pháp: CME <Mã_Khóa> <SĐT_hoặc_CCCD>
 * Ví dụ: CME CME-2026-CC01 0903123456
 */
export function generateCmeTransferMemo(courseCode: string, phoneOrCccd: string): string {
  const cleanCode = (courseCode || '').trim().replace(/[^a-zA-Z0-9-]/g, '');
  const cleanId = (phoneOrCccd || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  return `CME ${cleanCode} ${cleanId}`.trim();
}

/**
 * Sinh URL mã QR VietQR động (chuẩn Napas 247)
 * Sử dụng dịch vụ ảnh VietQR, tự động nhúng STK, Tên thụ hưởng, Số tiền và Nội dung.
 */
export function generateVietQrUrl(params: {
  amount: number;
  memo: string;
  bankConfig?: CmeBankConfig;
}): string {
  const bank = params.bankConfig || OFFICIAL_CME_BANK;
  const encodedMemo = encodeURIComponent(params.memo);
  const encodedName = encodeURIComponent(bank.accountName);
  const amount = Math.max(0, Math.floor(params.amount || 0));

  return `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNo}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${encodedName}`;
}

export interface CmeScheduleSession {
  buoi_so?: number;
  tieu_de: string;
  ngay: string; // YYYY-MM-DD
  gio_bat_dau: string; // HH:mm
  gio_ket_thuc: string; // HH:mm
  dia_diem?: string;
  phong?: string;
  giang_vien?: string;
  noi_dung?: string;
}

/**
 * Định dạng chuỗi ngày giờ theo chuẩn iCalendar UTC (YYYYMMDDTHHmmssZ)
 */
function formatIcsDateTime(dateYmd: string, timeHhMm: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const [hh, mm] = timeHhMm.split(':').map(Number);
  // Giả định giờ địa phương VN là UTC+7
  const localDate = new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0));
  return localDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Sinh tệp iCalendar (.ics) cho khóa học CME với toàn bộ các buổi học.
 * Thống nhất chuẩn:
 * - ORGANIZER: cecics@pnt.edu.vn
 * - ATTENDEE: Thêm email học viên (hoặc danh sách học viên) vào ATTENDEE của sự kiện calendar cecics@pnt.edu.vn
 * - METHOD: REQUEST để ứng dụng Calendar (Google Calendar, Apple Calendar, Outlook) tự động ghi nhận và thêm sự kiện vào lịch
 */
export function generateCmeIcsContent(params: {
  courseName: string;
  courseCode: string;
  sessions: CmeScheduleSession[];
  studentName?: string;
  studentEmail?: string;
  lecturerEmail?: string;
  additionalAttendees?: string[];
}): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trung tam CECICS - DH Y khoa Pham Ngoc Thach//CME Calendar Sync//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    `X-WR-CALNAME:Lịch CME - ${params.courseName}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ];

  params.sessions.forEach((s, idx) => {
    const uid = `cme-${params.courseCode}-${s.ngay}-${idx + 1}@cecics.pnt.edu.vn`;
    const dtStart = formatIcsDateTime(s.ngay, s.gio_bat_dau || '08:00');
    const dtEnd = formatIcsDateTime(s.ngay, s.gio_ket_thuc || '11:30');
    const location = [s.phong, s.dia_diem || 'Trung tâm Mô phỏng Lâm sàng CECICS (Lầu 4 - Tòa A3, ĐHYK Phạm Ngọc Thạch)']
      .filter(Boolean)
      .join(', ');

    const description = [
      `TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS) — ĐHYK PHẠM NGỌC THẠCH`,
      `Khóa đào tạo CME: ${params.courseName} (${params.courseCode})`,
      `Buổi: ${s.buoi_so ? `Buổi ${s.buoi_so}: ` : ''}${s.tieu_de}`,
      s.giang_vien ? `Giảng viên: ${s.giang_vien}` : '',
      s.noi_dung ? `Nội dung: ${s.noi_dung}` : '',
      params.studentName ? `Học viên tham dự: ${params.studentName}` : '',
      'Tài khoản điều phối lịch: cecics@pnt.edu.vn',
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:[CME CECICS] ${params.courseName} - ${s.tieu_de}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'ORGANIZER;CN="Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch":mailto:cecics@pnt.edu.vn',
      'STATUS:CONFIRMED',
      'SEQUENCE:0'
    );

    // THỐNG NHẤT: Thêm email học viên vào ATTENDEE của event calendar cecics@pnt.edu.vn
    if (params.studentEmail && params.studentEmail.includes('@')) {
      const cn = params.studentName ? `CN="${params.studentName}"` : 'CN="Học viên CME"';
      lines.push(
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;${cn}:mailto:${params.studentEmail}`
      );
    }

    // Thêm email giảng viên nếu có
    if (params.lecturerEmail && params.lecturerEmail.includes('@') && params.lecturerEmail !== params.studentEmail) {
      lines.push(
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="Giảng viên CME":mailto:${params.lecturerEmail}`
      );
    }

    // Luôn giữ attendee chính cecics@pnt.edu.vn
    lines.push(
      'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="Điều phối CECICS":mailto:cecics@pnt.edu.vn'
    );

    // Thêm các attendee bổ sung khác nếu có
    if (params.additionalAttendees && Array.isArray(params.additionalAttendees)) {
      params.additionalAttendees.forEach((email) => {
        if (email && email.includes('@') && email !== params.studentEmail && email !== 'cecics@pnt.edu.vn') {
          lines.push(
            `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:${email}`
          );
        }
      });
    }

    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Nhắc lịch học lớp CME CECICS',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Sinh liên kết "Thêm vào Google Calendar" trực tiếp trên trình duyệt
 */
export function generateDirectGoogleCalendarLink(params: {
  courseName: string;
  courseCode: string;
  session: CmeScheduleSession;
  studentEmail?: string;
}): string {
  const dtStart = formatIcsDateTime(params.session.ngay, params.session.gio_bat_dau || '08:00');
  const dtEnd = formatIcsDateTime(params.session.ngay, params.session.gio_ket_thuc || '11:30');
  const text = encodeURIComponent(`[CME CECICS] ${params.courseName} - ${params.session.tieu_de}`);
  const details = encodeURIComponent(
    `Khóa học CME: ${params.courseName} (${params.courseCode})\nGiảng viên: ${params.session.giang_vien || 'CECICS'}\nNội dung: ${params.session.noi_dung || ''}\nĐơn vị tổ chức: Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS) - ĐHYK Phạm Ngọc Thạch`
  );
  const location = encodeURIComponent(
    `${params.session.phong || 'Phòng Mô phỏng'}, Trung tâm CECICS - ĐHYK Phạm Ngọc Thạch`
  );
  const addAttendeeParam = params.studentEmail ? `&add=${encodeURIComponent(params.studentEmail)}` : '';

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}${addAttendeeParam}`;
}
