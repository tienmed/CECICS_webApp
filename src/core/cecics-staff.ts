import fs from 'fs';
import path from 'path';

/**
 * Danh sách 18 email CBNV chính thức của Trung tâm CECICS chuẩn hóa (chữ thường)
 * Tuân thủ quy tắc [P0-CECICS-OFFICIAL-STAFF-INVARIANT].
 */
export const CECICS_OFFICIAL_STAFF_EMAILS: readonly string[] = Object.freeze([
  'nguyenngocphuongthu@pnt.edu.vn',
  'thunnp@pnt.edu.vn', // Alias của Trưởng Trung tâm
  'bsquynhphuong@pnt.edu.vn',
  'linhntm@pnt.edu.vn',
  'bstien@pnt.edu.vn',
  'bichctn@pnt.edu.vn',
  'bsminhluan@pnt.edu.vn',
  'thuyntt.ttmpls@pnt.edu.vn',
  'chinhctk.ttmpls@pnt.edu.vn',
  'vanpnt@pnt.edu.vn',
  'quynhnn@pnt.edu.vn',
  'trinhtt@pnt.edu.vn',
  'taict@pnt.edu.vn',
  'huu_nhan@pnt.edu.vn',
  'trangntk@pnt.edu.vn',
  'cuongnt.ttmpls@pnt.edu.vn',
  'anhntl@pnt.edu.vn',
  'phapmtt@pnt.edu.vn',
  'thuttt@pnt.edu.vn',
]);

/**
 * Danh sách giảng viên liên kết kiêm nhiệm FTE (ví dụ: FTE 50% tại CECICS)
 * Được công nhận là thành viên của CECICS để nhận thông tin chung/nội bộ tự động.
 */
export const CECICS_AFFILIATED_STAFF_EMAILS: readonly string[] = Object.freeze([
  'uyen_vtt@pnt.edu.vn',
  'uyenvtt@pnt.edu.vn',
  'duydc@pnt.edu.vn',
]);

/**
 * Kiểm tra một địa chỉ email có thuộc nhân sự nội bộ Trung tâm CECICS (18 CBNV chính thức hoặc GV FTE 50% kiêm nhiệm) hay không.
 */
export function isCecicsInternalStaff(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return CECICS_OFFICIAL_STAFF_EMAILS.includes(normalized) || CECICS_AFFILIATED_STAFF_EMAILS.includes(normalized);
}

/**
 * Phân loại email nhận thông tin nội bộ:
 * - Email nội bộ CECICS (18 CBNV chính thức) -> được phép nhận thông tin nội bộ tự động.
 * - Email ngoài nhân sự CECICS (ví dụ: thanhdtn@pnt.edu.vn - Trưởng Khoa / ngoài CECICS):
 *   QUY TẮC BẮT BUỘC: KHÔNG ĐƯỢC gửi thông tin nội bộ cho email này,
 *   CHỈ KHI NÀO:
 *   1. Được chỉ định đích danh (explicitly targeted / direct single recipient)
 *   2. Gửi theo danh sách ngoài công khai được chọn chủ động (external recipient list)
 */
export function validateInternalRecipient(
  recipientEmail: string,
  options?: {
    isExplicitSingleTarget?: boolean;
    isExternalDispatchList?: boolean;
  }
): {
  allowed: boolean;
  isInternal: boolean;
  reason?: string;
} {
  const normalized = (recipientEmail || '').trim().toLowerCase();
  const isInternal = isCecicsInternalStaff(normalized);

  if (isInternal) {
    return { allowed: true, isInternal: true };
  }

  // Nếu là email ngoài
  if (options?.isExplicitSingleTarget || options?.isExternalDispatchList) {
    return {
      allowed: true,
      isInternal: false,
      reason: options.isExplicitSingleTarget
        ? 'Chỉ định đích danh gửi cho từng email cụ thể ngoài CECICS.'
        : 'Gửi theo danh sách ngoài CECICS được phê duyệt.',
    };
  }

  return {
    allowed: false,
    isInternal: false,
    reason: `Email ${recipientEmail} là email ngoài nhân sự Trung tâm CECICS. Quy tắc bảo mật: Không gửi thông tin nội bộ tự động cho email này trừ khi được chỉ định đích danh hoặc gửi theo danh sách ngoài.`,
  };
}

/**
 * Lọc danh sách người nhận tự động nội bộ CECICS, loại trừ mọi email ngoài (như thanhdtn@pnt.edu.vn)
 * trừ khi danh sách đó là danh sách gửi ngoài đã được chỉ định.
 */
export function filterInternalRecipients(emails: string[]): {
  validInternalEmails: string[];
  blockedExternalEmails: string[];
} {
  const validInternalEmails: string[] = [];
  const blockedExternalEmails: string[] = [];

  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (!e) continue;
    if (isCecicsInternalStaff(e)) {
      if (!validInternalEmails.includes(e)) {
        validInternalEmails.push(e);
      }
    } else {
      if (!blockedExternalEmails.includes(e)) {
        blockedExternalEmails.push(e);
      }
    }
  }

  return { validInternalEmails, blockedExternalEmails };
}
