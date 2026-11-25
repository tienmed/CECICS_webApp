import { describe, expect, it } from 'vitest';
import { executeAction } from '../src/core/mutations';
import { suggestEquipmentAndConsumablesForLesson } from '../src/core/equipment-dispatch';
import type { DatabaseSnapshot, UserRecord } from '../src/core/types';
import { buildMockSeed } from '../src/lib/mock-seed';

function createMockStore(initialDb: DatabaseSnapshot) {
  let db: DatabaseSnapshot = JSON.parse(JSON.stringify(initialDb));
  return {
    getAll: () => db,
    append: (table: any, record: any) => {
      if (!db[table]) db[table] = [];
      db[table].push(record);
    },
    update: (table: any, id: string, patch: any) => {
      const list = db[table] || [];
      const idx = list.findIndex((item: any) => Object.values(item)[0] === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch };
        return list[idx];
      }
      return patch;
    },
    removeByPredicate: (table: any, predicate: any) => {
      db[table] = (db[table] || []).filter((item: any) => !predicate(item));
    },
  };
}

describe('KTV Equipment & Consumable Support, Maintenance & Traceability', () => {
  const seed = buildMockSeed();
  const ktvUser = seed.Users.find((u) => u.vai_tro.includes('KY_THUAT') || u.don_vi === 'KY_THUAT') || {
    user_id: 'U-KTV-01',
    email: 'ktv@pnt.edu.vn',
    ho_ten: 'Kỹ Thuật Viên CECICS',
    vai_tro: ['KY_THUAT'],
    don_vi: 'KY_THUAT',
    co_so: 'HH',
    bo_mon_id: '',
    la_nguoi_ngoai: false,
    kich_hoat: true,
  };
  if (!seed.Users.some((u) => u.user_id === ktvUser.user_id)) {
    seed.Users.push(ktvUser);
  }

  it('gợi ý đúng mô hình thiết bị và vật tư tiêu hao phù hợp với nội dung bài học', () => {
    const res = suggestEquipmentAndConsumablesForLesson(
      {
        noi_dung: 'Kỹ năng hồi sức tim phổi nâng cao (CPR) và đặt nội khí quản',
        boi_canh_lam_sang: 'Cấp cứu bệnh nhân ngừng tuần hoàn tại khoa Cấp cứu',
        so_hoc_vien: 18,
        so_nhom: 3,
        campus_id: 'HH',
      },
      seed
    );

    expect(res.suggestedCatalogs.length).toBeGreaterThan(0);
    const hasCPR = res.suggestedCatalogs.some((c) =>
      c.catalog.ten.toLowerCase().includes('cpr') || c.catalog.nhom.toLowerCase().includes('hồi sức')
    );
    expect(hasCPR).toBe(true);

    expect(res.suggestedConsumables.length).toBeGreaterThan(0);
    const hasGlovesOrGel = res.suggestedConsumables.some((c) =>
      c.consumable.ten.toLowerCase().includes('găng') || c.consumable.ten.toLowerCase().includes('gel')
    );
    expect(hasGlovesOrGel).toBe(true);
  });

  it('ghi nhận bảo dưỡng sau buổi học thành công và cập nhật giờ dùng, số lượt, vị trí thiết bị', () => {
    const store = createMockStore(seed);
    const initialEq = store.getAll().Equipment.find((e) => e.equipment_id === 'CPR-04-01');
    const initialHours = Number(initialEq?.so_gio_dung) || 0;
    const initialRuns = Number(initialEq?.so_luot_dung) || 0;

    const actionRes = executeAction(
      store,
      'recordEquipmentMaintenance',
      {
        equipment_id: 'CPR-04-01',
        sim_id: 'MP-2026-0001',
        loai: 'Sau buổi học',
        noi_dung: 'Vệ sinh đường thở mô hình CPR, lau chùi cồn, sạc bộ cảm biến phản hồi lực.',
        tinh_trang_sau: 'Tốt - Sẵn sàng',
        vi_tri_sau: 'Lầu 8 Khu C - Kho Mô hình A1',
        so_gio_dung_them: 3.5,
        so_luot_dung_them: 1,
      },
      ktvUser.email,
      new Date('2026-11-25T15:00:00Z')
    );

    expect(actionRes.data).toBeDefined();
    const updatedEq = store.getAll().Equipment.find((e) => e.equipment_id === 'CPR-04-01');
    expect(updatedEq?.so_gio_dung).toBe(Math.round((initialHours + 3.5) * 10) / 10);
    expect(updatedEq?.so_luot_dung).toBe(initialRuns + 1);
    expect(updatedEq?.vi_tri).toBe('Lầu 8 Khu C - Kho Mô hình A1');
    expect(updatedEq?.vi_tri_hien_tai).toBe('Lầu 8 Khu C - Kho Mô hình A1');

    const maintenanceList = store.getAll().EquipmentMaintenance;
    const recorded = maintenanceList.find((m) => m.equipment_id === 'CPR-04-01' && m.sim_id === 'MP-2026-0001');
    expect(recorded).toBeDefined();
    expect(recorded?.loai).toBe('Sau buổi học');
  });

  it('ghi nhận bảo trì định kỳ và tự động cập nhật ngày bảo trì kế tiếp', () => {
    const store = createMockStore(seed);
    const actionRes = executeAction(
      store,
      'recordEquipmentMaintenance',
      {
        equipment_id: 'SA-01-01',
        loai: 'Định kỳ',
        ngay_thuc_hien: '2026-11-25',
        noi_dung: 'Kiểm tra cáp và đầu dò siêu âm, vệ sinh quạt tản nhiệt, kiểm định chất lượng hình ảnh.',
        tinh_trang_sau: 'Tốt - Sẵn sàng',
        vi_tri_sau: 'Lầu 8 Khu C - Tủ SA',
        ngay_bao_tri_tiep: '2026-12-25',
      },
      ktvUser.email,
      new Date('2026-11-25T15:00:00Z')
    );

    expect(actionRes.data).toBeDefined();
    const updatedEq = store.getAll().Equipment.find((e) => e.equipment_id === 'SA-01-01');
    expect(updatedEq?.ngay_bao_tri_cuoi).toBe('2026-11-25');
    expect(updatedEq?.ngay_bao_tri_tiep).toBe('2026-12-25');
  });

  it('cập nhật nhanh vị trí thiết bị để truy vết thời gian thực', () => {
    const store = createMockStore(seed);
    const actionRes = executeAction(
      store,
      'updateEquipmentLocation',
      {
        equipment_id: 'SA-01-02',
        vi_tri_moi: 'Phòng Sim 8.04 (Đang phục vụ lớp)',
        ly_do_di_chuyen: 'Cấp phát cho lớp Cấp cứu Sản khoa chiều nay',
      },
      ktvUser.email,
      new Date('2026-11-25T15:00:00Z')
    );

    expect(actionRes.data).toBeDefined();
    const updatedEq = store.getAll().Equipment.find((e) => e.equipment_id === 'SA-01-02');
    expect(updatedEq?.vi_tri_hien_tai).toBe('Phòng Sim 8.04 (Đang phục vụ lớp)');
  });
});
