import type { Rec, TableName } from './schema';

export const ROLES = {
  LANH_DAO: 'LANH_DAO',
  TRUONG_DON_VI: 'TRUONG_DON_VI',
  HANH_CHINH: 'HANH_CHINH',
  DAO_TAO: 'DAO_TAO',
  KY_THUAT: 'KY_THUAT',
  DAU_MOI_BO_MON: 'DAU_MOI_BO_MON',
  GIANG_VIEN: 'GIANG_VIEN',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  LANH_DAO: 'Ban Lãnh đạo',
  TRUONG_DON_VI: 'Trưởng Đơn vị',
  HANH_CHINH: 'Hành chính / Thư ký',
  DAO_TAO: 'Đào tạo',
  KY_THUAT: 'Kỹ thuật',
  DAU_MOI_BO_MON: 'Đầu mối Bộ môn',
  GIANG_VIEN: 'Giảng viên',
  ADMIN: 'Quản trị hệ thống',
};

export const UNITS = {
  BAN_LANH_DAO: 'BAN_LANH_DAO',
  HANH_CHINH: 'HANH_CHINH',
  DAO_TAO: 'DAO_TAO',
  KY_THUAT: 'KY_THUAT',
  NGHIEN_CUU: 'NGHIEN_CUU',
  BO_MON: 'BO_MON',
} as const;

export type Unit = (typeof UNITS)[keyof typeof UNITS];

export const UNIT_LABELS: Record<Unit, string> = {
  BAN_LANH_DAO: 'Ban Lãnh đạo',
  HANH_CHINH: 'Đơn vị Hành chính',
  DAO_TAO: 'Đơn vị Đào tạo',
  KY_THUAT: 'Đơn vị Kỹ thuật',
  NGHIEN_CUU: 'Đơn vị Nghiên cứu',
  BO_MON: 'Bộ môn / Ngoài trung tâm',
};

