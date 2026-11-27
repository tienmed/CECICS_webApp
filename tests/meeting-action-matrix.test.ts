import { describe, it, expect } from 'vitest';
import { getStoredMeetingMinutes, getStoredMeetingTasks } from '../src/lib/meeting-storage';
import officialStaffList from '../data/cecics_official_staff.json';
import { CECICS_AFFILIATED_STAFF_EMAILS } from '../src/core/cecics-staff';

describe('CECICS Meeting Minutes & Action Matrix Task Board - Standardized Profiles', () => {
  it('phải tải được danh sách biên bản họp với Trưởng Trung tâm và Thư ký Vân chuẩn hóa', () => {
    const minutes = getStoredMeetingMinutes();
    expect(minutes.length).toBeGreaterThan(0);

    const latest = minutes[0];
    expect(latest.tieu_de).toContain('Cuộc họp giao ban và phân công nhiệm vụ chuyên môn CECICS');
    expect(latest.ngay_hop).toBe('2026-11-27');
    
    // Kiểm tra danh xưng và vai trò chuẩn hóa của Chủ trì (Trưởng Trung tâm) và Thư ký (Vân)
    expect(latest.chu_tri).toBe('TS.BS. Nguyễn Ngọc Phương Thư');
    expect(latest.thu_ky).toBe('CN. Phạm Nguyễn Tường Vân');
    expect(latest.nguoi_tao).toBe('vanpnt@pnt.edu.vn');
    
    // Kiểm tra thành phần tham dự
    expect(latest.thanh_phan).toContain('TS.BS. Nguyễn Ngọc Phương Thư');
    expect(latest.thanh_phan).toContain('CN. Phạm Nguyễn Tường Vân');
    expect(latest.thanh_phan).toContain('BS.CKII. Trịnh Trung Tiến');
    expect(latest.thanh_phan).toContain('ThS.BS.CKII. Bùi Phan Quỳnh Phương');
    expect(latest.thanh_phan).toContain('ThS.ĐD. Cao Thị Ngọc Bích');
    expect(latest.thanh_phan).toContain('ThS.BS. Trần Tú Trinh');
    expect(latest.thanh_phan).toContain('ThS.BS. Võ Thị Tố Uyên');
    expect(latest.thanh_phan).toContain('ThS.BS. Đặng Công Duy');
  });

  it('phải đồng bộ đầy đủ 21 đầu việc với danh xưng chuẩn hóa', () => {
    const tasks = getStoredMeetingTasks();
    expect(tasks.length).toBe(21);

    // 1. BS.CKII. Trịnh Trung Tiến
    const tienTasks = tasks.filter((t) => t.nguoi_phu_trach === 'BS.CKII. Trịnh Trung Tiến');
    expect(tienTasks.length).toBe(2);
    expect(tienTasks[0].assignee_user_id).toBe('bstien@pnt.edu.vn');

    // 2. TS.BS. Nguyễn Ngọc Phương Thư (Trưởng Trung tâm)
    const thuTasks = tasks.filter((t) => t.nguoi_phu_trach === 'TS.BS. Nguyễn Ngọc Phương Thư');
    expect(thuTasks.length).toBe(1);
    expect(thuTasks[0].assignee_user_id).toBe('nguyenngocphuongthu@pnt.edu.vn');

    // 3. ThS.BS.CKII. Bùi Phan Quỳnh Phương
    const phuongTasks = tasks.filter((t) => t.nguoi_phu_trach === 'ThS.BS.CKII. Bùi Phan Quỳnh Phương');
    expect(phuongTasks.length).toBe(1);
    expect(phuongTasks[0].assignee_user_id).toBe('bsquynhphuong@pnt.edu.vn');

    // 4. ThS.BS. Võ Thị Tố Uyên & ThS.BS. Đặng Công Duy
    const uyenTasks = tasks.filter((t) => t.nguoi_phu_trach === 'ThS.BS. Võ Thị Tố Uyên');
    expect(uyenTasks.length).toBe(2);
    expect(uyenTasks[0].assignee_user_id).toBe('uyen_vtt@pnt.edu.vn');

    const duyTasks = tasks.filter((t) => t.nguoi_phu_trach === 'ThS.BS. Đặng Công Duy');
    expect(duyTasks.length).toBe(1);
    expect(duyTasks[0].assignee_user_id).toBe('duydc@pnt.edu.vn');

    // 5. ThS.ĐD. Cao Thị Ngọc Bích & ThS.BS. Trần Tú Trinh
    const bichTasks = tasks.filter((t) => t.nguoi_phu_trach === 'ThS.ĐD. Cao Thị Ngọc Bích');
    expect(bichTasks.length).toBe(1);
    expect(bichTasks[0].deadline).toBe('2026-11-30');

    const trinhTasks = tasks.filter((t) => t.nguoi_phu_trach === 'ThS.BS. Trần Tú Trinh');
    expect(trinhTasks.length).toBe(3);
  });

  it('phải khớp chính xác email công vụ đối với các nhân sự thuộc CECICS (18 CBNV chính thức hoặc GV FTE 50%)', () => {
    const tasks = getStoredMeetingTasks();
    const cecicsStaffEmails = officialStaffList.map((s) => s.email);
    const affiliatedEmails = [...CECICS_AFFILIATED_STAFF_EMAILS];
    const allValidEmails = [...cecicsStaffEmails, ...affiliatedEmails];

    for (const task of tasks) {
      if (task.assignee_user_id) {
        expect(allValidEmails).toContain(task.assignee_user_id);
      }
    }
  });
});
