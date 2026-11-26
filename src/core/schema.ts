/**
 * Định nghĩa cấu trúc các tab Google Sheets (mỗi tab = 1 bảng).
 * Thứ tự cột ở đây CHÍNH LÀ thứ tự cột trên Sheets — không đổi thứ tự khi đã có dữ liệu,
 * chỉ thêm cột mới vào cuối.
 */

import { sanitizeLegacyIsoText } from './time';

export type FieldType = 'string' | 'number' | 'boolean' | 'list' | 'json';

export const TABLES = {
  Users: {
    id: 'user_id',
    fields: {
      user_id: 'string',
      email: 'string',
      ho_ten: 'string',
      vai_tro: 'list',
      don_vi: 'string',
      co_so: 'string',
      bo_mon_id: 'string',
      la_nguoi_ngoai: 'boolean',
      kich_hoat: 'boolean',
    },
  },
  Campuses: {
    id: 'campus_id',
    fields: { campus_id: 'string', ten: 'string', dia_chi: 'string' },
  },
  Rooms: {
    id: 'room_id',
    fields: {
      room_id: 'string',
      campus_id: 'string',
      ten: 'string',
      loai: 'string',
      suc_chua: 'number',
      kich_hoat: 'boolean',
    },
  },
  Departments: {
    id: 'bo_mon_id',
    fields: { bo_mon_id: 'string', ten: 'string', dau_moi_user_id: 'string' },
  },
  Sessions: {
    id: 'session_id',
    fields: {
      session_id: 'string',
      loai: 'string',
      he: 'string',
      hoc_phan: 'string',
      bai_giang: 'string',
      lop: 'string',
      ngay: 'string',
      gio_bd: 'string',
      gio_kt: 'string',
      campus_id: 'string',
      giang_vien_id: 'string',
      room_id: 'string',
      trang_thai: 'string',
      calendar_event_id: 'string',
      rsvp: 'string',
      ghi_chu: 'string',
      tao_boi: 'string',
      cap_nhat_luc: 'string',
    },
  },
  SwapRequests: {
    id: 'swap_id',
    fields: {
      swap_id: 'string',
      session_id: 'string',
      target_session_id: 'string',
      tu_gv: 'string',
      den_gv: 'string',
      loi_nhan: 'string',
      ly_do_tu_choi: 'string',
      trang_thai: 'string',
      tao_luc: 'string',
      phan_hoi_luc: 'string',
    },
  },
  SimClasses: {
    id: 'sim_id',
    fields: {
      sim_id: 'string',
      bo_mon_id: 'string',
      nguoi_dang_ky: 'string',
      giang_vien_phu_trach: 'string',
      sdt_lien_he: 'string',
      email_lien_he: 'string',
      nguoi_ho_tro: 'string',
      doi_tuong_hoc_vien: 'string',
      ngay: 'string',
      gio_bd: 'string',
      gio_kt: 'string',
      campus_id: 'string',
      buoi_hoc: 'string',
      noi_dung: 'string',
      so_hoc_vien: 'number',
      so_nhom: 'number',
      so_hv_moi_nhom: 'number',
      nhu_cau_sp: 'string',
      boi_canh_lam_sang: 'string',
      muc_tieu_dao_tao: 'string',
      ky_nang_mong_doi: 'string',
      thiet_bi_yeu_cau: 'string',
      danh_muc_mo_hinh_json: 'string',
      so_buoi: 'number',
      ngay_kt: 'string',
      danh_sach_buoi_json: 'string',
      room_id: 'string',
      ktv_phu_trach: 'string',
      duyet_hanh_chinh: 'string',
      duyet_ky_thuat: 'string',
      trang_thai: 'string',
      dang_ky_tre: 'boolean',
      ghi_chu_hanh_chinh: 'string',
      ghi_chu_ky_thuat: 'string',
      ngay_nhac_t7: 'string',
      phan_hoi_bo_mon: 'string',
      ly_do_dieu_chinh: 'string',
      tao_luc: 'string',
      cap_nhat_luc: 'string',
    },
  },
  SimClassEquipment: {
    id: 'row_id',
    fields: { row_id: 'string', sim_id: 'string', equipment_id: 'string' },
  },
  EquipmentCatalogs: {
    id: 'catalog_id',
    fields: {
      catalog_id: 'string',
      ten: 'string',
      nhom: 'string',
      hang_sx: 'string',
      dvt: 'string',
      mo_ta: 'string',
      so_luong_tong: 'number',
    },
  },
  Consumables: {
    id: 'consumable_id',
    fields: {
      consumable_id: 'string',
      ten: 'string',
      nhom: 'string',
      dvt: 'string',
      dinh_muc_mac_dinh: 'number',
      ton_kho: 'number',
      ghi_chu: 'string',
    },
  },
  SimClassConsumables: {
    id: 'row_id',
    fields: {
      row_id: 'string',
      sim_id: 'string',
      consumable_id: 'string',
      so_luong: 'number',
      ghi_chu: 'string',
    },
  },
  Equipment: {
    id: 'equipment_id',
    fields: {
      equipment_id: 'string',
      catalog_id: 'string',
      ten: 'string',
      nhom: 'string',
      campus_id: 'string',
      trang_thai: 'string',
      so_seri: 'string',
      nam_sx: 'string',
      vi_tri: 'string',
      so_luot_dung: 'number',
      so_gio_dung: 'number',
      tu_ngay: 'string',
      ghi_chu: 'string',
      ngay_bao_tri_cuoi: 'string',
      ngay_bao_tri_tiep: 'string',
      chu_ky_bao_tri_ngay: 'number',
      vi_tri_hien_tai: 'string',
    },
  },
  EquipmentMaintenance: {
    id: 'maintenance_id',
    fields: {
      maintenance_id: 'string',
      equipment_id: 'string',
      sim_id: 'string',
      loai: 'string',
      ngay_thuc_hien: 'string',
      nguoi_thuc_hien: 'string',
      noi_dung: 'string',
      tinh_trang_sau: 'string',
      vi_tri_sau: 'string',
      ngay_bao_tri_tiep: 'string',
      ghi_chu: 'string',
      tao_luc: 'string',
    },
  },
  Incidents: {
    id: 'incident_id',
    fields: {
      incident_id: 'string',
      equipment_id: 'string',
      nguoi_bao: 'string',
      bao_luc: 'string',
      mo_ta: 'string',
      du_kien_xong: 'string',
      danh_gia: 'string',
      trang_thai: 'string',
      dong_luc: 'string',
    },
  },
  IncidentImpacts: {
    id: 'impact_id',
    fields: {
      impact_id: 'string',
      incident_id: 'string',
      sim_id: 'string',
      phuong_an: 'string',
      bo_mon_xac_nhan: 'boolean',
      xac_nhan_boi: 'string',
      xac_nhan_luc: 'string',
    },
  },
  Escalations: {
    id: 'esc_id',
    fields: {
      esc_id: 'string',
      loai: 'string',
      doi_tuong_id: 'string',
      don_vi: 'string',
      ly_do: 'string',
      tao_luc: 'string',
      trang_thai: 'string',
      hanh_dong_ld: 'string',
      y_kien: 'string',
      boi: 'string',
      luc: 'string',
    },
  },
  Targets: {
    id: 'target_id',
    fields: {
      target_id: 'string',
      nam: 'number',
      chi_tieu: 'string',
      gia_tri: 'number',
    },
  },
  Notifications: {
    id: 'id',
    fields: {
      id: 'string',
      user_id: 'string',
      tieu_de: 'string',
      noi_dung: 'string',
      link: 'string',
      da_doc: 'boolean',
      tao_luc: 'string',
    },
  },
  AuditLog: {
    id: 'log_id',
    fields: {
      log_id: 'string',
      luc: 'string',
      user: 'string',
      hanh_dong: 'string',
      bang: 'string',
      doi_tuong_id: 'string',
      truoc_json: 'json',
      sau_json: 'json',
    },
  },
  Settings: {
    id: 'khoa',
    fields: { khoa: 'string', gia_tri: 'string', mo_ta: 'string' },
  },
  Outbox: {
    id: 'id',
    fields: {
      id: 'string',
      luc: 'string',
      loai: 'string',
      nguoi_nhan: 'string',
      tieu_de: 'string',
      noi_dung: 'string',
    },
  },
  VerificationLocks: {
    id: 'lock_id',
    fields: {
      lock_id: 'string',
      period_key: 'string',
      entity_type: 'string',
      entity_id: 'string',
      layer1_locked: 'boolean',
      layer1_by: 'string',
      layer1_at: 'string',
      layer2_locked: 'boolean',
      layer2_by: 'string',
      layer2_at: 'string',
      unlock_requested: 'boolean',
      unlock_reason: 'string',
      email_sent_at: 'string',
    },
  },
  CmeCourses: {
    id: 'course_id',
    fields: {
      course_id: 'string',
      ma_khoa: 'string',
      ten_khoa: 'string',
      doi_tuong: 'string',
      so_tiet_cme: 'number',
      hoc_phi: 'number',
      chi_tieu: 'number',
      ngay_khai_giang: 'string',
      ngay_be_giang: 'string',
      han_dang_ky: 'string',
      campus_id: 'string',
      phong_hoc_mac_dinh: 'string',
      giang_vien_chu_nhiem: 'string',
      noi_dung_tom_tat: 'string',
      thoi_khoa_bieu_json: 'string',
      ngan_hang_cau_hoi_pretest_json: 'string',
      ngan_hang_cau_hoi_posttest_json: 'string',
      trang_thai: 'string',
      ngay_tao: 'string',
      tao_boi: 'string',
    },
  },
  CmeStudents: {
    id: 'student_id',
    fields: {
      student_id: 'string',
      cccd: 'string',
      ngay_sinh: 'string',
      ho_ten: 'string',
      gioi_tinh: 'string',
      don_vi_cong_tac: 'string',
      chuc_danh: 'string',
      email: 'string',
      sdt: 'string',
      dia_chi: 'string',
      so_cchn: 'string',
      anh_bang_cap_url: 'string',
      ngay_tao: 'string',
      cap_nhat_luc: 'string',
    },
  },
  CmeRegistrations: {
    id: 'reg_id',
    fields: {
      reg_id: 'string',
      course_id: 'string',
      student_id: 'string',
      ngay_dang_ky: 'string',
      trang_thai: 'string',
      so_tien: 'number',
      ma_giao_dich: 'string',
      minh_chung_ck_url: 'string',
      ngay_chuyen_khoan: 'string',
      xac_nhan_boi: 'string',
      xac_nhan_luc: 'string',
      ly_do_tu_choi: 'string',
      so_chung_chi_cme: 'string',
      ngay_cap_chung_chi: 'string',
    },
  },
  CmeAttendance: {
    id: 'att_id',
    fields: {
      att_id: 'string',
      course_id: 'string',
      student_id: 'string',
      buoi_so: 'number',
      ngay: 'string',
      ca_hoc: 'string',
      co_mat: 'boolean',
      ghi_chu: 'string',
      nguoi_diem_danh: 'string',
      luc: 'string',
    },
  },
  CmeAssessments: {
    id: 'asm_id',
    fields: {
      asm_id: 'string',
      course_id: 'string',
      student_id: 'string',
      diem_pretest: 'number',
      diem_posttest: 'number',
      diem_thuc_hanh: 'number',
      ket_qua: 'string',
      xep_loai: 'string',
      nhan_xet: 'string',
      ngay_danh_gia: 'string',
      nguoi_danh_gia: 'string',
    },
  },
  CmeSurveys: {
    id: 'survey_id',
    fields: {
      survey_id: 'string',
      course_id: 'string',
      student_id: 'string',
      hai_long_chuong_trinh: 'number',
      hai_long_giang_vien: 'number',
      hai_long_mo_hinh_csvc: 'number',
      hai_long_to_chuc: 'number',
      y_kien_dong_gop: 'string',
      ngay_khao_sat: 'string',
    },
  },
  CmeSettlements: {
    id: 'settlement_id',
    fields: {
      settlement_id: 'string',
      course_id: 'string',
      tong_thu_hoc_phi: 'number',
      thu_lao_giang_vien: 'number',
      thu_lao_tro_giang_ktv: 'number',
      chi_phi_vat_tu: 'number',
      chi_phi_to_chuc: 'number',
      trich_nop_nha_truong: 'number',
      thuc_nhan_cecics: 'number',
      trang_thai: 'string',
      nguoi_lap: 'string',
      ngay_lap: 'string',
      nguoi_duyet: 'string',
      ngay_duyet: 'string',
      ghi_chu: 'string',
    },
  },
  MeetingMinutes: {
    id: 'meeting_id',
    fields: {
      meeting_id: 'string',
      tieu_de: 'string',
      ngay_hop: 'string',
      gio_bd: 'string',
      gio_kt: 'string',
      dia_diem: 'string',
      chu_tri: 'string',
      thu_ky: 'string',
      thanh_phan: 'list',
      noi_dung_md: 'string',
      file_dinh_kem: 'json',
      nguoi_tao: 'string',
      tao_luc: 'string',
    },
  },
  MeetingTasks: {
    id: 'task_id',
    fields: {
      task_id: 'string',
      meeting_id: 'string',
      tieu_de: 'string',
      nguoi_phu_trach: 'string',
      assignee_user_id: 'string',
      deadline: 'string',
      muc_do_uu_tien: 'string',
      trang_thai: 'string',
      ghi_chu: 'string',
      tao_luc: 'string',
    },
  },
} as const satisfies Record<string, { id: string; fields: Record<string, FieldType> }>;

