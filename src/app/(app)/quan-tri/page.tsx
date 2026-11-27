'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  canPerform,
  isAdmin,
  APP_MODULES,
  MODULE_LABELS,
  DEFAULT_RBAC_MATRIX,
  parseRbacMatrix,
  type AppModuleKey,
  type AccessLevel,
} from '@/core/permissions';
import { todayVnYmd } from '@/core/time';
import { ROLE_LABELS, ROLES, ROOM_TYPES, UNIT_LABELS, UNITS, type Role } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, Modal, PageHeader } from '@/components/ui';

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

const ALL_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.LANH_DAO,
  ROLES.TRUONG_DON_VI,
  ROLES.HANH_CHINH,
  ROLES.DAO_TAO,
  ROLES.KY_THUAT,
  ROLES.DAU_MOI_BO_MON,
  ROLES.GIANG_VIEN,
];

const ALL_MODULES: AppModuleKey[] = [
  APP_MODULES.LICH_GIANG,
  APP_MODULES.LICH_THI,
  APP_MODULES.PHAN_PHONG,
  APP_MODULES.DOI_LICH,
  APP_MODULES.LOP_MO_PHONG,
  APP_MODULES.THIET_BI,
  APP_MODULES.SU_CO,
  APP_MODULES.BAO_CAO,
  APP_MODULES.QUAN_TRI,
];

