import { describe, it, expect } from 'vitest';
import { executeAction } from '../src/core/mutations';
import { buildMockSeed } from '../src/lib/mock-seed';
import type { DatabaseSnapshot, UserRecord } from '../src/core/types';
import type { DataStore } from '../src/core/mutations';

function createInMemoryStore(seed?: DatabaseSnapshot): DataStore {
  const db: DatabaseSnapshot = seed ? JSON.parse(JSON.stringify(seed)) : buildMockSeed();
  return {
    getAll: () => db,
    append: (table, record) => {
      (db[table] as unknown[]).push(record);
    },
    update: (table, id, patch) => {
      const rows = db[table] as Record<string, unknown>[];
      const idKey = table === 'Users' ? 'user_id'
        : table === 'Sessions' ? 'session_id'
        : table === 'Rooms' ? 'room_id'
        : table === 'SwapRequests' ? 'swap_id'
        : table === 'SimClasses' ? 'sim_id'
        : table === 'Equipment' ? 'equipment_id'
        : table === 'Incidents' ? 'incident_id'
        : table === 'Escalations' ? 'esc_id'
        : table === 'Targets' ? 'target_id'
        : table === 'Notifications' ? 'id'
        : table === 'Settings' ? 'khoa'
        : 'row_id';
      const idx = rows.findIndex((r) => r[idKey] === id);
      if (idx === -1) throw new Error(`Record ${id} not found in ${table}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx] as any;
    },
    removeByPredicate: (table, predicate) => {
      const rows = db[table] as Record<string, unknown>[];
      const filtered = rows.filter((r) => !predicate(r as any));
      (db as any)[table] = filtered;
    },
  };
}

describe('Tự động sinh chuỗi lịch họp định kỳ Trung tâm CECICS', () => {
  const adminActor: UserRecord = {
    user_id: 'U-2026-0010',
    email: 'admin@pnt.edu.vn',
    ho_ten: 'Quản trị hệ thống',
    vai_tro: ['ADMIN', 'HANH_CHINH'],
    don_vi: 'HANH_CHINH',
    co_so: 'HH',
    bo_mon_id: '',
    la_nguoi_ngoai: false,
    kich_hoat: true,
  };

  it('sinh thành công chuỗi lịch họp định kỳ 2 tuần 1 lần vào chiều Thứ 4 (14h-16h)', () => {
    const db = buildMockSeed();
    // Xóa các lịch họp cũ để kiểm tra
    db.Sessions = db.Sessions.filter((s) => s.loai !== 'Họp');

    const store = createInMemoryStore(db);
    const now = new Date('2026-11-25T14:00:00+07:00'); // Thứ Tư 25/11/2026

    const res = executeAction(
      store,
      'generateRecurringMeetings',
      { weeksAhead: 8 },
      adminActor.email,
      now
    ) as { data: { createdCount: number; sessions: any[] } };

    expect(res.data.createdCount).toBe(4); // 8 tuần / 2 = 4 buổi
    const sessions = res.data.sessions;
    expect(sessions[0].ngay).toBe('2026-11-25');
    expect(sessions[0].gio_bd).toBe('14:00');
    expect(sessions[0].gio_kt).toBe('16:00');
    expect(sessions[0].loai).toBe('Họp');
    expect(sessions[0].hoc_phan).toBe('CECICS');
    expect(sessions[0].room_id).toBeDefined();

    expect(sessions[1].ngay).toBe('2026-12-09');
    expect(sessions[2].ngay).toBe('2026-12-23');
    expect(sessions[3].ngay).toBe('2027-01-06');
  });

  it('không tạo trùng nếu lịch họp ngày đó đã tồn tại', () => {
    const db = buildMockSeed();
    const store = createInMemoryStore(db);
    const now = new Date('2026-11-25T14:00:00+07:00');

    // Lần 1
    const res1 = executeAction(store, 'generateRecurringMeetings', { weeksAhead: 6 }, adminActor.email, now) as { data: any };
    expect(res1.data.createdCount).toBeGreaterThan(0);

    // Lần 2 chạy lại ngay
    const res2 = executeAction(store, 'generateRecurringMeetings', { weeksAhead: 6 }, adminActor.email, now) as { data: any };
    expect(res2.data.createdCount).toBe(0);
  });
});
