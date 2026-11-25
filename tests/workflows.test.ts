import { describe, expect, it } from 'vitest';
import { computeDashboardMetrics, detectPendingEscalations } from '@/core/analytics';
import { DomainError, executeAction, type DataStore } from '@/core/mutations';
import { evaluateLoginAccess } from '@/core/permissions';
import { idFieldOf, type Rec, type TableName } from '@/core/schema';
import { addDaysYmd, todayVnYmd } from '@/core/time';
import type { DatabaseSnapshot } from '@/core/types';
import { buildMockSeed } from '@/lib/mock-seed';

function createMemoryStore(seed: DatabaseSnapshot): DataStore {
  const db: DatabaseSnapshot = JSON.parse(JSON.stringify(seed));
  return {
    getAll: () => db,
    append<T extends TableName>(table: T, rec: Rec<T>) {
      (db[table] as Rec<T>[]).push(rec);
    },
    update<T extends TableName>(table: T, id: string, patch: Partial<Rec<T>>): Rec<T> {
      const idField = idFieldOf(table);
      const list = db[table] as Record<string, unknown>[];
      const idx = list.findIndex((r) => String(r[idField]) === String(id));
      if (idx === -1) throw new Error(`NOT_FOUND:${table}:${id}`);
      const merged = { ...list[idx], ...patch };
      list[idx] = merged;
      return merged as Rec<T>;
    },
    removeByPredicate<T extends TableName>(table: T, predicate: (rec: Rec<T>) => boolean) {
      (db[table] as Rec<T>[]) = (db[table] as Rec<T>[]).filter((r) => !predicate(r));
    },
  };
}

