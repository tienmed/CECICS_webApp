import { dispatchLeastUsedEquipment } from './equipment-dispatch';
import type { Rec, TableName } from './schema';
import {
  type DatabaseSnapshot,
  type EscalationRecord,
  type IncidentImpactRecord,
  type IncidentRecord,
  type SessionRecord,
  type SimClassRecord,
  type SwapRequestRecord,
  type UserRecord,
  parseSettings,
  ROLES,
  UNITS,
} from './types';
import { findEquipmentConflicts, findLecturerConflicts, findRoomConflicts, parseRoomIds } from './conflict';
import { suggestAvailableRooms, suggestFreeLecturerSlots } from './suggest';
import { canPerform, canViewAllSimClasses, canViewSimClass } from './permissions';
import { addDaysYmd, dayOfWeekYmd, diffDaysYmd, formatVnDate, nowVnIso, parseTimeToMinutes, todayVnYmd, toVnDateTimeMs } from './time';
import { detectPendingEscalations } from './analytics';
import {
  type SimSessionItem,
  activeSimSessions,
  normalizeSimSessions,
  parseSimSessions,
  resolveSessionRoom,
  summarizeSimSchedule,
  validateSimSessions,
} from './sim-sessions';

/**
 * Giao diện lưu trữ trừu tượng:
 * - Ở Apps Script: đọc/ghi trực tiếp Google Sheets trong LockService.
 * - Ở chế độ Local/Demo: đọc/ghi file JSON cục bộ (.data/db.json).
 */
export interface DataStore {
  getAll(): DatabaseSnapshot;
  append<T extends TableName>(table: T, record: Rec<T>): void;
  update<T extends TableName>(table: T, id: string, patch: Partial<Rec<T>>): Rec<T>;
  removeByPredicate<T extends TableName>(table: T, predicate: (rec: Rec<T>) => boolean): void;
}

export class DomainError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export interface ActionSideEffects {
  calendarSync?: { op: 'upsert' | 'delete'; session: SessionRecord; lecturerEmail?: string; roomName?: string }[];
  emailsQueued?: number;
}

export interface ActionResult<T = unknown> {
  data: T;
  effects?: ActionSideEffects;
}

