import type { RoomRecord, SessionRecord, SimClassRecord } from './types';
import { findLecturerConflicts, findRoomConflicts } from './conflict';
import { addDaysYmd, minutesToTime, parseTimeToMinutes } from './time';

export interface RoomSuggestion {
  room: RoomRecord;
  reason: string;
  score: number;
}

/**
 * Gợi ý danh sách phòng trống cùng cơ sở, sắp xếp theo mức độ phù hợp loại phòng & sức chứa.
 */
export function suggestAvailableRooms(params: {
  excludeId: string;
  campus_id?: string;
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  preferredType?: string;
  minCapacity?: number;
  rooms: RoomRecord[];
  sessions: SessionRecord[];
  simClasses: SimClassRecord[];
}): RoomSuggestion[] {
  const minCap = params.minCapacity ?? 0;
  const candidates = params.rooms.filter(
    (r) => r.kich_hoat && (!params.campus_id || params.campus_id === 'ALL' || r.campus_id === params.campus_id)
  );

  const suggestions: RoomSuggestion[] = [];
  for (const room of candidates) {
    const conflicts = findRoomConflicts(
      {
        id: params.excludeId,
        ngay: params.ngay,
        gio_bd: params.gio_bd,
        gio_kt: params.gio_kt,
        room_id: room.room_id,
      },
      params.sessions,
      params.simClasses
    );
    if (conflicts.length > 0) continue;

    let score = 100;
    const reasons: string[] = [];

    if (params.preferredType && room.loai === params.preferredType) {
      score += 30;
      reasons.push(`Đúng loại ${room.loai}`);
    }
    if (minCap > 0) {
      if (room.suc_chua >= minCap) {
        score += 20;
        // Ưu tiên phòng vừa khít (tránh lãng phí hội trường lớn cho lớp nhỏ)
        const waste = room.suc_chua - minCap;
        score -= Math.min(15, Math.floor(waste / 10));
        reasons.push(`Đủ sức chứa (${room.suc_chua} chỗ)`);
      } else {
        score -= 40;
        reasons.push(`Nhỏ hơn dự kiến (${room.suc_chua}/${minCap} chỗ)`);
      }
    } else {
      reasons.push(`${room.loai} · ${room.suc_chua} chỗ`);
    }

    suggestions.push({
      room,
      score,
      reason: reasons.join(' · '),
    });
  }

  return suggestions.sort((a, b) => b.score - a.score || a.room.ten.localeCompare(b.room.ten, 'vi'));
}

export interface TimeSlotSuggestion {
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  label: string;
}

/**
 * Khi giảng viên bị trùng lịch, gợi ý tối đa 3 khung giờ trống gần nhất trong cùng ngày hoặc 3 ngày tiếp theo.
 */
export function suggestFreeLecturerSlots(params: {
  excludeId: string;
  giang_vien_id: string;
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  sessions: SessionRecord[];
  workStart?: string;
  workEnd?: string;
  limit?: number;
}): TimeSlotSuggestion[] {
  const startMin = parseTimeToMinutes(params.gio_bd);
  const endMin = parseTimeToMinutes(params.gio_kt);
  const dur = endMin - startMin;
  if (Number.isNaN(dur) || dur <= 0) return [];

  const workStart = parseTimeToMinutes(params.workStart || '07:30');
  const workEnd = parseTimeToMinutes(params.workEnd || '17:00');
  const limit = params.limit ?? 3;

  // Các khung chuẩn buổi sáng / chiều
  const anchorStarts = [450, 570, 810, 930]; // 07:30, 09:30, 13:30, 15:30
  const results: TimeSlotSuggestion[] = [];

  for (let dayOffset = 0; dayOffset <= 4 && results.length < limit; dayOffset++) {
    const candidateDay = addDaysYmd(params.ngay, dayOffset);
    const starts = dayOffset === 0 ? anchorStarts : [startMin, ...anchorStarts];
    const seen = new Set<number>();

    for (const sMin of starts) {
      if (seen.has(sMin)) continue;
      seen.add(sMin);
      if (sMin < workStart || sMin + dur > workEnd) continue;
      if (dayOffset === 0 && sMin === startMin) continue;

      const gio_bd = minutesToTime(sMin);
      const gio_kt = minutesToTime(sMin + dur);
      const conflicts = findLecturerConflicts(
        {
          id: params.excludeId,
          ngay: candidateDay,
          gio_bd,
          gio_kt,
          giang_vien_id: params.giang_vien_id,
        },
        params.sessions
      );
      if (conflicts.length === 0) {
        results.push({
          ngay: candidateDay,
          gio_bd,
          gio_kt,
          label: dayOffset === 0 ? `Cùng ngày (${gio_bd}–${gio_kt})` : `+${dayOffset} ngày (${candidateDay} ${gio_bd}–${gio_kt})`,
        });
        if (results.length >= limit) break;
      }
    }
  }

  return results;
}