export default function AdminPage() {
  const { user, db, execute } = useApp();
  const [tab, setTab] = useState<'users' | 'rooms' | 'targets' | 'rbac' | 'settings' | 'audit'>('users');
  const [userModal, setUserModal] = useState(false);
  const [roomModal, setRoomModal] = useState(false);

  const adminUser = isAdmin(user);
  const canManage = canPerform(user, 'manage_master_data');

  // Quản lý Ma trận phân quyền RBAC
  const rawRbacSetting = db.Settings.find((s) => s.khoa === 'RBAC_ROLE_PERMISSIONS')?.gia_tri;
  const initialRbac = useMemo(() => parseRbacMatrix(rawRbacSetting), [rawRbacSetting]);
  const [rbacDraft, setRbacDraft] = useState<Record<Role, Record<AppModuleKey, AccessLevel>>>(initialRbac);
  const [rbacDirty, setRbacDirty] = useState(false);

  useEffect(() => {
    if (!rbacDirty) {
      setRbacDraft(initialRbac);
    }
  }, [initialRbac, rbacDirty]);

  function handleCellChange(role: Role, mod: AppModuleKey, level: AccessLevel) {
    setRbacDraft((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [mod]: level,
      },
    }));
    setRbacDirty(true);
  }

  async function saveRbacMatrix() {
    const gia_tri = JSON.stringify(rbacDraft);
    const res = await execute(
      'updateSetting',
      {
        khoa: 'RBAC_ROLE_PERMISSIONS',
        gia_tri,
      },
      'Đã lưu thành công Ma trận Phân quyền hệ thống.'
    );
    if (res.ok) {
      setRbacDirty(false);
    }
  }

  function resetRbacMatrix() {
    if (confirm('Khôi phục ma trận phân quyền về cấu hình tiêu chuẩn y khoa ban đầu?')) {
      setRbacDraft(DEFAULT_RBAC_MATRIX);
      setRbacDirty(true);
    }
  }
  const [uForm, setUForm] = useState({
    user_id: '',
    email: '',
    ho_ten: '',
    vai_tro: [ROLES.GIANG_VIEN] as string[],
    don_vi: UNITS.BO_MON as string,
    co_so: 'HH',
    bo_mon_id: '',
    la_nguoi_ngoai: false,
    kich_hoat: true,
  });

  const [rForm, setRForm] = useState({
    room_id: '',
    campus_id: 'HH',
    ten: '',
    loai: 'Mô phỏng',
    suc_chua: 24,
    kich_hoat: true,
  });

  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [targetValues, setTargetValues] = useState<Record<string, number>>({});
  const year = Number(todayVnYmd().slice(0, 4));

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute('upsertUser', uForm, 'Đã lưu thông tin người dùng.');
    if (res.ok) setUserModal(false);
  }

  async function deleteUser(target: (typeof db.Users)[number]) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${target.ho_ten}" (${target.email}) khỏi hệ thống?`)) return;
    await execute('deleteUser', { user_id: target.user_id }, `Đã xóa người dùng ${target.ho_ten}.`);
  }

  async function saveRoom(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute('upsertRoom', rForm, 'Đã lưu thông tin phòng học.');
    if (res.ok) setRoomModal(false);
  }

  async function saveSetting(khoa: string, currentVal: string) {
    const gia_tri = settingValues[khoa] ?? currentVal;
    await execute('updateSetting', { khoa, gia_tri }, `Đã cập nhật cấu hình ${khoa}.`);
  }

  async function saveTarget(chi_tieu: string, currentVal: number) {
    const gia_tri = targetValues[chi_tieu] ?? currentVal;
    await execute('upsertTarget', { nam: year, chi_tieu, gia_tri }, `Đã cập nhật chỉ tiêu năm ${year}.`);
  }

  async function toggleAdminRole(target: (typeof db.Users)[number]) {
    const hasAdmin = target.vai_tro.includes(ROLES.ADMIN);
    const nextRoles = hasAdmin
      ? target.vai_tro.filter((r) => r !== ROLES.ADMIN)
      : [...target.vai_tro, ROLES.ADMIN];
    await execute(
      'upsertUser',
      {
        user_id: target.user_id,
        email: target.email,
        ho_ten: target.ho_ten,
        vai_tro: nextRoles,
        don_vi: target.don_vi,
        co_so: target.co_so,
        bo_mon_id: target.bo_mon_id,
        la_nguoi_ngoai: target.la_nguoi_ngoai,
        kich_hoat: target.kich_hoat,
      },
      hasAdmin ? `Đã gỡ quyền Admin của ${target.ho_ten}.` : `Đã cấp quyền Admin cho ${target.ho_ten}.`
    );
  }

  if (!adminUser) {
    return (
      <div className="space-y-4">
        <PageHeader title="Quản trị hệ thống" subtitle="Phân hệ dành riêng cho Quản trị viên (Admin)" />
        <Card>
          <div className="py-10 text-center space-y-2">
            <div className="text-base font-semibold text-red-700">Không có quyền truy cập phân hệ Quản trị</div>
            <p className="text-sm text-slate-600">
              Chỉ tài khoản được phân vai trò <strong>Quản trị hệ thống (ADMIN)</strong> mới có thể truy cập và cấu hình mục này.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'users', label: `Người dùng & Whitelist (${db.Users.length})` },
    { id: 'rooms', label: `Phòng học (${db.Rooms.length})` },
    { id: 'targets', label: `Chỉ tiêu năm ${year}` },
    { id: 'rbac', label: `🛡️ Ma trận Phân quyền (${ALL_MODULES.length} module)` },
    { id: 'settings', label: 'Tham số vận hành' },
    { id: 'audit', label: `Nhật ký kiểm toán (${db.AuditLog.length})` },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản trị Danh mục & Cấu hình"
        subtitle="Dữ liệu đồng bộ trực tiếp với các tab tương ứng trên Google Sheets"
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <Card
          title="Danh sách người dùng & Whitelist email ngoài"
          action={
            canManage && (
              <button
                onClick={() => {
                  setUForm({
                    user_id: '',
                    email: '',
                    ho_ten: '',
                    vai_tro: [ROLES.GIANG_VIEN],
                    don_vi: UNITS.BO_MON,
                    co_so: 'HH',
                    bo_mon_id: '',
                    la_nguoi_ngoai: false,
                    kich_hoat: true,
                  });
                  setUserModal(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
              >
                + Thêm người dùng
              </button>
            )
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-3">Họ tên / Email</th>
                  <th className="pb-2 pr-3">Vai trò</th>
                  <th className="pb-2 pr-3">Đơn vị / Cơ sở</th>
                  <th className="pb-2 pr-3">Loại</th>
                  <th className="pb-2">Trạng thái</th>
                  {canManage && <th className="pb-2 text-right">Sửa</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.Users.map((u) => (
                  <tr key={u.user_id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{u.ho_ten}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {u.vai_tro.map((r) => (
                          <Badge key={r} tone={r === ROLES.ADMIN ? 'purple' : 'teal'}>
                            {ROLE_LABELS[r as Role] || r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-700">
                      {UNIT_LABELS[u.don_vi as keyof typeof UNIT_LABELS] || u.don_vi} · {u.co_so}
                    </td>
                    <td className="py-2.5 pr-3">
                      {u.la_nguoi_ngoai ? <Badge tone="purple">Ngoài trường (Whitelist)</Badge> : <Badge tone="slate">Nội bộ</Badge>}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={u.kich_hoat ? 'emerald' : 'red'}>{u.kich_hoat ? 'Hoạt động' : 'Khóa'}</Badge>
                    </td>
                    {canManage && (
                      <td className="py-2.5 text-right whitespace-nowrap space-x-3">
                        <button
                          onClick={() => toggleAdminRole(u)}
                          className={`text-xs font-medium hover:underline ${
                            u.vai_tro.includes(ROLES.ADMIN) ? 'text-amber-700' : 'text-purple-700'
                          }`}
                        >
                          {u.vai_tro.includes(ROLES.ADMIN) ? 'Gỡ Admin' : 'Cấp Admin'}
                        </button>
                        <button
                          onClick={() => {
                            setUForm({
                              user_id: u.user_id,
                              email: u.email,
                              ho_ten: u.ho_ten,
                              vai_tro: u.vai_tro,
                              don_vi: u.don_vi,
                              co_so: u.co_so,
                              bo_mon_id: u.bo_mon_id || '',
                              la_nguoi_ngoai: u.la_nguoi_ngoai,
                              kich_hoat: u.kich_hoat,
                            });
                            setUserModal(true);
                          }}
                          className="text-xs text-teal-700 hover:underline font-medium"
                        >
                          Sửa
                        </button>
                        {u.user_id !== 'U-CECICS-ALL' && (
                          <button
                            onClick={() => deleteUser(u)}
                            className="text-xs text-rose-600 hover:underline font-medium hover:text-rose-800"
                            title="Xóa người dùng"
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'rooms' && (
        <Card
          title="Danh mục Phòng học & Phòng Mô phỏng"
          action={
            canManage && (
              <button
                onClick={() => {
                  setRForm({ room_id: '', campus_id: 'HH', ten: '', loai: 'Mô phỏng', suc_chua: 24, kich_hoat: true });
                  setRoomModal(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
              >
                + Thêm phòng
              </button>
            )
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-3">Mã phòng</th>
                  <th className="pb-2 pr-3">Tên phòng</th>
                  <th className="pb-2 pr-3">Cơ sở</th>
                  <th className="pb-2 pr-3">Loại</th>
                  <th className="pb-2 pr-3">Sức chứa</th>
                  <th className="pb-2">Trạng thái</th>
                  {canManage && <th className="pb-2 text-right">Sửa</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.Rooms.map((r) => (
                  <tr key={r.room_id}>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.room_id}</td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900">{r.ten}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone="teal">{r.campus_id}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">{r.loai}</td>
                    <td className="py-2.5 pr-3">{r.suc_chua} chỗ</td>
                    <td className="py-2.5">
                      <Badge tone={r.kich_hoat ? 'emerald' : 'slate'}>{r.kich_hoat ? 'Sẵn sàng' : 'Ngưng dùng'}</Badge>
                    </td>
                    {canManage && (
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setRForm({
                              room_id: r.room_id,
                              campus_id: r.campus_id,
                              ten: r.ten,
                              loai: r.loai,
                              suc_chua: r.suc_chua,
                              kich_hoat: r.kich_hoat,
                            });
                            setRoomModal(true);
                          }}
                          className="text-xs text-teal-700 hover:underline font-medium"
                        >
                          Sửa
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'targets' && (
        <Card title={`Chỉ tiêu kế hoạch năm ${year}`} subtitle="Dùng cho biểu đồ Tiến độ mục tiêu vs Thực hiện trên Dashboard Lãnh đạo">
          <div className="space-y-3 max-w-xl">
            {[
              { key: 'GIO_GIANG', label: 'Tổng giờ giảng dạy (năm)' },
              { key: 'SO_LOP_MO_PHONG', label: 'Tổng số lớp mô phỏng (năm)' },
              { key: 'GIO_COI_THI', label: 'Tổng giờ coi thi (năm)' },
            ].map((item) => {
              const found = db.Targets.find((t) => t.nam === year && t.chi_tieu === item.key);
              const val = targetValues[item.key] ?? found?.gia_tri ?? 0;
              return (
                <div key={item.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setTargetValues({ ...targetValues, [item.key]: Number(e.target.value) })}
                      className="w-28 text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 text-right"
                    />
                    <button
                      onClick={() => saveTarget(item.key, val)}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'rbac' && (
        <Card
          title="Ma trận Phân bổ Quyền can thiệp Phân hệ theo Vị trí Việc làm (RBAC Matrix)"
          subtitle="Cấu hình quyền hạn của 8 vai trò hệ thống đối với 9 phân hệ chức năng · Lưu động vào CSDL và đồng bộ"
          action={
            <div className="flex items-center gap-2">
              {rbacDirty && (
                <span className="text-xs text-amber-600 font-semibold animate-pulse">
                  ● Có thay đổi chưa lưu
                </span>
              )}
              <button
                type="button"
                onClick={resetRbacMatrix}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                ↺ Khôi phục mặc định
              </button>
              <button
                type="button"
                onClick={saveRbacMatrix}
                className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold shadow-xs transition-colors ${
                  rbacDirty ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800'
                }`}
              >
                💾 Lưu ma trận phân quyền
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Chú giải cấp độ quyền */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  FULL — Toàn quyền
                </div>
                <div className="text-slate-600 text-[11px] mt-0.5">Tạo, Sửa, Xóa, Duyệt & Quản trị cao nhất phân hệ.</div>
              </div>
              <div className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-200 text-xs">
                <div className="font-bold text-teal-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  WRITE — Ghi / Thao tác
                </div>
                <div className="text-slate-600 text-[11px] mt-0.5">Tạo mới, chỉnh sửa, thao tác trong phạm vi đơn vị.</div>
              </div>
              <div className="p-2.5 rounded-lg bg-sky-50/70 border border-sky-200 text-xs">
                <div className="font-bold text-sky-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  READ — Chỉ xem
                </div>
                <div className="text-slate-600 text-[11px] mt-0.5">Tra cứu lịch, theo dõi tiến độ, xem báo cáo cá nhân.</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  NONE — Không truy cập
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Ẩn menu và chặn mọi quyền can thiệp vào phân hệ.</div>
              </div>
            </div>

            {/* Banner nguyên tắc y khoa */}
            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <span className="text-base">💡</span>
              <div>
                <strong>Nguyên tắc phân giải đa vai trò (Multi-Role Privilege Resolution):</strong> Nếu giảng viên hoặc cán bộ đảm nhiệm nhiều vai trò cùng lúc (ví dụ: vừa là <em>Giảng viên</em> vừa là <em>Đầu mối Bộ môn</em> hoặc <em>Đào tạo</em>), hệ thống tự động áp dụng quyền cao nhất theo thứ bậc ưu tiên: <strong>FULL &gt; WRITE &gt; READ &gt; NONE</strong>.
              </div>
            </div>

            {/* Bảng ma trận 9 phân hệ x 8 vai trò */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="p-3 font-bold sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                      Phân hệ chức năng
                    </th>
                    {ALL_ROLES.map((role) => (
                      <th key={role} className="p-2.5 text-center min-w-[125px]">
                        <div className="font-bold text-slate-900 text-xs">{ROLE_LABELS[role]}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{role}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ALL_MODULES.map((modKey) => {
                    const modInfo = MODULE_LABELS[modKey];
                    return (
                      <tr key={modKey} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                            <span>{modInfo.icon}</span>
                            <span>{modInfo.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{modInfo.desc}</div>
                        </td>

                        {ALL_ROLES.map((role) => {
                          const isAdminRole = role === ROLES.ADMIN;
                          const lvl = isAdminRole ? 'FULL' : rbacDraft[role]?.[modKey] || 'NONE';

                          const toneStyle: Record<AccessLevel, string> = {
                            FULL: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
                            WRITE: 'bg-teal-50 text-teal-800 border-teal-300 font-semibold',
                            READ: 'bg-sky-50 text-sky-800 border-sky-300 font-medium',
                            NONE: 'bg-slate-50 text-slate-400 border-slate-200',
                          };

                          return (
                            <td key={role} className="p-2 text-center align-middle">
                              {isAdminRole ? (
                                <span className="inline-block px-2.5 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-bold">
                                  Toàn quyền
                                </span>
                              ) : (
                                <select
                                  value={lvl}
                                  onChange={(e) => handleCellChange(role, modKey, e.target.value as AccessLevel)}
                                  className={`w-full text-xs rounded-md border px-2 py-1.5 focus:outline-hidden transition-colors ${toneStyle[lvl]}`}
                                >
                                  <option value="FULL">🟢 FULL (Toàn quyền)</option>
                                  <option value="WRITE">🔷 WRITE (Ghi / Sửa)</option>
                                  <option value="READ">🔹 READ (Chỉ xem)</option>
                                  <option value="NONE">⚪ NONE (Chặn)</option>
                                </select>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {tab === 'settings' && (
        <Card title="Tham số quy tắc vận hành" subtitle="Cấu hình linh hoạt không cần sửa code">
          <div className="space-y-2.5">
            {db.Settings.map((s) => (
              <div key={s.khoa} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800">{s.khoa}</div>
                  <div className="text-xs text-slate-500">{s.mo_ta}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    disabled={!canManage}
                    value={settingValues[s.khoa] ?? s.gia_tri}
                    onChange={(e) => setSettingValues({ ...settingValues, [s.khoa]: e.target.value })}
                    className="w-36 text-sm border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                  {canManage && (
                    <button
                      onClick={() => saveSetting(s.khoa, s.gia_tri)}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
                    >
                      Lưu
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'audit' && (
        <Card title="Nhật ký kiểm toán (Audit Log)" subtitle="Truy vết mọi thao tác tạo, sửa, gán phòng, hoán đổi và chỉ đạo">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-3">Thời gian</th>
                  <th className="pb-2 pr-3">Người thực hiện</th>
                  <th className="pb-2 pr-3">Hành động</th>
                  <th className="pb-2 pr-3">Bảng / Đối tượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.AuditLog.slice()
                  .reverse()
                  .slice(0, 50)
                  .map((log) => (
                    <tr key={log.log_id}>
                      <td className="py-2 pr-3 font-mono text-slate-500">{log.luc.slice(0, 19).replace('T', ' ')}</td>
                      <td className="py-2 pr-3">{log.user}</td>
                      <td className="py-2 pr-3 font-semibold text-teal-800">{log.hanh_dong}</td>
                      <td className="py-2 pr-3">
                        {log.bang} · <span className="font-mono">{log.doi_tuong_id}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal User */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title={uForm.user_id ? `Sửa người dùng ${uForm.user_id}` : 'Thêm người dùng'}>
        <form onSubmit={saveUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" required value={uForm.email} onChange={(e) => setUForm({ ...uForm, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Họ và tên *</label>
              <input required value={uForm.ho_ten} onChange={(e) => setUForm({ ...uForm, ho_ten: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Đơn vị</label>
              <select value={uForm.don_vi} onChange={(e) => setUForm({ ...uForm, don_vi: e.target.value })} className={inputCls}>
                {Object.entries(UNIT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cơ sở chính</label>
              <select value={uForm.co_so} onChange={(e) => setUForm({ ...uForm, co_so: e.target.value })} className={inputCls}>
                {db.Campuses.map((c) => (
                  <option key={c.campus_id} value={c.campus_id}>
                    {c.ten}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Vai trò</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(ROLE_LABELS).map(([rKey, rLabel]) => {
                const checked = uForm.vai_tro.includes(rKey);
                return (
                  <label key={rKey} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...uForm.vai_tro, rKey]
                          : uForm.vai_tro.filter((x) => x !== rKey);
                        setUForm({ ...uForm, vai_tro: next });
                      }}
                      className="accent-teal-700"
                    />
                    {rLabel}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={uForm.la_nguoi_ngoai}
                onChange={(e) => setUForm({ ...uForm, la_nguoi_ngoai: e.target.checked })}
                className="accent-teal-700"
              />
              Email ngoài trường (Whitelist)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={uForm.kich_hoat}
                onChange={(e) => setUForm({ ...uForm, kich_hoat: e.target.checked })}
                className="accent-teal-700"
              />
              Đang kích hoạt
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setUserModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold">
              Lưu người dùng
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Room */}
      <Modal open={roomModal} onClose={() => setRoomModal(false)} title="Thêm / Sửa phòng học">
        <form onSubmit={saveRoom} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã phòng (VD: P-HH-103)</label>
              <input value={rForm.room_id} onChange={(e) => setRForm({ ...rForm, room_id: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cơ sở *</label>
              <select value={rForm.campus_id} onChange={(e) => setRForm({ ...rForm, campus_id: e.target.value })} className={inputCls}>
                {db.Campuses.map((c) => (
                  <option key={c.campus_id} value={c.campus_id}>
                    {c.ten}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tên phòng *</label>
            <input required value={rForm.ten} onChange={(e) => setRForm({ ...rForm, ten: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Loại phòng</label>
              <select value={rForm.loai} onChange={(e) => setRForm({ ...rForm, loai: e.target.value })} className={inputCls}>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sức chứa</label>
              <input
                type="number"
                min={1}
                value={rForm.suc_chua}
                onChange={(e) => setRForm({ ...rForm, suc_chua: Number(e.target.value) || 20 })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rForm.kich_hoat}
                onChange={(e) => setRForm({ ...rForm, kich_hoat: e.target.checked })}
                className="accent-teal-700"
              />
              Phòng sẵn sàng sử dụng
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRoomModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold">
              Lưu phòng
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
