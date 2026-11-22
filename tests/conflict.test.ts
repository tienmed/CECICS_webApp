import { describe, expect, it } from 'vitest';
import { findConflicts, findLecturerConflicts, findRoomConflicts } from '@/core/conflict';
import { suggestAvailableRooms, suggestFreeLecturerSlots } from '@/core/suggest';
import { buildMockSeed } from '@/lib/mock-seed';

describe('Kiểm tra trùng lịch & gợi ý', () => {
  it('không tính trùng ở biên thời gian (kết thúc 09:00 - bắt đầu 09:00)', () => {
    const existing = [
      {
        id: 'S1',
        resourceId: 'P-HH-101',
        start: Date.UTC(2026, 10, 20, 0, 0), // 07:00 VN
        end: Date.UTC(2026, 10, 20, 2, 0), // 09:00 VN
      },
    ];
    const adj = {
      id: 'S2',
      resourceId: 'P-HH-101',
      start: Date.UTC(2026, 10, 20, 2, 0), // 09:00 VN
      end: Date.UTC(2026, 10, 20, 4, 0), // 11:00 VN
    };
    expect(findConflicts(adj, existing)).toHaveLength(0);

    const overlap = {
      id: 'S3',
      resourceId: 'P-HH-101',
      start: Date.UTC(2026, 10, 20, 1, 59),
      end: Date.UTC(2026, 10, 20, 3, 0),
    };
    expect(findConflicts(overlap, existing)).toHaveLength(1);
  });

  it('chặn trùng giảng viên ngay cả khi dạy ở 2 cơ sở khác nhau', () => {
    const db = buildMockSeed(new Date('2026-11-19T03:00:00Z'));
    const existing = db.Sessions[0]; // campus HH, U-2026-0007
    const conflicts = findLecturerConflicts(
      {
        id: '__NEW__',
        ngay: existing.ngay,
        gio_bd: existing.gio_bd,
        gio_kt: existing.gio_kt,
        giang_vien_id: existing.giang_vien_id,
      },
      db.Sessions
    );
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].session_id).toBe(existing.session_id);

    const freeSlots = suggestFreeLecturerSlots({
      excludeId: '__NEW__',
      giang_vien_id: existing.giang_vien_id,
      ngay: existing.ngay,
      gio_bd: existing.gio_bd,
      gio_kt: existing.gio_kt,
      sessions: db.Sessions,
    });
    expect(freeSlots.length).toBeGreaterThan(0);
  });

  it('kiểm tra trùng phòng chéo giữa Sessions và SimClasses + chỉ gợi ý phòng cùng cơ sở', () => {
    const db = buildMockSeed(new Date('2026-11-19T03:00:00Z'));
    const sim = db.SimClasses[0]; // P-HH-101
    const conflicts = findRoomConflicts(
      {
        id: '__NEW__',
        ngay: sim.ngay,
        gio_bd: sim.gio_bd,
        gio_kt: sim.gio_kt,
        room_id: sim.room_id,
      },
      db.Sessions,
      db.SimClasses
    );
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe('sim');

    const suggestions = suggestAvailableRooms({
      excludeId: '__NEW__',
      campus_id: sim.campus_id,
      ngay: sim.ngay,
      gio_bd: sim.gio_bd,
      gio_kt: sim.gio_kt,
      rooms: db.Rooms,
      sessions: db.Sessions,
      simClasses: db.SimClasses,
    });
    expect(suggestions.every((s) => s.room.campus_id === 'HH')).toBe(true);
    expect(suggestions.some((s) => s.room.room_id === 'P-HH-101')).toBe(false);
  });
});
