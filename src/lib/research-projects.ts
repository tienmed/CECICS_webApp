import fs from 'fs';
import path from 'path';

export interface ResearchProject {
  id: string;
  ten_de_tai: string;
  chu_nhiem: string;
  email_chu_nhiem: string;
  bo_mon_phoi_hop: string;
  trang_thai: 'Ý tưởng' | 'Đang thực hiện' | 'Đã nghiệm thu' | 'Đã công bố (Bài báo/Hội nghị)';
  thoi_gian_bat_dau: string;
  thoi_gian_du_kien_hoan_thanh: string;
  tom_tat_muc_tieu: string;
  file_bao_cao_url?: string;
  linh_vuc: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'research_projects.json');

export function getResearchProjects(): ResearchProject[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content) as ResearchProject[];
    }
  } catch (err) {
    console.error('[ResearchProjects] Lỗi đọc danh sách đề tài:', err);
  }
  return [];
}

export function saveResearchProjects(projects: ResearchProject[]): boolean {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[ResearchProjects] Lỗi lưu danh sách đề tài:', err);
    return false;
  }
}

export function upsertResearchProject(project: ResearchProject): ResearchProject[] {
  const current = getResearchProjects();
  const idx = current.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    current[idx] = project;
  } else {
    current.unshift(project);
  }
  saveResearchProjects(current);
  return current;
}
