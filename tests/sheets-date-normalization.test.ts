import { describe, it, expect } from 'vitest';
import { parseCell, fromRow } from '../src/core/schema';

describe('parseCell Date & Time normalization from Google Sheets', () => {
  it('converts Excel serial number to YYYY-MM-DD for date fields', () => {
    // 46352 -> 2026-11-26
    // 46353 -> 2026-11-27
    expect(parseCell('string', 46352, 'ngay')).toBe('2026-11-26');
    expect(parseCell('string', 46353, 'ngay')).toBe('2026-11-27');
    // Hỗ trợ trường hợp số serial bị lưu dưới dạng chuỗi ("46349")
    expect(parseCell('string', '46349', 'ngay')).toBe('2026-11-23');
  });

  it('converts Excel fraction to HH:mm for time fields', () => {
    // 0.5625 = 13.5 hours = 13:30
    // 0.7083333333333334 = 17 hours = 17:00
    expect(parseCell('string', 0.5625, 'gio_bd')).toBe('13:30');
    expect(parseCell('string', 0.7083333333333334, 'gio_kt')).toBe('17:00');
    // Hỗ trợ trường hợp fraction bị lưu dưới dạng chuỗi ("0.5625")
    expect(parseCell('string', '0.5625', 'gio_bd')).toBe('13:30');
    expect(parseCell('string', '0.7083333333333334', 'gio_kt')).toBe('17:00');
  });

  it('normalizes ISO UTC date strings to Vietnam time (UTC+7)', () => {
    // 2026-11-25T17:00:00.000Z + 7h = 2026-11-26T00:00:00.000Z
    expect(parseCell('string', '2026-11-25T17:00:00.000Z', 'ngay')).toBe('2026-11-26');
    // 1899-12-30T06:23:30.000Z + 7h06m30s (Saigon historic LMT) = 13:30
    expect(parseCell('string', '1899-12-30T06:23:30.000Z', 'gio_bd')).toBe('13:30');
    // 1899-12-30T09:53:30.000Z + 7h06m30s = 17:00
    expect(parseCell('string', '1899-12-30T09:53:30.000Z', 'gio_kt')).toBe('17:00');
  });

  it('preserves normal string formats', () => {
    expect(parseCell('string', '2026-11-26', 'ngay')).toBe('2026-11-26');
    expect(parseCell('string', '13:30', 'gio_bd')).toBe('13:30');
    expect(parseCell('string', 'P-HH-101', 'room_id')).toBe('P-HH-101');
  });

  it('correctly cleans legacy ISO text strings in parseCell or sanitizeLegacyIsoText', () => {
    const rawText =
      'Buổi "Bệnh học nội khoa - bệnh học ngoại khoa - THI KẾT THÚC HỌC PHẦN (Trắc nghiệm)" ngày 2026-12-02T17:00:00.000Z (1899-12-30T06:23:30.000Z–1899-12-30T08:23:30.000Z) còn 0 ngày nhưng chưa gán phòng.';
    const cleaned = parseCell('string', rawText, 'ly_do');
    expect(cleaned).toContain('ngày 03/12/2026');
    expect(cleaned).toContain('(13:30–15:30)');
    expect(cleaned).not.toContain('1899-12-30');
    expect(cleaned).not.toContain('.000Z');
  });

  it('correctly maps raw sheet row in fromRow', () => {
    const rawRow = [
      'B-TEST-01', // session_id
      'Giảng dạy', // loai
      'ĐH', // he
      'Học phần', // hoc_phan
      'Bài giảng', // bai_giang
      'Lớp', // lop
      46352, // ngay -> 2026-11-26
      0.5625, // gio_bd -> 13:30
      0.7083333333333334, // gio_kt -> 17:00
      'HH', // campus_id
      'U-GV-01', // giang_vien_id
      'P-HH-101', // room_id
      'Đã lên lịch', // trang_thai
      'gcal-123', // calendar_event_id
      'Chờ phản hồi', // rsvp
      'Ghi chú', // ghi_chu
      'admin', // tao_boi
      '2026-11-25T10:00:00.000Z', // cap_nhat_luc
    ];

    const session = fromRow('Sessions', rawRow);
    expect(session.ngay).toBe('2026-11-26');
    expect(session.gio_bd).toBe('13:30');
    expect(session.gio_kt).toBe('17:00');
  });
});
