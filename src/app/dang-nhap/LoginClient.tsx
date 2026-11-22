'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ROLE_LABELS, type Role, type UserRecord } from '@/core/types';

export function LoginClient({
  error,
  demoMode,
  hasGoogleOAuth,
  dataMode,
  demoUsers,
}: {
  error?: string;
  demoMode: boolean;
  hasGoogleOAuth: boolean;
  dataMode: 'sheets' | 'local';
  demoUsers: UserRecord[];
}) {
  const router = useRouter();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(error || null);

  async function loginAsDemo(email: string) {
    setBusyEmail(email);
    setLocalError(null);
    try {
      const res = await fetch('/api/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLocalError(json.error || 'Không thể đăng nhập.');
        return;
      }
      window.location.href = '/tong-quan';
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-teal-700 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center font-bold text-lg">
              CE
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CECICS — Hệ thống Vận hành Số hóa</h1>
              <p className="text-teal-100 text-xs sm:text-sm">
                Trung tâm Kỹ năng &amp; Sáng tạo Mô phỏng Lâm sàng · Cơ sở Hòa Hưng &amp; Tân Nhật
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
          <div className="space-y-2">
            <button
              type="button"
              disabled={!hasGoogleOAuth}
              onClick={() => signIn('google', { callbackUrl: '/tong-quan' })}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-slate-800 flex items-center justify-center gap-3 shadow-xs transition-colors"
            >
              <span className="text-lg">🔐</span>
              <span>
                {hasGoogleOAuth
                  ? 'Đăng nhập bằng Google (@pnt.edu.vn / Danh sách trắng)'
                  : 'Đăng nhập Google (chưa cấu hình AUTH_GOOGLE_ID trong .env.local)'}
              </span>
            </button>
            <p className="text-xs text-slate-500 text-center">
              Yêu cầu tài khoản email công vụ <code>@pnt.edu.vn</code> hoặc email ngoài đã được duyệt trong danh sách trắng.
              Chế độ dữ liệu hiện tại: <strong>{dataMode === 'sheets' ? 'Google Sheets' : 'Local Demo'}</strong>.
            </p>
          </div>

          {/* Demo Role Picker */}
          {demoMode && demoUsers.length > 0 && (
            <div className="border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Chế độ dùng thử — Chọn nhanh vai trò để kiểm thử
                </h2>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  DEMO_MODE=true
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {demoUsers.map((u) => (
                  <button
                    key={u.user_id}
                    type="button"
                    disabled={busyEmail !== null}
                    onClick={() => loginAsDemo(u.email)}
                    className="text-left p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 transition-all disabled:opacity-50"
                  >
                    <div className="font-semibold text-sm text-slate-900 truncate">{u.ho_ten}</div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.vai_tro.map((r) => (
                        <span
                          key={r}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium"
                        >
                          {ROLE_LABELS[r as Role] || r}
                        </span>
                      ))}
                      {u.la_nguoi_ngoai && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                          Ngoài trường (Whitelist)
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
