import { describe, it, expect } from 'vitest';
import { buildMockSeed } from '../src/lib/mock-seed';
import { executeAction, type DataStore } from '../src/core/mutations';
import { lookupStudentByCccdAndDob, registerCmeCourseAction, importLegacyCmeData } from '../src/core/cme';
import type { Rec, TableName } from '../src/core/schema';
import type { DatabaseSnapshot } from '../src/core/types';

class MemoryDataStore implements DataStore {
  db: DatabaseSnapshot;
  constructor(seed: DatabaseSnapshot) {
    this.db = JSON.parse(JSON.stringify(seed));
  }
  getAll(): DatabaseSnapshot {
    return this.db;
  }
  append<T extends TableName>(table: T, record: Rec<T>): void {
    (this.db[table] as unknown[]).push(record);
  }
  update<T extends TableName>(table: T, id: string, patch: Partial<Rec<T>>): Rec<T> {
    const arr = this.db[table] as Array<Record<string, unknown>>;
    const idField = table === 'Users' ? 'user_id' : table === 'CmeCourses' ? 'course_id' : table === 'CmeStudents' ? 'student_id' : table === 'CmeRegistrations' ? 'reg_id' : table === 'CmeAttendance' ? 'att_id' : table === 'CmeAssessments' ? 'asm_id' : table === 'CmeSurveys' ? 'survey_id' : table === 'CmeSettlements' ? 'settlement_id' : 'id';
    const idx = arr.findIndex((x) => x[idField] === id);
    if (idx === -1) throw new Error(`Not found ${id} in ${table}`);
    arr[idx] = { ...arr[idx], ...patch };
    return arr[idx] as Rec<T>;
  }
  removeByPredicate<T extends TableName>(table: T, predicate: (rec: Rec<T>) => boolean): void {
    const arr = this.db[table] as Array<Rec<T>>;
    this.db[table] = arr.filter((x) => !predicate(x)) as any;
  }
}

