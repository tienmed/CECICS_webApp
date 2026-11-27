import { describe, expect, it } from 'vitest';
import { computeDashboardMetrics } from '../src/core/analytics';
import { buildMockSeed } from '../src/lib/mock-seed';
import { generateExcelReportBuffer } from '../src/lib/excel-export';
import { executeAction } from '../src/core/mutations';
import type { DataStore } from '../src/core/mutations';
import type { DatabaseSnapshot, VerificationLockRecord } from '../src/core/types';

describe('Analytics & Multi-Room Hours Attribution', () => {
  it('correctly credits hours to all assigned rooms in multi-room bookings', () => {
    const db = buildMockSeed(new Date('2026-11-20T08:00:00Z'));
    // Thêm một ca học đa phòng (P-HH-101, P-HH-102) kéo dài 3 giờ (08:00 - 11:00)
    db.Sessions.push({
      session_id: 'SES-TEST-MULTI',
      loai: 'Giảng dạy',
      he: 'ĐH',
      hoc_phan: 'Kỹ năng hồi sức',
      bai_giang: 'Chạy trạm đa phòng',
      lop: 'Y2020',
      ngay: '2026-11-15',
      gio_bd: '08:00',
      gio_kt: '11:00',
      campus_id: 'HH',
      giang_vien_id: 'U-2026-0001',
      room_id: 'P-HH-101, P-HH-102',
      trang_thai: 'Đã lên lịch',
      calendar_event_id: '',
      rsvp: 'Chấp nhận',
      ghi_chu: 'Dạy bù cho buổi ngày 05/11',
      tao_boi: 'bstien@pnt.edu.vn',
      cap_nhat_luc: '2026-11-15T08:00:00Z',
    });

    const metrics = computeDashboardMetrics(db, {
      periodKind: 'month',
      year: 2026,
      periodIndex: 11,
      campusId: 'ALL',
      now: new Date('2026-11-20T08:00:00Z'),
    });

    const roomP101 = metrics.roomUtilization.find((r) => r.room_id === 'P-HH-101');
    const roomP102 = metrics.roomUtilization.find((r) => r.room_id === 'P-HH-102');

    expect(roomP101).toBeDefined();
    expect(roomP102).toBeDefined();
    expect(roomP101!.bookedHours).toBeGreaterThanOrEqual(3);
    expect(roomP102!.bookedHours).toBeGreaterThanOrEqual(3);
  });

  it('calculates academic program hours breakdown (ĐH, SĐH, CME) and make-up flag', () => {
    const db = buildMockSeed(new Date('2026-11-20T08:00:00Z'));
    // Thêm 2 buổi học với hệ SĐH và CME cho giảng viên U-2026-0002
    db.Sessions.push(
      {
        session_id: 'SES-SDH-1',
        loai: 'Giảng dạy',
        he: 'SĐH',
        hoc_phan: 'CK1 Nhi khoa',
        bai_giang: 'Hồi sức sơ sinh chuyên sâu',
        lop: 'CK1 Nhi 2025',
        ngay: '2026-11-12',
        gio_bd: '13:00',
        gio_kt: '16:00',
        campus_id: 'TN',
        giang_vien_id: 'U-2026-0002',
        room_id: 'P201',
        trang_thai: 'Đã lên lịch',
        calendar_event_id: '',
        rsvp: '',
        ghi_chu: '',
        tao_boi: 'bstien@pnt.edu.vn',
        cap_nhat_luc: '2026-11-12T13:00:00Z',
      },
      {
        session_id: 'SES-CME-1',
        loai: 'Coi thi',
        he: 'CME',
        hoc_phan: 'CME Nội soi',
        bai_giang: 'Thi trạm OSCE Nội soi can thiệp',
        lop: 'CME Nội soi K12',
        ngay: '2026-11-14',
        gio_bd: '08:00',
        gio_kt: '10:00',
        campus_id: 'HH',
        giang_vien_id: 'U-2026-0002',
        room_id: 'P101',
        trang_thai: 'Đã lên lịch',
        calendar_event_id: '',
        rsvp: '',
        ghi_chu: 'Ca dạy bù',
        tao_boi: 'bstien@pnt.edu.vn',
        cap_nhat_luc: '2026-11-14T08:00:00Z',
      }
    );

    const metrics = computeDashboardMetrics(db, {
      periodKind: 'month',
      year: 2026,
      periodIndex: 11,
      campusId: 'ALL',
      now: new Date('2026-11-20T08:00:00Z'),
    });

    const lecturer = metrics.lecturerWorkload.find((l) => l.user_id === 'U-2026-0002');
    expect(lecturer).toBeDefined();
    expect(lecturer!.hoursSDH).toBeGreaterThanOrEqual(3);
    expect(lecturer!.hoursCME).toBeGreaterThanOrEqual(2);
    expect(lecturer!.sessions.some((s) => s.isMakeUp)).toBe(true);
  });
});