describe('Luồng nghiệp vụ MVP CECICS', () => {
  const fixedNow = new Date('2026-11-19T03:00:00Z'); // 10:00 giờ VN

  it('kiểm tra quyền đăng nhập domain @pnt.edu.vn và whitelist email ngoài', () => {
    const db = buildMockSeed(fixedNow);
    expect(evaluateLoginAccess('daotao@pnt.edu.vn', db.Users).allowed).toBe(true);
    // GV thỉnh giảng Gmail ngoài có trong whitelist
    expect(evaluateLoginAccess('gv.thinhgiang@gmail.com', db.Users).allowed).toBe(true);
    // Email lạ không có trong danh sách
    expect(evaluateLoginAccess('nguoila@gmail.com', db.Users).allowed).toBe(false);
  });

  it('gán phòng thành công và tự động đồng bộ cơ sở theo phòng đã chọn', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();
    const pendingSession = db.Sessions.find((s) => !s.room_id && s.campus_id === 'HH')!;

    // Gán phòng TN cho buổi học -> thành công và tự động cập nhật cơ sở sang TN
    const resTN = executeAction(
      store,
      'assignRoom',
      { session_id: pendingSession.session_id, room_id: 'P-TN-101' },
      'hanhchinh@pnt.edu.vn',
      fixedNow
    );
    expect((resTN.data as { room_id: string }).room_id).toBe('P-TN-101');
    const updatedSession = store.getAll().Sessions.find((s) => s.session_id === pendingSession.session_id)!;
    expect(updatedSession.campus_id).toBe('TN');

    // Gán lại phòng HH -> tự động cập nhật cơ sở về HH
    const resHH = executeAction(
      store,
      'assignRoom',
      { session_id: pendingSession.session_id, room_id: 'P-HH-201' },
      'hanhchinh@pnt.edu.vn',
      fixedNow
    );
    expect((resHH.data as { room_id: string }).room_id).toBe('P-HH-201');
    expect(store.getAll().Sessions.find((s) => s.session_id === pendingSession.session_id)!.campus_id).toBe('HH');
  });

  it('hoán đổi lịch tự do: người nhận đồng ý -> tự động cập nhật giảng viên không cần duyệt', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();
    const pendingSwap = db.SwapRequests[0];

    executeAction(
      store,
      'respondSwapRequest',
      { swap_id: pendingSwap.swap_id, decision: 'Đồng ý' },
      'linhntm@pnt.edu.vn',
      fixedNow
    );

    expect(db.SwapRequests[0].trang_thai).toBe('Đồng ý');
  });

  it('từ chối hoán đổi lịch kèm lý do: lưu lý do từ chối và gửi thông báo cho người yêu cầu', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();
    const pendingSwap = db.SwapRequests[0];

    executeAction(
      store,
      'respondSwapRequest',
      {
        swap_id: pendingSwap.swap_id,
        decision: 'Từ chối',
        ly_do_tu_choi: 'Trùng lịch phẫu thuật tại Bệnh viện',
      },
      'linhntm@pnt.edu.vn',
      fixedNow
    );

    expect(db.SwapRequests[0].trang_thai).toBe('Từ chối');
    expect(db.SwapRequests[0].ly_do_tu_choi).toBe('Trùng lịch phẫu thuật tại Bệnh viện');
    const notif = db.Notifications.find((n) => n.user_id === pendingSwap.tu_gv);
    expect(notif?.tieu_de).toContain('bị từ chối');
    expect(notif?.noi_dung).toContain('Trùng lịch phẫu thuật');
  });

  it('lớp mô phỏng đăng ký trễ (< 14 ngày) -> Cần xét đặc biệt -> duyệt -> gán thiết bị & chặn thiết bị hỏng', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const today = todayVnYmd(fixedNow);

    // Đăng ký trước 5 ngày (< 14 ngày)
    const created = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-NOI',
        ngay: addDaysYmd(today, 5),
        gio_bd: '08:00',
        gio_kt: '11:00',
        campus_id: 'HH',
        noi_dung: 'Lớp bổ sung cấp cứu',
        so_hoc_vien: 15,
      },
      'bomon.noi@pnt.edu.vn',
      fixedNow
    ).data as { sim_id: string; trang_thai: string; dang_ky_tre: boolean };

    expect(created.dang_ky_tre).toBe(true);
    expect(created.trang_thai).toBe('Cần xét đặc biệt');

    // Trưởng ĐV Kỹ thuật chấp thuận
    executeAction(
      store,
      'approveLateSimClass',
      { sim_id: created.sim_id, decision: 'approve', ghi_chu: 'Đồng ý hỗ trợ' },
      'kythuat@pnt.edu.vn',
      fixedNow
    );

    // Cố tình gán thiết bị đang hỏng (CPR-04-02) -> phải bị chặn
    expect(() =>
      executeAction(
        store,
        'reviewSimClass',
        {
          sim_id: created.sim_id,
          trang_thai: 'Đã duyệt',
          room_id: 'P-HH-101',
          equipment_ids: ['CPR-04-02'],
        },
        'ktv.hung@pnt.edu.vn',
        fixedNow
      )
    ).toThrowError(DomainError);

    // Gán thiết bị hoạt động (CPR-04-01) -> thành công
    const reviewed = executeAction(
      store,
      'reviewSimClass',
      {
        sim_id: created.sim_id,
        trang_thai: 'Đã duyệt',
        room_id: 'P-HH-101',
        equipment_ids: ['CPR-04-01'],
      },
      'ktv.hung@pnt.edu.vn',
      fixedNow
    ).data as { trang_thai: string };
    expect(reviewed.trang_thai).toBe('Đã duyệt');
  });

  it('báo hỏng thiết bị tự động quét lớp tương lai bị ảnh hưởng và cho phép Bộ môn xác nhận phương án', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    // CPR-04-01 đang được gán cho lớp MP-2026-0001 ở tương lai
    const report = executeAction(
      store,
      'reportIncident',
      {
        equipment_id: 'CPR-04-01',
        mo_ta: 'Hỏng nguồn bo mạch chính',
        danh_gia: 'Không kịp',
      },
      'ktv.hung@pnt.edu.vn',
      fixedNow
    ).data as { impacts: { impact_id: string; sim_id: string }[] };

    expect(report.impacts.length).toBe(1);
    const impactId = report.impacts[0].impact_id;

    executeAction(
      store,
      'confirmIncidentImpact',
      { impact_id: impactId, phuong_an: 'Đổi mô hình' },
      'bomon.noi@pnt.edu.vn',
      fixedNow
    );
    const saved = store.getAll().IncidentImpacts.find((i) => i.impact_id === impactId)!;
    expect(saved.bo_mon_xac_nhan).toBe(true);
    expect(saved.phuong_an).toBe('Đổi mô hình');
  });

  it('tính toán dashboard, phát hiện leo thang và Ban Lãnh đạo chỉ đạo', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();

    // Lớp MP-2026-0002 đã chờ xét đặc biệt 4 ngày (> 3 ngày) -> phải phát hiện leo thang mới
    const pendingEsc = detectPendingEscalations(db, fixedNow);
    expect(pendingEsc.some((e) => e.loai === 'LOP_TRE_TON_DONG')).toBe(true);

    executeAction(store, 'runDailyChecks', {}, 'admin@pnt.edu.vn', fixedNow);
    const openEsc = db.Escalations.find((e) => e.trang_thai === 'Đang mở')!;

    executeAction(
      store,
      'resolveEscalation',
      { esc_id: openEsc.esc_id, hanh_dong_ld: 'Chỉ đạo', y_kien: 'Ưu tiên xử lý trong ngày mai.' },
      'truongtt@pnt.edu.vn',
      fixedNow
    );
    const resolved = db.Escalations.find((e) => e.esc_id === openEsc.esc_id)!;
    expect(resolved.trang_thai).toBe('Đã chỉ đạo');

    const metrics = computeDashboardMetrics(db, {
      periodKind: 'month',
      year: 2026,
      periodIndex: 11,
      campusId: 'ALL',
      now: fixedNow,
    });
    expect(metrics.summary.totalSessions).toBeGreaterThan(0);
    expect(metrics.roomUtilization.length).toBe(db.Rooms.length);
  });

  it('chỉ Admin mới được vào phân hệ Quản trị và phân quyền vai trò ADMIN cho người khác', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();
    const target = db.Users.find((u) => u.email === 'hanhchinh@pnt.edu.vn')!;

    // Hành chính (không phải Admin) không được phép phân quyền hoặc sửa người dùng
    expect(() =>
      executeAction(
        store,
        'upsertUser',
        { user_id: target.user_id, email: target.email, vai_tro: [...target.vai_tro, 'ADMIN'] },
        'hanhchinh@pnt.edu.vn',
        fixedNow
      )
    ).toThrowError(DomainError);

    // Admin cấp vai trò ADMIN cho Hành chính -> thành công
    const updated = executeAction(
      store,
      'upsertUser',
      { user_id: target.user_id, email: target.email, vai_tro: [...target.vai_tro, 'ADMIN'] },
      'admin@pnt.edu.vn',
      fixedNow
    ).data as { vai_tro: string[] };
    expect(updated.vai_tro).toContain('ADMIN');
  });

  it('hoán đổi lịch 2 chiều: đổi ngày giữa các giảng viên, không đổi nội dung giảng, phòng đi theo buổi giờ', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();
    const year = fixedNow.getFullYear();

    // Giảng viên A: U-2027-0013 (bstien@pnt.edu.vn) - Buổi B-2027-HA04
    // Giảng viên B: U-2027-0014 (bsquynhphuong@pnt.edu.vn) - Buổi B-2027-HA05
    const sessionA = db.Sessions.find((s) => s.session_id === 'B-2027-HA04')!;
    const sessionB = db.Sessions.find((s) => s.session_id === 'B-2027-HA05')!;

    const origDateA = sessionA.ngay;
    const origTimeA = sessionA.gio_bd;
    const origRoomA = sessionA.room_id;
    const origTopicA = sessionA.bai_giang;

    const origDateB = sessionB.ngay;
    const origTimeB = sessionB.gio_bd;
    const origRoomB = sessionB.room_id;
    const origTopicB = sessionB.bai_giang;

    // GV A gửi đề nghị hoán đổi ngày với GV B
    const swapRes = executeAction(
      store,
      'createSwapRequest',
      {
        session_id: sessionA.session_id,
        den_gv: 'U-2027-0014',
        target_session_id: sessionB.session_id,
        loi_nhan: 'Đổi ngày trực bệnh viện',
      },
      'bstien@pnt.edu.vn',
      fixedNow
    ).data as { swap_id: string; target_session_id: string };

    expect(swapRes.target_session_id).toBe(sessionB.session_id);

    // GV B đồng ý hoán đổi
    executeAction(
      store,
      'respondSwapRequest',
      { swap_id: swapRes.swap_id, decision: 'Đồng ý' },
      'bsquynhphuong@pnt.edu.vn',
      fixedNow
    );

    const afterDb = store.getAll();
    const afterSessionA = afterDb.Sessions.find((s) => s.session_id === sessionA.session_id)!;
    const afterSessionB = afterDb.Sessions.find((s) => s.session_id === sessionB.session_id)!;

    // QUY TẮC CỐT LÕI: Bài ai nấy dạy, phòng đi theo buổi giờ
    // Session A giữ nguyên GV A và bài A, nhưng đổi sang ngày, giờ và phòng của B
    expect(afterSessionA.giang_vien_id).toBe('U-2027-0013');
    expect(afterSessionA.bai_giang).toBe(origTopicA);
    expect(afterSessionA.ngay).toBe(origDateB);
    expect(afterSessionA.gio_bd).toBe(origTimeB);
    expect(afterSessionA.room_id).toBe(origRoomB);

    // Session B giữ nguyên GV B và bài B, nhưng đổi sang ngày, giờ và phòng của A
    expect(afterSessionB.giang_vien_id).toBe('U-2027-0014');
    expect(afterSessionB.bai_giang).toBe(origTopicB);
    expect(afterSessionB.ngay).toBe(origDateA);
    expect(afterSessionB.gio_bd).toBe(origTimeA);
    expect(afterSessionB.room_id).toBe(origRoomA);

    // Kiểm tra Outbox email có tiền tố [AppCECICS]
    const outboxEmails = afterDb.Outbox.filter((o) => o.loai === 'EMAIL');
    expect(outboxEmails.length).toBeGreaterThan(0);
    expect(outboxEmails.every((o) => o.tieu_de.startsWith('[AppCECICS]'))).toBe(true);
  });

  it('rà soát lớp mô phỏng hỗ trợ combo đa phòng (P-HH-101 và P-HH-102)', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const today = todayVnYmd(fixedNow);

    const created = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-NOI',
        ngay: addDaysYmd(today, 20),
        gio_bd: '13:30',
        gio_kt: '16:30',
        campus_id: 'HH',
        noi_dung: 'Mô phỏng đa trạm OSCE cấp cứu',
        so_hoc_vien: 30,
      },
      'bomon.noi@pnt.edu.vn',
      fixedNow
    ).data as { sim_id: string };

    const reviewed = executeAction(
      store,
      'reviewSimClass',
      {
        sim_id: created.sim_id,
        trang_thai: 'Đã duyệt',
        room_ids: ['P-HH-101', 'P-HH-102'],
        equipment_ids: ['CPR-04-01'],
      },
      'ktv.hung@pnt.edu.vn',
      fixedNow
    ).data as { room_id: string; trang_thai: string };

    expect(reviewed.trang_thai).toBe('Đã duyệt');
    expect(reviewed.room_id).toBe('P-HH-101,P-HH-102');

    const saved = store.getAll().SimClasses.find((s) => s.sim_id === created.sim_id)!;
    expect(saved.room_id).toBe('P-HH-101,P-HH-102');
  });

  it('hỗ trợ cập nhật dời ngày và giờ buổi học (drag & drop / reschedule) khi không có xung đột', () => {
    const store = createMemoryStore(buildMockSeed(fixedNow));
    const db = store.getAll();
    const session = db.Sessions.find((s) => s.trang_thai !== 'Đã hủy' && s.giang_vien_id)!;

    const newDate = addDaysYmd(session.ngay, 2);
    const res = executeAction(
      store,
      'updateSession',
      {
        session_id: session.session_id,
        ngay: newDate,
        gio_bd: '14:00',
        gio_kt: '16:30',
      },
      'daotao@pnt.edu.vn',
      fixedNow
    );

    expect(res.data).toBeDefined();
    const updated = store.getAll().Sessions.find((s) => s.session_id === session.session_id)!;
    expect(updated.ngay).toBe(newDate);
    expect(updated.gio_bd).toBe('14:00');
    expect(updated.gio_kt).toBe('16:30');
  });
});
