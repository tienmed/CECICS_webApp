import type {
  ConsumableRecord,
  DatabaseSnapshot,
  EquipmentCatalogRecord,
  EquipmentRecord,
  SimClassEquipmentRecord,
  SimClassRecord,
} from './types';
import { findEquipmentConflicts } from './conflict';
import { parseSimSessions } from './sim-sessions';

export interface DispatchEquipmentQuery {
  catalog_id?: string;
  nhom?: string;
  campus_id: string;
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  sim_id?: string;
  count?: number; // Số lượng cần chọn, mặc định 1
  exclude_equipment_ids?: string[];
}

export interface EquipmentCandidate {
  equipment: EquipmentRecord;
  catalog?: EquipmentCatalogRecord;
  so_luot_dung: number;
  so_gio_dung: number;
  is_available: boolean;
  unavailability_reason?: string;
}

export interface DispatchResult {
  selected: EquipmentRecord[];
  candidates: EquipmentCandidate[];
  missing_count: number;
}

/**
 * Tính toán số lượt và số giờ sử dụng thực tế của từng thiết bị
 * dựa vào lịch sử phân bổ của các lớp mô phỏng (SimClasses + SimClassEquipment).
 */
export function calculateEquipmentUsageMap(
  equipmentList: EquipmentRecord[],
  simClasses: SimClassRecord[],
  simClassEquipment: SimClassEquipmentRecord[]
): Map<string, { so_luot_dung: number; so_gio_dung: number }> {
  const usageMap = new Map<string, { so_luot_dung: number; so_gio_dung: number }>();

  for (const eq of equipmentList) {
    usageMap.set(eq.equipment_id, {
      so_luot_dung: Number(eq.so_luot_dung) || 0,
      so_gio_dung: Number(eq.so_gio_dung) || 0,
    });
  }

  const simMap = new Map(simClasses.map((s) => [s.sim_id, s]));

  for (const link of simClassEquipment) {
    const sim = simMap.get(link.sim_id);
    if (!sim) continue;
    if (sim.trang_thai === 'Đã hủy' || sim.trang_thai === 'Từ chối') continue;

    const cur = usageMap.get(link.equipment_id) || { so_luot_dung: 0, so_gio_dung: 0 };
    const sessions = parseSimSessions(sim);

    let simHours = 0;
    for (const ss of sessions) {
      const [hBd, mBd] = ss.gio_bd.split(':').map(Number);
      const [hKt, mKt] = ss.gio_kt.split(':').map(Number);
      const dur = Math.max(0, (hKt * 60 + mKt - (hBd * 60 + mBd)) / 60);
      simHours += dur;
    }

    cur.so_luot_dung += sessions.length > 0 ? sessions.length : 1;
    cur.so_gio_dung += Math.round(simHours * 10) / 10;
    usageMap.set(link.equipment_id, cur);
  }

  return usageMap;
}

/**
 * Thuật toán điều phối tự động cân bằng tải (Least-Frequently-Used First)
 * Ưu tiên các cá thể thiết bị thuộc cùng một Loại (catalog_id):
 * 1. Thuộc cùng cơ sở (campus_id)
 * 2. Đang ở trạng thái "Hoạt động"
 * 3. Không bị xung đột lịch với lớp mô phỏng khác trong cùng khung giờ
 * 4. Có số lượt dùng (so_luot_dung) thấp nhất; nếu bằng nhau thì so tiếp số giờ dùng (so_gio_dung) thấp nhất.
 */
