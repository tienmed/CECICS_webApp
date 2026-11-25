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

export interface LessonEquipmentConsumableSuggestion {
  suggestedCatalogs: {
    catalog: EquipmentCatalogRecord;
    matchedKeywords: string[];
    recommendedCount: number;
    availableCount: number;
    sampleEquipment: EquipmentRecord[];
  }[];
  suggestedConsumables: {
    consumable: ConsumableRecord;
    matchedKeywords: string[];
    so_luong_de_xuat: number;
    ton_kho: number;
    is_low_stock: boolean;
  }[];
}

/**
 * Gợi ý thông minh mô hình thiết bị và vật tư tiêu hao phù hợp với nội dung bài học
 * Dựa trên từ khóa trong nội dung bài (noi_dung), chuyên khoa/bộ môn (bo_mon_id),
 * bối cảnh lâm sàng (boi_canh_lam_sang), số học viên và số nhóm.
 */
export function suggestEquipmentAndConsumablesForLesson(
  params: {
    noi_dung: string;
    boi_canh_lam_sang?: string;
    ky_nang_mong_doi?: string;
    bo_mon_id?: string;
    so_hoc_vien?: number;
    so_nhom?: number;
    campus_id?: string;
  },
  db: Pick<DatabaseSnapshot, 'Equipment' | 'EquipmentCatalogs' | 'Consumables'>
): LessonEquipmentConsumableSuggestion {
  const {
    noi_dung = '',
    boi_canh_lam_sang = '',
    ky_nang_mong_doi = '',
    so_hoc_vien = 12,
    so_nhom = 2,
    campus_id = 'HH',
  } = params;

  const textToScan = `${noi_dung} ${boi_canh_lam_sang} ${ky_nang_mong_doi}`.toLowerCase();
  const effectiveGroups = Math.max(1, so_nhom || Math.ceil(so_hoc_vien / 6));

  // Bộ từ điển ánh xạ từ khóa bài học sang chuyên mục / thiết bị / vật tư
  const keywordMappings: {
    keys: string[];
    categoryHints: string[];
    consumableHints: string[];
  }[] = [
    {
      keys: ['cpr', 'hồi sức', 'ngừng tuần hoàn', 'tim phổi', 'ép tim', 'sốc điện', 'aed', 'bóp bóng', 'đường thở', 'đặt nội khí quản'],
      categoryHints: ['cpr', 'hồi sức', 'tim', 'đường thở', 'khí quản', 'cấp cứu'],
      consumableHints: ['găng', 'gel', 'bóng', 'ống nkq', 'dây oxy', 'canun', 'băng keo'],
    },
    {
      keys: ['siêu âm', 'ultrasound', 'fast', 'doppler', 'đầu dò', 'echo', 'tim mạch'],
      categoryHints: ['siêu âm', 'đầu dò', 'vscan', 'ultrasound'],
      consumableHints: ['gel', 'khăn giấy', 'găng', 'cồn'],
    },
    {
      keys: ['nội soi', 'laparoscopy', 'nội soi ổ bụng', 'phẫu thuật nội soi', 'camera'],
      categoryHints: ['nội soi', 'phẫu thuật', 'trainer'],
      consumableHints: ['gạc', 'chỉ khâu', 'găng', 'bộ trocar', 'dao mổ'],
    },
    {
      keys: ['tiêm', 'truyền', 'lấy máu', 'ven', 'tiêm bắp', 'tiêm tĩnh mạch', 'đặt catheter', 'tiêm dưới da'],
      categoryHints: ['tiêm', 'tay tiêm', 'ven', 'catheter'],
      consumableHints: ['bơm tiêm', 'kim tiêm', 'bông cồn', 'dây truyền', 'găng', 'băng cá nhân'],
    },
    {
      keys: ['khâu', 'vết thương', 'tiểu phẫu', 'cắt chỉ', 'chỉ khâu'],
      categoryHints: ['mô hình khâu', 'da khâu', 'vết thương'],
      consumableHints: ['chỉ khâu', 'kim khâu', 'gạc', 'cồn', 'găng', 'lưỡi dao'],
    },
    {
      keys: ['sản', 'đỡ đẻ', 'khám thai', 'phụ khoa', 'đặt vòng', 'sinh khó', 'ngôi thai'],
      categoryHints: ['sản', 'đỡ đẻ', 'thai', 'khung chậu', 'tử cung'],
      consumableHints: ['găng sản khoa', 'dầu bôi trơn', 'tấm lót', 'kẹp rốn', 'gạc'],
    },
    {
      keys: ['nhi', 'sơ sinh', 'hồi sức sơ sinh', 'cấp cứu nhi'],
      categoryHints: ['sơ sinh', 'nhi', 'pediatric', 'em bé'],
      consumableHints: ['găng', 'ống hút đờm', 'bơm tiêm', 'dây oxy nhi'],
    },
  ];

  // Tìm các nhóm khớp từ khóa
  const matchedRules = keywordMappings.filter((rule) =>
    rule.keys.some((k) => textToScan.includes(k))
  );

  const matchedCatHints = new Set<string>();
  const matchedConsHints = new Set<string>();

  matchedRules.forEach((r) => {
    r.categoryHints.forEach((h) => matchedCatHints.add(h));
    r.consumableHints.forEach((h) => matchedConsHints.add(h));
  });

  // 1. Quét EquipmentCatalogs
  const suggestedCatalogs: LessonEquipmentConsumableSuggestion['suggestedCatalogs'] = [];

  for (const cat of db.EquipmentCatalogs) {
    const catText = `${cat.ten} ${cat.nhom} ${cat.mo_ta || ''}`.toLowerCase();
    const hits: string[] = [];

    // Kiểm tra trực tiếp với từ khóa của bài
    matchedRules.forEach((r) => {
      r.keys.forEach((k) => {
        if (textToScan.includes(k) && catText.includes(k)) hits.push(k);
      });
    });

    // Kiểm tra với gợi ý chuyên mục
    matchedCatHints.forEach((h) => {
      if (catText.includes(h) && !hits.includes(h)) hits.push(h);
    });

    if (hits.length > 0) {
      // Đếm số lượng cá thể máy thực tế đang hoạt động ở campus này
      const availableEq = db.Equipment.filter(
        (eq) =>
          eq.catalog_id === cat.catalog_id &&
          eq.trang_thai === 'Hoạt động' &&
          (!campus_id || eq.campus_id === campus_id)
      );

      suggestedCatalogs.push({
        catalog: cat,
        matchedKeywords: Array.from(new Set(hits)),
        recommendedCount: Math.min(Math.max(1, effectiveGroups), Math.max(1, availableEq.length)),
        availableCount: availableEq.length,
        sampleEquipment: availableEq.slice(0, 3),
      });
    }
  }

  // 2. Quét Consumables
  const suggestedConsumables: LessonEquipmentConsumableSuggestion['suggestedConsumables'] = [];

  for (const con of db.Consumables) {
    const conText = `${con.ten} ${con.nhom} ${con.ghi_chu || ''}`.toLowerCase();
    const hits: string[] = [];

    matchedConsHints.forEach((h) => {
      if (conText.includes(h)) hits.push(h);
    });

    // Các vật tư phổ thông luôn cần trong mọi bài học mô phỏng nếu có thực hành
    const isUniversal = ['găng', 'cồn', 'khăn giấy'].some((u) => conText.includes(u));
    if (isUniversal && matchedRules.length > 0) {
      hits.push('vật tư thiết yếu');
    }

    if (hits.length > 0) {
      let factor = 1;
      if (con.dvt === 'Gói' || con.dvt === 'Tép' || con.dvt === 'Cái' || con.dvt === 'Đôi') {
        factor = effectiveGroups * 2;
      } else if (con.dvt === 'Hộp' || con.dvt === 'Bình' || con.dvt === 'Chai') {
        factor = Math.ceil(effectiveGroups / 2);
      }
      const qty = Math.max(1, (con.dinh_muc_mac_dinh || 1) * factor);
      const stock = con.ton_kho || 0;

      suggestedConsumables.push({
        consumable: con,
        matchedKeywords: Array.from(new Set(hits)),
        so_luong_de_xuat: qty,
        ton_kho: stock,
        is_low_stock: stock < qty,
      });
    }
  }

  return {
    suggestedCatalogs: suggestedCatalogs.sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length),
    suggestedConsumables: suggestedConsumables.sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length),
  };
}
