import { ROLES, UNITS, type Role, type UserRecord } from './types';

export function hasRole(user: Pick<UserRecord, 'vai_tro'> | null | undefined, role: Role): boolean {
  if (!user) return false;
  return user.vai_tro.includes(role);
}

export function hasAnyRole(user: Pick<UserRecord, 'vai_tro'> | null | undefined, roles: Role[]): boolean {
  if (!user) return false;
  return roles.some((r) => user.vai_tro.includes(r));
}

export function isAdmin(user: Pick<UserRecord, 'vai_tro'> | null | undefined): boolean {
  return hasRole(user, ROLES.ADMIN);
}

export function isLeadership(user: Pick<UserRecord, 'vai_tro'> | null | undefined): boolean {
  return hasRole(user, ROLES.LANH_DAO);
}

/**
 * Kiểm tra quyền đăng nhập theo câu 4:
 * - Email phải tồn tại trong danh sách Users và đang kích hoạt.
 * - Nếu email thuộc tên miền công vụ (@pnt.edu.vn) -> cho phép.
 * - Nếu email ngoài (Gmail cá nhân...) -> chỉ cho phép khi `la_nguoi_ngoai === true` (whitelist).
 */
export function evaluateLoginAccess(
  email: string,
  users: UserRecord[],
  allowedDomain = 'pnt.edu.vn'
): { allowed: true; user: UserRecord } | { allowed: false; reason: string } {
  let decoded = String(email || '').trim().toLowerCase();
  try {
    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded).trim().toLowerCase();
    }
  } catch {
    // Giữ nguyên nếu giải mã lỗi
  }
  const normalized = decoded;
  if (!normalized || !normalized.includes('@')) {
    return { allowed: false, reason: 'Email không hợp lệ.' };
  }
  let user = users.find((u) => u.email.trim().toLowerCase() === normalized);
  // Hỗ trợ trường hợp email bí danh của TS.BS. Nguyễn Ngọc Phương Thư
  if (!user && (normalized === 'nguyenngocphuongthu@pnt.edu.vn' || normalized === 'thunnp@pnt.edu.vn')) {
    user = users.find((u) => {
      const e = u.email.trim().toLowerCase();
      return e === 'thunnp@pnt.edu.vn' || e === 'nguyenngocphuongthu@pnt.edu.vn';
    });
  }
  if (!user) {
    return {
      allowed: false,
      reason: 'Tài khoản chưa được cấp quyền truy cập hệ thống CECICS. Liên hệ Đơn vị Hành chính.',
    };
  }
  if (!user.kich_hoat) {
    return { allowed: false, reason: 'Tài khoản đã bị tạm khóa.' };
  }
  const domain = normalized.split('@')[1] || '';
  const isOfficial = domain === allowedDomain.toLowerCase() || domain.endsWith(`.${allowedDomain.toLowerCase()}`);
  if (!isOfficial && !user.la_nguoi_ngoai) {
    return {
      allowed: false,
      reason: `Email ngoài tên miền @${allowedDomain} cần được duyệt trong danh sách trắng.`,
    };
  }
  return { allowed: true, user };
}

export type PermissionAction =
  | 'view_dashboard'
  | 'create_session'
  | 'create_exam_session'
  | 'edit_session'
  | 'assign_room'
  | 'request_swap'
  | 'respond_swap'
  | 'create_sim_class'
  | 'review_sim_class'
  | 'review_sim_class_admin'
  | 'review_sim_class_tech'
  | 'send_sim_reminder'
  | 'respond_sim_confirmation'
  | 'approve_late_sim_class'
  | 'manage_equipment'
  | 'report_incident'
  | 'assess_incident'
  | 'confirm_incident_impact'
  | 'resolve_escalation'
  | 'manage_master_data'
  | 'manage_rooms'
  | 'view_hours_report';

