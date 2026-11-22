import { describe, expect, it } from 'vitest';
import { buildMockSeed } from '../src/lib/mock-seed';
import { executeAction, DomainError } from '../src/core/mutations';
import { canViewAllSimClasses, canViewSimClass } from '../src/core/permissions';
import { addDaysYmd } from '../src/core/time';
import type { DatabaseSnapshot, SimClassRecord } from '../src/core/types';
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

describe('Quy trình Đăng ký Lớp Mô phỏng & Phê duyệt Song song (3 Mẫu Y khoa)', () => {
  const fixedNow = new Date('2026-11-20T08:00:00.000Z');
  const today = '2026-11-20';

  it('1. Đăng ký lớp mô phỏng đa bước với đầy đủ thông tin Mẫu 1 + 2 + 3', () => {
    const store = createInMemoryStore();
    const simDate = addDaysYmd(today, 25); // > 14 ngày -> đúng hạn

    const items = [
      { loai: 'mo_hinh', ten: 'Mô hình thực hành siêu âm bụng tổng quát', sl_nhom: 1, sl_tong: 2, ghi_chu: 'Cần đầu dò convex' },
      { loai: 'dung_cu', ten: 'Máy siêu âm màu Doppler 4D Voluson E8', sl_nhom: 1, sl_tong: 2, ghi_chu: 'Cài sẵn preset bụng tổng quát' },
      { loai: 'vat_tu', ten: 'Gel siêu âm y tế & Khăn lau', sl_nhom: 2, sl_tong: 4, ghi_chu: 'Tiêu hao' },
    ];

    const res = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-CDHA',
        giang_vien_phu_trach: 'ThS. BSCKII. Phạm Nguyên Vũ',
        sdt_lien_he: '0983738421',
        email_lien_he: 'vuphammd@pnt.edu.vn',
        nguoi_ho_tro: 'ĐD. Lê Thị Hồng',
        doi_tuong_hoc_vien: 'Sinh viên Y5 Đa khoa - Lớp K52',
        ngay: simDate,
        gio_bd: '08:00',
        gio_kt: '11:30',
        campus_id: 'HH',
        buoi_hoc: 'Sáng',
        noi_dung: 'Khóa học Siêu âm tổng quát thực hành K52',
        so_hoc_vien: 24,
        so_nhom: 2,
        so_hv_moi_nhom: 12,
        nhu_cau_sp: JSON.stringify(['Người lớn', 'Huấn luyện kỹ năng từng phần']),
        boi_canh_lam_sang: JSON.stringify(['Chăm sóc cấp', 'Khác']),
        muc_tieu_dao_tao: 'Nhận diện các mốc giải phẫu gan mật tụy lách trên siêu âm 2D.',
        ky_nang_mong_doi: 'Cầm đầu dò siêu âm đúng tư thế, quét lát cắt chuẩn.',
        thiet_bi_yeu_cau: '2 Máy siêu âm Doppler 4D + 2 Mô hình thực hành siêu âm bụng',
        danh_muc_mo_hinh_json: JSON.stringify(items),
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    );

    const created = res.data as SimClassRecord;
    expect(created.sim_id).toMatch(/^MP-2026-/);
    expect(created.trang_thai).toBe('Chờ rà soát');
    expect(created.dang_ky_tre).toBe(false);
    expect(created.duyet_hanh_chinh).toBe('Chờ');
    expect(created.duyet_ky_thuat).toBe('Chờ');
    expect(created.giang_vien_phu_trach).toBe('ThS. BSCKII. Phạm Nguyên Vũ');
    expect(created.danh_muc_mo_hinh_json).toContain('Voluson E8');
  });

  it('2. Quy trình Phê duyệt Song song: Hành chính duyệt trước, Kỹ thuật duyệt sau -> Kích hoạt ĐÃ PHÊ DUYỆT', () => {
    const store = createInMemoryStore();
    const simDate = addDaysYmd(today, 25);

    const created = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-CDHA',
        giang_vien_phu_trach: 'ThS. BSCKII. Phạm Nguyên Vũ',
        ngay: simDate,
        gio_bd: '13:30',
        gio_kt: '16:30',
        campus_id: 'HH',
        noi_dung: 'Siêu âm Doppler tim mạch K52',
        so_hoc_vien: 20,
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    // Bước 1: Hành chính duyệt
    const adminReviewed = executeAction(
      store,
      'reviewSimClassAdmin',
      {
        sim_id: created.sim_id,
        decision: 'Đã duyệt',
        ghi_chu_hanh_chinh: 'Kế hoạch hợp lệ theo khung chương trình.',
      },
      'thunnp@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(adminReviewed.duyet_hanh_chinh).toBe('Đã duyệt');
    expect(adminReviewed.duyet_ky_thuat).toBe('Chờ');
    expect(adminReviewed.trang_thai).toBe('Chờ rà soát'); // Chưa xong kỹ thuật

    // Bước 2: Kỹ thuật duyệt & gán phòng/thiết bị
    const techReviewed = executeAction(
      store,
      'reviewSimClassTech',
      {
        sim_id: created.sim_id,
        decision: 'Đã duyệt',
        room_ids: ['P-HH-101'],
        equipment_ids: ['TB-US-01'],
        ktv_phu_trach: 'U-2026-0006',
        ghi_chu_ky_thuat: 'Đã chuẩn bị máy tại P.HH-101',
      },
      'kythuat@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(techReviewed.duyet_ky_thuat).toBe('Đã duyệt');
    expect(techReviewed.duyet_hanh_chinh).toBe('Đã duyệt');
    // Cả 2 đã duyệt -> Chuyển sang ĐÃ PHÊ DUYỆT
    expect(techReviewed.trang_thai).toBe('Đã phê duyệt');
    expect(techReviewed.room_id).toBe('P-HH-101');
  });

  it('3. Thẩm định Kỹ thuật: Chặn thiết bị hỏng hoặc phòng bị trùng', () => {
    const store = createInMemoryStore();
    const simDate = addDaysYmd(today, 25);

    const created = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-CDHA',
        ngay: simDate,
        gio_bd: '08:00',
        gio_kt: '11:00',
        campus_id: 'HH',
        noi_dung: 'Khóa kỹ năng số 1',
        so_hoc_vien: 15,
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    // Cố tình gán thiết bị TB-SIM-02 đang ở trạng thái 'Hỏng'
    expect(() =>
      executeAction(
        store,
        'reviewSimClassTech',
        {
          sim_id: created.sim_id,
          decision: 'Đã duyệt',
          room_ids: ['P-HH-101'],
          equipment_ids: ['TB-SIM-02'],
        },
        'kythuat@pnt.edu.vn',
        fixedNow
      )
    ).toThrowError(DomainError);
  });

  it('4. Cơ chế Nhắc nhở T-7 ngày & Bộ môn Bấm Xác nhận Giữ nguyên -> Đã chốt kế hoạch', () => {
    const store = createInMemoryStore();
    // MP-2026-0004 đã được seed sẵn ở trạng thái Đã phê duyệt, diễn ra sau 4 ngày (trong ngưỡng T-7)
    const targetSimId = 'MP-2026-0004';

    // Hành chính phát email nhắc nhở T-7
    const reminded = executeAction(
      store,
      'sendSimClassReminder',
      { sim_id: targetSimId },
      'thunnp@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(reminded.trang_thai).toBe('Nhắc xác nhận T-7');
    expect(reminded.ngay_nhac_t7).toBeTruthy();

    // Bộ môn bấm nút Xác nhận giữ nguyên
    const confirmed = executeAction(
      store,
      'respondSimClassConfirmation',
      {
        sim_id: targetSimId,
        response_type: 'Giữ nguyên',
        phan_hoi_bo_mon: 'Bộ môn CĐHA xác nhận giữ nguyên đúng kế hoạch và danh mục thiết bị.',
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(confirmed.trang_thai).toBe('Đã chốt giữ nguyên');
    expect(confirmed.phan_hoi_bo_mon).toContain('xác nhận giữ nguyên');
  });

  it('5. Bộ môn Phản hồi Yêu cầu Điều chỉnh -> Kích hoạt cảnh báo Kỹ thuật & Hành chính', () => {
    const store = createInMemoryStore();
    const targetSimId = 'MP-2026-0004';

    // Hành chính phát thư nhắc
    executeAction(
      store,
      'sendSimClassReminder',
      { sim_id: targetSimId },
      'thunnp@pnt.edu.vn',
      fixedNow
    );

    // Bộ môn xin điều chỉnh: Tăng thêm 1 máy siêu âm và dời giờ sang chiều
    const adjusted = executeAction(
      store,
      'respondSimClassConfirmation',
      {
        sim_id: targetSimId,
        response_type: 'Điều chỉnh',
        phan_hoi_bo_mon: 'Bộ môn xin bổ sung thêm 1 máy siêu âm Doppler và tăng 4 sinh viên.',
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(adjusted.trang_thai).toBe('Cần rà soát điều chỉnh');
    expect(adjusted.ly_do_dieu_chinh).toContain('bổ sung thêm 1 máy siêu âm Doppler');

    // Kiểm tra xem hệ thống đã tạo notification cảnh báo cho Kỹ thuật & Hành chính chưa
    const notifications = store.getAll().Notifications;
    const alert = notifications.find((n) => n.tieu_de.includes('CẢNH BÁO: Bộ môn yêu cầu ĐIỀU CHỈNH'));
    expect(alert).toBeDefined();
  });

  it('6. Phân quyền Bộ môn: BM nào chỉ thấy được phiếu của BM đó thôi, chặn can thiệp chéo', () => {
    const store = createInMemoryStore();
    const db = store.getAll();

    const userCDHA = db.Users.find((u) => u.email === 'vuphammd@pnt.edu.vn')!;
    const userNoi = db.Users.find((u) => u.email === 'bomon.noi@pnt.edu.vn')!;
    const adminUser = db.Users.find((u) => u.email === 'admin@pnt.edu.vn')!;
    const techUser = db.Users.find((u) => u.email === 'kythuat@pnt.edu.vn')!;

    const simCDHA = db.SimClasses.find((s) => s.sim_id === 'MP-2026-0004')!; // BM-CDHA
    const simNoi = db.SimClasses.find((s) => s.sim_id === 'MP-2026-0001')!;  // BM-NOI
    const simSan = db.SimClasses.find((s) => s.sim_id === 'MP-2026-0002')!;  // BM-SAN

    // 1. Phân quyền xem Admin/Kỹ thuật: Thấy toàn bộ
    expect(canViewAllSimClasses(adminUser)).toBe(true);
    expect(canViewAllSimClasses(techUser)).toBe(true);
    expect(canViewSimClass(adminUser, simCDHA)).toBe(true);
    expect(canViewSimClass(adminUser, simNoi)).toBe(true);

    // 2. Phân quyền Bộ môn CĐHA: Chỉ thấy phiếu của CĐHA
    expect(canViewAllSimClasses(userCDHA)).toBe(false);
    expect(canViewSimClass(userCDHA, simCDHA)).toBe(true);
    expect(canViewSimClass(userCDHA, simNoi)).toBe(false);
    expect(canViewSimClass(userCDHA, simSan)).toBe(false);

    // 3. Phân quyền Bộ môn Nội: Chỉ thấy phiếu của Nội
    expect(canViewAllSimClasses(userNoi)).toBe(false);
    expect(canViewSimClass(userNoi, simNoi)).toBe(true);
    expect(canViewSimClass(userNoi, simCDHA)).toBe(false);
    expect(canViewSimClass(userNoi, simSan)).toBe(false);

    // 4. Chặn can thiệp chéo: Giảng viên CĐHA cố tình can thiệp/phản hồi phiếu của BM Nội -> Bị chặn FORBIDDEN
    expect(() =>
      executeAction(
        store,
        'respondSimClassConfirmation',
        {
          sim_id: simNoi.sim_id,
          response_type: 'Giữ nguyên',
          phan_hoi_bo_mon: 'Thử can thiệp chéo trái phép',
        },
        'vuphammd@pnt.edu.vn',
        fixedNow
      )
    ).toThrowError(DomainError);

    // 5. Cố tình đăng ký mạo danh bộ môn khác: Tự động gán về đúng bộ môn của tài khoản
    const spoofAttempt = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-NOI', // Cố tình chọn BM-NOI trong khi tài khoản là BM-CDHA
        ngay: addDaysYmd(today, 20),
        gio_bd: '08:00',
        gio_kt: '11:00',
        campus_id: 'HH',
        noi_dung: 'Lớp kiểm tra quyền',
        so_hoc_vien: 15,
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(spoofAttempt.bo_mon_id).toBe('BM-CDHA'); // Bị khóa cứng về BM-CDHA của giảng viên
  });

  it('7. Khóa học Chuỗi Nhiều Buổi: Sinh lịch định kỳ, tự động nhân vật tư tiêu hao (Mẫu 1)', () => {
    const store = createInMemoryStore();
    const sessions = [
      { buoi_so: 1, ngay: addDaysYmd(today, 18), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:30', trang_thai_buoi: 'Kế hoạch' },
      { buoi_so: 2, ngay: addDaysYmd(today, 20), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:30', trang_thai_buoi: 'Kế hoạch' },
      { buoi_so: 3, ngay: addDaysYmd(today, 25), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:30', trang_thai_buoi: 'Kế hoạch' },
    ];

    // Bảng dự trù: Mô hình không nhân số buổi (1 x 2 = 2); Vật tư nhân số buổi (2 x 2 x 3 = 12)
    const items = [
      { loai: 'mo_hinh', ten: 'Mô hình đặt nội khí quản', sl_nhom: 1, sl_tong: 2 },
      { loai: 'vat_tu', ten: 'Ống nội khí quản & gel', sl_nhom: 2, sl_tong: 12 }, // 2 * 2 nhóm * 3 buổi = 12
    ];

    const res = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-HSCC',
        giang_vien_phu_trach: 'BS.CKII. Trịnh Trung Tiến',
        doi_tuong_hoc_vien: 'Sinh viên Y6 Đa khoa',
        campus_id: 'HH',
        noi_dung: 'Khóa học Kiểm soát đường thở nâng cao',
        so_hoc_vien: 20,
        so_nhom: 2,
        so_hv_moi_nhom: 10,
        danh_muc_mo_hinh_json: JSON.stringify(items),
        danh_sach_buoi: sessions,
      },
      'bstien@pnt.edu.vn',
      fixedNow
    );

    const created = res.data as SimClassRecord;
    expect(created.so_buoi).toBe(3);
    expect(created.ngay).toBe(sessions[0].ngay);
    expect(created.ngay_kt).toBe(sessions[2].ngay);
    expect(created.danh_sach_buoi_json).toContain(sessions[1].ngay);
  });

  it('8. Thẩm định Kỹ thuật Chuỗi Nhiều Buổi: Gán phòng chung + Tùy chỉnh phòng riêng từng buổi (session_overrides)', () => {
    const store = createInMemoryStore();
    const sessions = [
      { buoi_so: 1, ngay: addDaysYmd(today, 22), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:00', trang_thai_buoi: 'Kế hoạch' },
      { buoi_so: 2, ngay: addDaysYmd(today, 24), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:00', trang_thai_buoi: 'Kế hoạch' },
    ];

    const created = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-CDHA',
        giang_vien_phu_trach: 'ThS. BSCKII. Phạm Nguyên Vũ',
        campus_id: 'HH',
        noi_dung: 'Khóa học Siêu âm chuyên khoa 2 buổi',
        so_hoc_vien: 16,
        so_nhom: 2,
        danh_sach_buoi: sessions,
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    // Kỹ thuật gán phòng P-HH-101 chung, nhưng buổi 2 gán phòng riêng P-HH-102
    const reviewed = executeAction(
      store,
      'reviewSimClassTech',
      {
        sim_id: created.sim_id,
        decision: 'Đã duyệt',
        room_ids: ['P-HH-101'],
        equipment_ids: ['TB-US-01'],
        ktv_phu_trach: 'U-2026-0006',
        session_overrides: [
          { buoi_so: 2, room_id: 'P-HH-102', ktv_phu_trach: 'U-2026-0006' },
        ],
      },
      'kythuat@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(reviewed.duyet_ky_thuat).toBe('Đã duyệt');
    expect(reviewed.room_id).toBe('P-HH-101');
    expect(reviewed.danh_sach_buoi_json).toContain('P-HH-102');
  });

  it('9. Điều chỉnh riêng từng buổi: Bộ môn yêu cầu dời giờ buổi 2 -> Kỹ thuật cần rà soát lại', () => {
    const store = createInMemoryStore();
    const sessions = [
      { buoi_so: 1, ngay: addDaysYmd(today, 25), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:00', trang_thai_buoi: 'Kế hoạch' },
      { buoi_so: 2, ngay: addDaysYmd(today, 27), buoi_hoc: 'Sáng', gio_bd: '08:00', gio_kt: '11:00', trang_thai_buoi: 'Kế hoạch' },
    ];

    const created = executeAction(
      store,
      'createSimClass',
      {
        bo_mon_id: 'BM-CDHA',
        giang_vien_phu_trach: 'ThS. BSCKII. Phạm Nguyên Vũ',
        campus_id: 'HH',
        noi_dung: 'Khóa học Siêu âm 2 buổi',
        so_hoc_vien: 16,
        danh_sach_buoi: sessions,
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    // Bộ môn gửi phản hồi điều chỉnh buổi 2 sang buổi chiều
    const newDate = addDaysYmd(today, 28);
    const adjusted = executeAction(
      store,
      'respondSimClassConfirmation',
      {
        sim_id: created.sim_id,
        response_type: 'Điều chỉnh',
        phan_hoi_bo_mon: 'Xin dời buổi 2 sang ngày hôm sau vì giảng viên bận lịch mổ',
        dieu_chinh_buoi: [
          { buoi_so: 2, ngay: newDate, gio_bd: '13:30', gio_kt: '16:30' },
        ],
      },
      'vuphammd@pnt.edu.vn',
      fixedNow
    ).data as SimClassRecord;

    expect(adjusted.trang_thai).toBe('Cần rà soát điều chỉnh');
    expect(adjusted.duyet_ky_thuat).toBe('Chờ'); // Bị reset về Chờ để KTV xếp lại phòng
    expect(adjusted.danh_sach_buoi_json).toContain(newDate);
    expect(adjusted.danh_sach_buoi_json).toContain('13:30');
  });
});