describe('CME Workflow & Legacy Import', () => {
  it('1. Tra cứu học viên cũ theo CCCD và Ngày sinh (Auto-fill profile)', () => {
    const seed = buildMockSeed();
    const result = lookupStudentByCccdAndDob(seed, '079090001234', '15/08/1990');
    expect(result.student).not.toBeNull();
    expect(result.student?.ho_ten).toBe('BS. Lê Hoàng Long');
    expect(result.student?.don_vi_cong_tac).toBe('Bệnh viện Đa khoa Khu vực Hóc Môn');
    expect(result.historyRegistrations.length).toBeGreaterThan(0);
    expect(result.historyRegistrations[0].so_chung_chi_cme).toBe('CME-2025-ACLS-001');

    // Tra cứu không khớp ngày sinh
    const notFound = lookupStudentByCccdAndDob(seed, '079090001234', '01/01/1995');
    expect(notFound.student).toBeNull();
  });

  it('2. Đăng ký khóa học mới tái sử dụng hồ sơ cũ & cập nhật chuyển khoản', () => {
    const seed = buildMockSeed();
    const store = new MemoryDataStore(seed);

    const regResult = registerCmeCourseAction(store, {
      course_id: 'CME-2026-02',
      student: {
        cccd: '079090001234',
        ngay_sinh: '15/08/1990',
        ho_ten: 'BS. Lê Hoàng Long',
        email: 'lehoanglong.dr@gmail.com',
        sdt: '0903123456',
        don_vi_cong_tac: 'Bệnh viện Đa khoa Khu vực Hóc Môn - Khoa Cấp cứu',
      },
      payment: {
        ma_giao_dich: 'VNPAY2026112501',
        minh_chung_ck_url: 'https://cecics.pnt.edu.vn/uploads/bill/bill01.jpg',
        so_tien: 2800000,
      },
    });

    expect(regResult.student.student_id).toBe('STU-079090001234');
    expect(regResult.student.don_vi_cong_tac).toBe('Bệnh viện Đa khoa Khu vực Hóc Môn - Khoa Cấp cứu');
    expect(regResult.registration.course_id).toBe('CME-2026-02');
    expect(regResult.registration.trang_thai).toBe('DA_CHUYEN_KHOAN');
    expect(regResult.registration.ma_giao_dich).toBe('VNPAY2026112501');
  });

  it('3. Đẩy dữ liệu các khóa cũ hàng loạt (Legacy CME Data Import)', () => {
    const seed = buildMockSeed();
    const store = new MemoryDataStore(seed);

    const importRes = importLegacyCmeData(store, {
      courses: [
        {
          course_id: 'CME-2024-CC01',
          ma_khoa: 'CME-2024-CC01',
          ten_khoa: 'Cấp cứu ngừng tuần hoàn nâng cao Khóa 1 - 2024',
          so_tiet_cme: 24,
          hoc_phi: 3000000,
          ngay_khai_giang: '2024-05-10',
          ngay_be_giang: '2024-05-12',
          trang_thai: 'COMPLETED',
        },
      ],
      students: [
        {
          student_id: 'STU-080085009999',
          cccd: '080085009999',
          ngay_sinh: '10/10/1985',
          ho_ten: 'BS.CKI. Phạm Văn Hải',
          don_vi_cong_tac: 'Bệnh viện Nhân Dân Gia Định',
          email: 'haipv@gmail.com',
          sdt: '0988776655',
        },
      ],
      registrations: [
        {
          reg_id: 'REG-2024-01-99',
          course_id: 'CME-2024-CC01',
          student_id: 'STU-080085009999',
          trang_thai: 'HOAN_THANH',
          so_tien: 3000000,
          so_chung_chi_cme: 'CME-2024-0099',
          ngay_cap_chung_chi: '2024-05-20',
        },
      ],
      assessments: [
        {
          asm_id: 'ASM-2024-01-99',
          course_id: 'CME-2024-CC01',
          student_id: 'STU-080085009999',
          diem_pretest: 5.5,
          diem_posttest: 8.5,
          diem_thuc_hanh: 9.0,
          ket_qua: 'DAT',
          xep_loai: 'GIOI',
        },
      ],
    });

    expect(importRes.importedCourses).toBe(1);
    expect(importRes.importedStudents).toBe(1);
    expect(importRes.importedRegistrations).toBe(1);
    expect(importRes.importedAssessments).toBe(1);

    // Kiểm tra có thể tra cứu học viên khóa cũ vừa import
    const db = store.getAll();
    const lookup = lookupStudentByCccdAndDob(db, '080085009999', '10/10/1985');
    expect(lookup.student).not.toBeNull();
    expect(lookup.student?.ho_ten).toBe('BS.CKI. Phạm Văn Hải');
    expect(lookup.historyRegistrations[0].so_chung_chi_cme).toBe('CME-2024-0099');
  });

  it('4. Luồng Quản trị: Duyệt đăng ký, Điểm danh, Lượng giá, Khảo sát và Giải chi', () => {
    const seed = buildMockSeed();
    const store = new MemoryDataStore(seed);
    const actor = 'cecics@pnt.edu.vn';

    // A. Duyệt đóng học phí & cấp mã chứng chỉ
    const reviewRes = executeAction(store, 'reviewCmeRegistration', {
      reg_id: 'REG-2025-01-01',
      trang_thai: 'DA_DUYET',
    }, actor);
    expect((reviewRes.data as any).trang_thai).toBe('DA_DUYET');

    // B. Ghi nhận điểm danh
    const attRes = executeAction(store, 'recordCmeAttendance', {
      course_id: 'CME-2025-01',
      student_id: 'STU-079090001234',
      buoi_so: 3,
      co_mat: true,
      ca_hoc: 'Sáng',
      ghi_chu: 'Tham gia đầy đủ thực hành',
    }, actor);
    expect((attRes.data as any).co_mat).toBe(true);

    // C. Chấm điểm Pre/Post-test & Lượng giá thực hành
    const asmRes = executeAction(store, 'submitCmeAssessment', {
      course_id: 'CME-2025-01',
      student_id: 'STU-079090001234',
      diem_pretest: 7.0,
      diem_posttest: 9.5,
      diem_thuc_hanh: 10.0,
      nhan_xet: 'Thực hành xuất sắc',
    }, actor);
    expect((asmRes.data as any).ket_qua).toBe('DAT');
    expect((asmRes.data as any).xep_loai).toBe('XUAT_SAC');

    // D. Gửi khảo sát hài lòng
    const srvRes = executeAction(store, 'submitCmeSurvey', {
      course_id: 'CME-2025-01',
      student_id: 'STU-079090001234',
      hai_long_chuong_trinh: 5,
      hai_long_giang_vien: 5,
      hai_long_mo_hinh_csvc: 5,
      hai_long_to_chuc: 5,
      y_kien_dong_gop: 'Rất hài lòng với trang thiết bị mô phỏng của Trung tâm',
    }, actor);
    expect((srvRes.data as any).hai_long_chuong_trinh).toBe(5);

    // E. Lập & Phê duyệt giải chi tài chính
    const stlRes = executeAction(store, 'upsertCmeSettlement', {
      course_id: 'CME-2025-01',
      tong_thu_hoc_phi: 10000000,
      thu_lao_giang_vien: 4000000,
      thu_lao_tro_giang_ktv: 1500000,
      chi_phi_vat_tu: 1000000,
      chi_phi_to_chuc: 500000,
      trang_thai: 'DA_DUYET',
    }, actor);
    expect((stlRes.data as any).tong_thu_hoc_phi).toBe(10000000);
    expect((stlRes.data as any).trich_nop_nha_truong).toBe(1500000);
    expect((stlRes.data as any).thuc_nhan_cecics).toBe(1500000);
  });
});
