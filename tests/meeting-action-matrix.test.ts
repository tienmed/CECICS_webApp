import { describe, it, expect } from 'vitest';
import { getStoredMeetingMinutes, getStoredMeetingTasks } from '../src/lib/meeting-storage';
import officialStaffList from '../data/cecics_official_staff.json';

describe('CECICS Meeting Minutes & Action Matrix Task Board', () => {
  it('phải tải được danh sách biên bản họp với đầy đủ thông tin chuẩn 4 phần', () => {
    const minutes = getStoredMeetingMinutes();
    expect(minutes.length).toBeGreaterThan(0);

    const latest = minutes[0];
    expect(latest.tieu_de).toContain('Cuộc họp giao ban và phân công nhiệm vụ chuyên môn CECICS');
    expect(latest.ngay_hop).toBe('2026-11-27');
    expect(latest.chu_tri).toBe('Nguyễn Ngọc Phương Thư');
    expect(latest.thu_ky).toBe('Trần Tú Trinh');
    expect(latest.thanh_phan).toContain('Nguyễn Ngọc Phương Thư');
    expect(latest.thanh_phan).toContain('Cao Thị Ngọc Bích');
    expect(latest.thanh_phan).toContain('Trần Tú Trinh');
  });

  it('phải đồng bộ đầy đủ 21 đầu việc phân công chi tiết cho các nhân sự', () => {
    const tasks = getStoredMeetingTasks();
    expect(tasks.length).toBe(21);

    // Kiểm tra task video SSH
    const sshTask = tasks.find((t) => t.tieu_de.includes('video') && t.tieu_de.includes('SSH'));
    expect(sshTask).toBeDefined();
    expect(sshTask?.nguoi_phu_trach).toBe('Nguyễn Hữu Nhân');
    expect(sshTask?.assignee_user_id).toBe('huu_nhan@pnt.edu.vn');
    expect(sshTask?.muc_do_uu_tien).toBe('Cao');

    // Kiểm tra task kiểm định chất lượng (góp ý Thầy Hội, Cô Kim)
    const auditTask = tasks.find((t) => t.tieu_de.includes('kiểm định'));
    expect(auditTask).toBeDefined();
    expect(auditTask?.nguoi_phu_trach).toBe('Trần Tú Trinh');
    expect(auditTask?.assignee_user_id).toBe('trinhtt@pnt.edu.vn');

    // Kiểm tra task viết sách Sau Đại học Điều dưỡng (hạn tháng 11/2026)
    const bookTask = tasks.find((t) => t.tieu_de.includes('Sau Đại học Điều dưỡng'));
    expect(bookTask).toBeDefined();
    expect(bookTask?.nguoi_phu_trach).toBe('Cao Thị Ngọc Bích');
    expect(bookTask?.deadline).toBe('2026-11-30');

    // Kiểm tra task Tiền Hội nghị KHCN 2027
    const preConfTasks = tasks.filter((t) => t.tieu_de.includes('Tiền Hội nghị KHCN XX'));
    expect(preConfTasks.length).toBe(4);

    // Kiểm tra task Hội nghị chính thức KHCN 2027 (loại trừ Tiền Hội nghị)
    const mainConfTasks = tasks.filter((t) => t.tieu_de.includes('Hội nghị KHCN XX') && !t.tieu_de.includes('Tiền Hội nghị'));
    expect(mainConfTasks.length).toBe(10);
  });

  it('phải khớp chính xác email công vụ đối với các nhân sự thuộc 18 cán bộ chính thức CECICS', () => {
    const tasks = getStoredMeetingTasks();
    const cecicsStaffEmails = officialStaffList.map((s) => s.email);

    for (const task of tasks) {
      if (task.assignee_user_id) {
        expect(cecicsStaffEmails).toContain(task.assignee_user_id);
      }
    }
  });
});