export const SESSION_TYPES = ['Giảng dạy', 'Coi thi', 'Họp'] as const;
export const SESSION_PROGRAMS = ['ĐH', 'SĐH', 'CME', 'Hành chính'] as const;
export const SESSION_STATUSES = ['Đã lên lịch', 'Đã hủy'] as const;
export const SWAP_STATUSES = ['Chờ', 'Đồng ý', 'Từ chối', 'Hủy', 'Hết hạn'] as const;
export const SIM_STATUSES = [
  'Chờ rà soát',
  'Cần xét đặc biệt',
  'Đã duyệt',
  'Đã phê duyệt',
  'Nhắc xác nhận T-7',
  'Đã chốt giữ nguyên',
  'Cần rà soát điều chỉnh',
  'Từ chối',
  'Đã hủy',
] as const;
export const EQUIPMENT_STATUSES = ['Hoạt động', 'Hỏng', 'Bảo trì', 'Thanh lý'] as const;
export const ROOM_TYPES = [
  'OSCE',
  'Phản hồi',
  'Kỹ năng',
  'Simulation',
  'Phòng họp',
  'Lý thuyết',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const INCIDENT_ASSESSMENTS = ['Chưa đánh giá', 'Sửa kịp', 'Không kịp'] as const;
export const MITIGATION_OPTIONS = ['Chưa chọn', 'Đổi mô hình', 'Giảm bài', 'Dời lịch'] as const;
export const ESCALATION_ACTIONS = ['Chỉ đạo', 'Phê duyệt', 'Trả lại'] as const;

export type DatabaseSnapshot = {
  [K in TableName]: Rec<K>[];
};

export type UserRecord = Rec<'Users'>;
export type CampusRecord = Rec<'Campuses'>;
export type RoomRecord = Rec<'Rooms'>;
export type DepartmentRecord = Rec<'Departments'>;
export type SessionRecord = Rec<'Sessions'>;
export type SwapRequestRecord = Rec<'SwapRequests'>;
export type SimClassRecord = Rec<'SimClasses'>;
export type SimClassEquipmentRecord = Rec<'SimClassEquipment'>;
export type EquipmentCatalogRecord = Rec<'EquipmentCatalogs'>;
export type ConsumableRecord = Rec<'Consumables'>;
export type SimClassConsumableRecord = Rec<'SimClassConsumables'>;
export type EquipmentRecord = Rec<'Equipment'>;
export type EquipmentMaintenanceRecord = Rec<'EquipmentMaintenance'>;
export type IncidentRecord = Rec<'Incidents'>;
export type IncidentImpactRecord = Rec<'IncidentImpacts'>;
export type EscalationRecord = Rec<'Escalations'>;
export type TargetRecord = Rec<'Targets'>;
export type NotificationRecord = Rec<'Notifications'>;
export type AuditLogRecord = Rec<'AuditLog'>;
export type SettingRecord = Rec<'Settings'>;
export type OutboxRecord = Rec<'Outbox'>;
export type VerificationLockRecord = Rec<'VerificationLocks'>;
export type CmeCourseRecord = Rec<'CmeCourses'>;
export type CmeStudentRecord = Rec<'CmeStudents'>;
export type CmeRegistrationRecord = Rec<'CmeRegistrations'>;
export type CmeAttendanceRecord = Rec<'CmeAttendance'>;
export type CmeAssessmentRecord = Rec<'CmeAssessments'>;
export type CmeSurveyRecord = Rec<'CmeSurveys'>;
export type CmeSettlementRecord = Rec<'CmeSettlements'>;

export interface DefaultSettings {
  GAN_PHONG_TRUOC_NGAY: number;
  CANH_BAO_CHUA_GAN_PHONG_NGAY: number;
  HAN_DANG_KY_MO_PHONG_NGAY: number;
  THIET_BI_HONG_LEO_THANG_NGAY: number;
  LOP_TRE_LEO_THANG_NGAY: number;
  LECH_TAI_PHAN_TRAM: number;
  GIO_LAM_VIEC_BD: string;
  GIO_LAM_VIEC_KT: string;
  NGAY_LAM_VIEC: string; // e.g., "1,2,3,4,5,6" (Mon-Sat)
}

export const DEFAULT_SETTINGS: DefaultSettings = {
  GAN_PHONG_TRUOC_NGAY: 7,
  CANH_BAO_CHUA_GAN_PHONG_NGAY: 2,
  HAN_DANG_KY_MO_PHONG_NGAY: 14,
  THIET_BI_HONG_LEO_THANG_NGAY: 7,
  LOP_TRE_LEO_THANG_NGAY: 3,
  LECH_TAI_PHAN_TRAM: 30,
  GIO_LAM_VIEC_BD: '07:00',
  GIO_LAM_VIEC_KT: '17:00',
  NGAY_LAM_VIEC: '1,2,3,4,5,6',
};

export function parseSettings(rows: SettingRecord[]): DefaultSettings {
  const map = new Map(rows.map((r) => [r.khoa, r.gia_tri]));
  const num = (k: keyof DefaultSettings) => {
    const raw = map.get(k);
    const n = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : (DEFAULT_SETTINGS[k] as number);
  };
  return {
    GAN_PHONG_TRUOC_NGAY: num('GAN_PHONG_TRUOC_NGAY'),
    CANH_BAO_CHUA_GAN_PHONG_NGAY: num('CANH_BAO_CHUA_GAN_PHONG_NGAY'),
    HAN_DANG_KY_MO_PHONG_NGAY: num('HAN_DANG_KY_MO_PHONG_NGAY'),
    THIET_BI_HONG_LEO_THANG_NGAY: num('THIET_BI_HONG_LEO_THANG_NGAY'),
    LOP_TRE_LEO_THANG_NGAY: num('LOP_TRE_LEO_THANG_NGAY'),
    LECH_TAI_PHAN_TRAM: num('LECH_TAI_PHAN_TRAM'),
    GIO_LAM_VIEC_BD: map.get('GIO_LAM_VIEC_BD') || DEFAULT_SETTINGS.GIO_LAM_VIEC_BD,
    GIO_LAM_VIEC_KT: map.get('GIO_LAM_VIEC_KT') || DEFAULT_SETTINGS.GIO_LAM_VIEC_KT,
    NGAY_LAM_VIEC: map.get('NGAY_LAM_VIEC') || DEFAULT_SETTINGS.NGAY_LAM_VIEC,
  };
}
