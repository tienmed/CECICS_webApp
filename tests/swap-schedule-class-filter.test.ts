import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '@/core/types';

describe('Hoán đổi lịch giảng - Lọc buổi đối ứng theo đúng lớp của buổi muốn đổi', () => {
  const mySession: SessionRecord = {
    session_id: 'S-01',
    loai: 'Giảng dạy',
    he: 'ĐH',
    hoc_phan: 'Tiền lâm sàng 1',
    bai_giang: 'Kỹ năng thăm khám tim mạch',
    lop: 'Y2023A',
    ngay: '2026-12-01',
    gio_bd: '08:00',
    gio_kt: '11:30',
    campus_id: 'HH',
    giang_vien_id: 'GV-ME',
    room_id: 'P-HH-101',
    trang_thai: 'Đã lên lịch',
    calendar_event_id: '',
    rsvp: 'Chờ phản hồi',
    ghi_chu: '',
    tao_boi: 'admin',
    cap_nhat_luc: '2026-11-26',
  };

  const colleagueSessions: SessionRecord[] = [
    {
      session_id: 'S-02',
      loai: 'Giảng dạy',
      he: 'ĐH',
      hoc_phan: 'Tiền lâm sàng 1',
      bai_giang: 'Kỹ năng thăm khám hô hấp',
      lop: 'Y2023A', // Cùng lớp Y2023A
      ngay: '2026-12-05',
      gio_bd: '08:00',
      gio_kt: '11:30',
      campus_id: 'HH',
      giang_vien_id: 'GV-BAN',
      room_id: 'P-HH-102',
      trang_thai: 'Đã lên lịch',
      calendar_event_id: '',
      rsvp: 'Chờ phản hồi',
      ghi_chu: '',
      tao_boi: 'admin',
      cap_nhat_luc: '2026-11-26',
    },
    {
      session_id: 'S-03',
      loai: 'Giảng dạy',
      he: 'ĐH',
      hoc_phan: 'Ngoại cơ sở',
      bai_giang: 'Kỹ năng khâu vết thương',
      lop: 'Y2023A', // Cùng lớp Y2023A, khác học phần
      ngay: '2026-12-08',
      gio_bd: '13:30',
      gio_kt: '17:00',
      campus_id: 'HH',
      giang_vien_id: 'GV-BAN-2',
      room_id: 'P-HH-102',
      trang_thai: 'Đã lên lịch',
      calendar_event_id: '',
      rsvp: 'Chờ phản hồi',
      ghi_chu: '',
      tao_boi: 'admin',
      cap_nhat_luc: '2026-11-26',
    },
    {
      session_id: 'S-04',
      loai: 'Giảng dạy',
      he: 'ĐH',
      hoc_phan: 'Tiền lâm sàng 1',
      bai_giang: 'Kỹ năng thăm khám bụng',
      lop: 'Y2023B', // Khác lớp Y2023B
      ngay: '2026-12-06',
      gio_bd: '08:00',
      gio_kt: '11:30',
      campus_id: 'HH',
      giang_vien_id: 'GV-BAN-3',
      room_id: 'P-HH-101',
      trang_thai: 'Đã lên lịch',
      calendar_event_id: '',
      rsvp: 'Chờ phản hồi',
      ghi_chu: '',
      tao_boi: 'admin',
      cap_nhat_luc: '2026-11-26',
    },
  ];

  it('phải chỉ lọc các buổi còn lại thuộc cùng lớp Y2023A của buổi được chọn', () => {
    const selectedClass = (mySession.lop || '').trim();

    // Logic lọc trong SwapPage
    const targetColleagueSessions = colleagueSessions.filter(
      (s) => (s.lop || '').trim() === selectedClass
    );

    // Kết quả chỉ được chứa S-02 và S-03 (cùng lớp Y2023A), loại trừ hoàn toàn S-04 (lớp Y2023B)
    expect(targetColleagueSessions.map((s) => s.session_id)).toEqual(['S-02', 'S-03']);
    expect(targetColleagueSessions.some((s) => s.lop === 'Y2023B')).toBe(false);
  });
});