export type TableName = keyof typeof TABLES;

type TsOf<F extends FieldType> = F extends 'number'
  ? number
  : F extends 'boolean'
    ? boolean
    : F extends 'list'
      ? string[]
      : F extends 'json'
        ? unknown
        : string;

export type Rec<T extends TableName> = {
  -readonly [K in keyof (typeof TABLES)[T]['fields']]: (typeof TABLES)[T]['fields'][K] extends FieldType
    ? TsOf<(typeof TABLES)[T]['fields'][K]>
    : never;
};

export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

export function columnsOf(t: TableName): string[] {
  return Object.keys(TABLES[t].fields);
}

export function idFieldOf(t: TableName): string {
  return TABLES[t].id;
}

/** Chuyển 1 dòng thô trên Sheets (mảng giá trị) thành bản ghi có kiểu. */
export function fromRow<T extends TableName>(t: T, row: unknown[]): Rec<T> {
  const fields = TABLES[t].fields as Record<string, FieldType>;
  const out: Record<string, unknown> = {};
  Object.keys(fields).forEach((name, i) => {
    out[name] = parseCell(fields[name], row[i], name);
  });
  return out as Rec<T>;
}

/** Chuyển bản ghi thành mảng giá trị để ghi lên Sheets. */
export function toRow<T extends TableName>(t: T, rec: Partial<Rec<T>>): (string | number | boolean)[] {
  const fields = TABLES[t].fields as Record<string, FieldType>;
  return Object.keys(fields).map((name) => serializeCell(fields[name], (rec as Record<string, unknown>)[name]));
}