export function dispatchLeastUsedEquipment(
  query: DispatchEquipmentQuery,
  db: Pick<DatabaseSnapshot, 'Equipment' | 'EquipmentCatalogs' | 'SimClasses' | 'SimClassEquipment'>
): DispatchResult {
  const {
    catalog_id,
    nhom,
    campus_id,
    ngay,
    gio_bd,
    gio_kt,
    sim_id,
    count = 1,
    exclude_equipment_ids = [],
  } = query;

  const catalogMap = new Map(db.EquipmentCatalogs.map((c) => [c.catalog_id, c]));
  const usageMap = calculateEquipmentUsageMap(db.Equipment, db.SimClasses, db.SimClassEquipment);

  // 1. Lọc cá thể máy phù hợp theo catalog_id hoặc nhóm và cơ sở
  const candidatePool = db.Equipment.filter((eq) => {
    if (exclude_equipment_ids.includes(eq.equipment_id)) return false;
    if (catalog_id && eq.catalog_id !== catalog_id) return false;
    if (!catalog_id && nhom && eq.nhom !== nhom) return false;
    if (campus_id && eq.campus_id !== campus_id) return false;
    return true;
  });

  const candidates: EquipmentCandidate[] = [];

  for (const eq of candidatePool) {
    const stats = usageMap.get(eq.equipment_id) || { so_luot_dung: 0, so_gio_dung: 0 };
    let isAvailable = true;
    let unavailabilityReason: string | undefined;

    if (eq.trang_thai !== 'Hoạt động') {
      isAvailable = false;
      unavailabilityReason = `Trạng thái: ${eq.trang_thai}`;
    } else {
      // Kiểm tra xung đột lịch
      const conflicts = findEquipmentConflicts(
        {
          sim_id: sim_id || '',
          ngay,
          gio_bd,
          gio_kt,
          equipment_id: eq.equipment_id,
        },
        db.SimClasses,
        db.SimClassEquipment
      );

      if (conflicts.length > 0) {
        isAvailable = false;
        unavailabilityReason = `Đã được gán cho lớp "${conflicts[0].noi_dung}" (${conflicts[0].gio_bd}-${conflicts[0].gio_kt})`;
      }
    }

    candidates.push({
      equipment: eq,
      catalog: eq.catalog_id ? catalogMap.get(eq.catalog_id) : undefined,
      so_luot_dung: stats.so_luot_dung,
      so_gio_dung: stats.so_gio_dung,
      is_available: isAvailable,
      unavailability_reason: unavailabilityReason,
    });
  }

  // 2. Sắp xếp: Khả dụng lên trước, sau đó sắp xếp theo lượt dùng tăng dần, giờ dùng tăng dần
  candidates.sort((a, b) => {
    if (a.is_available && !b.is_available) return -1;
    if (!a.is_available && b.is_available) return 1;
    if (a.so_luot_dung !== b.so_luot_dung) return a.so_luot_dung - b.so_luot_dung;
    if (a.so_gio_dung !== b.so_gio_dung) return a.so_gio_dung - b.so_gio_dung;
    return a.equipment.equipment_id.localeCompare(b.equipment.equipment_id);
  });

  const availableList = candidates.filter((c) => c.is_available).map((c) => c.equipment);
  const selected = availableList.slice(0, count);
  const missing_count = Math.max(0, count - selected.length);

  return {
    selected,
    candidates,
    missing_count,
  };
}

/**
 * Đề xuất định mức tiêu hao vật tư cho một lớp mô phỏng dựa vào số học viên hoặc số nhóm
 */
export function suggestConsumablesForSimClass(
  so_hoc_vien: number,
  so_nhom: number,
  consumablesList: ConsumableRecord[]
): { consumable: ConsumableRecord; so_luong_de_xuat: number }[] {
  const effectiveGroups = Math.max(1, so_nhom || Math.ceil(so_hoc_vien / 6));

  return consumablesList.map((c) => {
    let factor = 1;
    if (c.dvt === 'Gói' || c.dvt === 'Tép' || c.dvt === 'Cái') {
      factor = effectiveGroups;
    } else if (c.dvt === 'Hộp' || c.dvt === 'Bình') {
      factor = Math.ceil(effectiveGroups / 3);
    }
    const qty = Math.max(1, (c.dinh_muc_mac_dinh || 1) * factor);
    return {
      consumable: c,
      so_luong_de_xuat: qty,
    };
  });
}
