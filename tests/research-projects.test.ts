import { describe, it, expect } from 'vitest';
import { getResearchProjects, upsertResearchProject, type ResearchProject } from '@/lib/research-projects';
import { getSimulationConferencesTracker } from '@/lib/simulation-crawler';

describe('CECICS Research & Conference Center', () => {
  it('đọc danh mục đề tài nghiên cứu nội bộ thành công', () => {
    const projects = getResearchProjects();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    const first = projects[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('ten_de_tai');
    expect(first).toHaveProperty('chu_nhiem');
  });

  it('lưu và cập nhật đề tài nghiên cứu thành công', () => {
    const testProj: ResearchProject = {
      id: 'TEST-PROJ-01',
      ten_de_tai: 'Đề tài nghiên cứu kiểm thử tự động',
      chu_nhiem: 'Trịnh Trung Tiến',
      email_chu_nhiem: 'bstien@pnt.edu.vn',
      bo_mon_phoi_hop: 'Trung tâm CECICS',
      trang_thai: 'Ý tưởng',
      thoi_gian_bat_dau: '2026-01-01',
      thoi_gian_du_kien_hoan_thanh: '2026-12-31',
      tom_tat_muc_tieu: 'Mục tiêu kiểm thử',
      linh_vuc: 'Y khoa Mô phỏng',
    };

    const updatedList = upsertResearchProject(testProj);
    const found = updatedList.find((p) => p.id === 'TEST-PROJ-01');
    expect(found).toBeDefined();
    expect(found?.ten_de_tai).toBe('Đề tài nghiên cứu kiểm thử tự động');
  });

  it('danh mục hội nghị đã bao quát cả quốc tế và trong nước (VAME, PNTU)', () => {
    const confs = getSimulationConferencesTracker();
    expect(confs.length).toBeGreaterThanOrEqual(5);

    const hasInternational = confs.some((c) => c.id.includes('imsh') || c.id.includes('sesam'));
    const hasDomestic = confs.some((c) => c.id.includes('vame') || c.id.includes('pnt'));

    expect(hasInternational).toBe(true);
    expect(hasDomestic).toBe(true);
  });
});