export function canPerform(user: UserRecord | null | undefined, action: PermissionAction): boolean {
  if (!user || !user.kich_hoat) return false;
  if (isAdmin(user)) return true;

  switch (action) {
    case 'view_dashboard':
      return true;
    case 'create_session':
    case 'edit_session':
      return hasAnyRole(user, [ROLES.DAO_TAO, ROLES.HANH_CHINH]) ||
        (hasRole(user, ROLES.TRUONG_DON_VI) && user.don_vi === UNITS.DAO_TAO);
    case 'create_exam_session':
    case 'assign_room':
      return hasRole(user, ROLES.HANH_CHINH) ||
        (hasRole(user, ROLES.TRUONG_DON_VI) && user.don_vi === UNITS.HANH_CHINH);
    case 'request_swap':
    case 'respond_swap':
      return hasAnyRole(user, [ROLES.GIANG_VIEN, ROLES.DAO_TAO, ROLES.TRUONG_DON_VI]);
    case 'create_sim_class':
      return hasAnyRole(user, [ROLES.DAU_MOI_BO_MON, ROLES.DAO_TAO, ROLES.KY_THUAT, ROLES.GIANG_VIEN]);
    case 'review_sim_class':
    case 'review_sim_class_tech':
    case 'manage_equipment':
    case 'report_incident':
    case 'assess_incident':
      return hasRole(user, ROLES.KY_THUAT) ||
        (hasRole(user, ROLES.TRUONG_DON_VI) && user.don_vi === UNITS.KY_THUAT);
    case 'review_sim_class_admin':
    case 'send_sim_reminder':
      return hasRole(user, ROLES.HANH_CHINH) ||
        (hasRole(user, ROLES.TRUONG_DON_VI) && user.don_vi === UNITS.HANH_CHINH) ||
        hasRole(user, ROLES.LANH_DAO);
    case 'respond_sim_confirmation':
      return hasAnyRole(user, [ROLES.DAU_MOI_BO_MON, ROLES.GIANG_VIEN, ROLES.DAO_TAO]);
    case 'approve_late_sim_class':
      return (hasRole(user, ROLES.TRUONG_DON_VI) && user.don_vi === UNITS.KY_THUAT) || hasRole(user, ROLES.LANH_DAO);
    case 'confirm_incident_impact':
      return hasAnyRole(user, [ROLES.DAU_MOI_BO_MON, ROLES.DAO_TAO, ROLES.KY_THUAT]);
    case 'resolve_escalation':
      return hasRole(user, ROLES.LANH_DAO);
    case 'manage_master_data':
      return isAdmin(user);
    case 'manage_rooms':
      return (
        isAdmin(user) ||
        hasRole(user, ROLES.HANH_CHINH) ||
        (hasRole(user, ROLES.TRUONG_DON_VI) && user.don_vi === UNITS.HANH_CHINH)
      );
    case 'view_hours_report':
      return hasAnyRole(user, [ROLES.LANH_DAO, ROLES.TRUONG_DON_VI, ROLES.HANH_CHINH, ROLES.DAO_TAO, ROLES.GIANG_VIEN]);
    default:
      return false;
  }
}

/**
 * Kiểm tra xem người dùng có quyền xem toàn bộ lớp mô phỏng của tất cả các Bộ môn không:
 * - Admin, Ban Lãnh đạo Trung tâm CECICS.
 * - Nhân sự các đơn vị điều phối/quản lý CECICS: Hành chính, Kỹ thuật, Đào tạo.
 */
export function canViewAllSimClasses(user: UserRecord | null | undefined): boolean {
  if (!user || !user.kich_hoat) return false;
  if (isAdmin(user)) return true;
  if (hasRole(user, ROLES.LANH_DAO)) return true;
  if (hasAnyRole(user, [ROLES.HANH_CHINH, ROLES.KY_THUAT, ROLES.DAO_TAO])) return true;
  if (
    user.don_vi === UNITS.HANH_CHINH ||
    user.don_vi === UNITS.KY_THUAT ||
    user.don_vi === UNITS.DAO_TAO ||
    user.don_vi === 'BAN_LANH_DAO'
  ) {
    return true;
  }
  return false;
}

/**
 * Quy tắc bảo mật nghiệp vụ:
 * "BM nào chỉ thấy được phiếu của bm đó thôi"
 * - Nhân sự CECICS / Admin: thấy toàn bộ.
 * - Giảng viên / Đầu mối Bộ môn: CHỈ thấy phiếu thuộc đúng Bộ môn của mình (hoặc do chính mình tạo).
 */
export function canViewSimClass(
  user: UserRecord | null | undefined,
  simClass: { bo_mon_id?: string; nguoi_dang_ky?: string }
): boolean {
  if (!user || !user.kich_hoat) return false;
  if (canViewAllSimClasses(user)) return true;
  if (user.bo_mon_id) {
    return user.bo_mon_id === simClass.bo_mon_id;
  }
  return Boolean(user.user_id && simClass.nguoi_dang_ky && user.user_id === simClass.nguoi_dang_ky);
}

// -------------------------------------------------------------
// MA TRẬN PHÂN QUYỀN VAI TRÒ & PHÂN HỆ (DYNAMIC RBAC MATRIX)
// -------------------------------------------------------------

