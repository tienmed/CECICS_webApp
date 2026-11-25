/**
 * Trích xuất trực tiếp dữ liệu hoạt động giảng dạy mô phỏng THẬT 100%
 * Nguồn: Google Sheets công vụ CECICS (DATA_MODE=sheets) + Danh mục thiết bị thực tế AMS
 * KHÔNG sử dụng mock data, KHÔNG người giả định, KHÔNG khóa học giả định.
 */

import fs from 'fs';
import path from 'path';
import { readAllFromSheets } from './sheets';
import { type DatabaseSnapshot } from '@/core/types';

// Tải biến môi trường từ .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

export interface RealWeekActivity {
  today: string;
  startDate: string;
  endDate: string;
  activeSimClasses: Array<{
    sim_id: string;
    noi_dung: string;
    ngay: string;
    gio_bd: string;
    gio_kt: string;
    bo_mon_id: string;
    giang_vien_phu_trach: string;
    doi_tuong_hoc_vien: string;
    muc_tieu_dao_tao: string;
    thiet_bi_yeu_cau: string;
    room_id: string;
  }>;
  activeSessions: Array<{
    session_id: string;
    bai_giang: string;
    ngay: string;
    gio_bd: string;
    gio_kt: string;
    giang_vien: string;
    phong: string;
  }>;
  activeCmeCourses: Array<{
    course_id: string;
    ten_khoa: string;
    doi_tuong: string;
    ngay_khai_giang: string;
    ngay_be_giang: string;
    giang_vien_chu_nhiem: string;
  }>;
}

export async function fetchCurrentRealWeekActivity(referenceDate = new Date()): Promise<RealWeekActivity> {
  const db: DatabaseSnapshot = await readAllFromSheets(true);
  
  // Xác định khoảng thời gian tuần hiện tại (Thứ 2 đến Chủ nhật)
  const current = new Date(referenceDate);
  const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = (dayOfWeek + 6) % 7;
  
  const monday = new Date(current);
  monday.setDate(current.getDate() - distanceToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = toYmd(current);
  const startYmd = toYmd(monday);
  const endYmd = toYmd(sunday);

  // Map người dùng thật để hiển thị họ tên giảng viên
  const userMap = new Map((db.Users || []).map(u => [u.user_id, u.ho_ten]));

  // 1. Lọc lớp mô phỏng thật (SimClasses)
  const activeSimClasses = (db.SimClasses || [])
    .filter(s => s.ngay >= startYmd && s.ngay <= endYmd)
    .map(s => ({
      sim_id: s.sim_id,
      noi_dung: s.noi_dung,
      ngay: s.ngay,
      gio_bd: s.gio_bd,
      gio_kt: s.gio_kt,
      bo_mon_id: s.bo_mon_id,
      giang_vien_phu_trach: s.giang_vien_phu_trach,
      doi_tuong_hoc_vien: s.doi_tuong_hoc_vien,
      muc_tieu_dao_tao: s.muc_tieu_dao_tao,
      thiet_bi_yeu_cau: s.thiet_bi_yeu_cau,
      room_id: s.room_id || 'Chưa gán phòng',
    }));

  // 2. Lọc lịch giảng lâm sàng / thực hành kỹ năng thật (Sessions)
  const activeSessions = (db.Sessions || [])
    .filter(s => s.ngay >= startYmd && s.ngay <= endYmd)
    .map(s => ({
      session_id: s.session_id,
      bai_giang: s.bai_giang || s.hoc_phan || 'Lịch giảng lâm sàng',
      ngay: s.ngay,
      gio_bd: s.gio_bd,
      gio_kt: s.gio_kt,
      giang_vien: userMap.get(s.giang_vien_id) || s.giang_vien_id,
      phong: s.room_id || 'P-CECICS',
    }));

  // 3. Lọc khóa đào tạo liên tục CME thật
  const activeCmeCourses = (db.CmeCourses || [])
    .filter(c => c.trang_thai === 'OPEN' || (c.ngay_khai_giang >= startYmd && c.ngay_khai_giang <= endYmd))
    .map(c => ({
      course_id: c.course_id,
      ten_khoa: c.ten_khoa,
      doi_tuong: c.doi_tuong,
      ngay_khai_giang: c.ngay_khai_giang,
      ngay_be_giang: c.ngay_be_giang,
      giang_vien_chu_nhiem: c.giang_vien_chu_nhiem,
    }));

  return {
    today: todayStr,
    startDate: startYmd,
    endDate: endYmd,
    activeSimClasses,
    activeSessions,
    activeCmeCourses,
  };
}
