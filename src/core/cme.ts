import type { DatabaseSnapshot, CmeCourseRecord, CmeStudentRecord, CmeRegistrationRecord, CmeAttendanceRecord, CmeAssessmentRecord, CmeSurveyRecord, CmeSettlementRecord } from './types';
import type { DataStore } from './mutations';
import { DomainError } from './mutations';
import { nowVnIso } from './time';

/**
 * Tra cứu hồ sơ học viên cũ dựa trên CCCD và Ngày sinh (định dạng dd/mm/yyyy hoặc yyyy-mm-dd).
 * Dùng để tự động điền lại hồ sơ (Auto-fill) khi học viên đăng ký khóa mới.
 */
export function lookupStudentByCccdAndDob(
  db: DatabaseSnapshot,
  cccd: string,
  dob: string
): { student: CmeStudentRecord | null; historyRegistrations: (CmeRegistrationRecord & { course_name?: string })[] } {
  const cleanCccd = String(cccd || '').trim();
  const cleanDob = String(dob || '').trim().replace(/-/g, '/');

  if (!cleanCccd || cleanCccd.length < 9) {
    return { student: null, historyRegistrations: [] };
  }

  const student = db.CmeStudents.find((s) => {
    const sCccd = String(s.cccd || '').trim();
    const sDob = String(s.ngay_sinh || '').trim().replace(/-/g, '/');
    return sCccd === cleanCccd && (sDob === cleanDob || sDob.replace(/^0+/, '') === cleanDob.replace(/^0+/, ''));
  }) || null;

  if (!student) {
    return { student: null, historyRegistrations: [] };
  }

  const courseMap = new Map((db.CmeCourses || []).map((c) => [c.course_id, c.ten_khoa]));
  const history = (db.CmeRegistrations || [])
    .filter((r) => r.student_id === student.student_id)
    .map((r) => ({
      ...r,
      course_name: courseMap.get(r.course_id) || r.course_id,
    }));

  return { student, historyRegistrations: history };
}

/**
 * Đăng ký khóa học CME (tạo mới học viên hoặc cập nhật hồ sơ cũ, tạo bản ghi đăng ký).
 */
