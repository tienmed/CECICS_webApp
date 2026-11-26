import { describe, it, expect } from 'vitest';
import {
  generateCmeTransferMemo,
  generateVietQrUrl,
  generateCmeIcsContent,
  generateDirectGoogleCalendarLink,
  OFFICIAL_CME_BANK,
} from '../src/lib/cme-utils';

describe('CME Utilities & Automation Tests', () => {
  it('sinh cú pháp chuyển khoản chuẩn hóa cho học viên', () => {
    const memo = generateCmeTransferMemo('CME-2026-CC01', '0903123456');
    expect(memo).toBe('CME CME-2026-CC01 0903123456');

    const memoSpecialChars = generateCmeTransferMemo('CME/2026/02', '0790-8800-1122');
    expect(memoSpecialChars).toBe('CME CME202602 079088001122');
  });

  it('sinh URL VietQR hợp lệ với đầy đủ cấu hình ngân hàng Sacombank ĐHYK Phạm Ngọc Thạch', () => {
    const qrUrl = generateVietQrUrl({
      amount: 2500000,
      memo: 'CME CME-2026-02 0903123456',
    });

    expect(qrUrl).toContain(`https://img.vietqr.io/image/${OFFICIAL_CME_BANK.bankId}-${OFFICIAL_CME_BANK.accountNo}-compact2.png`);
    expect(qrUrl).toContain('amount=2500000');
    expect(qrUrl).toContain('accountName=TRUONG%20DAI%20HOC%20Y%20KHOA%20PHAM%20NGOC%20THACH');
  });

  it('sinh tệp iCalendar .ics đúng chuẩn và thêm email học viên vào ATTENDEE của cecics@pnt.edu.vn', () => {
    const ics = generateCmeIcsContent({
      courseName: 'Cấp Cứu Ngừng Tuần Hoàn Nâng Cao 2026',
      courseCode: 'CME-2026-CC01',
      studentName: 'TS.BS. Lê Hoàng Long',
      studentEmail: 'bs.lehoanglong@pnt.edu.vn',
      lecturerEmail: 'giangvien@pnt.edu.vn',
      sessions: [
        {
          buoi_so: 1,
          tieu_de: 'Lý thuyết Tiếp cận ACLS & Hồi sức tim phổi',
          ngay: '2026-12-05',
          gio_bat_dau: '08:00',
          gio_ket_thuc: '11:30',
          phong: 'Phòng A3-401',
          giang_vien: 'TS.BS. Phan Văn B',
        },
        {
          buoi_so: 2,
          tieu_de: 'Thực hành kịch bản mô phỏng sốc tim & đặt nội khí quản',
          ngay: '2026-12-06',
          gio_bat_dau: '13:30',
          gio_ket_thuc: '17:00',
          phong: 'Phòng Sim ICU',
          giang_vien: 'ThS.BS. Nguyễn Văn C',
        },
      ],
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('ORGANIZER;CN="Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch":mailto:cecics@pnt.edu.vn');
    expect(ics).toContain('ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="TS.BS. Lê Hoàng Long":mailto:bs.lehoanglong@pnt.edu.vn');
    expect(ics).toContain('ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="Điều phối CECICS":mailto:cecics@pnt.edu.vn');
    expect(ics).toContain('SUMMARY:[CME CECICS] Cấp Cứu Ngừng Tuần Hoàn Nâng Cao 2026 - Lý thuyết Tiếp cận ACLS & Hồi sức tim phổi');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('sinh link mở trực tiếp Google Calendar cho học viên', () => {
    const link = generateDirectGoogleCalendarLink({
      courseName: 'Cấp Cứu Hồi Sức',
      courseCode: 'CME-2026-02',
      session: {
        tieu_de: 'Khai mạc',
        ngay: '2026-12-10',
        gio_bat_dau: '08:00',
        gio_ket_thuc: '11:30',
      },
      studentEmail: 'hocvien@pnt.edu.vn',
    });

    expect(link).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(link).toContain('add=hocvien%40pnt.edu.vn');
  });
});