function nextId(prefix: string, existingIds: string[], year: number): string {
  const stem = `${prefix}-${year}-`;
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(stem)) continue;
    const n = Number(id.slice(stem.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${stem}${String(max + 1).padStart(4, '0')}`;
}

function recordAudit(
  store: DataStore,
  actor: UserRecord,
  hanh_dong: string,
  bang: TableName,
  doi_tuong_id: string,
  truoc_json: unknown,
  sau_json: unknown,
  now: Date
) {
  store.append('AuditLog', {
    log_id: `LOG-${now.getTime()}-${Math.floor(Math.random() * 10000)}`,
    luc: nowVnIso(now),
    user: actor.email,
    hanh_dong,
    bang,
    doi_tuong_id,
    truoc_json,
    sau_json,
  });
}

function notifyUser(
  store: DataStore,
  user_id: string,
  tieu_de: string,
  noi_dung: string,
  link: string,
  now: Date,
  emailRecipient?: string
) {
  const ts = nowVnIso(now);
  store.append('Notifications', {
    id: `NTF-${now.getTime()}-${Math.floor(Math.random() * 100000)}`,
    user_id,
    tieu_de,
    noi_dung,
    link,
    da_doc: false,
    tao_luc: ts,
  });
  if (emailRecipient) {
    const cleanTitle = tieu_de.replace(/^\[(AppCECICS|CECICS)\]\s*/i, '');
    store.append('Outbox', {
      id: `EML-${now.getTime()}-${Math.floor(Math.random() * 100000)}`,
      luc: ts,
      loai: 'EMAIL',
      nguoi_nhan: emailRecipient,
      tieu_de: `[AppCECICS] ${cleanTitle}`,
      noi_dung,
    });
  }
}

function validateTimeWindow(ngay: string, gio_bd: string, gio_kt: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) {
    throw new DomainError('INVALID_DATE', 'Ngày không đúng định dạng YYYY-MM-DD.');
  }
  const a = parseTimeToMinutes(gio_bd);
  const b = parseTimeToMinutes(gio_kt);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
    throw new DomainError('INVALID_TIME', 'Giờ kết thúc phải lớn hơn giờ bắt đầu.');
  }
}

/**
 * Thẩm định Kỹ thuật cho khóa học (1 hoặc nhiều buổi):
 *  - Gán chung phòng/KTV cho cả khóa (roomIds, ktv) + tùy chọn ghi đè phòng/KTV riêng từng buổi.
 *  - Kiểm tra trùng phòng và trùng thiết bị trên TỪNG buổi.
 * Trả về danh sách buổi đã cập nhật phòng/KTV riêng.
 */
function validateSimClassAllocation(
  db: DatabaseSnapshot,
  existing: SimClassRecord,
  roomIds: string[],
  equipmentIds: string[],
  overridesRaw: unknown
): SimSessionItem[] {
  const sim_id = existing.sim_id;
  const sessions = parseSimSessions(existing);
  const overrides = Array.isArray(overridesRaw) ? (overridesRaw as Record<string, unknown>[]) : [];
  const ovMap = new Map(overrides.map((o) => [Number(o.buoi_so), o]));
  const updatedSessions = sessions.map((s) => {
    const ov = ovMap.get(s.buoi_so);
    if (!ov) return s;
    return {
      ...s,
      room_id: parseRoomIds((ov.room_id as string) || '').join(','),
      ktv_phu_trach: String(ov.ktv_phu_trach || ''),
    };
  });

  const checkRoom = (rid: string) => {
    const room = db.Rooms.find((r) => r.room_id === rid && r.kich_hoat);
    if (!room || room.campus_id !== existing.campus_id) {
      throw new DomainError('CAMPUS_MISMATCH', `Phòng ${rid} không hợp lệ hoặc khác cơ sở.`);
    }
  };
  roomIds.forEach(checkRoom);

  const multi = updatedSessions.length > 1;
  for (const item of updatedSessions) {
    if (item.trang_thai_buoi === 'Hủy') continue;
    const itemRooms = parseRoomIds(resolveSessionRoom({ room_id: roomIds.join(',') }, item));
    if (itemRooms.length === 0) {
      throw new DomainError(
        'VALIDATION',
        multi
          ? `Buổi ${item.buoi_so} (${formatVnDate(item.ngay)}) chưa được gán phòng.`
          : 'Vui lòng chọn ít nhất một phòng mô phỏng trước khi duyệt.'
      );
    }
    if (item.room_id) parseRoomIds(item.room_id).forEach(checkRoom);
    const roomConflicts = findRoomConflicts(
      { id: sim_id, ngay: item.ngay, gio_bd: item.gio_bd, gio_kt: item.gio_kt, room_ids: itemRooms },
      db.Sessions,
      db.SimClasses
    );
    if (roomConflicts.length > 0) {
      const conflictLabels = roomConflicts.map((c) => `${c.resourceId}: ${c.label || c.id}`).join('; ');
      const prefix = multi ? `Buổi ${item.buoi_so} (${formatVnDate(item.ngay)} ${item.gio_bd}–${item.gio_kt}): ` : '';
      throw new DomainError('ROOM_CONFLICT', `${prefix}Phòng bị trùng lịch (${conflictLabels}).`, {
        conflicts: roomConflicts,
        buoi_so: item.buoi_so,
        suggestions: suggestAvailableRooms({
          excludeId: sim_id,
          campus_id: existing.campus_id,
          ngay: item.ngay,
          gio_bd: item.gio_bd,
          gio_kt: item.gio_kt,
          preferredType: 'Mô phỏng',
          minCapacity: existing.so_hoc_vien,
          rooms: db.Rooms,
          sessions: db.Sessions,
          simClasses: db.SimClasses,
        }).slice(0, 3),
      });
    }
  }

  for (const eqId of equipmentIds) {
    const eq = db.Equipment.find((e) => e.equipment_id === eqId);
    if (!eq) throw new DomainError('NOT_FOUND', `Không tìm thấy thiết bị ${eqId}.`);
    if (eq.trang_thai !== 'Hoạt động') {
      throw new DomainError(
        'EQUIPMENT_UNAVAILABLE',
        `Thiết bị "${eq.ten}" (${eq.equipment_id}) đang ở trạng thái "${eq.trang_thai}", không thể gán.`
      );
    }
    if (eq.campus_id !== existing.campus_id) {
      throw new DomainError('CAMPUS_MISMATCH', `Thiết bị "${eq.ten}" đang ở cơ sở ${eq.campus_id}, khác cơ sở lớp học.`);
    }
    for (const item of updatedSessions) {
      if (item.trang_thai_buoi === 'Hủy') continue;
      const eqConflicts = findEquipmentConflicts(
        { sim_id, ngay: item.ngay, gio_bd: item.gio_bd, gio_kt: item.gio_kt, equipment_id: eqId },
        db.SimClasses,
        db.SimClassEquipment
      );
      if (eqConflicts.length > 0) {
        throw new DomainError(
          'EQUIPMENT_CONFLICT',
          `Thiết bị "${eq.ten}" đã được gán cho lớp "${eqConflicts[0].noi_dung}" (${eqConflicts[0].sim_id}) trùng khung giờ${
            multi ? ` Buổi ${item.buoi_so} (${formatVnDate(item.ngay)})` : ''
          }.`
        );
      }
    }
  }
  return updatedSessions;
}

export type ActionName =
  | 'createSession'
  | 'updateSession'
  | 'cancelSession'
  | 'assignRoom'
  | 'createSwapRequest'
  | 'respondSwapRequest'
  | 'createSimClass'
  | 'reviewSimClass'
  | 'reviewSimClassAdmin'
  | 'reviewSimClassTech'
  | 'sendSimClassReminder'
  | 'respondSimClassConfirmation'
  | 'approveLateSimClass'
  | 'updateEquipment'
  | 'createEquipment'
  | 'upsertEquipmentCatalog'
  | 'upsertConsumable'
  | 'autoDispatchEquipment'
  | 'reportIncident'
  | 'assessIncident'
  | 'confirmIncidentImpact'
  | 'closeIncident'
  | 'resolveEscalation'
  | 'runDailyChecks'
  | 'markNotificationsRead'
  | 'upsertUser'
  | 'upsertRoom'
  | 'upsertDepartment'
  | 'upsertTarget'
  | 'updateSetting'
  | 'updateVerificationLock'
  | 'generateRecurringMeetings'
  | 'upsertCmeCourse'
  | 'reviewCmeRegistration'
  | 'recordCmeAttendance'
  | 'submitCmeAssessment'
  | 'submitCmeSurvey'
  | 'upsertCmeSettlement'
  | 'importLegacyCme';

export function executeAction(
  store: DataStore,
  action: ActionName,
  payload: Record<string, unknown>,
  actorEmail: string,
  now: Date = new Date()
): ActionResult {
  const db = store.getAll();
  const actor = db.Users.find((u) => u.email.toLowerCase() === String(actorEmail || '').toLowerCase() && u.kich_hoat);
  if (!actor) {
    throw new DomainError('UNAUTHORIZED', 'Người dùng không tồn tại hoặc đã bị khóa.');
  }
  const year = Number(todayVnYmd(now).slice(0, 4));
  const nowIso = nowVnIso(now);

  switch (action) {
    case 'createSession': {
      const loai = String(payload.loai || 'Giảng dạy');
      if (loai === 'Coi thi') {
        if (!canPerform(actor, 'create_exam_session') && !canPerform(actor, 'create_session')) {
          throw new DomainError('FORBIDDEN', 'Bạn không có quyền nhập lịch coi thi.');
        }
      } else if (!canPerform(actor, 'create_session')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Đào tạo hoặc Hành chính được nhập lịch giảng.');
      }

      const repeatWeeks = Math.max(1, Math.min(16, Number(payload.repeatWeeks || 1)));
      const baseNgay = String(payload.ngay || '');
      const gio_bd = String(payload.gio_bd || '');
      const gio_kt = String(payload.gio_kt || '');
      const giang_vien_id = String(payload.giang_vien_id || '');
      const campus_id = String(payload.campus_id || '');
      const room_id = String(payload.room_id || '');

      validateTimeWindow(baseNgay, gio_bd, gio_kt);
      if (!campus_id) throw new DomainError('VALIDATION', 'Vui lòng chọn cơ sở.');
      if (!giang_vien_id) throw new DomainError('VALIDATION', 'Vui lòng chọn giảng viên.');

      const created: SessionRecord[] = [];
      const currentSessions = [...db.Sessions];
      const calendarSync: ActionSideEffects['calendarSync'] = [];
      const lecturer = db.Users.find((u) => u.user_id === giang_vien_id);
      const roomObj = db.Rooms.find((r) => r.room_id === room_id);

      for (let w = 0; w < repeatWeeks; w++) {
        const ngay = addDaysYmd(baseNgay, w * 7);
        if (giang_vien_id !== 'U-CECICS-ALL' && loai !== 'Họp') {
          const lecConflicts = findLecturerConflicts(
            { id: '__NEW__', ngay, gio_bd, gio_kt, giang_vien_id },
            currentSessions
          );
          if (lecConflicts.length > 0) {
            const suggestions = suggestFreeLecturerSlots({
              excludeId: '__NEW__',
              giang_vien_id,
              ngay,
              gio_bd,
              gio_kt,
              sessions: currentSessions,
            });
            throw new DomainError(
              'LECTURER_CONFLICT',
              `Giảng viên bị trùng lịch ngày ${ngay} (${lecConflicts[0].gio_bd}–${lecConflicts[0].gio_kt}: ${lecConflicts[0].hoc_phan}).`,
              { conflicts: lecConflicts, suggestions }
            );
          }
        }

        if (room_id) {
          const roomConflicts = findRoomConflicts(
            { id: '__NEW__', ngay, gio_bd, gio_kt, room_id },
            currentSessions,
            db.SimClasses
          );
          if (roomConflicts.length > 0) {
            const suggestions = suggestAvailableRooms({
              excludeId: '__NEW__',
              campus_id,
              ngay,
              gio_bd,
              gio_kt,
              rooms: db.Rooms,
              sessions: currentSessions,
              simClasses: db.SimClasses,
            });
            throw new DomainError(
              'ROOM_CONFLICT',
              `Phòng đã có lịch trùng ngày ${ngay} (${roomConflicts[0].label || roomConflicts[0].id}).`,
              { conflicts: roomConflicts, suggestions: suggestions.slice(0, 3) }
            );
          }
        }

        const session_id = nextId('B', currentSessions.map((s) => s.session_id), year);
        const rec: SessionRecord = {
          session_id,
          loai,
          he: String(payload.he || 'ĐH'),
          hoc_phan: String(payload.hoc_phan || '').trim(),
          bai_giang: String(payload.bai_giang || '').trim(),
          lop: String(payload.lop || '').trim(),
          ngay,
          gio_bd,
          gio_kt,
          campus_id,
          giang_vien_id,
          room_id,
          trang_thai: 'Đã lên lịch',
          calendar_event_id: `gcal-${session_id}`,
          rsvp: 'Chờ phản hồi',
          ghi_chu: String(payload.ghi_chu || '').trim(),
          tao_boi: actor.user_id,
          cap_nhat_luc: nowIso,
        };
        currentSessions.push(rec);
        created.push(rec);
        calendarSync.push({
          op: 'upsert',
          session: rec,
          lecturerEmail: lecturer?.email || 'cecics@pnt.edu.vn',
          roomName: roomObj?.ten || (campus_id === 'TN' ? 'Trụ sở chính — Tân Nhựt (chờ gán phòng)' : 'Cơ sở Hoà Hưng (chờ gán phòng)'),
        });
      }

      for (const rec of created) {
        store.append('Sessions', rec);
        recordAudit(store, actor, 'CREATE_SESSION', 'Sessions', rec.session_id, null, rec, now);
      }

      if (lecturer) {
        notifyUser(
          store,
          lecturer.user_id,
          `Lịch ${loai.toLowerCase()} mới (${created.length} buổi)`,
          `${created[0].hoc_phan} - ${created[0].bai_giang} bắt đầu từ ngày ${created[0].ngay} (${gio_bd}–${gio_kt}).`,
          '/lich-giang',
          now,
          lecturer.email
        );
      }

      return { data: created, effects: { calendarSync } };
    }

    case 'updateSession': {
      if (!canPerform(actor, 'edit_session')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền sửa lịch.');
      }
      const session_id = String(payload.session_id || '');
      const existing = db.Sessions.find((s) => s.session_id === session_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy buổi học.');

      const ngay = String(payload.ngay ?? existing.ngay);
      const gio_bd = String(payload.gio_bd ?? existing.gio_bd);
      const gio_kt = String(payload.gio_kt ?? existing.gio_kt);
      const giang_vien_id = String(payload.giang_vien_id ?? existing.giang_vien_id);
      const campus_id = String(payload.campus_id ?? existing.campus_id);
      const room_id = String(payload.room_id ?? existing.room_id);
      validateTimeWindow(ngay, gio_bd, gio_kt);

      const loai = String(payload.loai ?? existing.loai);
      if (giang_vien_id !== 'U-CECICS-ALL' && loai !== 'Họp') {
        const lecConflicts = findLecturerConflicts(
          { id: session_id, ngay, gio_bd, gio_kt, giang_vien_id },
          db.Sessions
        );
        if (lecConflicts.length > 0) {
          throw new DomainError(
            'LECTURER_CONFLICT',
            `Giảng viên bị trùng lịch với ${lecConflicts[0].hoc_phan} (${lecConflicts[0].gio_bd}–${lecConflicts[0].gio_kt}).`,
            {
              conflicts: lecConflicts,
              suggestions: suggestFreeLecturerSlots({
                excludeId: session_id,
                giang_vien_id,
                ngay,
                gio_bd,
                gio_kt,
                sessions: db.Sessions,
              }),
            }
          );
        }
      }
      if (room_id) {
        const roomObj = db.Rooms.find((r) => r.room_id === room_id);
        if (roomObj && roomObj.campus_id !== campus_id) {
          throw new DomainError('CAMPUS_MISMATCH', 'Phòng học không thuộc cơ sở của buổi giảng.');
        }
        const roomConflicts = findRoomConflicts(
          { id: session_id, ngay, gio_bd, gio_kt, room_id },
          db.Sessions,
          db.SimClasses
        );
        if (roomConflicts.length > 0) {
          throw new DomainError('ROOM_CONFLICT', 'Phòng học bị trùng lịch với buổi khác.', {
            conflicts: roomConflicts,
            suggestions: suggestAvailableRooms({
              excludeId: session_id,
              campus_id,
              ngay,
              gio_bd,
              gio_kt,
              rooms: db.Rooms,
              sessions: db.Sessions,
              simClasses: db.SimClasses,
            }).slice(0, 3),
          });
        }
      }

      const updated = store.update('Sessions', session_id, {
        loai: String(payload.loai ?? existing.loai),
        he: String(payload.he ?? existing.he),
        hoc_phan: String(payload.hoc_phan ?? existing.hoc_phan),
        bai_giang: String(payload.bai_giang ?? existing.bai_giang),
        lop: String(payload.lop ?? existing.lop ?? '').trim(),
        ngay,
        gio_bd,
        gio_kt,
        campus_id,
        giang_vien_id,
        room_id,
        ghi_chu: String(payload.ghi_chu ?? existing.ghi_chu),
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'UPDATE_SESSION', 'Sessions', session_id, existing, updated, now);
      const lecturer = db.Users.find((u) => u.user_id === updated.giang_vien_id);
      const roomObj = db.Rooms.find((r) => r.room_id === updated.room_id);
      return {
        data: updated,
        effects: { calendarSync: [{ op: 'upsert', session: updated, lecturerEmail: lecturer?.email, roomName: roomObj?.ten }] },
      };
    }

    case 'cancelSession': {
      if (!canPerform(actor, 'edit_session')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền hủy lịch.');
      }
      const session_id = String(payload.session_id || '');
      const existing = db.Sessions.find((s) => s.session_id === session_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy buổi học.');
      const updated = store.update('Sessions', session_id, {
        trang_thai: 'Đã hủy',
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'CANCEL_SESSION', 'Sessions', session_id, existing, updated, now);
      return { data: updated, effects: { calendarSync: [{ op: 'delete', session: updated }] } };
    }

    case 'assignRoom': {
      if (!canPerform(actor, 'assign_room')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Hành chính có quyền gán phòng.');
      }
      const session_id = String(payload.session_id || '');
      const rawRoomIds = (payload as Record<string, unknown>).room_ids ?? (payload as Record<string, unknown>).room_id;
      const roomIds = parseRoomIds(rawRoomIds as string | string[] | undefined);
      if (roomIds.length === 0) {
        throw new DomainError('VALIDATION', 'Vui lòng chọn ít nhất một phòng học.');
      }
      const existing = db.Sessions.find((s) => s.session_id === session_id);
      if (!existing || existing.trang_thai === 'Đã hủy') {
        throw new DomainError('NOT_FOUND', 'Buổi học không tồn tại hoặc đã bị hủy.');
      }
      let assignedCampusId = existing.campus_id;
      for (const rid of roomIds) {
        const room = db.Rooms.find((r) => r.room_id === rid && r.kich_hoat);
        if (!room) throw new DomainError('NOT_FOUND', `Phòng học ${rid} không tồn tại hoặc đã ngừng sử dụng.`);
        // Đồng bộ cơ sở của buổi học theo cơ sở của phòng được chọn
        if (room.campus_id) {
          assignedCampusId = room.campus_id;
        }
      }

      const conflicts = findRoomConflicts(
        { id: session_id, ngay: existing.ngay, gio_bd: existing.gio_bd, gio_kt: existing.gio_kt, room_ids: roomIds },
        db.Sessions,
        db.SimClasses
      );
      if (conflicts.length > 0) {
        const suggestions = suggestAvailableRooms({
          excludeId: session_id,
          campus_id: assignedCampusId,
          ngay: existing.ngay,
          gio_bd: existing.gio_bd,
          gio_kt: existing.gio_kt,
          rooms: db.Rooms,
          sessions: db.Sessions,
          simClasses: db.SimClasses,
        });
        const conflictLabels = conflicts.map((c) => `${c.resourceId}: ${c.label || c.id}`).join('; ');
        throw new DomainError(
          'ROOM_CONFLICT',
          `Phòng đã bị trùng lịch (${conflictLabels}).`,
          { conflicts, suggestions: suggestions.slice(0, 3) }
        );
      }

      const updated = store.update('Sessions', session_id, {
        room_id: roomIds.join(','),
        campus_id: assignedCampusId,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'ASSIGN_ROOM', 'Sessions', session_id, existing, updated, now);

      // Tự động đóng mục leo thang "CHUA_GAN_PHONG" nếu có
      for (const esc of db.Escalations) {
        if (esc.trang_thai === 'Đang mở' && esc.loai === 'CHUA_GAN_PHONG' && esc.doi_tuong_id === session_id) {
          store.update('Escalations', esc.esc_id, { trang_thai: 'Đã xử lý', luc: nowIso });
        }
      }

      const assignedRoomNames = roomIds
        .map((rid) => db.Rooms.find((r) => r.room_id === rid)?.ten || rid)
        .join(', ');

      const lecturer = db.Users.find((u) => u.user_id === existing.giang_vien_id);
      if (lecturer) {
        notifyUser(
          store,
          lecturer.user_id,
          `Đã gán phòng ${assignedRoomNames}`,
          `Buổi "${existing.hoc_phan} - ${existing.bai_giang}" ngày ${existing.ngay} (${existing.gio_bd}–${existing.gio_kt}) được xếp tại: ${assignedRoomNames}.`,
          '/lich-giang',
          now,
          lecturer.email
        );
      }

      return {
        data: updated,
        effects: { calendarSync: [{ op: 'upsert', session: updated, lecturerEmail: lecturer?.email, roomName: assignedRoomNames }] },
      };
    }

    case 'createSwapRequest': {
      if (!canPerform(actor, 'request_swap')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền gửi yêu cầu hoán đổi lịch.');
      }
      const session_id = String(payload.session_id || '');
      const den_gv = String(payload.den_gv || '');
      const target_session_id = String(payload.target_session_id || '').trim();
      const loi_nhan = String(payload.loi_nhan || '').trim();
      const session = db.Sessions.find((s) => s.session_id === session_id && s.trang_thai !== 'Đã hủy');
      if (!session) throw new DomainError('NOT_FOUND', 'Không tìm thấy buổi giảng.');
      if (session.giang_vien_id !== actor.user_id && !actor.vai_tro.includes(ROLES.ADMIN)) {
        throw new DomainError('FORBIDDEN', 'Bạn chỉ có thể đề nghị đổi lịch cho buổi do mình phụ trách.');
      }
      if (den_gv === session.giang_vien_id) {
        throw new DomainError('VALIDATION', 'Không thể hoán đổi cho chính mình.');
      }
      const targetUser = db.Users.find((u) => u.user_id === den_gv && u.kich_hoat);
      if (!targetUser) throw new DomainError('NOT_FOUND', 'Giảng viên nhận đổi không tồn tại.');

      const sessionStartMs = toVnDateTimeMs(session.ngay, session.gio_bd);
      if (sessionStartMs <= now.getTime()) {
        throw new DomainError('EXPIRED', 'Buổi giảng đã bắt đầu hoặc kết thúc, không thể hoán đổi.');
      }

      let targetSession: SessionRecord | undefined;
      if (target_session_id) {
        targetSession = db.Sessions.find((s) => s.session_id === target_session_id && s.trang_thai !== 'Đã hủy');
        if (!targetSession) {
          throw new DomainError('NOT_FOUND', 'Không tìm thấy buổi giảng đối tác cần hoán đổi.');
        }
        if (targetSession.giang_vien_id !== den_gv) {
          throw new DomainError('VALIDATION', 'Buổi giảng mục tiêu không thuộc về giảng viên được chọn.');
        }
        if (toVnDateTimeMs(targetSession.ngay, targetSession.gio_bd) <= now.getTime()) {
          throw new DomainError('EXPIRED', 'Buổi giảng đối tác đã bắt đầu hoặc đã qua, không thể hoán đổi.');
        }

        // Quy tắc cốt lõi y khoa: đổi ngày giữa 2 GV, không đổi nội dung
        // Kiểm tra xung đột 2 chiều:
        // 1. Giảng viên A dạy vào khung giờ của targetSession:
        const conflictsA = findLecturerConflicts(
          { id: session_id, ngay: targetSession.ngay, gio_bd: targetSession.gio_bd, gio_kt: targetSession.gio_kt, giang_vien_id: session.giang_vien_id },
          db.Sessions.filter((s) => s.session_id !== session_id && s.session_id !== target_session_id)
        );
        if (conflictsA.length > 0) {
          throw new DomainError(
            'LECTURER_CONFLICT',
            `Bạn (${actor.ho_ten}) bị trùng lịch với "${conflictsA[0].hoc_phan}" (${conflictsA[0].gio_bd}–${conflictsA[0].gio_kt}) vào ngày nhận đổi (${targetSession.ngay}).`,
            { conflicts: conflictsA }
          );
        }

        // 2. Giảng viên B dạy vào khung giờ của session:
        const conflictsB = findLecturerConflicts(
          { id: target_session_id, ngay: session.ngay, gio_bd: session.gio_bd, gio_kt: session.gio_kt, giang_vien_id: den_gv },
          db.Sessions.filter((s) => s.session_id !== session_id && s.session_id !== target_session_id)
        );
        if (conflictsB.length > 0) {
          throw new DomainError(
            'LECTURER_CONFLICT',
            `${targetUser.ho_ten} bị trùng lịch với "${conflictsB[0].hoc_phan}" (${conflictsB[0].gio_bd}–${conflictsB[0].gio_kt}) vào ngày nhận đổi (${session.ngay}).`,
            { conflicts: conflictsB }
          );
        }

        const duplicateTarget = db.SwapRequests.find(
          (sw) => (sw.session_id === target_session_id || sw.target_session_id === target_session_id) && sw.trang_thai === 'Chờ'
        );
        if (duplicateTarget) {
          throw new DomainError('DUPLICATE', 'Buổi giảng của giảng viên đối tác đang có một yêu cầu hoán đổi khác chờ duyệt.');
        }
      } else {
        // Fallback 1 chiều: kiểm tra xem GV nhận có rảnh vào giờ buổi session không
        const conflicts = findLecturerConflicts(
          { id: session_id, ngay: session.ngay, gio_bd: session.gio_bd, gio_kt: session.gio_kt, giang_vien_id: den_gv },
          db.Sessions
        );
        if (conflicts.length > 0) {
          throw new DomainError(
            'LECTURER_CONFLICT',
            `${targetUser.ho_ten} bị trùng lịch với "${conflicts[0].hoc_phan}" (${conflicts[0].gio_bd}–${conflicts[0].gio_kt}).`,
            { conflicts }
          );
        }
      }

      const duplicate = db.SwapRequests.find(
        (sw) => (sw.session_id === session_id || sw.target_session_id === session_id) && sw.trang_thai === 'Chờ'
      );
      if (duplicate) {
        throw new DomainError('DUPLICATE', 'Buổi giảng này đang có một yêu cầu hoán đổi chờ phản hồi.');
      }

      const swap_id = nextId('DL', db.SwapRequests.map((x) => x.swap_id), year);
      const rec: SwapRequestRecord = {
        swap_id,
        session_id,
        target_session_id: target_session_id || '',
        tu_gv: session.giang_vien_id,
        den_gv,
        loi_nhan,
        ly_do_tu_choi: '',
        trang_thai: 'Chờ',
        tao_luc: nowIso,
        phan_hoi_luc: '',
      };
      store.append('SwapRequests', rec);
      recordAudit(store, actor, 'CREATE_SWAP', 'SwapRequests', swap_id, null, rec, now);

      const actionDesc = targetSession
        ? `đổi ngày giảng giữa bài "${session.bai_giang}" (${session.ngay}) và bài "${targetSession.bai_giang}" (${targetSession.ngay})`
        : `dạy thay bài "${session.hoc_phan} - ${session.bai_giang}" ngày ${session.ngay} (${session.gio_bd}–${session.gio_kt})`;

      notifyUser(
        store,
        targetUser.user_id,
        `Đề nghị hoán đổi lịch từ ${actor.ho_ten}`,
        `${actor.ho_ten} đề nghị bạn ${actionDesc}. ${loi_nhan ? `Lời nhắn: ${loi_nhan}` : ''}`,
        '/doi-lich',
        now,
        targetUser.email
      );

      return { data: rec };
    }

    case 'respondSwapRequest': {
      const swap_id = String(payload.swap_id || '');
      const decision = String(payload.decision || ''); // 'Đồng ý' | 'Từ chối' | 'Hủy'
      const ly_do_tu_choi = String(payload.ly_do_tu_choi || '').trim();
      const swap = db.SwapRequests.find((x) => x.swap_id === swap_id);
      if (!swap) throw new DomainError('NOT_FOUND', 'Không tìm thấy yêu cầu hoán đổi.');
      if (swap.trang_thai !== 'Chờ') {
        throw new DomainError('INVALID_STATE', `Yêu cầu đã ở trạng thái "${swap.trang_thai}".`);
      }

      if (decision === 'Hủy') {
        if (swap.tu_gv !== actor.user_id && !actor.vai_tro.includes(ROLES.ADMIN)) {
          throw new DomainError('FORBIDDEN', 'Chỉ người gửi mới được hủy yêu cầu.');
        }
        const updated = store.update('SwapRequests', swap_id, { trang_thai: 'Hủy', phan_hoi_luc: nowIso });
        recordAudit(store, actor, 'CANCEL_SWAP', 'SwapRequests', swap_id, swap, updated, now);
        return { data: updated };
      }

      if (swap.den_gv !== actor.user_id && !actor.vai_tro.includes(ROLES.ADMIN)) {
        throw new DomainError('FORBIDDEN', 'Chỉ giảng viên nhận yêu cầu mới được phản hồi.');
      }

      const session = db.Sessions.find((s) => s.session_id === swap.session_id);
      if (!session || session.trang_thai === 'Đã hủy') {
        throw new DomainError('NOT_FOUND', 'Buổi giảng không còn tồn tại.');
      }

      if (toVnDateTimeMs(session.ngay, session.gio_bd) <= now.getTime()) {
        store.update('SwapRequests', swap_id, { trang_thai: 'Hết hạn', phan_hoi_luc: nowIso });
        throw new DomainError('EXPIRED', 'Buổi giảng đã bắt đầu, yêu cầu tự động hết hạn.');
      }

      if (decision === 'Từ chối') {
        const updated = store.update('SwapRequests', swap_id, {
          trang_thai: 'Từ chối',
          ly_do_tu_choi: ly_do_tu_choi || '',
          phan_hoi_luc: nowIso,
        });
        recordAudit(store, actor, 'REJECT_SWAP', 'SwapRequests', swap_id, swap, updated, now);
        const requester = db.Users.find((u) => u.user_id === swap.tu_gv);
        if (requester) {
          const reasonMsg = ly_do_tu_choi ? ` Lý do từ chối: "${ly_do_tu_choi}".` : '';
          notifyUser(
            store,
            requester.user_id,
            `Yêu cầu đổi lịch bị từ chối (${swap.swap_id})`,
            `${actor.ho_ten} đã từ chối yêu cầu hoán đổi buổi "${session.hoc_phan}" (${session.bai_giang}) ngày ${session.ngay}.${reasonMsg}`,
            '/doi-lich',
            now,
            requester.email
          );
        }
        return { data: updated };
      }

      if (decision !== 'Đồng ý') {
        throw new DomainError('VALIDATION', 'Quyết định không hợp lệ.');
      }

      const requester = db.Users.find((u) => u.user_id === swap.tu_gv);
      const receiver = db.Users.find((u) => u.user_id === swap.den_gv);

      // QUY TẮC CỐT LÕI Y KHOA: "đổi lịch giảng là đổi ngày giữa các giảng viên, không đổi nội dung giảng, phòng đi theo buổi giờ"
      if (swap.target_session_id) {
        const targetSession = db.Sessions.find((s) => s.session_id === swap.target_session_id && s.trang_thai !== 'Đã hủy');
        if (!targetSession) {
          throw new DomainError('NOT_FOUND', 'Buổi giảng mục tiêu hoán đổi không còn tồn tại.');
        }
        if (toVnDateTimeMs(targetSession.ngay, targetSession.gio_bd) <= now.getTime()) {
          store.update('SwapRequests', swap_id, { trang_thai: 'Hết hạn', phan_hoi_luc: nowIso });
          throw new DomainError('EXPIRED', 'Buổi giảng mục tiêu đã bắt đầu, yêu cầu tự động hết hạn.');
        }

        // Kiểm tra lại xung đột 2 chiều bên trong khóa
        const conflictsA = findLecturerConflicts(
          { id: session.session_id, ngay: targetSession.ngay, gio_bd: targetSession.gio_bd, gio_kt: targetSession.gio_kt, giang_vien_id: swap.tu_gv },
          db.Sessions.filter((s) => s.session_id !== session.session_id && s.session_id !== targetSession.session_id)
        );
        if (conflictsA.length > 0) {
          throw new DomainError(
            'LECTURER_CONFLICT',
            `Người đề nghị (${swap.tu_gv}) bị trùng lịch với "${conflictsA[0].hoc_phan}" vào ngày đổi (${targetSession.ngay}).`
          );
        }

        const conflictsB = findLecturerConflicts(
          { id: targetSession.session_id, ngay: session.ngay, gio_bd: session.gio_bd, gio_kt: session.gio_kt, giang_vien_id: swap.den_gv },
          db.Sessions.filter((s) => s.session_id !== session.session_id && s.session_id !== targetSession.session_id)
        );
        if (conflictsB.length > 0) {
          throw new DomainError(
            'LECTURER_CONFLICT',
            `Bạn bị trùng lịch mới với "${conflictsB[0].hoc_phan}" vào ngày đổi (${session.ngay}).`
          );
        }

        const updatedSwap = store.update('SwapRequests', swap_id, { trang_thai: 'Đồng ý', phan_hoi_luc: nowIso });

        // Session A: giữ nguyên GV A, nhận thời gian, phòng, campus của B
        const updatedSessionA = store.update('Sessions', session.session_id, {
          ngay: targetSession.ngay,
          gio_bd: targetSession.gio_bd,
          gio_kt: targetSession.gio_kt,
          room_id: targetSession.room_id,
          campus_id: targetSession.campus_id,
          rsvp: 'Đã đồng ý',
          cap_nhat_luc: nowIso,
        });

        // Session B: giữ nguyên GV B, nhận thời gian, phòng, campus của A
        const updatedSessionB = store.update('Sessions', targetSession.session_id, {
          ngay: session.ngay,
          gio_bd: session.gio_bd,
          gio_kt: session.gio_kt,
          room_id: session.room_id,
          campus_id: session.campus_id,
          rsvp: 'Đã đồng ý',
          cap_nhat_luc: nowIso,
        });

        recordAudit(store, actor, 'ACCEPT_SWAP', 'Sessions', session.session_id, session, updatedSessionA, now);
        recordAudit(store, actor, 'ACCEPT_SWAP', 'Sessions', targetSession.session_id, targetSession, updatedSessionB, now);

        const roomAObj = db.Rooms.find((r) => r.room_id === updatedSessionA.room_id);
        const roomBObj = db.Rooms.find((r) => r.room_id === updatedSessionB.room_id);

        if (requester) {
          notifyUser(
            store,
            requester.user_id,
            `Hoán đổi ngày giảng thành công`,
            `${receiver?.ho_ten || swap.den_gv} đã đồng ý hoán đổi. Buổi giảng bài "${session.bai_giang}" của bạn chuyển sang ngày ${updatedSessionA.ngay} (${updatedSessionA.gio_bd}–${updatedSessionA.gio_kt}) tại ${roomAObj?.ten || updatedSessionA.room_id}.`,
            '/lich-giang',
            now,
            requester.email
          );
        }
        if (receiver) {
          notifyUser(
            store,
            receiver.user_id,
            `Xác nhận hoán đổi ngày giảng`,
            `Bạn đã đổi buổi thành công. Buổi giảng bài "${targetSession.bai_giang}" của bạn chuyển sang ngày ${updatedSessionB.ngay} (${updatedSessionB.gio_bd}–${updatedSessionB.gio_kt}) tại ${roomBObj?.ten || updatedSessionB.room_id}.`,
            '/lich-giang',
            now,
            receiver.email
          );
        }

        return {
          data: { swap: updatedSwap, sessionA: updatedSessionA, sessionB: updatedSessionB },
          effects: {
            calendarSync: [
              { op: 'upsert', session: updatedSessionA, lecturerEmail: requester?.email, roomName: roomAObj?.ten },
              { op: 'upsert', session: updatedSessionB, lecturerEmail: receiver?.email, roomName: roomBObj?.ten },
            ],
          },
        };
      }

      // Fallback 1 chiều: kiểm tra lại trùng lịch ngay bên trong khóa!
      const conflicts = findLecturerConflicts(
        { id: session.session_id, ngay: session.ngay, gio_bd: session.gio_bd, gio_kt: session.gio_kt, giang_vien_id: swap.den_gv },
        db.Sessions
      );
      if (conflicts.length > 0) {
        throw new DomainError(
          'LECTURER_CONFLICT',
          `Bạn đã có lịch trùng mới (${conflicts[0].hoc_phan} ${conflicts[0].gio_bd}–${conflicts[0].gio_kt}), không thể nhận đổi.`
        );
      }

      const updatedSwap = store.update('SwapRequests', swap_id, { trang_thai: 'Đồng ý', phan_hoi_luc: nowIso });
      const updatedSession = store.update('Sessions', session.session_id, {
        giang_vien_id: swap.den_gv,
        rsvp: 'Đã đồng ý',
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'ACCEPT_SWAP', 'Sessions', session.session_id, session, updatedSession, now);

      const roomObj = db.Rooms.find((r) => r.room_id === updatedSession.room_id);

      if (requester) {
        notifyUser(
          store,
          requester.user_id,
          `Hoán đổi lịch thành công (${session.ngay})`,
          `${receiver?.ho_ten || swap.den_gv} đã đồng ý nhận buổi "${session.hoc_phan} - ${session.bai_giang}". Lịch Google Calendar đã tự động cập nhật.`,
          '/lich-giang',
          now,
          requester.email
        );
      }
      if (receiver) {
        notifyUser(
          store,
          receiver.user_id,
          `Xác nhận nhận buổi giảng (${session.ngay})`,
          `Bạn đã nhận buổi "${session.hoc_phan} - ${session.bai_giang}" (${session.gio_bd}–${session.gio_kt}).`,
          '/lich-giang',
          now,
          receiver.email
        );
      }

      return {
        data: { swap: updatedSwap, session: updatedSession },
        effects: {
          calendarSync: [
            { op: 'upsert', session: updatedSession, lecturerEmail: receiver?.email, roomName: roomObj?.ten },
          ],
        },
      };
    }

    case 'createSimClass': {
      if (!canPerform(actor, 'create_sim_class')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền đăng ký lớp mô phỏng.');
      }
      let ngay = String(payload.ngay || '');
      let gio_bd = String(payload.gio_bd || '');
      let gio_kt = String(payload.gio_kt || '');
      const campus_id = String(payload.campus_id || '');
      let bo_mon_id = String(payload.bo_mon_id || actor.bo_mon_id || '');
      if (!canViewAllSimClasses(actor) && actor.bo_mon_id) {
        bo_mon_id = actor.bo_mon_id;
      }
      const noi_dung = String(payload.noi_dung || '').trim();

      // Khóa học chuỗi nhiều buổi (lịch định kỳ)
      const rawSessions = payload.danh_sach_buoi ?? payload.danh_sach_buoi_json;
      let sessionItems: SimSessionItem[] = [];
      if (Array.isArray(rawSessions)) {
        sessionItems = parseSimSessions({ ngay, gio_bd, gio_kt, buoi_hoc: String(payload.buoi_hoc || 'Sáng'), danh_sach_buoi_json: JSON.stringify(rawSessions) });
      } else if (typeof rawSessions === 'string' && rawSessions.trim()) {
        sessionItems = parseSimSessions({ ngay, gio_bd, gio_kt, buoi_hoc: String(payload.buoi_hoc || 'Sáng'), danh_sach_buoi_json: rawSessions });
      }
      if (sessionItems.length > 0) {
        const err = validateSimSessions(sessionItems);
        if (err) throw new DomainError('VALIDATION', err);
        ngay = sessionItems[0].ngay;
        gio_bd = sessionItems[0].gio_bd;
        gio_kt = sessionItems[0].gio_kt;
      }
      validateTimeWindow(ngay, gio_bd, gio_kt);
      if (!campus_id || !noi_dung) {
        throw new DomainError('VALIDATION', 'Vui lòng nhập đủ cơ sở và nội dung buổi mô phỏng.');
      }
      const so_buoi = Math.max(1, sessionItems.length);
      const ngay_kt = sessionItems.length > 0 ? sessionItems[sessionItems.length - 1].ngay : ngay;

      const settings = parseSettings(db.Settings);
      const daysAhead = diffDaysYmd(todayVnYmd(now), ngay);
      const dang_ky_tre = daysAhead < settings.HAN_DANG_KY_MO_PHONG_NGAY;
      const trang_thai = dang_ky_tre ? 'Cần xét đặc biệt' : 'Chờ rà soát';

      const giang_vien_phu_trach = String(payload.giang_vien_phu_trach || actor.ho_ten || '').trim();
      const sdt_lien_he = String(payload.sdt_lien_he || '').trim();
      const email_lien_he = String(payload.email_lien_he || actor.email || '').trim();
      const nguoi_ho_tro = String(payload.nguoi_ho_tro || '').trim();
      const doi_tuong_hoc_vien = String(payload.doi_tuong_hoc_vien || '').trim();
      const buoi_hoc = String(payload.buoi_hoc || 'Sáng').trim();
      const so_nhom = Number(payload.so_nhom || 1);
      const so_hv_moi_nhom = Number(payload.so_hv_moi_nhom || payload.so_hoc_vien || 0);
      const boi_canh_lam_sang = String(payload.boi_canh_lam_sang || '').trim();
      const muc_tieu_dao_tao = String(payload.muc_tieu_dao_tao || '').trim();
      const ky_nang_mong_doi = String(payload.ky_nang_mong_doi || '').trim();
      const danh_muc_mo_hinh_json = String(payload.danh_muc_mo_hinh_json || '[]').trim();

      const sim_id = nextId('MP', db.SimClasses.map((x) => x.sim_id), year);
      const rec: SimClassRecord = {
        sim_id,
        bo_mon_id,
        nguoi_dang_ky: actor.user_id,
        giang_vien_phu_trach,
        sdt_lien_he,
        email_lien_he,
        nguoi_ho_tro,
        doi_tuong_hoc_vien,
        ngay,
        gio_bd,
        gio_kt,
        campus_id,
        buoi_hoc,
        noi_dung,
        so_hoc_vien: Number(payload.so_hoc_vien || 0),
        so_nhom,
        so_hv_moi_nhom,
        nhu_cau_sp: String(payload.nhu_cau_sp || '').trim(),
        boi_canh_lam_sang,
        muc_tieu_dao_tao,
        ky_nang_mong_doi,
        thiet_bi_yeu_cau: String(payload.thiet_bi_yeu_cau || '').trim(),
        danh_muc_mo_hinh_json,
        so_buoi,
        ngay_kt,
        danh_sach_buoi_json: sessionItems.length > 0 ? JSON.stringify(sessionItems) : '',
        room_id: '',
        ktv_phu_trach: '',
        duyet_hanh_chinh: 'Chờ',
        duyet_ky_thuat: 'Chờ',
        trang_thai,
        dang_ky_tre,
        ghi_chu_hanh_chinh: '',
        ghi_chu_ky_thuat: '',
        ngay_nhac_t7: '',
        phan_hoi_bo_mon: '',
        ly_do_dieu_chinh: '',
        tao_luc: nowIso,
        cap_nhat_luc: nowIso,
      };
      store.append('SimClasses', rec);
      recordAudit(store, actor, 'CREATE_SIM_CLASS', 'SimClasses', sim_id, null, rec, now);

      // Thông báo song song cho CẢ Hành chính và Kỹ thuật
      const recipients = db.Users.filter(
        (u) =>
          u.kich_hoat &&
          (dang_ky_tre
            ? (u.vai_tro.includes(ROLES.TRUONG_DON_VI) && (u.don_vi === UNITS.KY_THUAT || u.don_vi === UNITS.HANH_CHINH)) || u.vai_tro.includes(ROLES.LANH_DAO)
            : u.vai_tro.includes(ROLES.KY_THUAT) || u.vai_tro.includes(ROLES.HANH_CHINH))
      );
      for (const r of recipients) {
        notifyUser(
          store,
          r.user_id,
          dang_ky_tre ? `Đăng ký lớp mô phỏng TRỄ HẠN (${sim_id})` : `Phiếu yêu cầu mở lớp mô phỏng mới (${sim_id})`,
          `${actor.ho_ten} gửi phiếu yêu cầu mở lớp "${noi_dung}" ${
            so_buoi > 1 ? `gồm ${so_buoi} buổi: ${summarizeSimSchedule(sessionItems)}` : `ngày ${formatVnDate(ngay)} (${gio_bd}–${gio_kt})`
          }${
            dang_ky_tre ? ` — trễ hạn (< ${settings.HAN_DANG_KY_MO_PHONG_NGAY} ngày), cần xét đặc biệt.` : '.'
          }`,
          '/lop-mo-phong',
          now,
          r.email
        );
      }

      return { data: rec };
    }

    case 'approveLateSimClass': {
      if (!canPerform(actor, 'approve_late_sim_class')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Trưởng Đơn vị Kỹ thuật hoặc Ban Lãnh đạo được duyệt lớp đăng ký trễ.');
      }
      const sim_id = String(payload.sim_id || '');
      const decision = String(payload.decision || 'approve'); // 'approve' | 'reject'
      const ghi_chu = String(payload.ghi_chu || '').trim();
      const existing = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');
      if (existing.trang_thai !== 'Cần xét đặc biệt') {
        throw new DomainError('INVALID_STATE', 'Lớp này không ở trạng thái Cần xét đặc biệt.');
      }
      const nextStatus = decision === 'reject' ? 'Từ chối' : 'Chờ rà soát';
      const updated = store.update('SimClasses', sim_id, {
        trang_thai: nextStatus,
        ghi_chu_ky_thuat: ghi_chu || existing.ghi_chu_ky_thuat,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'APPROVE_LATE_SIM', 'SimClasses', sim_id, existing, updated, now);

      // Đóng escalation nếu có
      for (const esc of db.Escalations) {
        if (esc.trang_thai === 'Đang mở' && esc.loai === 'LOP_TRE_TON_DONG' && esc.doi_tuong_id === sim_id) {
          store.update('Escalations', esc.esc_id, { trang_thai: 'Đã xử lý', luc: nowIso });
        }
      }
      const owner = db.Users.find((u) => u.user_id === existing.nguoi_dang_ky);
      if (owner) {
        notifyUser(
          store,
          owner.user_id,
          decision === 'reject' ? `Từ chối lớp mô phỏng trễ hạn ${sim_id}` : `Chấp thuận xét lớp mô phỏng ${sim_id}`,
          `Trưởng ĐV Kỹ thuật đã ${decision === 'reject' ? 'từ chối' : 'chuyển sang rà soát kỹ thuật'} cho lớp "${existing.noi_dung}".`,
          '/lop-mo-phong',
          now,
          owner.email
        );
      }
      return { data: updated };
    }

    case 'reviewSimClass': {
      if (!canPerform(actor, 'review_sim_class')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền rà soát lớp mô phỏng.');
      }
      const sim_id = String(payload.sim_id || '');
      const existing = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');
      if (existing.trang_thai === 'Cần xét đặc biệt') {
        throw new DomainError('NEEDS_APPROVAL', 'Lớp đăng ký trễ cần Trưởng ĐV Kỹ thuật chấp thuận trước khi rà soát.');
      }

      const trang_thai = String(payload.trang_thai || 'Đã duyệt');
      const rawRoomIds = (payload as Record<string, unknown>).room_ids ?? (payload as Record<string, unknown>).room_id ?? existing.room_id;
      const roomIds = parseRoomIds(rawRoomIds as string | string[] | undefined);
      const ktv_phu_trach = String(payload.ktv_phu_trach || existing.ktv_phu_trach || actor.user_id);
      const equipmentIds: string[] = Array.isArray(payload.equipment_ids)
        ? payload.equipment_ids.map(String).filter(Boolean)
        : [];
      const ghi_chu_ky_thuat = String(payload.ghi_chu_ky_thuat ?? existing.ghi_chu_ky_thuat);

      if (trang_thai === 'Đã duyệt') {
        validateSimClassAllocation(db, existing, roomIds, equipmentIds, payload.session_overrides);

        // Cập nhật danh sách thiết bị gán cho lớp
        store.removeByPredicate('SimClassEquipment', (row) => row.sim_id === sim_id);
        equipmentIds.forEach((eqId, idx) => {
          store.append('SimClassEquipment', {
            row_id: `${sim_id}-${idx + 1}`,
            sim_id,
            equipment_id: eqId,
          });
        });
      }

      const techApproval = trang_thai === 'Từ chối' ? 'Từ chối' : 'Đã duyệt';
      let nextStatus = trang_thai;
      if (techApproval === 'Từ chối') {
        nextStatus = 'Từ chối';
      } else if (techApproval === 'Đã duyệt') {
        if (existing.duyet_hanh_chinh === 'Đã duyệt') {
          nextStatus = 'Đã phê duyệt';
        }
      }

      const updated = store.update('SimClasses', sim_id, {
        room_id: roomIds.join(','),
        ktv_phu_trach,
        duyet_ky_thuat: techApproval,
        trang_thai: nextStatus,
        ghi_chu_ky_thuat,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'REVIEW_SIM_CLASS', 'SimClasses', sim_id, existing, updated, now);

      const owner = db.Users.find((u) => u.user_id === existing.nguoi_dang_ky);
      const recipientEmail = existing.email_lien_he || owner?.email;
      if (owner || recipientEmail) {
        notifyUser(
          store,
          owner ? owner.user_id : actor.user_id,
          `Lớp mô phỏng ${sim_id}: ${nextStatus}`,
          `Kỹ thuật đã cập nhật trạng thái lớp "${existing.noi_dung}" ngày ${existing.ngay} thành "${nextStatus}".`,
          '/lop-mo-phong',
          now,
          recipientEmail
        );
      }

      return { data: updated };
    }

    case 'reviewSimClassAdmin': {
      if (!canPerform(actor, 'review_sim_class_admin')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Hành chính có quyền rà soát hành chính lớp mô phỏng.');
      }
      const sim_id = String(payload.sim_id || '');
      const existing = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');
      if (existing.trang_thai === 'Cần xét đặc biệt') {
        throw new DomainError('NEEDS_APPROVAL', 'Lớp đăng ký trễ cần Lãnh đạo hoặc Trưởng ĐV phê duyệt trước.');
      }

      const decision = String(payload.decision || 'Đã duyệt'); // 'Đã duyệt' | 'Từ chối'
      const ghi_chu_hanh_chinh = String(payload.ghi_chu_hanh_chinh || '').trim();

      let nextStatus = existing.trang_thai;
      if (decision === 'Từ chối') {
        nextStatus = 'Từ chối';
      } else if (decision === 'Đã duyệt') {
        if (existing.duyet_ky_thuat === 'Đã duyệt') {
          nextStatus = 'Đã phê duyệt';
        }
      }

      const updated = store.update('SimClasses', sim_id, {
        duyet_hanh_chinh: decision,
        ghi_chu_hanh_chinh: ghi_chu_hanh_chinh || existing.ghi_chu_hanh_chinh,
        trang_thai: nextStatus,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'REVIEW_SIM_CLASS_ADMIN', 'SimClasses', sim_id, existing, updated, now);

      const owner = db.Users.find((u) => u.user_id === existing.nguoi_dang_ky);
      const recipientEmail = existing.email_lien_he || owner?.email;
      if (owner || recipientEmail) {
        notifyUser(
          store,
          owner ? owner.user_id : actor.user_id,
          `Hành chính ${decision.toLowerCase()} lớp mô phỏng ${sim_id}`,
          `Bộ phận Hành chính đã cập nhật phê duyệt: ${decision} cho lớp "${existing.noi_dung}". ${ghi_chu_hanh_chinh ? `Ghi chú: ${ghi_chu_hanh_chinh}` : ''}`,
          '/lop-mo-phong',
          now,
          recipientEmail
        );
      }

      return { data: updated };
    }

    case 'reviewSimClassTech': {
      if (!canPerform(actor, 'review_sim_class_tech')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền thẩm định kỹ thuật lớp mô phỏng.');
      }
      const sim_id = String(payload.sim_id || '');
      const existing = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');
      if (existing.trang_thai === 'Cần xét đặc biệt') {
        throw new DomainError('NEEDS_APPROVAL', 'Lớp đăng ký trễ cần Trưởng ĐV Kỹ thuật chấp thuận trước.');
      }

      const decision = String(payload.decision || 'Đã duyệt'); // 'Đã duyệt' | 'Từ chối'
      const rawRoomIds = (payload as Record<string, unknown>).room_ids ?? (payload as Record<string, unknown>).room_id ?? existing.room_id;
      const roomIds = parseRoomIds(rawRoomIds as string | string[] | undefined);
      const ktv_phu_trach = String(payload.ktv_phu_trach || existing.ktv_phu_trach || actor.user_id);
      const equipmentIds: string[] = Array.isArray(payload.equipment_ids)
        ? payload.equipment_ids.map(String).filter(Boolean)
        : [];
      const ghi_chu_ky_thuat = String(payload.ghi_chu_ky_thuat ?? existing.ghi_chu_ky_thuat);

      if (decision === 'Từ chối') {
        const updated = store.update('SimClasses', sim_id, {
          duyet_ky_thuat: 'Từ chối',
          trang_thai: 'Từ chối',
          ghi_chu_ky_thuat: ghi_chu_ky_thuat || existing.ghi_chu_ky_thuat,
          cap_nhat_luc: nowIso,
        });
        recordAudit(store, actor, 'REJECT_SIM_TECH', 'SimClasses', sim_id, existing, updated, now);
        return { data: updated };
      }

      const updatedSessions = validateSimClassAllocation(db, existing, roomIds, equipmentIds, payload.session_overrides);
      const hasOverrides = updatedSessions.some((s) => s.room_id || s.ktv_phu_trach);
      const sessionsJson = updatedSessions.length > 1 || hasOverrides ? JSON.stringify(updatedSessions) : existing.danh_sach_buoi_json || '';

      store.removeByPredicate('SimClassEquipment', (row) => row.sim_id === sim_id);
      equipmentIds.forEach((eqId, idx) => {
        store.append('SimClassEquipment', {
          row_id: `${sim_id}-${idx + 1}`,
          sim_id,
          equipment_id: eqId,
        });
      });

      let nextStatus = existing.trang_thai;
      if (existing.duyet_hanh_chinh === 'Đã duyệt') {
        nextStatus = 'Đã phê duyệt';
      }

      const updated = store.update('SimClasses', sim_id, {
        room_id: roomIds.join(','),
        ktv_phu_trach,
        danh_sach_buoi_json: sessionsJson,
        duyet_ky_thuat: 'Đã duyệt',
        trang_thai: nextStatus,
        ghi_chu_ky_thuat,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'REVIEW_SIM_CLASS_TECH', 'SimClasses', sim_id, existing, updated, now);

      const owner = db.Users.find((u) => u.user_id === existing.nguoi_dang_ky);
      const recipientEmail = existing.email_lien_he || owner?.email;
      if (owner || recipientEmail) {
        notifyUser(
          store,
          owner ? owner.user_id : actor.user_id,
          `Kỹ thuật đã duyệt phòng/thiết bị (${sim_id})`,
          `Lớp "${existing.noi_dung}" đã được gán phòng ${roomIds.join(', ')} và ${equipmentIds.length} thiết bị.`,
          '/lop-mo-phong',
          now,
          recipientEmail
        );
      }

      return { data: updated };
    }

    case 'sendSimClassReminder': {
      if (!canPerform(actor, 'send_sim_reminder')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Hành chính có quyền phát thư nhắc nhở T-7 ngày.');
      }
      const sim_id = String(payload.sim_id || '');
      const existing = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');

      const updated = store.update('SimClasses', sim_id, {
        trang_thai: 'Nhắc xác nhận T-7',
        ngay_nhac_t7: nowIso,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'SEND_SIM_REMINDER', 'SimClasses', sim_id, existing, updated, now);

      const owner = db.Users.find((u) => u.user_id === existing.nguoi_dang_ky);
      const recipientEmail = existing.email_lien_he || owner?.email;
      if (owner || recipientEmail) {
        notifyUser(
          store,
          owner ? owner.user_id : actor.user_id,
          `[AppCECICS] Nhắc nhở kế hoạch lớp mô phỏng: ${existing.noi_dung}`,
          `Kế hoạch lớp mô phỏng "${existing.noi_dung}" ${
            parseSimSessions(existing).length > 1
              ? `gồm ${parseSimSessions(existing).length} buổi, bắt đầu Buổi 1: ${summarizeSimSchedule(activeSimSessions(existing))}`
              : `sẽ diễn ra vào ngày ${formatVnDate(existing.ngay)} (${existing.gio_bd}–${existing.gio_kt})`
          }. Vui lòng vào hệ thống xác nhận giữ nguyên toàn bộ kế hoạch hoặc điều chỉnh buổi cụ thể nếu có thay đổi.`,
          '/lop-mo-phong',
          now,
          recipientEmail
        );
      }

      return { data: updated };
    }

    case 'respondSimClassConfirmation': {
      const sim_id = String(payload.sim_id || '');
      const response_type = String(payload.response_type || 'Giữ nguyên'); // 'Giữ nguyên' | 'Điều chỉnh'
      const phan_hoi = String(payload.phan_hoi_bo_mon || '').trim();
      const existing = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');
      if (!canViewSimClass(actor, existing)) {
        throw new DomainError('FORBIDDEN', 'Bạn chỉ có quyền phản hồi phiếu yêu cầu của Bộ môn mình.');
      }

      let nextStatus = existing.trang_thai;
      if (response_type === 'Giữ nguyên') {
        nextStatus = 'Đã chốt giữ nguyên';
      } else {
        nextStatus = 'Cần rà soát điều chỉnh';
      }

      // Điều chỉnh riêng từng buổi (khóa học nhiều buổi): [{ buoi_so, ngay?, gio_bd?, gio_kt?, huy? }]
      const adjustments = Array.isArray(payload.dieu_chinh_buoi) ? (payload.dieu_chinh_buoi as Record<string, unknown>[]) : [];
      let sessionsPatch: Partial<SimClassRecord> = {};
      let adjustSummary = '';
      if (response_type === 'Điều chỉnh' && adjustments.length > 0) {
        const adjMap = new Map(adjustments.map((a) => [Number(a.buoi_so), a]));
        const current = parseSimSessions(existing);
        const changedLabels: string[] = [];
        const next = current.map((s) => {
          const a = adjMap.get(s.buoi_so);
          if (!a) return s;
          const cancel = Boolean(a.huy);
          const ngayMoi = String(a.ngay || s.ngay);
          const bdMoi = String(a.gio_bd || s.gio_bd);
          const ktMoi = String(a.gio_kt || s.gio_kt);
          changedLabels.push(
            cancel
              ? `Buổi ${s.buoi_so} (${formatVnDate(s.ngay)}): đề nghị hủy`
              : `Buổi ${s.buoi_so}: ${formatVnDate(s.ngay)} ${s.gio_bd}–${s.gio_kt} → ${formatVnDate(ngayMoi)} ${bdMoi}–${ktMoi}`
          );
          return {
            ...s,
            ngay: ngayMoi,
            gio_bd: bdMoi,
            gio_kt: ktMoi,
            trang_thai_buoi: cancel ? 'Hủy' : 'Đã điều chỉnh',
            ghi_chu: phan_hoi || s.ghi_chu,
          };
        });
        const normalized = normalizeSimSessions(next);
        const err = validateSimSessions(normalized.filter((s) => s.trang_thai_buoi !== 'Hủy'));
        if (err) throw new DomainError('VALIDATION', err);
        const actives = normalized.filter((s) => s.trang_thai_buoi !== 'Hủy');
        adjustSummary = changedLabels.join('; ');
        sessionsPatch = {
          danh_sach_buoi_json: JSON.stringify(normalized),
          so_buoi: actives.length,
          ngay: actives[0]?.ngay || existing.ngay,
          gio_bd: actives[0]?.gio_bd || existing.gio_bd,
          gio_kt: actives[0]?.gio_kt || existing.gio_kt,
          ngay_kt: actives[actives.length - 1]?.ngay || existing.ngay_kt,
          duyet_ky_thuat: 'Chờ', // Kỹ thuật phải rà soát lại phòng/thiết bị cho buổi thay đổi
        };
      }

      const lyDo = [phan_hoi, adjustSummary].filter(Boolean).join(' | ');
      const updated = store.update('SimClasses', sim_id, {
        ...sessionsPatch,
        trang_thai: nextStatus,
        phan_hoi_bo_mon: lyDo || (response_type === 'Giữ nguyên' ? 'Bộ môn xác nhận giữ nguyên kế hoạch.' : 'Bộ môn yêu cầu điều chỉnh kế hoạch.'),
        ly_do_dieu_chinh: response_type === 'Điều chỉnh' ? lyDo : existing.ly_do_dieu_chinh,
        cap_nhat_luc: nowIso,
      });
      recordAudit(store, actor, 'RESPOND_SIM_CONFIRMATION', 'SimClasses', sim_id, existing, updated, now);

      // Thông báo cho Đơn vị Kỹ thuật và Hành chính
      const staffUsers = db.Users.filter(
        (u) => u.kich_hoat && (u.vai_tro.includes(ROLES.KY_THUAT) || u.vai_tro.includes(ROLES.HANH_CHINH))
      );
      for (const st of staffUsers) {
        notifyUser(
          store,
          st.user_id,
          response_type === 'Giữ nguyên'
            ? `Bộ môn ĐÃ CHỐT lớp mô phỏng ${sim_id}`
            : `CẢNH BÁO: Bộ môn yêu cầu ĐIỀU CHỈNH lớp mô phỏng ${sim_id}`,
          `${actor.ho_ten} (${existing.bo_mon_id}) đã phản hồi cho lớp "${existing.noi_dung}" (bắt đầu ${formatVnDate(existing.ngay)}): ${response_type}. ${phan_hoi ? `Chi tiết: ${phan_hoi}` : ''}${adjustSummary ? ` Buổi điều chỉnh: ${adjustSummary}` : ''}`,
          '/lop-mo-phong',
          now,
          st.email
        );
      }

      return { data: updated };
    }

    case 'createEquipment': {
      if (!canPerform(actor, 'manage_equipment')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền quản lý thiết bị.');
      }
      const equipment_id =
        String(payload.equipment_id || '').trim() ||
        nextId('TB', db.Equipment.map((e) => e.equipment_id), year);
      if (db.Equipment.some((e) => e.equipment_id === equipment_id)) {
        throw new DomainError('DUPLICATE', `Mã thiết bị ${equipment_id} đã tồn tại.`);
      }
      const rec = {
        equipment_id,
        catalog_id: String(payload.catalog_id || '').trim(),
        ten: String(payload.ten || '').trim(),
        nhom: String(payload.nhom || 'Khác').trim(),
        campus_id: String(payload.campus_id || 'HH'),
        trang_thai: String(payload.trang_thai || 'Hoạt động'),
        so_seri: String(payload.so_seri || '').trim(),
        nam_sx: String(payload.nam_sx || '').trim(),
        vi_tri: String(payload.vi_tri || '').trim(),
        so_luot_dung: Number(payload.so_luot_dung) || 0,
        so_gio_dung: Number(payload.so_gio_dung) || 0,
        tu_ngay: todayVnYmd(now),
        ghi_chu: String(payload.ghi_chu || '').trim(),
      };
      if (!rec.ten) throw new DomainError('VALIDATION', 'Vui lòng nhập tên thiết bị.');
      store.append('Equipment', rec);
      recordAudit(store, actor, 'CREATE_EQUIPMENT', 'Equipment', equipment_id, null, rec, now);
      return { data: rec };
    }

    case 'updateEquipment': {
      if (!canPerform(actor, 'manage_equipment')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền cập nhật thiết bị.');
      }
      const equipment_id = String(payload.equipment_id || '');
      const existing = db.Equipment.find((e) => e.equipment_id === equipment_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy thiết bị.');
      const nextStatus = String(payload.trang_thai ?? existing.trang_thai);
      const statusChanged = nextStatus !== existing.trang_thai;
      const updated = store.update('Equipment', equipment_id, {
        catalog_id: String(payload.catalog_id ?? existing.catalog_id ?? ''),
        ten: String(payload.ten ?? existing.ten),
        nhom: String(payload.nhom ?? existing.nhom),
        campus_id: String(payload.campus_id ?? existing.campus_id),
        trang_thai: nextStatus,
        so_seri: String(payload.so_seri ?? existing.so_seri ?? ''),
        nam_sx: String(payload.nam_sx ?? existing.nam_sx ?? ''),
        vi_tri: String(payload.vi_tri ?? existing.vi_tri ?? ''),
        so_luot_dung: payload.so_luot_dung !== undefined ? Number(payload.so_luot_dung) : existing.so_luot_dung,
        so_gio_dung: payload.so_gio_dung !== undefined ? Number(payload.so_gio_dung) : existing.so_gio_dung,
        tu_ngay: statusChanged ? todayVnYmd(now) : existing.tu_ngay,
        ghi_chu: String(payload.ghi_chu ?? existing.ghi_chu),
      });
      recordAudit(store, actor, 'UPDATE_EQUIPMENT', 'Equipment', equipment_id, existing, updated, now);

      if (nextStatus === 'Hoạt động') {
        for (const esc of db.Escalations) {
          if (esc.trang_thai === 'Đang mở' && esc.loai === 'THIET_BI_HONG' && esc.doi_tuong_id === equipment_id) {
            store.update('Escalations', esc.esc_id, { trang_thai: 'Đã xử lý', luc: nowIso });
          }
        }
      }
      return { data: updated };
    }

    case 'upsertEquipmentCatalog': {
      if (!canPerform(actor, 'manage_equipment')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền quản lý danh mục loại mô hình/thiết bị.');
      }
      const catalog_id = String(payload.catalog_id || '').trim();
      if (!catalog_id) throw new DomainError('VALIDATION', 'Vui lòng cung cấp mã loại mô hình (catalog_id).');
      const ten = String(payload.ten || '').trim();
      if (!ten) throw new DomainError('VALIDATION', 'Vui lòng nhập tên loại mô hình/thiết bị.');

      const existing = db.EquipmentCatalogs.find((c) => c.catalog_id === catalog_id);
      if (existing) {
        const updated = store.update('EquipmentCatalogs', catalog_id, {
          ten,
          nhom: String(payload.nhom ?? existing.nhom),
          hang_sx: String(payload.hang_sx ?? existing.hang_sx),
          dvt: String(payload.dvt ?? existing.dvt),
          mo_ta: String(payload.mo_ta ?? existing.mo_ta),
          so_luong_tong: payload.so_luong_tong !== undefined ? Number(payload.so_luong_tong) : existing.so_luong_tong,
        });
        recordAudit(store, actor, 'UPDATE_EQUIPMENT_CATALOG', 'EquipmentCatalogs', catalog_id, existing, updated, now);
        return { data: updated };
      } else {
        const rec = {
          catalog_id,
          ten,
          nhom: String(payload.nhom || 'Khác').trim(),
          hang_sx: String(payload.hang_sx || '').trim(),
          dvt: String(payload.dvt || 'Mô hình').trim(),
          mo_ta: String(payload.mo_ta || '').trim(),
          so_luong_tong: Number(payload.so_luong_tong) || 0,
        };
        store.append('EquipmentCatalogs', rec);
        recordAudit(store, actor, 'CREATE_EQUIPMENT_CATALOG', 'EquipmentCatalogs', catalog_id, null, rec, now);
        return { data: rec };
      }
    }

    case 'upsertConsumable': {
      if (!canPerform(actor, 'manage_equipment')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền quản lý danh mục vật tư tiêu hao.');
      }
      const consumable_id = String(payload.consumable_id || '').trim();
      if (!consumable_id) throw new DomainError('VALIDATION', 'Vui lòng cung cấp mã vật tư (consumable_id).');
      const ten = String(payload.ten || '').trim();
      if (!ten) throw new DomainError('VALIDATION', 'Vui lòng nhập tên vật tư tiêu hao.');

      const existing = db.Consumables.find((c) => c.consumable_id === consumable_id);
      if (existing) {
        const updated = store.update('Consumables', consumable_id, {
          ten,
          nhom: String(payload.nhom ?? existing.nhom),
          dvt: String(payload.dvt ?? existing.dvt),
          dinh_muc_mac_dinh: payload.dinh_muc_mac_dinh !== undefined ? Number(payload.dinh_muc_mac_dinh) : existing.dinh_muc_mac_dinh,
          ton_kho: payload.ton_kho !== undefined ? Number(payload.ton_kho) : existing.ton_kho,
          ghi_chu: String(payload.ghi_chu ?? existing.ghi_chu),
        });
        recordAudit(store, actor, 'UPDATE_CONSUMABLE', 'Consumables', consumable_id, existing, updated, now);
        return { data: updated };
      } else {
        const rec = {
          consumable_id,
          ten,
          nhom: String(payload.nhom || 'Vật tư chung').trim(),
          dvt: String(payload.dvt || 'Cái').trim(),
          dinh_muc_mac_dinh: Number(payload.dinh_muc_mac_dinh) || 1,
          ton_kho: Number(payload.ton_kho) || 0,
          ghi_chu: String(payload.ghi_chu || '').trim(),
        };
        store.append('Consumables', rec);
        recordAudit(store, actor, 'CREATE_CONSUMABLE', 'Consumables', consumable_id, null, rec, now);
        return { data: rec };
      }
    }

    case 'autoDispatchEquipment': {
      if (!canPerform(actor, 'review_sim_class_tech')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền điều phối thiết bị tự động.');
      }
      const sim_id = String(payload.sim_id || '');
      const existingSim = db.SimClasses.find((s) => s.sim_id === sim_id);
      if (!existingSim) throw new DomainError('NOT_FOUND', 'Không tìm thấy lớp mô phỏng.');

      const catalog_id = payload.catalog_id ? String(payload.catalog_id) : undefined;
      const count = Number(payload.count) || 1;
      const campus_id = String(payload.campus_id || existingSim.campus_id);
      const ngay = String(payload.ngay || existingSim.ngay);
      const gio_bd = String(payload.gio_bd || existingSim.gio_bd);
      const gio_kt = String(payload.gio_kt || existingSim.gio_kt);

      const { dispatchLeastUsedEquipment: dispatchFn } = { dispatchLeastUsedEquipment };
      const result = dispatchFn(
        {
          catalog_id,
          count,
          campus_id,
          ngay,
          gio_bd,
          gio_kt,
          sim_id,
          exclude_equipment_ids: Array.isArray(payload.exclude_equipment_ids) ? payload.exclude_equipment_ids.map(String) : [],
        },
        db
      );

      return { data: result };
    }

    case 'reportIncident': {
      if (!canPerform(actor, 'report_incident')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền báo sự cố thiết bị.');
      }
      const equipment_id = String(payload.equipment_id || '');
      const mo_ta = String(payload.mo_ta || '').trim();
      const danh_gia = String(payload.danh_gia || 'Chưa đánh giá'); // 'Sửa kịp' | 'Không kịp' | 'Chưa đánh giá'
      const du_kien_xong = String(payload.du_kien_xong || '');
      const eq = db.Equipment.find((e) => e.equipment_id === equipment_id);
      if (!eq) throw new DomainError('NOT_FOUND', 'Không tìm thấy thiết bị.');
      if (!mo_ta) throw new DomainError('VALIDATION', 'Vui lòng mô tả sự cố.');

      const today = todayVnYmd(now);
      store.update('Equipment', equipment_id, {
        trang_thai: 'Hỏng',
        tu_ngay: eq.trang_thai === 'Hỏng' && eq.tu_ngay ? eq.tu_ngay : today,
        ghi_chu: mo_ta,
      });

      const incident_id = nextId('SC', db.Incidents.map((i) => i.incident_id), year);
      const incident: IncidentRecord = {
        incident_id,
        equipment_id,
        nguoi_bao: actor.user_id,
        bao_luc: nowIso,
        mo_ta,
        du_kien_xong,
        danh_gia,
        trang_thai: 'Đang mở',
        dong_luc: '',
      };
      store.append('Incidents', incident);
      recordAudit(store, actor, 'REPORT_INCIDENT', 'Incidents', incident_id, null, incident, now);

      // Tự động quét tất cả lớp mô phỏng tương lai đang gán thiết bị này
      const linkedSimIds = new Set(
        db.SimClassEquipment.filter((l) => l.equipment_id === equipment_id).map((l) => l.sim_id)
      );
      const affectedSims = db.SimClasses.filter(
        (sc) =>
          linkedSimIds.has(sc.sim_id) &&
          sc.trang_thai !== 'Đã hủy' &&
          sc.trang_thai !== 'Từ chối' &&
          sc.ngay >= today
      );

      const impacts: IncidentImpactRecord[] = [];
      for (const sc of affectedSims) {
        const impact: IncidentImpactRecord = {
          impact_id: `IMP-${incident_id}-${sc.sim_id}`,
          incident_id,
          sim_id: sc.sim_id,
          phuong_an: 'Chưa chọn',
          bo_mon_xac_nhan: false,
          xac_nhan_boi: '',
          xac_nhan_luc: '',
        };
        store.append('IncidentImpacts', impact);
        impacts.push(impact);

        if (danh_gia === 'Không kịp') {
          const dept = db.Departments.find((d) => d.bo_mon_id === sc.bo_mon_id);
          const contact = db.Users.find((u) => u.user_id === (dept?.dau_moi_user_id || sc.nguoi_dang_ky));
          if (contact) {
            notifyUser(
              store,
              contact.user_id,
              `Cảnh báo hỏng thiết bị ảnh hưởng lớp ${sc.sim_id}`,
              `Thiết bị "${eq.ten}" báo hỏng không kịp sửa trước lớp "${sc.noi_dung}" ngày ${sc.ngay}. Vui lòng chọn phương án (Đổi mô hình / Giảm bài / Dời lịch).`,
              '/thiet-bi',
              now,
              contact.email
            );
          }
        }
      }

      return { data: { incident, affectedSims, impacts } };
    }

    case 'assessIncident': {
      if (!canPerform(actor, 'assess_incident')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật có quyền đánh giá sự cố.');
      }
      const incident_id = String(payload.incident_id || '');
      const danh_gia = String(payload.danh_gia || '');
      const du_kien_xong = String(payload.du_kien_xong ?? '');
      const inc = db.Incidents.find((i) => i.incident_id === incident_id);
      if (!inc) throw new DomainError('NOT_FOUND', 'Không tìm thấy sự cố.');
      const updated = store.update('Incidents', incident_id, {
        danh_gia,
        du_kien_xong: du_kien_xong || inc.du_kien_xong,
      });
      recordAudit(store, actor, 'ASSESS_INCIDENT', 'Incidents', incident_id, inc, updated, now);

      if (danh_gia === 'Không kịp') {
        const eq = db.Equipment.find((e) => e.equipment_id === inc.equipment_id);
        const impacts = db.IncidentImpacts.filter((im) => im.incident_id === incident_id);
        for (const im of impacts) {
          const sc = db.SimClasses.find((s) => s.sim_id === im.sim_id);
          if (!sc) continue;
          const dept = db.Departments.find((d) => d.bo_mon_id === sc.bo_mon_id);
          const contact = db.Users.find((u) => u.user_id === (dept?.dau_moi_user_id || sc.nguoi_dang_ky));
          if (contact) {
            notifyUser(
              store,
              contact.user_id,
              `Cần thống nhất phương án sự cố thiết bị (${sc.sim_id})`,
              `Thiết bị "${eq?.ten || inc.equipment_id}" không kịp sửa trước lớp "${sc.noi_dung}" ngày ${sc.ngay}. Vui lòng chọn và xác nhận phương án thay thế.`,
              '/thiet-bi',
              now,
              contact.email
            );
          }
        }
      }

      return { data: updated };
    }

    case 'confirmIncidentImpact': {
      if (!canPerform(actor, 'confirm_incident_impact')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền xác nhận phương án xử lý.');
      }
      const impact_id = String(payload.impact_id || '');
      const phuong_an = String(payload.phuong_an || '');
      const existing = db.IncidentImpacts.find((im) => im.impact_id === impact_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy mục ảnh hưởng.');
      if (!['Đổi mô hình', 'Giảm bài', 'Dời lịch'].includes(phuong_an)) {
        throw new DomainError('VALIDATION', 'Vui lòng chọn phương án hợp lệ (Đổi mô hình / Giảm bài / Dời lịch).');
      }
      const updated = store.update('IncidentImpacts', impact_id, {
        phuong_an,
        bo_mon_xac_nhan: true,
        xac_nhan_boi: actor.user_id,
        xac_nhan_luc: nowIso,
      });
      recordAudit(store, actor, 'CONFIRM_IMPACT', 'IncidentImpacts', impact_id, existing, updated, now);
      return { data: updated };
    }

    case 'closeIncident': {
      if (!canPerform(actor, 'assess_incident')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Kỹ thuật được đóng sự cố.');
      }
      const incident_id = String(payload.incident_id || '');
      const inc = db.Incidents.find((i) => i.incident_id === incident_id);
      if (!inc) throw new DomainError('NOT_FOUND', 'Không tìm thấy sự cố.');
      const updated = store.update('Incidents', incident_id, { trang_thai: 'Đã khắc phục', dong_luc: nowIso });
      store.update('Equipment', inc.equipment_id, { trang_thai: 'Hoạt động', tu_ngay: todayVnYmd(now) });
      for (const esc of db.Escalations) {
        if (esc.trang_thai === 'Đang mở' && esc.loai === 'THIET_BI_HONG' && esc.doi_tuong_id === inc.equipment_id) {
          store.update('Escalations', esc.esc_id, { trang_thai: 'Đã xử lý', luc: nowIso });
        }
      }
      recordAudit(store, actor, 'CLOSE_INCIDENT', 'Incidents', incident_id, inc, updated, now);
      return { data: updated };
    }

    case 'resolveEscalation': {
      if (!canPerform(actor, 'resolve_escalation')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Ban Lãnh đạo có quyền chỉ đạo / phê duyệt mục leo thang.');
      }
      const esc_id = String(payload.esc_id || '');
      const hanh_dong_ld = String(payload.hanh_dong_ld || ''); // 'Chỉ đạo' | 'Phê duyệt' | 'Trả lại'
      const y_kien = String(payload.y_kien || '').trim();
      const existing = db.Escalations.find((e) => e.esc_id === esc_id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Không tìm thấy mục leo thang.');
      if (!['Chỉ đạo', 'Phê duyệt', 'Trả lại'].includes(hanh_dong_ld)) {
        throw new DomainError('VALIDATION', 'Hành động lãnh đạo không hợp lệ.');
      }
      if (!y_kien) throw new DomainError('VALIDATION', 'Vui lòng nhập nội dung chỉ đạo / nhận xét.');

      const updated = store.update('Escalations', esc_id, {
        trang_thai: hanh_dong_ld === 'Trả lại' ? 'Trả lại đơn vị' : 'Đã chỉ đạo',
        hanh_dong_ld,
        y_kien,
        boi: actor.user_id,
        luc: nowIso,
      });
      recordAudit(store, actor, 'RESOLVE_ESCALATION', 'Escalations', esc_id, existing, updated, now);

      // Thông báo đến Trưởng đơn vị phụ trách
      const unitHeads = db.Users.filter(
        (u) => u.kich_hoat && u.vai_tro.includes(ROLES.TRUONG_DON_VI) && u.don_vi === existing.don_vi
      );
      for (const head of unitHeads) {
        notifyUser(
          store,
          head.user_id,
          `Ban Lãnh đạo đã ${hanh_dong_ld.toLowerCase()} mục ${esc_id}`,
          `${actor.ho_ten}: "${y_kien}" (liên quan: ${existing.ly_do})`,
          '/leo-thang',
          now,
          head.email
        );
      }

      return { data: updated };
    }

    case 'runDailyChecks': {
      // Hết hạn yêu cầu đổi lịch quá giờ
      let expiredSwaps = 0;
      for (const sw of db.SwapRequests) {
        if (sw.trang_thai !== 'Chờ') continue;
        const s = db.Sessions.find((x) => x.session_id === sw.session_id);
        if (!s || toVnDateTimeMs(s.ngay, s.gio_bd) <= now.getTime()) {
          store.update('SwapRequests', sw.swap_id, { trang_thai: 'Hết hạn', phan_hoi_luc: nowIso });
          expiredSwaps++;
        }
      }

      // Tạo các mục leo thang mới
      const candidates = detectPendingEscalations(store.getAll(), now);
      const currentEscIds = db.Escalations.map((e) => e.esc_id);
      const createdEscalations: EscalationRecord[] = [];
      const leaders = db.Users.filter((u) => u.kich_hoat && u.vai_tro.includes(ROLES.LANH_DAO));

      for (const c of candidates) {
        const esc_id = nextId('LT', currentEscIds, year);
        currentEscIds.push(esc_id);
        const rec: EscalationRecord = {
          esc_id,
          ...c,
          tao_luc: nowIso,
          trang_thai: 'Đang mở',
          hanh_dong_ld: '',
          y_kien: '',
          boi: '',
          luc: '',
        };
        store.append('Escalations', rec);
        createdEscalations.push(rec);

        for (const ld of leaders) {
          notifyUser(
            store,
            ld.user_id,
            `Cảnh báo leo thang mới (${esc_id})`,
            c.ly_do,
            '/leo-thang',
            now,
            ld.email
          );
        }
      }

      // 3. Tự động sinh lịch họp định kỳ Trung tâm (nếu được kích hoạt hoặc duy trì gối đầu)
      const recurringMeetingResult = generateCenterRecurringMeetingsInternal(store, db, actor, now);

      return { data: { expiredSwaps, createdEscalations, recurringMeetings: recurringMeetingResult } };
    }

    case 'markNotificationsRead': {
      const ids = Array.isArray(payload.ids) ? new Set(payload.ids.map(String)) : null;
      let count = 0;
      for (const n of db.Notifications) {
        if (n.user_id !== actor.user_id || n.da_doc) continue;
        if (ids && !ids.has(n.id)) continue;
        store.update('Notifications', n.id, { da_doc: true });
        count++;
      }
      return { data: { marked: count } };
    }

    case 'upsertUser': {
      if (!canPerform(actor, 'manage_master_data')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Quản trị hệ thống (Admin) có quyền quản trị người dùng.');
      }
      const email = String(payload.email || '').trim().toLowerCase();
      if (!email.includes('@')) throw new DomainError('VALIDATION', 'Email không hợp lệ.');
      const existing = db.Users.find(
        (u) => u.user_id === payload.user_id || u.email.toLowerCase() === email
      );
      const vai_tro = Array.isArray(payload.vai_tro) ? payload.vai_tro.map(String).filter(Boolean) : ['GIANG_VIEN'];
      if (vai_tro.length === 0) {
        throw new DomainError('VALIDATION', 'Người dùng phải có ít nhất 1 vai trò.');
      }
      // Không cho phép tự bỏ quyền ADMIN của chính mình nếu không còn Admin nào khác
      if (existing && existing.user_id === actor.user_id && !vai_tro.includes(ROLES.ADMIN)) {
        const otherAdmins = db.Users.filter(
          (u) => u.user_id !== actor.user_id && u.kich_hoat && u.vai_tro.includes(ROLES.ADMIN)
        );
        if (otherAdmins.length === 0) {
          throw new DomainError('VALIDATION', 'Hệ thống phải còn ít nhất 1 tài khoản Admin đang hoạt động.');
        }
      }
      if (existing) {
        const updated = store.update('Users', existing.user_id, {
          email,
          ho_ten: String(payload.ho_ten ?? existing.ho_ten),
          vai_tro,
          don_vi: String(payload.don_vi ?? existing.don_vi),
          co_so: String(payload.co_so ?? existing.co_so),
          bo_mon_id: String(payload.bo_mon_id ?? existing.bo_mon_id),
          la_nguoi_ngoai: Boolean(payload.la_nguoi_ngoai ?? existing.la_nguoi_ngoai),
          kich_hoat: Boolean(payload.kich_hoat ?? existing.kich_hoat),
        });
        recordAudit(store, actor, 'UPDATE_USER', 'Users', existing.user_id, existing, updated, now);
        return { data: updated };
      }
      const user_id = nextId('U', db.Users.map((u) => u.user_id), year);
      const created: UserRecord = {
        user_id,
        email,
        ho_ten: String(payload.ho_ten || email.split('@')[0]),
        vai_tro,
        don_vi: String(payload.don_vi || UNITS.BO_MON),
        co_so: String(payload.co_so || 'HH'),
        bo_mon_id: String(payload.bo_mon_id || ''),
        la_nguoi_ngoai: Boolean(payload.la_nguoi_ngoai),
        kich_hoat: payload.kich_hoat !== false,
      };
      store.append('Users', created);
      recordAudit(store, actor, 'CREATE_USER', 'Users', user_id, null, created, now);
      return { data: created };
    }

    case 'upsertRoom': {
      if (!canPerform(actor, 'manage_rooms') && !canPerform(actor, 'manage_master_data')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền quản trị hoặc nạp phòng học.');
      }
      const room_id = String(payload.room_id || '').trim();
      const existing = room_id ? db.Rooms.find((r) => r.room_id === room_id) : undefined;
      if (existing) {
        const updated = store.update('Rooms', existing.room_id, {
          campus_id: String(payload.campus_id ?? existing.campus_id),
          ten: String(payload.ten ?? existing.ten),
          loai: String(payload.loai ?? existing.loai),
          suc_chua: Number(payload.suc_chua ?? existing.suc_chua),
          kich_hoat: Boolean(payload.kich_hoat ?? existing.kich_hoat),
        });
        recordAudit(store, actor, 'UPDATE_ROOM', 'Rooms', existing.room_id, existing, updated, now);
        return { data: updated };
      }
      const newId = room_id || nextId('P', db.Rooms.map((r) => r.room_id), year);
      const created = {
        room_id: newId,
        campus_id: String(payload.campus_id || 'HH'),
        ten: String(payload.ten || '').trim(),
        loai: String(payload.loai || 'Lý thuyết'),
        suc_chua: Number(payload.suc_chua || 30),
        kich_hoat: payload.kich_hoat !== false,
      };
      if (!created.ten) throw new DomainError('VALIDATION', 'Vui lòng nhập tên phòng.');
      store.append('Rooms', created);
      recordAudit(store, actor, 'CREATE_ROOM', 'Rooms', newId, null, created, now);
      return { data: created };
    }

    case 'upsertDepartment': {
      if (!canPerform(actor, 'manage_master_data')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền quản trị bộ môn.');
      }
      const bo_mon_id = String(payload.bo_mon_id || '').trim();
      const existing = bo_mon_id ? db.Departments.find((d) => d.bo_mon_id === bo_mon_id) : undefined;
      if (existing) {
        const updated = store.update('Departments', existing.bo_mon_id, {
          ten: String(payload.ten ?? existing.ten),
          dau_moi_user_id: String(payload.dau_moi_user_id ?? existing.dau_moi_user_id),
        });
        return { data: updated };
      }
      const newId = bo_mon_id || nextId('BM', db.Departments.map((d) => d.bo_mon_id), year);
      const created = {
        bo_mon_id: newId,
        ten: String(payload.ten || '').trim(),
        dau_moi_user_id: String(payload.dau_moi_user_id || ''),
      };
      if (!created.ten) throw new DomainError('VALIDATION', 'Vui lòng nhập tên bộ môn.');
      store.append('Departments', created);
      return { data: created };
    }

    case 'upsertTarget': {
      if (!canPerform(actor, 'manage_master_data') && !actor.vai_tro.includes(ROLES.LANH_DAO)) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền thiết lập chỉ tiêu.');
      }
      const nam = Number(payload.nam || year);
      const chi_tieu = String(payload.chi_tieu || '');
      const gia_tri = Number(payload.gia_tri || 0);
      const target_id = `${nam}-${chi_tieu}`;
      const existing = db.Targets.find((t) => t.target_id === target_id);
      if (existing) {
        const updated = store.update('Targets', target_id, { gia_tri });
        recordAudit(store, actor, 'UPDATE_TARGET', 'Targets', target_id, existing, updated, now);
        return { data: updated };
      }
      const created = { target_id, nam, chi_tieu, gia_tri };
      store.append('Targets', created);
      recordAudit(store, actor, 'CREATE_TARGET', 'Targets', target_id, null, created, now);
      return { data: created };
    }

    case 'updateSetting': {
      if (!canPerform(actor, 'manage_master_data')) {
        throw new DomainError('FORBIDDEN', 'Bạn không có quyền đổi cấu hình hệ thống.');
      }
      const khoa = String(payload.khoa || '').trim();
      const gia_tri = String(payload.gia_tri ?? '').trim();
      const mo_ta = String(payload.mo_ta ?? '');
      if (!khoa) throw new DomainError('VALIDATION', 'Thiếu tên khóa cấu hình.');
      const existing = db.Settings.find((s) => s.khoa === khoa);
      if (existing) {
        const updated = store.update('Settings', khoa, { gia_tri, mo_ta: mo_ta || existing.mo_ta });
        recordAudit(store, actor, 'UPDATE_SETTING', 'Settings', khoa, existing, updated, now);
        return { data: updated };
      }
      const created = { khoa, gia_tri, mo_ta };
      store.append('Settings', created);
      recordAudit(store, actor, 'CREATE_SETTING', 'Settings', khoa, null, created, now);
      return { data: created };
    }

    case 'updateVerificationLock': {
      const lock_id = String(payload.lock_id || '');
      const period_key = String(payload.period_key || '');
      const entity_type = String(payload.entity_type || 'BO_MON');
      const entity_id = String(payload.entity_id || '');
      if (!lock_id || !period_key || !entity_id) {
        throw new DomainError('VALIDATION', 'Thiếu thông tin khóa đối soát.');
      }
      const existing = db.VerificationLocks?.find((l) => l.lock_id === lock_id);
      const patch = {
        period_key,
        entity_type,
        entity_id,
        layer1_locked: payload.layer1_locked !== undefined ? Boolean(payload.layer1_locked) : existing?.layer1_locked || false,
        layer1_by: payload.layer1_by !== undefined ? String(payload.layer1_by) : existing?.layer1_by || '',
        layer1_at: payload.layer1_at !== undefined ? String(payload.layer1_at) : existing?.layer1_at || '',
        layer2_locked: payload.layer2_locked !== undefined ? Boolean(payload.layer2_locked) : existing?.layer2_locked || false,
        layer2_by: payload.layer2_by !== undefined ? String(payload.layer2_by) : existing?.layer2_by || '',
        layer2_at: payload.layer2_at !== undefined ? String(payload.layer2_at) : existing?.layer2_at || '',
        unlock_requested: payload.unlock_requested !== undefined ? Boolean(payload.unlock_requested) : existing?.unlock_requested || false,
        unlock_reason: payload.unlock_reason !== undefined ? String(payload.unlock_reason) : existing?.unlock_reason || '',
        email_sent_at: payload.email_sent_at !== undefined ? String(payload.email_sent_at) : existing?.email_sent_at || '',
      };
      if (existing) {
        const updated = store.update('VerificationLocks', lock_id, patch);
        recordAudit(store, actor, 'UPDATE_VERIFICATION_LOCK', 'VerificationLocks', lock_id, existing, updated, now);
        return { data: updated };
      }
      const created = { lock_id, ...patch };
      store.append('VerificationLocks', created);
      recordAudit(store, actor, 'CREATE_VERIFICATION_LOCK', 'VerificationLocks', lock_id, null, created, now);
      return { data: created };
    }

    case 'generateRecurringMeetings': {
      if (!canPerform(actor, 'create_session') && !canPerform(actor, 'assign_room')) {
        throw new DomainError('FORBIDDEN', 'Chỉ Đơn vị Hành chính hoặc Đào tạo có quyền sinh lịch họp định kỳ.');
      }
      const weeksAhead = Math.max(2, Math.min(52, Number(payload.weeksAhead || 26)));
      const result = generateCenterRecurringMeetingsInternal(store, db, actor, now, weeksAhead);
      return { data: result };
    }

    case 'upsertCmeCourse': {
      const course_id = String(payload.course_id || '').trim();
      const ten_khoa = String(payload.ten_khoa || '').trim();
      if (!course_id || !ten_khoa) {
        throw new DomainError('VALIDATION', 'Vui lòng cung cấp mã khóa học và tên khóa học CME.');
      }
      const existing = db.CmeCourses?.find((c) => c.course_id === course_id);
      const patch = {
        ma_khoa: String(payload.ma_khoa || course_id),
        ten_khoa,
        doi_tuong: String(payload.doi_tuong || ''),
        so_tiet_cme: Number(payload.so_tiet_cme || 16),
        hoc_phi: Number(payload.hoc_phi || 0),
        chi_tieu: Number(payload.chi_tieu || 30),
        ngay_khai_giang: String(payload.ngay_khai_giang || ''),
        ngay_be_giang: String(payload.ngay_be_giang || ''),
        han_dang_ky: String(payload.han_dang_ky || ''),
        campus_id: String(payload.campus_id || 'HH'),
        phong_hoc_mac_dinh: String(payload.phong_hoc_mac_dinh || ''),
        giang_vien_chu_nhiem: String(payload.giang_vien_chu_nhiem || ''),
        noi_dung_tom_tat: String(payload.noi_dung_tom_tat || ''),
        thoi_khoa_bieu_json: typeof payload.thoi_khoa_bieu_json === 'string' ? payload.thoi_khoa_bieu_json : JSON.stringify(payload.thoi_khoa_bieu_json || []),
        ngan_hang_cau_hoi_pretest_json: typeof payload.ngan_hang_cau_hoi_pretest_json === 'string' ? payload.ngan_hang_cau_hoi_pretest_json : JSON.stringify(payload.ngan_hang_cau_hoi_pretest_json || []),
        ngan_hang_cau_hoi_posttest_json: typeof payload.ngan_hang_cau_hoi_posttest_json === 'string' ? payload.ngan_hang_cau_hoi_posttest_json : JSON.stringify(payload.ngan_hang_cau_hoi_posttest_json || []),
        trang_thai: String(payload.trang_thai || 'OPEN'),
      };
      if (existing) {
        const updated = store.update('CmeCourses', course_id, patch);
        recordAudit(store, actor, 'UPDATE_CME_COURSE', 'CmeCourses', course_id, existing, updated, now);
        return { data: updated };
      }
      const created = {
        course_id,
        ...patch,
        ngay_tao: nowIso.slice(0, 10),
        tao_boi: actor.email,
      };
      store.append('CmeCourses', created);
      recordAudit(store, actor, 'CREATE_CME_COURSE', 'CmeCourses', course_id, null, created, now);
      return { data: created };
    }

    case 'reviewCmeRegistration': {
      const reg_id = String(payload.reg_id || '');
      const trang_thai = String(payload.trang_thai || 'DA_DUYET'); // DA_DUYET, TU_CHOI, HOAN_THANH
      const reg = db.CmeRegistrations?.find((r) => r.reg_id === reg_id);
      if (!reg) throw new DomainError('NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký CME.');

      const patch: Record<string, unknown> = {
        trang_thai,
        xac_nhan_boi: actor.email,
        xac_nhan_luc: nowIso,
        ly_do_tu_choi: payload.ly_do_tu_choi ? String(payload.ly_do_tu_choi) : reg.ly_do_tu_choi,
        so_chung_chi_cme: payload.so_chung_chi_cme ? String(payload.so_chung_chi_cme) : reg.so_chung_chi_cme,
        ngay_cap_chung_chi: payload.ngay_cap_chung_chi ? String(payload.ngay_cap_chung_chi) : reg.ngay_cap_chung_chi,
      };
      const updated = store.update('CmeRegistrations', reg_id, patch);
      recordAudit(store, actor, 'REVIEW_CME_REGISTRATION', 'CmeRegistrations', reg_id, reg, updated, now);
      return { data: updated };
    }

    case 'recordCmeAttendance': {
      const course_id = String(payload.course_id || '');
      const student_id = String(payload.student_id || '');
      const buoi_so = Number(payload.buoi_so || 1);
      const co_mat = Boolean(payload.co_mat);
      const att_id = String(payload.att_id || `ATT-${course_id.replace(/^CME-/, '')}-${student_id.slice(-4)}-B${buoi_so}`);

      const existing = db.CmeAttendance?.find((a) => a.att_id === att_id || (a.course_id === course_id && a.student_id === student_id && a.buoi_so === buoi_so));
      const patch = {
        course_id,
        student_id,
        buoi_so,
        ngay: String(payload.ngay || todayVnYmd(now)),
        ca_hoc: String(payload.ca_hoc || 'Sáng'),
        co_mat,
        ghi_chu: String(payload.ghi_chu || ''),
        nguoi_diem_danh: actor.email,
        luc: nowIso,
      };
      if (existing) {
        const updated = store.update('CmeAttendance', existing.att_id, patch);
        return { data: updated };
      }
      const created = { att_id, ...patch };
      store.append('CmeAttendance', created);
      return { data: created };
    }

    case 'submitCmeAssessment': {
      const course_id = String(payload.course_id || '');
      const student_id = String(payload.student_id || '');
      const asm_id = String(payload.asm_id || `ASM-${course_id.replace(/^CME-/, '')}-${student_id.slice(-4)}`);
      const existing = db.CmeAssessments?.find((a) => a.asm_id === asm_id || (a.course_id === course_id && a.student_id === student_id));

      const diem_pretest = payload.diem_pretest !== undefined ? Number(payload.diem_pretest) : existing?.diem_pretest ?? 0;
      const diem_posttest = payload.diem_posttest !== undefined ? Number(payload.diem_posttest) : existing?.diem_posttest ?? 0;
      const diem_thuc_hanh = payload.diem_thuc_hanh !== undefined ? Number(payload.diem_thuc_hanh) : existing?.diem_thuc_hanh ?? 0;
      const ket_qua = String(payload.ket_qua || (diem_posttest >= 5 && diem_thuc_hanh >= 5 ? 'DAT' : 'KHONG_DAT'));
      const xep_loai = String(payload.xep_loai || (diem_thuc_hanh >= 9 ? 'XUAT_SAC' : diem_thuc_hanh >= 8 ? 'GIOI' : diem_thuc_hanh >= 6.5 ? 'KHA' : ket_qua === 'DAT' ? 'TRUNG_BINH' : 'KHONG_DAT'));

      const patch = {
        course_id,
        student_id,
        diem_pretest,
        diem_posttest,
        diem_thuc_hanh,
        ket_qua,
        xep_loai,
        nhan_xet: String(payload.nhan_xet || ''),
        ngay_danh_gia: String(payload.ngay_danh_gia || todayVnYmd(now)),
        nguoi_danh_gia: actor.email,
      };
      if (existing) {
        const updated = store.update('CmeAssessments', existing.asm_id, patch);
        recordAudit(store, actor, 'UPDATE_CME_ASSESSMENT', 'CmeAssessments', existing.asm_id, existing, updated, now);
        return { data: updated };
      }
      const created = { asm_id, ...patch };
      store.append('CmeAssessments', created);
      recordAudit(store, actor, 'CREATE_CME_ASSESSMENT', 'CmeAssessments', asm_id, null, created, now);
      return { data: created };
    }

    case 'submitCmeSurvey': {
      const course_id = String(payload.course_id || '');
      const student_id = String(payload.student_id || '');
      const survey_id = String(payload.survey_id || `SRV-${course_id.replace(/^CME-/, '')}-${student_id.slice(-4)}`);
      const existing = db.CmeSurveys?.find((s) => s.survey_id === survey_id || (s.course_id === course_id && s.student_id === student_id));

      const patch = {
        course_id,
        student_id,
        hai_long_chuong_trinh: Number(payload.hai_long_chuong_trinh || 5),
        hai_long_giang_vien: Number(payload.hai_long_giang_vien || 5),
        hai_long_mo_hinh_csvc: Number(payload.hai_long_mo_hinh_csvc || 5),
        hai_long_to_chuc: Number(payload.hai_long_to_chuc || 5),
        y_kien_dong_gop: String(payload.y_kien_dong_gop || ''),
        ngay_khao_sat: String(payload.ngay_khao_sat || todayVnYmd(now)),
      };
      if (existing) {
        const updated = store.update('CmeSurveys', existing.survey_id, patch);
        return { data: updated };
      }
      const created = { survey_id, ...patch };
      store.append('CmeSurveys', created);
      return { data: created };
    }

    case 'upsertCmeSettlement': {
      const course_id = String(payload.course_id || '');
      const settlement_id = String(payload.settlement_id || `STL-${course_id.replace(/^CME-/, '')}`);
      const existing = db.CmeSettlements?.find((s) => s.settlement_id === settlement_id || s.course_id === course_id);

      const tong_thu_hoc_phi = Number(payload.tong_thu_hoc_phi || 0);
      const thu_lao_giang_vien = Number(payload.thu_lao_giang_vien || 0);
      const thu_lao_tro_giang_ktv = Number(payload.thu_lao_tro_giang_ktv || 0);
      const chi_phi_vat_tu = Number(payload.chi_phi_vat_tu || 0);
      const chi_phi_to_chuc = Number(payload.chi_phi_to_chuc || 0);
      const trich_nop_nha_truong = Number(payload.trich_nop_nha_truong || Math.round(tong_thu_hoc_phi * 0.15));
      const thuc_nhan_cecics = Number(payload.thuc_nhan_cecics || (tong_thu_hoc_phi - thu_lao_giang_vien - thu_lao_tro_giang_ktv - chi_phi_vat_tu - chi_phi_to_chuc - trich_nop_nha_truong));

      const patch = {
        course_id,
        tong_thu_hoc_phi,
        thu_lao_giang_vien,
        thu_lao_tro_giang_ktv,
        chi_phi_vat_tu,
        chi_phi_to_chuc,
        trich_nop_nha_truong,
        thuc_nhan_cecics,
        trang_thai: String(payload.trang_thai || 'CHO_DUYET'),
        nguoi_lap: String(payload.nguoi_lap || actor.email),
        ngay_lap: String(payload.ngay_lap || todayVnYmd(now)),
        nguoi_duyet: String(payload.nguoi_duyet || ''),
        ngay_duyet: String(payload.ngay_duyet || ''),
        ghi_chu: String(payload.ghi_chu || ''),
      };
      if (existing) {
        const updated = store.update('CmeSettlements', existing.settlement_id, patch);
        recordAudit(store, actor, 'UPDATE_CME_SETTLEMENT', 'CmeSettlements', existing.settlement_id, existing, updated, now);
        return { data: updated };
      }
      const created = { settlement_id, ...patch };
      store.append('CmeSettlements', created);
      recordAudit(store, actor, 'CREATE_CME_SETTLEMENT', 'CmeSettlements', settlement_id, null, created, now);
      return { data: created };
    }

    case 'importLegacyCme': {
      // Nhập hàng loạt khóa học & hồ sơ học viên cũ
      const { importLegacyCmeData } = require('./cme');
      const res = importLegacyCmeData(store, payload, actor.email);
      recordAudit(store, actor, 'IMPORT_LEGACY_CME', 'CmeCourses', 'BATCH', null, res, now);
      return { data: res };
    }

    default:
      throw new DomainError('UNKNOWN_ACTION', `Hành động không hỗ trợ: ${String(action)}`);
  }
}

/**
 * Tự động sinh lịch họp định kỳ Trung tâm CECICS 2 tuần/lần vào chiều Thứ 4 (14:00 - 16:00).
 * Mặc định phòng P-2026-0001 (P.302 lầu 3 khu A2 Hoà Hưng).
 */
export function generateCenterRecurringMeetingsInternal(
  store: DataStore,
  db: DatabaseSnapshot,
  actor: UserRecord,
  now: Date,
  weeksAhead: number = 26
): { createdCount: number; sessions: SessionRecord[] } {
  const currentSessions = [...db.Sessions];
  const currentIds = currentSessions.map((s) => s.session_id);
  const nowIso = nowVnIso(now);
  const today = todayVnYmd(now);

  // Tìm các buổi họp CECICS hiện có vào các ngày thứ 4
  const existingMeetingDates = new Set<string>();
  let lastMeetingDate = '';

  for (const s of currentSessions) {
    if (s.trang_thai === 'Đã hủy') continue;
    const isMeeting = s.loai === 'Họp' || s.hoc_phan === 'CECICS' || s.session_id.includes('MEET');
    if (isMeeting && s.ngay) {
      existingMeetingDates.add(s.ngay);
      if (s.ngay >= lastMeetingDate) {
        lastMeetingDate = s.ngay;
      }
    }
  }

  // Xác định ngày Thứ 4 đầu tiên để bắt đầu chuỗi
  // Nếu hôm nay là Thứ 4 (14h-16h) và chưa có lịch: có thể tạo từ hôm nay hoặc tuần sau
  let startWednesday = '';
  let cur = today;
  // Tìm thứ 4 gần nhất từ hôm nay trở đi
  for (let i = 0; i < 14; i++) {
    const d = addDaysYmd(today, i);
    if (dayOfWeekYmd(d) === 3) { // 3 là Thứ Tư
      startWednesday = d;
      break;
    }
  }

  const created: SessionRecord[] = [];
  const defaultRoom = db.Rooms?.find((r) => r.room_id === 'P-2026-0001' && r.kich_hoat) || db.Rooms?.[0];
  const roomId = defaultRoom?.room_id || 'P-2026-0001';
  const campusId = defaultRoom?.campus_id || 'HH';

  // Sinh lịch 2 tuần 1 lần (khoảng cách 14 ngày)
  const numCycles = Math.ceil(weeksAhead / 2);

  for (let cycle = 0; cycle < numCycles; cycle++) {
    const meetingDate = addDaysYmd(startWednesday, cycle * 14);
    if (existingMeetingDates.has(meetingDate)) {
      continue;
    }

    const meetingYear = Number(meetingDate.slice(0, 4)) || now.getFullYear();
    const session_id = nextId('B', currentIds, meetingYear);
    currentIds.push(session_id);

    const rec: SessionRecord = {
      session_id,
      loai: 'Họp',
      he: 'Hành chính',
      hoc_phan: 'CECICS',
      bai_giang: 'Họp định kỳ',
      lop: 'Toàn thể nhân sự Trung tâm CECICS',
      ngay: meetingDate,
      gio_bd: '14:00',
      gio_kt: '16:00',
      campus_id: campusId,
      giang_vien_id: 'U-CECICS-ALL',
      room_id: roomId,
      trang_thai: 'Đã lên lịch',
      calendar_event_id: `gcal-${session_id}`,
      rsvp: 'Đã đồng ý',
      ghi_chu: 'Họp giao ban định kỳ Trung tâm CECICS (Chiều Thứ Tư, 2 tuần/lần, 14:00 - 16:00). Thành phần: Toàn bộ nhân viên CECICS.',
      tao_boi: actor.user_id || 'admin@pnt.edu.vn',
      cap_nhat_luc: nowIso,
    };

    store.append('Sessions', rec);
    recordAudit(store, actor, 'CREATE_SESSION', 'Sessions', rec.session_id, null, rec, now);
    created.push(rec);
    existingMeetingDates.add(meetingDate);
  }

  return { createdCount: created.length, sessions: created };
}
