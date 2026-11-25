import { describe, expect, it } from 'vitest';
import {
  APP_MODULES,
  DEFAULT_RBAC_MATRIX,
  canAccessModule,
  canPerform,
  parseRbacMatrix,
  resolveModuleAccess,
  type AccessLevel,
  type AppModuleKey,
} from '../src/core/permissions';
import { ROLES, type Role, type UserRecord } from '../src/core/types';

describe('RBAC Matrix & Multi-Role Privilege Resolution', () => {
  it('DEFAULT_RBAC_MATRIX covers all 8 system roles and 9 application modules', () => {
    const roles = Object.keys(DEFAULT_RBAC_MATRIX) as Role[];
    expect(roles).toHaveLength(8);
    expect(roles).toContain(ROLES.ADMIN);
    expect(roles).toContain(ROLES.LANH_DAO);
    expect(roles).toContain(ROLES.TRUONG_DON_VI);
    expect(roles).toContain(ROLES.HANH_CHINH);
    expect(roles).toContain(ROLES.DAO_TAO);
    expect(roles).toContain(ROLES.KY_THUAT);
    expect(roles).toContain(ROLES.DAU_MOI_BO_MON);
    expect(roles).toContain(ROLES.GIANG_VIEN);

    for (const r of roles) {
      const moduleKeys = Object.keys(DEFAULT_RBAC_MATRIX[r]) as AppModuleKey[];
      expect(moduleKeys).toHaveLength(9);
      for (const m of Object.values(APP_MODULES)) {
        expect(DEFAULT_RBAC_MATRIX[r][m]).toBeDefined();
      }
    }
  });

  it('admin role always resolves to FULL for any module', () => {
    expect(resolveModuleAccess([ROLES.ADMIN], APP_MODULES.LICH_GIANG)).toBe('FULL');
    expect(resolveModuleAccess([ROLES.ADMIN], APP_MODULES.QUAN_TRI)).toBe('FULL');
    expect(resolveModuleAccess([ROLES.ADMIN, ROLES.GIANG_VIEN], APP_MODULES.THIET_BI)).toBe('FULL');
  });

  it('multi-role privilege resolution prioritizes FULL > WRITE > READ > NONE', () => {
    // GIANG_VIEN on LICH_GIANG is READ, DAO_TAO on LICH_GIANG is FULL
    // A user with both roles must resolve to FULL
    const dualRoleAccess = resolveModuleAccess([ROLES.GIANG_VIEN, ROLES.DAO_TAO], APP_MODULES.LICH_GIANG);
    expect(dualRoleAccess).toBe('FULL');

    // GIANG_VIEN on DOI_LICH is WRITE, KY_THUAT on DOI_LICH is NONE
    // Combined must resolve to WRITE
    const swapAccess = resolveModuleAccess([ROLES.GIANG_VIEN, ROLES.KY_THUAT], APP_MODULES.DOI_LICH);
    expect(swapAccess).toBe('WRITE');

    // DAU_MOI_BO_MON on LOP_MO_PHONG is WRITE, GIANG_VIEN is READ
    const simClassAccess = resolveModuleAccess([ROLES.DAU_MOI_BO_MON, ROLES.GIANG_VIEN], APP_MODULES.LOP_MO_PHONG);
    expect(simClassAccess).toBe('WRITE');
  });

  it('canAccessModule checks required access levels accurately', () => {
    const lecturer: UserRecord = {
      user_id: 'U-TEST-01',
      email: 'gv@pnt.edu.vn',
      ho_ten: 'BS Test',
      vai_tro: [ROLES.GIANG_VIEN],
      don_vi: 'BO_MON',
      co_so: 'HH',
      bo_mon_id: 'BM-NOI',
      la_nguoi_ngoai: false,
      kich_hoat: true,
    };

    // GIANG_VIEN on LICH_GIANG is READ:
    expect(canAccessModule(lecturer, APP_MODULES.LICH_GIANG, 'READ')).toBe(true);
    expect(canAccessModule(lecturer, APP_MODULES.LICH_GIANG, 'WRITE')).toBe(false);
    expect(canAccessModule(lecturer, APP_MODULES.LICH_GIANG, 'FULL')).toBe(false);

    // GIANG_VIEN on DOI_LICH is WRITE:
    expect(canAccessModule(lecturer, APP_MODULES.DOI_LICH, 'READ')).toBe(true);
    expect(canAccessModule(lecturer, APP_MODULES.DOI_LICH, 'WRITE')).toBe(true);
    expect(canAccessModule(lecturer, APP_MODULES.DOI_LICH, 'FULL')).toBe(false);

    // GIANG_VIEN on QUAN_TRI is NONE:
    expect(canAccessModule(lecturer, APP_MODULES.QUAN_TRI, 'READ')).toBe(false);
  });

  it('parseRbacMatrix parses JSON configuration from db.Settings safely', () => {
    const customConfig = JSON.stringify({
      GIANG_VIEN: {
        LICH_GIANG: 'WRITE',
      },
    });

    const parsed = parseRbacMatrix(customConfig);
    expect(parsed.GIANG_VIEN.LICH_GIANG).toBe('WRITE');
    // Keeps fallback defaults for unmentioned fields
    expect(parsed.GIANG_VIEN.DOI_LICH).toBe('WRITE');
    expect(parsed.ADMIN.QUAN_TRI).toBe('FULL');

    // Invalid JSON fallback
    const fallback = parseRbacMatrix('invalid_json');
    expect(fallback).toEqual(DEFAULT_RBAC_MATRIX);
  });

  it('manage_rooms permission allows ADMIN and HANH_CHINH roles to upsert rooms', () => {
    const adminUser: UserRecord = {
      user_id: 'U-ADMIN',
      email: 'admin@pnt.edu.vn',
      ho_ten: 'Admin',
      vai_tro: [ROLES.ADMIN],
      don_vi: 'HANH_CHINH',
      co_so: 'HH',
      la_nguoi_ngoai: false,
      kich_hoat: true,
    };
    const hanhChinhUser: UserRecord = {
      user_id: 'U-HC',
      email: 'hc@pnt.edu.vn',
      ho_ten: 'Chuyên viên Hành chính',
      vai_tro: [ROLES.HANH_CHINH],
      don_vi: 'HANH_CHINH',
      co_so: 'HH',
      la_nguoi_ngoai: false,
      kich_hoat: true,
    };
    const lecturerUser: UserRecord = {
      user_id: 'U-GV',
      email: 'gv@pnt.edu.vn',
      ho_ten: 'Giảng viên',
      vai_tro: [ROLES.GIANG_VIEN],
      don_vi: 'BO_MON',
      co_so: 'HH',
      la_nguoi_ngoai: false,
      kich_hoat: true,
    };

    expect(canPerform(adminUser, 'manage_rooms')).toBe(true);
    expect(canPerform(hanhChinhUser, 'manage_rooms')).toBe(true);
    expect(canPerform(lecturerUser, 'manage_rooms')).toBe(false);
  });
});