export const APP_MODULES = {
  LICH_GIANG: 'LICH_GIANG',
  LICH_THI: 'LICH_THI',
  PHAN_PHONG: 'PHAN_PHONG',
  DOI_LICH: 'DOI_LICH',
  LOP_MO_PHONG: 'LOP_MO_PHONG',
  THIET_BI: 'THIET_BI',
  SU_CO: 'SU_CO',
  BAO_CAO: 'BAO_CAO',
  QUAN_TRI: 'QUAN_TRI',
} as const;

export type AppModuleKey = (typeof APP_MODULES)[keyof typeof APP_MODULES];

export const MODULE_LABELS: Record<AppModuleKey, { title: string; desc: string; icon: string }> = {
  LICH_GIANG: { title: 'Lịch giảng', desc: 'Quản lý lịch giảng dạy lý thuyết & tiền lâm sàng', icon: '📅' },
  LICH_THI: { title: 'Lịch thi', desc: 'Lập lịch thi OSCE/trắc nghiệm, phân công giám thị', icon: '📝' },
  PHAN_PHONG: { title: 'Phân phòng', desc: 'Gán và duyệt sử dụng phòng học, giải quyết xung đột', icon: '🚪' },
  DOI_LICH: { title: 'Đổi lịch', desc: 'Hoán đổi ngày giảng 2 chiều hoặc yêu cầu dạy thay', icon: '🔄' },
  LOP_MO_PHONG: { title: 'Lớp mô phỏng', desc: 'Đăng ký, thẩm định và phê duyệt lớp mô phỏng lâm sàng', icon: '🩺' },
  THIET_BI: { title: 'Thiết bị & Mô hình', desc: 'Quản lý danh mục mô hình SimMan, task-trainer, bảo trì', icon: '🛠️' },
  SU_CO: { title: 'Báo cáo sự cố', desc: 'Ghi nhận hỏng hóc, đánh giá ảnh hưởng & phương án thay thế', icon: '⚠️' },
  BAO_CAO: { title: 'Báo cáo thống kê', desc: 'Thống kê giờ giảng quy đổi, đối soát & khóa kỳ', icon: '⏱️' },
  QUAN_TRI: { title: 'Quản trị hệ thống', desc: 'Cấu hình người dùng, phòng học, chỉ tiêu & ma trận phân quyền', icon: '⚙️' },
};

