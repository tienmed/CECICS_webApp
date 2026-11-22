import type { SessionRecord, SimClassEquipmentRecord, SimClassRecord } from './types';
import { toVnDateTimeMs } from './time';
import { activeSimSessions, parseSimSessions, resolveSessionRoom } from './sim-sessions';

export interface Slot {
  id: string;
  start: number; // ms
  end: number; // ms
  resourceId: string;
  label?: string;
  kind?: 'session' | 'sim';
}

/**
 * Trả về các slot trùng thời gian với `candidate` trên cùng `resourceId`.
 * Quy tắc biên: kết thúc 09:00 và bắt đầu 09:00 KHÔNG trùng (so sánh < nghiêm ngặt).
 */
export function findConflicts(candidate: Slot, existing: Slot[], bufferMin = 0): Slot[] {
  if (!candidate.resourceId || Number.isNaN(candidate.start) || Number.isNaN(candidate.end)) {
    return [];
  }
  const pad = Math.max(0, bufferMin) * 60_000;
  return existing.filter(
    (s) =>
      s.id !== candidate.id &&
      s.resourceId === candidate.resourceId &&
      s.start < candidate.end + pad &&
      candidate.start < s.end + pad
  );
}

/** Kiểm tra trùng giảng viên trên TẤT CẢ các cơ sở (một GV không thể dạy 2 nơi cùng lúc). */
export function findLecturerConflicts(
  candidate: {
    id: string;
    ngay: string;
    gio_bd: string;
    gio_kt: string;
    giang_vien_id: string;
  },
  sessions: SessionRecord[]
): SessionRecord[] {
  if (!candidate.giang_vien_id) return [];
  const candSlot: Slot = {
    id: candidate.id,
    start: toVnDateTimeMs(candidate.ngay, candidate.gio_bd),
    end: toVnDateTimeMs(candidate.ngay, candidate.gio_kt),
    resourceId: candidate.giang_vien_id,
  };
  const active = sessions.filter((s) => s.trang_thai !== 'Đã hủy' && s.giang_vien_id);
  const slotMap = new Map<string, SessionRecord>();
  const existingSlots: Slot[] = active.map((s) => {
    slotMap.set(s.session_id, s);
    return {
      id: s.session_id,
      start: toVnDateTimeMs(s.ngay, s.gio_bd),
      end: toVnDateTimeMs(s.ngay, s.gio_kt),
      resourceId: s.giang_vien_id,
    };
  });
  return findConflicts(candSlot, existingSlots).map((c) => slotMap.get(c.id)!);
}

/**
 * Tách và chuẩn hóa danh sách ID phòng (hỗ trợ cả gán 1 phòng và gán đa phòng / OSCE).
 */
export function parseRoomIds(roomIdOrIds?: string | string[]): string[] {
  if (!roomIdOrIds) return [];
  if (Array.isArray(roomIdOrIds)) return roomIdOrIds.map((s) => s.trim()).filter(Boolean);
  return roomIdOrIds.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Kiểm tra trùng phòng giữa CẢ Sessions (lịch giảng/coi thi) VÀ SimClasses (lớp mô phỏng).
 * Hỗ trợ gán đa phòng (ví dụ hoạt động thi chạy trạm OSCE hoặc Team Training cần nhiều phòng đồng thời).
 */
export function findRoomConflicts(
  candidate: {
    id: string;
    ngay: string;
    gio_bd: string;
    gio_kt: string;
    room_id?: string;
    room_ids?: string[] | string;
  },
  sessions: SessionRecord[],
  simClasses: SimClassRecord[],
  bufferMin = 0
): Slot[] {
  const candRoomIds = parseRoomIds(candidate.room_ids || candidate.room_id);
  if (candRoomIds.length === 0) return [];

  const existing: Slot[] = [];
  for (const s of sessions) {
    if (s.trang_thai === 'Đã hủy' || !s.room_id) continue;
    const rids = parseRoomIds(s.room_id);
    for (const rid of rids) {
      existing.push({
        id: s.session_id,
        start: toVnDateTimeMs(s.ngay, s.gio_bd),
        end: toVnDateTimeMs(s.ngay, s.gio_kt),
        resourceId: rid,
        label: `${s.hoc_phan} — ${s.bai_giang}`,
        kind: 'session',
      });
    }
  }
  for (const sc of simClasses) {
    if (sc.trang_thai === 'Đã hủy' || sc.trang_thai === 'Từ chối') continue;
    // Mở rộng từng buổi của khóa học nhiều buổi (mỗi buổi có thể có phòng riêng)
    const items = activeSimSessions(sc);
    const multi = parseSimSessions(sc).length > 1;
    for (const item of items) {
      const rids = parseRoomIds(resolveSessionRoom(sc, item));
      for (const rid of rids) {
        existing.push({
          id: sc.sim_id,
          start: toVnDateTimeMs(item.ngay, item.gio_bd),
          end: toVnDateTimeMs(item.ngay, item.gio_kt),
          resourceId: rid,
          label: `Mô phỏng: ${sc.noi_dung}${multi ? ` (Buổi ${item.buoi_so})` : ''}`,
          kind: 'sim',
        });
      }
    }
  }

  const allConflicts: Slot[] = [];
  const seenKeys = new Set<string>();

  for (const rid of candRoomIds) {
    const candSlot: Slot = {
      id: candidate.id,
      start: toVnDateTimeMs(candidate.ngay, candidate.gio_bd),
      end: toVnDateTimeMs(candidate.ngay, candidate.gio_kt),
      resourceId: rid,
    };
    const conflicts = findConflicts(candSlot, existing, bufferMin);
    for (const c of conflicts) {
      const key = `${c.id}_${c.resourceId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allConflicts.push(c);
      }
    }
  }

  return allConflicts;
}

/**
 * Kiểm tra trùng thiết bị mô phỏng giữa các lớp mô phỏng đang hoạt động.
 */
export function findEquipmentConflicts(
  candidate: {
    sim_id: string;
    ngay: string;
    gio_bd: string;
    gio_kt: string;
    equipment_id: string;
  },
  simClasses: SimClassRecord[],
  links: SimClassEquipmentRecord[]
): SimClassRecord[] {
  if (!candidate.equipment_id) return [];
  const candSlot: Slot = {
    id: candidate.sim_id,
    start: toVnDateTimeMs(candidate.ngay, candidate.gio_bd),
    end: toVnDateTimeMs(candidate.ngay, candidate.gio_kt),
    resourceId: candidate.equipment_id,
  };

  const classMap = new Map(simClasses.map((sc) => [sc.sim_id, sc]));
  const existing: Slot[] = [];
  for (const link of links) {
    if (link.equipment_id !== candidate.equipment_id) continue;
    const sc = classMap.get(link.sim_id);
    if (!sc || sc.trang_thai === 'Đã hủy' || sc.trang_thai === 'Từ chối') continue;
    for (const item of activeSimSessions(sc)) {
      existing.push({
        id: sc.sim_id,
        start: toVnDateTimeMs(item.ngay, item.gio_bd),
        end: toVnDateTimeMs(item.ngay, item.gio_kt),
        resourceId: link.equipment_id,
      });
    }
  }
  return findConflicts(candSlot, existing).map((c) => classMap.get(c.id)!);
}
