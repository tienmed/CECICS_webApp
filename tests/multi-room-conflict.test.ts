import { describe, expect, it } from 'vitest';
import { findRoomConflicts, parseRoomIds } from '../src/core/conflict';
import type { SessionRecord, SimClassRecord } from '../src/core/types';

describe('Nghiệp vụ gán đa phòng & kiểm tra xung đột (OSCE / Simulation Multi-Room)', () => {
  it('parseRoomIds xử lý đúng cả chuỗi phân cách dấu phẩy lẫn mảng', () => {
    expect(parseRoomIds('P-HH-101, P-HH-102 , P-HH-103')).toEqual(['P-HH-101', 'P-HH-102', 'P-HH-103']);
    expect(parseRoomIds(['P-HH-101', ' P-HH-102 '])).toEqual(['P-HH-101', 'P-HH-102']);
    expect(parseRoomIds('')).toEqual([]);
    expect(parseRoomIds(undefined)).toEqual([]);
  });

  const baseSessions: SessionRecord[] = [
    {
      session_id: 'S-OSCE-01',
      loai: 'Coi thi',
      he: 'ĐH',
      hoc_phan: 'Thi chạy trạm OSCE Lâm sàng',
      bai_giang: 'Chạy trạm 3 phòng (Simulation, Debriefing, Skills Lab)',
      lop: 'Y2021',
      ngay: '2026-11-25',
      gio_bd: '08:00',
      gio_kt: '11:30',
      campus_id: 'HH',
      giang_vien_id: 'GV-01',
      room_id: 'P-HH-101,P-HH-202,P-HH-102', // Chiếm đồng thời 3 phòng
      trang_thai: 'Đã lên lịch',
      calendar_event_id: '',
      rsvp: '',
      ghi_chu: 'OSCE Trạm 1: P.101 | Trạm 2: P.202 | Trạm 3: P.102',
      tao_boi: 'admin@pnt.edu.vn',
      cap_nhat_luc: '2026-11-20T00:00:00Z',
    },
  ];

  const emptySimClasses: SimClassRecord[] = [];

  it('phát hiện xung đột khi một buổi khác cố đặt vào 1 trong các phòng của buổi OSCE', () => {
    // Buổi S-NEW cố đặt vào P-HH-202 (phòng Phản hồi/Debriefing của buổi OSCE) cùng khung giờ
    const candSession = {
      id: 'S-NEW-01',
      ngay: '2026-11-25',
      gio_bd: '09:00',
      gio_kt: '10:30',
      room_id: 'P-HH-202',
    };

    const conflicts = findRoomConflicts(candSession, baseSessions, emptySimClasses);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].id).toBe('S-OSCE-01');
    expect(conflicts[0].resourceId).toBe('P-HH-202');
  });

  it('phát hiện xung đột khi một buổi mới yêu cầu nhiều phòng và có 1 phòng trùng', () => {
    // Buổi S-NEW-02 cần 2 phòng: P-HH-103 (trống) và P-HH-101 (đã bị OSCE chiếm)
    const candSession = {
      id: 'S-NEW-02',
      ngay: '2026-11-25',
      gio_bd: '10:00',
      gio_kt: '11:00',
      room_ids: ['P-HH-103', 'P-HH-101'],
    };

    const conflicts = findRoomConflicts(candSession, baseSessions, emptySimClasses);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].resourceId).toBe('P-HH-101');
  });

  it('không báo xung đột khi đặt vào phòng khác hoàn toàn', () => {
    // Buổi S-NEW-03 đặt vào P-HH-201 (không nằm trong 3 phòng của OSCE)
    const candSession = {
      id: 'S-NEW-03',
      ngay: '2026-11-25',
      gio_bd: '08:00',
      gio_kt: '11:30',
      room_id: 'P-HH-201',
    };

    const conflicts = findRoomConflicts(candSession, baseSessions, emptySimClasses);
    expect(conflicts.length).toBe(0);
  });

  it('không báo xung đột khi cùng phòng nhưng khác khung giờ (sau khi ca OSCE kết thúc)', () => {
    // Buổi S-NEW-04 đặt vào P-HH-101 lúc 13:00 - 15:00 (buổi chiều)
    const candSession = {
      id: 'S-NEW-04',
      ngay: '2026-11-25',
      gio_bd: '13:00',
      gio_kt: '15:00',
      room_id: 'P-HH-101',
    };

    const conflicts = findRoomConflicts(candSession, baseSessions, emptySimClasses);
    expect(conflicts.length).toBe(0);
  });
});
