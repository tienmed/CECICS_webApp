import { describe, expect, it } from 'vitest';
import { dispatchLeastUsedEquipment, calculateEquipmentUsageMap } from '../src/core/equipment-dispatch';
import type { DatabaseSnapshot, EquipmentCatalogRecord, EquipmentRecord, SimClassRecord } from '../src/core/types';

describe('Equipment Dispatch & Load Balancing Algorithm (Least-Used First)', () => {
  const mockCatalogs: EquipmentCatalogRecord[] = [
    {
      catalog_id: 'CPR-01',
      ten: 'Mô hình SimMan 3G',
      nhom: 'Hồi sức cấp cứu',
      hang_sx: 'Laerdal',
      dvt: 'Mô hình',
      mo_ta: '',
      so_luong_tong: 3,
    },
  ];

  const mockEquipment: EquipmentRecord[] = [
    {
      equipment_id: 'CPR-01-01',
      catalog_id: 'CPR-01',
      ten: 'SimMan 3G #01',
      nhom: 'Hồi sức cấp cứu',
      campus_id: 'HH',
      trang_thai: 'Hoạt động',
      so_seri: 'SERI-01',
      nam_sx: '2020',
      vi_tri: 'Lầu 8 Khu C',
      so_luot_dung: 10,
      so_gio_dung: 30,
      tu_ngay: '2024-01-01',
      ghi_chu: '',
    },
    {
      equipment_id: 'CPR-01-02',
      catalog_id: 'CPR-01',
      ten: 'SimMan 3G #02',
      nhom: 'Hồi sức cấp cứu',
      campus_id: 'HH',
      trang_thai: 'Hoạt động',
      so_seri: 'SERI-02',
      nam_sx: '2020',
      vi_tri: 'Lầu 8 Khu C',
      so_luot_dung: 2, // Ít dùng nhất
      so_gio_dung: 6,
      tu_ngay: '2024-01-01',
      ghi_chu: '',
    },
    {
      equipment_id: 'CPR-01-03',
      catalog_id: 'CPR-01',
      ten: 'SimMan 3G #03',
      nhom: 'Hồi sức cấp cứu',
      campus_id: 'HH',
      trang_thai: 'Hỏng', // Bị hỏng
      so_seri: 'SERI-03',
      nam_sx: '2020',
      vi_tri: 'Lầu 8 Khu C',
      so_luot_dung: 0,
      so_gio_dung: 0,
      tu_ngay: '2024-01-01',
      ghi_chu: '',
    },
  ];

  it('ưu tiên tự động chọn máy có lượt dùng thấp nhất và đang hoạt động', () => {
    const result = dispatchLeastUsedEquipment(
      {
        catalog_id: 'CPR-01',
        campus_id: 'HH',
        count: 1,
        ngay: '2026-12-01',
        gio_bd: '08:00',
        gio_kt: '11:00',
      },
      {
        Equipment: mockEquipment,
        EquipmentCatalogs: mockCatalogs,
        SimClasses: [],
        SimClassEquipment: [],
      }
    );

    expect(result.selected.length).toBe(1);
    // Máy #02 có số lượt dùng = 2 (thấp nhất trong các máy 'Hoạt động')
    expect(result.selected[0].equipment_id).toBe('CPR-01-02');
    expect(result.missing_count).toBe(0);
  });

  it('loại trừ thiết bị đang hỏng hoặc bảo trì dù số lượt dùng bằng 0', () => {
    const result = dispatchLeastUsedEquipment(
      {
        catalog_id: 'CPR-01',
        campus_id: 'HH',
        count: 2,
        ngay: '2026-12-01',
        gio_bd: '08:00',
        gio_kt: '11:00',
      },
      {
        Equipment: mockEquipment,
        EquipmentCatalogs: mockCatalogs,
        SimClasses: [],
        SimClassEquipment: [],
      }
    );

    // Máy #03 hỏng -> chỉ chọn được #02 (2 lượt) và #01 (10 lượt)
    expect(result.selected.length).toBe(2);
    expect(result.selected[0].equipment_id).toBe('CPR-01-02');
    expect(result.selected[1].equipment_id).toBe('CPR-01-01');
    expect(result.candidates.find((c) => c.equipment.equipment_id === 'CPR-01-03')?.is_available).toBe(false);
  });
});