export const ACCESS_LEVELS = {
  FULL: 'FULL',
  WRITE: 'WRITE',
  READ: 'READ',
  NONE: 'NONE',
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

export const ACCESS_LEVEL_LABELS: Record<
  AccessLevel,
  { label: string; tone: 'emerald' | 'teal' | 'sky' | 'slate'; desc: string }
> = {
  FULL: { label: 'Toàn quyền', tone: 'emerald', desc: 'Xem, Tạo mới, Chỉnh sửa, Phê duyệt & Quản trị cao nhất' },
  WRITE: { label: 'Ghi / Thao tác', tone: 'teal', desc: 'Xem, Đăng ký, Cập nhật thông tin trong phạm vi đơn vị' },
  READ: { label: 'Chỉ xem', tone: 'sky', desc: 'Xem dữ liệu, tiến độ, tra cứu lịch biểu' },
  NONE: { label: 'Không truy cập', tone: 'slate', desc: 'Bị khóa/ẩn khỏi phân hệ này' },
};

export const LEVEL_WEIGHT: Record<AccessLevel, number> = {
  FULL: 3,
  WRITE: 2,
  READ: 1,
  NONE: 0,
};

export const DEFAULT_RBAC_MATRIX: Record<Role, Record<AppModuleKey, AccessLevel>> = {
  ADMIN: {
    LICH_GIANG: 'FULL',
    LICH_THI: 'FULL',
    PHAN_PHONG: 'FULL',
    DOI_LICH: 'FULL',
    LOP_MO_PHONG: 'FULL',
    THIET_BI: 'FULL',
    SU_CO: 'FULL',
    BAO_CAO: 'FULL',
    QUAN_TRI: 'FULL',
  },
  LANH_DAO: {
    LICH_GIANG: 'READ',
    LICH_THI: 'READ',
    PHAN_PHONG: 'READ',
    DOI_LICH: 'READ',
    LOP_MO_PHONG: 'FULL',
    THIET_BI: 'READ',
    SU_CO: 'WRITE',
    BAO_CAO: 'FULL',
    QUAN_TRI: 'READ',
  },
  TRUONG_DON_VI: {
    LICH_GIANG: 'WRITE',
    LICH_THI: 'WRITE',
    PHAN_PHONG: 'WRITE',
    DOI_LICH: 'WRITE',
    LOP_MO_PHONG: 'WRITE',
    THIET_BI: 'WRITE',
    SU_CO: 'WRITE',
    BAO_CAO: 'FULL',
    QUAN_TRI: 'NONE',
  },
  HANH_CHINH: {
    LICH_GIANG: 'WRITE',
    LICH_THI: 'FULL',
    PHAN_PHONG: 'FULL',
    DOI_LICH: 'READ',
    LOP_MO_PHONG: 'READ',
    THIET_BI: 'READ',
    SU_CO: 'READ',
    BAO_CAO: 'WRITE',
    QUAN_TRI: 'NONE',
  },
  DAO_TAO: {
    LICH_GIANG: 'FULL',
    LICH_THI: 'WRITE',
    PHAN_PHONG: 'READ',
    DOI_LICH: 'WRITE',
    LOP_MO_PHONG: 'WRITE',
    THIET_BI: 'READ',
    SU_CO: 'READ',
    BAO_CAO: 'FULL',
    QUAN_TRI: 'NONE',
  },
  KY_THUAT: {
    LICH_GIANG: 'READ',
    LICH_THI: 'READ',
    PHAN_PHONG: 'READ',
    DOI_LICH: 'NONE',
    LOP_MO_PHONG: 'WRITE',
    THIET_BI: 'FULL',
    SU_CO: 'FULL',
    BAO_CAO: 'WRITE',
    QUAN_TRI: 'NONE',
  },
  DAU_MOI_BO_MON: {
    LICH_GIANG: 'READ',
    LICH_THI: 'READ',
    PHAN_PHONG: 'READ',
    DOI_LICH: 'READ',
    LOP_MO_PHONG: 'WRITE',
    THIET_BI: 'READ',
    SU_CO: 'WRITE',
    BAO_CAO: 'READ',
    QUAN_TRI: 'NONE',
  },
  GIANG_VIEN: {
    LICH_GIANG: 'READ',
    LICH_THI: 'READ',
    PHAN_PHONG: 'READ',
    DOI_LICH: 'WRITE',
    LOP_MO_PHONG: 'READ',
    THIET_BI: 'READ',
    SU_CO: 'READ',
    BAO_CAO: 'READ',
    QUAN_TRI: 'NONE',
  },
};

export function resolveModuleAccess(
  roles: Role[],
  moduleKey: AppModuleKey,
  matrix: Record<Role, Record<AppModuleKey, AccessLevel>> = DEFAULT_RBAC_MATRIX
): AccessLevel {
  if (roles.includes(ROLES.ADMIN)) return 'FULL';
  let maxWeight = -1;
  let highestLevel: AccessLevel = 'NONE';
  for (const r of roles) {
    const lvl = matrix[r]?.[moduleKey] || 'NONE';
    const weight = LEVEL_WEIGHT[lvl] ?? 0;
    if (weight > maxWeight) {
      maxWeight = weight;
      highestLevel = lvl;
    }
  }
  return highestLevel;
}

export function parseRbacMatrix(rawSetting?: string): Record<Role, Record<AppModuleKey, AccessLevel>> {
  if (!rawSetting) return DEFAULT_RBAC_MATRIX;
  try {
    const parsed = JSON.parse(rawSetting);
    const result: Record<Role, Record<AppModuleKey, AccessLevel>> = { ...DEFAULT_RBAC_MATRIX };
    for (const r of Object.keys(DEFAULT_RBAC_MATRIX) as Role[]) {
      if (parsed[r]) {
        result[r] = { ...DEFAULT_RBAC_MATRIX[r], ...parsed[r] };
      }
    }
    return result;
  } catch {
    return DEFAULT_RBAC_MATRIX;
  }
}

export function canAccessModule(
  user: UserRecord | null | undefined,
  moduleKey: AppModuleKey,
  requiredLevel: AccessLevel = 'READ',
  rbacMatrix?: Record<Role, Record<AppModuleKey, AccessLevel>>
): boolean {
  if (!user || !user.kich_hoat) return false;
  if (isAdmin(user)) return true;
  const effective = resolveModuleAccess(user.vai_tro as Role[], moduleKey, rbacMatrix);
  return LEVEL_WEIGHT[effective] >= LEVEL_WEIGHT[requiredLevel];
}