function excelSerialToYmd(serial: number): string {
  // Mốc epoch của Excel / Google Sheets: 30/12/1899
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Math.round(serial * 86400 * 1000);
  const d = new Date(epoch + ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function excelFractionToTime(frac: number): string {
  const totalSeconds = Math.round(frac * 86400);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseCell(type: FieldType, v: unknown, fieldName?: string): unknown {
  if (v === null || v === undefined) v = '';
  switch (type) {
    case 'number': {
      if (v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    case 'boolean':
      return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1';
    case 'list':
      return String(v)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    case 'json':
      if (v === '') return null;
      try {
        return JSON.parse(String(v));
      } catch {
        return String(v);
      }
    default: {
      const fn = fieldName ? fieldName.toLowerCase() : '';
      const isDateField = fn.startsWith('ngay') || fn.includes('date');
      const isTimeField = fn.startsWith('gio_') || fn.includes('time');

      // 1. Google Sheets UNFORMATTED_VALUE trả về số Serial cho ngày (ví dụ 46352 hoặc chuỗi "46352")
      const numV = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : NaN;
      if (!Number.isNaN(numV) && isDateField && numV >= 35000 && numV <= 65000) {
        return excelSerialToYmd(numV);
      }

      // 2. Google Sheets UNFORMATTED_VALUE trả về phần thập phân 0 <= v < 1 cho giờ (ví dụ 0.5625 -> 13:30)
      if (!Number.isNaN(numV) && isTimeField && numV >= 0 && numV < 1) {
        return excelFractionToTime(numV);
      }

      // 3. Đối tượng Date từ Apps Script hoặc API
      if (v instanceof Date) {
        if (isDateField) {
          const vn = new Date(v.getTime() + 7 * 3600 * 1000);
          return vn.toISOString().slice(0, 10);
        }
        if (isTimeField) {
          const vn = new Date(v.getTime() + 7 * 3600 * 1000);
          const h = String(vn.getUTCHours()).padStart(2, '0');
          const m = String(vn.getUTCMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        }
        return v.toISOString();
      }

      // 4. Chuỗi ISO UTC (ví dụ "2026-11-25T17:00:00.000Z" hoặc "1899-12-30T06:23:30.000Z")
      const s = String(v);
      if (s.includes('T') && s.endsWith('Z')) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          // Lưu ý: Đối với mốc thời gian năm 1899 (Google Sheets time epoch), Apps Script tại múi giờ Việt Nam
          // sử dụng Saigon Local Mean Time (LMT = UTC+07:06:30), làm 13:30 thành 06:23:30Z.
          // Cần cộng thêm đúng 7h06m30s cho các mốc năm 1899 để khôi phục chính xác 13:30 / 17:00.
          const isHistoric1899 = d.getUTCFullYear() <= 1900;
          const offsetMs = isHistoric1899 ? (7 * 3600 + 6 * 60 + 30) * 1000 : 7 * 3600 * 1000;
          const vn = new Date(d.getTime() + offsetMs);

          if (isDateField) {
            return vn.toISOString().slice(0, 10);
          }
          if (isTimeField) {
            const h = String(vn.getUTCHours()).padStart(2, '0');
            const m = String(vn.getUTCMinutes()).padStart(2, '0');
            return `${h}:${m}`;
          }
        }
      }

      // 5. Chuẩn hóa làm sạch bất kỳ chuỗi văn bản nào chứa các mốc ISO lịch sử (ví dụ ly_do trong Escalations)
      if (s.includes('1899-12-30T') || (s.includes('T') && s.includes(':00.000Z'))) {
        return sanitizeLegacyIsoText(s);
      }

      return s;
    }
  }
}

export function serializeCell(type: FieldType, v: unknown): string | number | boolean {
  if (v === null || v === undefined) return '';
  switch (type) {
    case 'number':
      return typeof v === 'number' ? v : Number(v) || 0;
    case 'boolean':
      return v === true || v === 'true' || v === 'TRUE';
    case 'list':
      return Array.isArray(v) ? v.join(',') : String(v);
    case 'json':
      return v === '' ? '' : JSON.stringify(v);
    default:
      return String(v);
  }
}