export function registerCmeCourseAction(
  store: DataStore,
  payload: {
    course_id: string;
    student: {
      cccd: string;
      ngay_sinh: string;
      ho_ten: string;
      gioi_tinh?: string;
      don_vi_cong_tac?: string;
      chuc_danh?: string;
      email: string;
      sdt: string;
      dia_chi?: string;
      so_cchn?: string;
      anh_bang_cap_url?: string;
    };
    payment?: {
      ma_giao_dich?: string;
      minh_chung_ck_url?: string;
      so_tien?: number;
    };
  },
  now: Date = new Date()
): { student: CmeStudentRecord; registration: CmeRegistrationRecord } {
  const db = store.getAll();
  const course = db.CmeCourses.find((c) => c.course_id === payload.course_id);
  if (!course) {
    throw new DomainError('COURSE_NOT_FOUND', 'Khóa học CME không tồn tại.');
  }

  const nowIso = nowVnIso(now);
  const cleanCccd = payload.student.cccd.trim();
  const cleanDob = payload.student.ngay_sinh.trim();

  // 1. Kiểm tra hoặc cập nhật thông tin học viên
  let student = db.CmeStudents.find((s) => s.cccd.trim() === cleanCccd);
  if (student) {
    student = store.update('CmeStudents', student.student_id, {
      ho_ten: payload.student.ho_ten || student.ho_ten,
      ngay_sinh: cleanDob || student.ngay_sinh,
      gioi_tinh: payload.student.gioi_tinh || student.gioi_tinh,
      don_vi_cong_tac: payload.student.don_vi_cong_tac || student.don_vi_cong_tac,
      chuc_danh: payload.student.chuc_danh || student.chuc_danh,
      email: payload.student.email || student.email,
      sdt: payload.student.sdt || student.sdt,
      dia_chi: payload.student.dia_chi || student.dia_chi,
      so_cchn: payload.student.so_cchn || student.so_cchn,
      anh_bang_cap_url: payload.student.anh_bang_cap_url || student.anh_bang_cap_url,
      cap_nhat_luc: nowIso,
    });
  } else {
    const studentId = `STU-${cleanCccd}`;
    const newStudent: CmeStudentRecord = {
      student_id: studentId,
      cccd: cleanCccd,
      ngay_sinh: cleanDob,
      ho_ten: payload.student.ho_ten,
      gioi_tinh: payload.student.gioi_tinh || '',
      don_vi_cong_tac: payload.student.don_vi_cong_tac || '',
      chuc_danh: payload.student.chuc_danh || '',
      email: payload.student.email,
      sdt: payload.student.sdt,
      dia_chi: payload.student.dia_chi || '',
      so_cchn: payload.student.so_cchn || '',
      anh_bang_cap_url: payload.student.anh_bang_cap_url || '',
      ngay_tao: nowIso.slice(0, 10),
      cap_nhat_luc: nowIso,
    };
    store.append('CmeStudents', newStudent);
    student = newStudent;
  }

  // 2. Kiểm tra xem đã đăng ký khóa này chưa
  const existingReg = db.CmeRegistrations.find(
    (r) => r.course_id === course.course_id && r.student_id === student.student_id
  );

  const payment = payload.payment || {};
  const hasTrans = !!payment.ma_giao_dich || !!payment.minh_chung_ck_url;

  if (existingReg) {
    const updatedReg = store.update('CmeRegistrations', existingReg.reg_id, {
      trang_thai: hasTrans ? 'DA_CHUYEN_KHOAN' : existingReg.trang_thai,
      so_tien: payment.so_tien || existingReg.so_tien || course.hoc_phi,
      ma_giao_dich: payment.ma_giao_dich || existingReg.ma_giao_dich,
      minh_chung_ck_url: payment.minh_chung_ck_url || existingReg.minh_chung_ck_url,
      ngay_chuyen_khoan: hasTrans ? nowIso.slice(0, 10) : existingReg.ngay_chuyen_khoan,
    });
    return { student, registration: updatedReg };
  }

  // 3. Tạo bản ghi đăng ký mới
  const regId = `REG-${course.course_id.replace(/^CME-/, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newReg: CmeRegistrationRecord = {
    reg_id: regId,
    course_id: course.course_id,
    student_id: student.student_id,
    ngay_dang_ky: nowIso.slice(0, 10),
    trang_thai: hasTrans ? 'DA_CHUYEN_KHOAN' : 'DANG_KY',
    so_tien: payment.so_tien || course.hoc_phi,
    ma_giao_dich: payment.ma_giao_dich || '',
    minh_chung_ck_url: payment.minh_chung_ck_url || '',
    ngay_chuyen_khoan: hasTrans ? nowIso.slice(0, 10) : '',
    xac_nhan_boi: '',
    xac_nhan_luc: '',
    ly_do_tu_choi: '',
    so_chung_chi_cme: '',
    ngay_cap_chung_chi: '',
  };
  store.append('CmeRegistrations', newReg);

  return { student, registration: newReg };
}

/**
 * Nhập dữ liệu các khóa CME cũ (Legacy CME Data Import)
 * Cho phép nạp hàng loạt khóa học, học viên, kết quả đào tạo và chứng chỉ đã cấp trước đây.
 */
export function importLegacyCmeData(
  store: DataStore,
  data: {
    courses?: Partial<CmeCourseRecord>[];
    students?: Partial<CmeStudentRecord>[];
    registrations?: Partial<CmeRegistrationRecord>[];
    assessments?: Partial<CmeAssessmentRecord>[];
  },
  actorEmail: string = 'system'
): { importedCourses: number; importedStudents: number; importedRegistrations: number; importedAssessments: number } {
  const db = store.getAll();
  let countCourses = 0;
  let countStudents = 0;
  let countRegs = 0;
  let countAsms = 0;

  // 1. Import Courses
  if (data.courses && Array.isArray(data.courses)) {
    for (const c of data.courses) {
      if (!c.course_id || !c.ten_khoa) continue;
      const exist = db.CmeCourses.find((x) => x.course_id === c.course_id);
      if (exist) {
        store.update('CmeCourses', exist.course_id, c);
      } else {
        const newC: CmeCourseRecord = {
          course_id: c.course_id,
          ma_khoa: c.ma_khoa || c.course_id,
          ten_khoa: c.ten_khoa,
          doi_tuong: c.doi_tuong || 'Y bác sĩ, nhân viên y tế',
          so_tiet_cme: c.so_tiet_cme || 16,
          hoc_phi: c.hoc_phi || 0,
          chi_tieu: c.chi_tieu || 30,
          ngay_khai_giang: c.ngay_khai_giang || '',
          ngay_be_giang: c.ngay_be_giang || '',
          han_dang_ky: c.han_dang_ky || '',
          campus_id: c.campus_id || 'HH',
          phong_hoc_mac_dinh: c.phong_hoc_mac_dinh || '',
          giang_vien_chu_nhiem: c.giang_vien_chu_nhiem || '',
          noi_dung_tom_tat: c.noi_dung_tom_tat || '',
          thoi_khoa_bieu_json: c.thoi_khoa_bieu_json || '[]',
          ngan_hang_cau_hoi_pretest_json: c.ngan_hang_cau_hoi_pretest_json || '[]',
          ngan_hang_cau_hoi_posttest_json: c.ngan_hang_cau_hoi_posttest_json || '[]',
          trang_thai: c.trang_thai || 'COMPLETED',
          ngay_tao: c.ngay_tao || '2025-01-01',
          tao_boi: c.tao_boi || actorEmail,
        };
        store.append('CmeCourses', newC);
      }
      countCourses++;
    }
  }

  // 2. Import Students
  if (data.students && Array.isArray(data.students)) {
    for (const s of data.students) {
      if (!s.cccd || !s.ho_ten) continue;
      const cleanCccd = s.cccd.trim();
      const exist = db.CmeStudents.find((x) => x.cccd === cleanCccd);
      if (exist) {
        store.update('CmeStudents', exist.student_id, s);
      } else {
        const studentId = s.student_id || `STU-${cleanCccd}`;
        const newS: CmeStudentRecord = {
          student_id: studentId,
          cccd: cleanCccd,
          ngay_sinh: s.ngay_sinh || '',
          ho_ten: s.ho_ten,
          gioi_tinh: s.gioi_tinh || '',
          don_vi_cong_tac: s.don_vi_cong_tac || '',
          chuc_danh: s.chuc_danh || '',
          email: s.email || '',
          sdt: s.sdt || '',
          dia_chi: s.dia_chi || '',
          so_cchn: s.so_cchn || '',
          anh_bang_cap_url: s.anh_bang_cap_url || '',
          ngay_tao: s.ngay_tao || '2025-01-01',
          cap_nhat_luc: s.cap_nhat_luc || '2025-01-01',
        };
        store.append('CmeStudents', newS);
      }
      countStudents++;
    }
  }

  // 3. Import Registrations
  if (data.registrations && Array.isArray(data.registrations)) {
    for (const r of data.registrations) {
      if (!r.reg_id || !r.course_id || !r.student_id) continue;
      const exist = db.CmeRegistrations.find((x) => x.reg_id === r.reg_id);
      if (exist) {
        store.update('CmeRegistrations', exist.reg_id, r);
      } else {
        const newR: CmeRegistrationRecord = {
          reg_id: r.reg_id,
          course_id: r.course_id,
          student_id: r.student_id,
          ngay_dang_ky: r.ngay_dang_ky || '',
          trang_thai: r.trang_thai || 'HOAN_THANH',
          so_tien: r.so_tien || 0,
          ma_giao_dich: r.ma_giao_dich || '',
          minh_chung_ck_url: r.minh_chung_ck_url || '',
          ngay_chuyen_khoan: r.ngay_chuyen_khoan || '',
          xac_nhan_boi: r.xac_nhan_boi || actorEmail,
          xac_nhan_luc: r.xac_nhan_luc || '',
          ly_do_tu_choi: r.ly_do_tu_choi || '',
          so_chung_chi_cme: r.so_chung_chi_cme || '',
          ngay_cap_chung_chi: r.ngay_cap_chung_chi || '',
        };
        store.append('CmeRegistrations', newR);
      }
      countRegs++;
    }
  }

  // 4. Import Assessments
  if (data.assessments && Array.isArray(data.assessments)) {
    for (const a of data.assessments) {
      if (!a.asm_id || !a.course_id || !a.student_id) continue;
      const exist = db.CmeAssessments.find((x) => x.asm_id === a.asm_id);
      if (exist) {
        store.update('CmeAssessments', exist.asm_id, a);
      } else {
        const newA: CmeAssessmentRecord = {
          asm_id: a.asm_id,
          course_id: a.course_id,
          student_id: a.student_id,
          diem_pretest: a.diem_pretest ?? 0,
          diem_posttest: a.diem_posttest ?? 0,
          diem_thuc_hanh: a.diem_thuc_hanh ?? 0,
          ket_qua: a.ket_qua || 'DAT',
          xep_loai: a.xep_loai || 'DAT',
          nhan_xet: a.nhan_xet || '',
          ngay_danh_gia: a.ngay_danh_gia || '',
          nguoi_danh_gia: a.nguoi_danh_gia || actorEmail,
        };
        store.append('CmeAssessments', newA);
      }
      countAsms++;
    }
  }

  return {
    importedCourses: countCourses,
    importedStudents: countStudents,
    importedRegistrations: countRegs,
    importedAssessments: countAsms,
  };
}
