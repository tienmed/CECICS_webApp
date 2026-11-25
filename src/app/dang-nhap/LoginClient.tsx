'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';

export function LoginClient({
  error,
  hasGoogleOAuth,
  dataMode,
}: {
  error?: string;
  demoMode?: boolean;
  hasGoogleOAuth: boolean;
  dataMode: 'sheets' | 'local';
  demoUsers?: unknown[];
}) {
  const [localError] = useState<string | null>(error || null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-teal-700 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center font-bold text-lg">
              CE
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CECICS — Hệ thống Vận hành Số hóa</h1>
              <p className="text-teal-100 text-xs sm:text-sm">
                Trung tâm Kỹ năng &amp; Sáng tạo Mô phỏng Lâm sàng · Cơ sở Hòa Hưng &amp; Tân Nhựt
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {localError && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {localError}
            </div>
          )}

          {/* Google Sign-In */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={!hasGoogleOAuth}
              onClick={() => signIn('google', { callbackUrl: '/tong-quan' })}
              className="w-full py-3.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-slate-800 flex items-center justify-center gap-3 shadow-xs transition-colors"
            >
              <span className="text-xl">🔐</span>
              <span className="text-sm sm:text-base">
                {hasGoogleOAuth
                  ? 'Đăng nhập bằng Google (@pnt.edu.vn / Danh sách trắng)'
                  : 'Đăng nhập Google (chưa cấu hình AUTH_GOOGLE_ID trên Vercel)'}
              </span>
            </button>
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Yêu cầu tài khoản email công vụ <code>@pnt.edu.vn</code> hoặc email ngoài đã được duyệt trong danh sách trắng.
              Chế độ dữ liệu: <strong>{dataMode === 'sheets' ? 'Google Sheets (Thời gian thực)' : 'Local Demo'}</strong>.
            </p>
          </div>

          {/* Quy chuẩn bảo mật & phân quyền thực tế */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <span>🛡️</span>
              <span>Xác thực &amp; Phân quyền nghiệp vụ thực tế</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                • <strong>Định danh tài khoản</strong>: Đăng nhập trực tiếp bằng tài khoản Google cá nhân. Hệ thống tự động đối chiếu thông tin với cơ sở dữ liệu nhân sự CECICS.
              </p>
              <p>
                • <strong>Khu vực hoạt động</strong>: Mỗi tài khoản chỉ được truy cập và thao tác đúng các phân hệ chức năng tương ứng với vai trò được giao:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1 pt-1 font-medium text-slate-700">
                <li className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-teal-600">⚙️</span>
                  <span><strong>Admin</strong>: Quản trị danh mục &amp; tài khoản</span>
                </li>
                <li className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-teal-600">🚪</span>
                  <span><strong>Điều phối</strong>: Xếp phòng &amp; duyệt đổi lịch</span>
                </li>
                <li className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-teal-600">🚨</span>
                  <span><strong>Ban Lãnh đạo</strong>: Phê duyệt chỉ đạo &amp; báo cáo</span>
                </li>
                <li className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-teal-600">🩺</span>
                  <span><strong>Giảng viên</strong>: Lịch dạy &amp; đổi ca cá nhân</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