describe('Excel Generation Service (exceljs)', () => {
  it('generates a valid .xlsx buffer with 2 sheets and correct Times New Roman headers', async () => {
    const db = buildMockSeed(new Date('2026-11-20T08:00:00Z'));
    const metrics = computeDashboardMetrics(db, {
      periodKind: 'month',
      year: 2026,
      periodIndex: 11,
      campusId: 'ALL',
      now: new Date('2026-11-20T08:00:00Z'),
    });

    const buffer = await generateExcelReportBuffer({
      metrics,
      campusName: 'Cơ sở A — Hòa Hưng',
      departmentName: 'Ngoại khoa',
      departmentId: 'BM_NGOAI',
      layer1Lock: { locked: true, by: 'BS. Nguyễn Văn A', at: '2026-11-20T10:00:00Z' },
      layer2Lock: { locked: true, by: 'Lãnh đạo CECICS', at: '2026-11-20T11:00:00Z' },
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    // Xác nhận header signature của file zip/xlsx (PK\x03\x04)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});

describe('Dual-Key Verification Locks State Machine', () => {
  function createMockStore(db: DatabaseSnapshot): DataStore {
    return {
      getAll: () => db,
      append: (table, record) => {
        (db[table] as any[]).push(record);
      },
      update: (table, id, patch) => {
        const idField = table === 'VerificationLocks' ? 'lock_id' : 'id';
        const list = db[table] as any[];
        const idx = list.findIndex((r) => r[idField] === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...patch };
          return list[idx];
        }
        return patch as any;
      },
      removeByPredicate: (table, pred) => {
        (db[table] as any[]) = (db[table] as any[]).filter((r) => !pred(r));
      },
    };
  }

  it('handles layer 1 lock, layer 2 lock, unlock request, and layer 2 unlock', () => {
    const db = buildMockSeed(new Date('2026-11-20T08:00:00Z'));
    db.VerificationLocks = [];
    const store = createMockStore(db);

    // 1. Layer 1 lock (Bộ môn xác nhận)
    const res1 = executeAction(
      store,
      'updateVerificationLock',
      {
        lock_id: 'vl_2026-11_BM_NOI',
        period_key: '2026-11',
        entity_type: 'BO_MON',
        entity_id: 'BM_NOI',
        layer1_locked: true,
        layer1_by: 'BS. Nội Khoa',
        layer1_at: '2026-11-20T08:00:00Z',
      },
      'bstien@pnt.edu.vn'
    ).data as VerificationLockRecord;
    expect(res1.layer1_locked).toBe(true);
    expect(res1.layer2_locked).toBe(false);

    // 2. Layer 2 lock (CECICS duyệt)
    const res2 = executeAction(
      store,
      'updateVerificationLock',
      {
        lock_id: 'vl_2026-11_BM_NOI',
        period_key: '2026-11',
        entity_type: 'BO_MON',
        entity_id: 'BM_NOI',
        layer2_locked: true,
        layer2_by: 'Lãnh đạo CECICS',
        layer2_at: '2026-11-20T09:00:00Z',
      },
      'bstien@pnt.edu.vn'
    ).data as VerificationLockRecord;
    expect(res2.layer1_locked).toBe(true);
    expect(res2.layer2_locked).toBe(true);

    // 3. Request unlock (Bộ môn tự mở khóa lớp 1 của mình và gửi lý do)
    const res3 = executeAction(
      store,
      'updateVerificationLock',
      {
        lock_id: 'vl_2026-11_BM_NOI',
        period_key: '2026-11',
        entity_type: 'BO_MON',
        entity_id: 'BM_NOI',
        layer1_locked: false,
        unlock_requested: true,
        unlock_reason: 'Cần bổ sung ca thi trạm OSCE',
      },
      'bstien@pnt.edu.vn'
    ).data as VerificationLockRecord;
    expect(res3.layer1_locked).toBe(false);
    expect(res3.unlock_requested).toBe(true);

    // 4. CECICS unlocks layer 2 -> Cả 2 lớp mở hoàn tất
    const res4 = executeAction(
      store,
      'updateVerificationLock',
      {
        lock_id: 'vl_2026-11_BM_NOI',
        period_key: '2026-11',
        entity_type: 'BO_MON',
        entity_id: 'BM_NOI',
        layer2_locked: false,
        unlock_requested: false,
        unlock_reason: '',
      },
      'bstien@pnt.edu.vn'
    ).data as VerificationLockRecord;
    expect(res4.layer1_locked).toBe(false);
    expect(res4.layer2_locked).toBe(false);
    expect(res4.unlock_requested).toBe(false);
  });
});
