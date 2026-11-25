'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { canPerform, isAdmin } from '@/core/permissions';
import { ROLE_LABELS, type Role } from '@/core/types';
import { useApp } from './AppProvider';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  visible?: boolean;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, db, dataMode, loading, refresh, execute } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const myNotifs = useMemo(
    () =>
      db.Notifications.filter((n) => n.user_id === user.user_id).sort((a, b) =>
        b.tao_luc.localeCompare(a.tao_luc)
      ),
    [db.Notifications, user.user_id]
  );
  const unreadCount = myNotifs.filter((n) => !n.da_doc).length;

  const openEscalations = db.Escalations.filter((e) => e.trang_thai === 'Đang mở').length;
  const incomingSwaps = db.SwapRequests.filter(
    (sw) => sw.trang_thai === 'Chờ' && sw.den_gv === user.user_id
  ).length;
  const pendingSims = db.SimClasses.filter(
    (s) => s.trang_thai === 'Chờ rà soát' || s.trang_thai === 'Cần xét đặc biệt'
  ).length;
  const unassignedSessions = db.Sessions.filter((s) => s.trang_thai !== 'Đã hủy' && !s.room_id).length;

  const navItems: NavItem[] = [
    { href: '/tong-quan', label: 'Tổng quan', icon: '📊', visible: true },
    { href: '/lich-giang', label: 'Lịch giảng & Coi thi', icon: '📅', visible: true },
    {
      href: '/gan-phong',
      label: 'Gán phòng',
      icon: '🚪',
      badge: unassignedSessions,
      visible: canPerform(user, 'assign_room') || user.vai_tro.includes('LANH_DAO'),
    },
    {
      href: '/osce',
      label: 'Sơ đồ trạm OSCE',
      icon: '🧭',
      visible: true,
    },
    {
      href: '/doi-lich',
      label: 'Hoán đổi lịch',
      icon: '🔄',
      badge: incomingSwaps,
      visible: true,
    },
    {
      href: '/lop-mo-phong',
      label: 'Lớp mô phỏng',
      icon: '🩺',
      badge: pendingSims,
      visible: true,
    },
    {
      href: '/thiet-bi',
      label: 'Thiết bị & Sự cố',
      icon: '🛠️',
      badge: db.Equipment.filter((e) => e.trang_thai === 'Hỏng').length,
      visible: true,
    },
    {
      href: '/leo-thang',
      label: 'Leo thang & Chỉ đạo',
      icon: '🚨',
      badge: openEscalations,
      visible: true,
    },
    {
      href: '/cme',
      label: 'Đào tạo CME',
      icon: '🎓',
      badge: (db.CmeRegistrations || []).filter((r) => r.trang_thai === 'DA_CHUYEN_KHOAN').length,
      visible: true,
    },
    {
      href: '/thong-ke-gio',
      label: 'Thống kê giờ giảng',
      icon: '⏱️',
      visible: canPerform(user, 'view_hours_report'),
    },
    {
      href: '/quan-tri',
      label: 'Quản trị hệ thống',
      icon: '⚙️',
      visible: isAdmin(user),
    },
  ].filter((item) => item.visible);

  async function handleLogout() {
    try {
      await fetch('/api/demo-login', { method: 'DELETE' });
    } catch {
      // Bỏ qua lỗi dọn cookie demo
    }
    try {
      await signOut({ callbackUrl: '/dang-nhap', redirect: true });
    } catch {
      window.location.href = '/dang-nhap';
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    await execute('markNotificationsRead', {});
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 font-bold text-white text-sm">
              CE
            </span>
            <div>
              <div className="font-bold text-base tracking-tight text-white">CECICS</div>
              <div className="text-[11px] text-teal-300 leading-tight">Vận hành Số hóa · MVP</div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white text-xl px-2"
          aria-label="Đóng menu"
        >
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {item.badge ? (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-2 text-xs">
        <div className="px-2 py-1.5 rounded bg-slate-800/80 flex items-center justify-between">
          <span className="text-slate-400">Nguồn dữ liệu:</span>
          <span className={`font-semibold ${dataMode === 'sheets' ? 'text-emerald-400' : 'text-amber-300'}`}>
            {dataMode === 'sheets' ? 'Google Sheets' : 'Local Demo'}
          </span>
        </div>
        <div className="px-2 py-1">
          <div className="font-semibold text-white truncate">{user.ho_ten}</div>
          <div className="text-slate-400 truncate">{user.email}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {user.vai_tro.map((r) => (
              <span key={r} className="px-1.5 py-0.5 rounded bg-teal-900/70 text-teal-200 text-[10px]">
                {ROLE_LABELS[r as Role] || r}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-center py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar (>= 1024px) */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {/* Tablet Icon Rail (768px - 1023px) */}
      <aside className="hidden md:flex lg:hidden w-16 shrink-0 sticky top-0 h-screen flex-col bg-slate-900 text-slate-100 border-r border-slate-800 py-3 items-center justify-between z-20">
        <div className="flex flex-col items-center w-full gap-3">
          <Link
            href="/tong-quan"
            className="h-9 w-9 rounded-lg bg-teal-600 font-bold text-white text-sm flex items-center justify-center shadow-sm"
            title="CECICS Trang chủ"
          >
            CE
          </Link>
          <div className="w-8 h-[1px] bg-slate-800" />
          <nav className="flex flex-col items-center gap-1.5 w-full px-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`relative flex items-center justify-center w-11 h-11 rounded-xl text-lg transition-colors ${
                    active ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.badge ? (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            title="Mở toàn bộ danh mục menu"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-base"
            aria-label="Mở menu đầy đủ"
          >
            ☰
          </button>
          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-sm"
            aria-label="Đăng xuất"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Mobile & Tablet Slide Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              aria-label="Mở menu"
            >
              ☰
            </button>
            <div className="hidden sm:block text-sm text-slate-500">
              Trung tâm Kỹ năng &amp; Sáng tạo Mô phỏng Lâm sàng ·{' '}
              <span className="font-medium text-slate-700">Hòa Hưng &amp; Tân Nhật</span>
            </div>
            <div className="sm:hidden font-bold text-slate-900 text-base flex items-center gap-1.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-[10px] font-bold text-white">
                CE
              </span>
              <span>CECICS</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => refresh(true)}
              disabled={loading}
              title="Làm mới dữ liệu"
              className="px-2 sm:px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? '⏳' : '↻'}
              <span className="hidden sm:inline sm:ml-1">Làm mới</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                aria-label="Thông báo"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">Thông báo ({unreadCount} mới)</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-teal-700 hover:underline font-medium"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {myNotifs.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">Chưa có thông báo nào.</div>
                    ) : (
                      myNotifs.slice(0, 15).map((n) => (
                        <Link
                          key={n.id}
                          href={n.link || '/tong-quan'}
                          onClick={() => setBellOpen(false)}
                          className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${
                            !n.da_doc ? 'bg-teal-50/50' : ''
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-900">{n.tieu_de}</div>
                          <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.noi_dung}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{n.tao_luc.slice(0, 16).replace('T', ' ')}</div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 md:pb-6 max-w-[1440px] w-full mx-auto">{children}</main>

        {/* Mobile Bottom Navigation Bar (< 768px) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around px-2 shadow-lg">
          <Link
            href="/lich-giang"
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors ${
              pathname.startsWith('/lich-giang') ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="text-xl">📅</span>
            <span className="text-[10px] leading-tight mt-0.5">Lịch giảng</span>
          </Link>
          <Link
            href="/gan-phong"
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center relative transition-colors ${
              pathname.startsWith('/gan-phong') ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="text-xl relative inline-block">
              🚪
              {unassignedSessions > 0 && (
                <span className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unassignedSessions}
                </span>
              )}
            </span>
            <span className="text-[10px] leading-tight mt-0.5">Gán phòng</span>
          </Link>
          <Link
            href="/doi-lich"
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center relative transition-colors ${
              pathname.startsWith('/doi-lich') ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="text-xl relative inline-block">
              🔄
              {incomingSwaps > 0 && (
                <span className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {incomingSwaps}
                </span>
              )}
            </span>
            <span className="text-[10px] leading-tight mt-0.5">Đổi lịch</span>
          </Link>
          <Link
            href="/tong-quan"
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors ${
              pathname.startsWith('/tong-quan') ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="text-xl">📊</span>
            <span className="text-[10px] leading-tight mt-0.5">Tổng quan</span>
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center relative transition-colors ${
              mobileOpen ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="text-xl relative inline-block">
              ☰
              {(openEscalations > 0 || pendingSims > 0) && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </span>
            <span className="text-[10px] leading-tight mt-0.5">Thêm</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
