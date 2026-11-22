'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ActionName } from '@/core/mutations';
import type { DatabaseSnapshot, UserRecord } from '@/core/types';

export interface ActionError {
  code: string;
  error: string;
  details?: unknown;
}

interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  user: UserRecord;
  db: DatabaseSnapshot;
  dataMode: 'sheets' | 'local';
  demoMode: boolean;
  loading: boolean;
  refresh: (fresh?: boolean) => Promise<void>;
  execute: <T = unknown>(
    action: ActionName,
    payload: Record<string, unknown>,
    successMsg?: string
  ) => Promise<{ ok: true; data: T } | { ok: false; err: ActionError }>;
  notify: (kind: ToastItem['kind'], message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  initialUser,
  initialDb,
  initialDataMode,
  initialDemoMode,
  children,
}: {
  initialUser: UserRecord;
  initialDb: DatabaseSnapshot;
  initialDataMode: 'sheets' | 'local';
  initialDemoMode: boolean;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserRecord>(initialUser);
  const [db, setDb] = useState<DatabaseSnapshot>(initialDb);
  const [dataMode, setDataMode] = useState<'sheets' | 'local'>(initialDataMode);
  const [demoMode, setDemoMode] = useState<boolean>(initialDemoMode);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastItem['kind'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refresh = useCallback(async (fresh = true) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setUser(json.user);
        setDb(json.db);
        setDataMode(json.dataMode);
        setDemoMode(json.demoMode);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const execute = useCallback(
    async <T = unknown,>(
      action: ActionName,
      payload: Record<string, unknown>,
      successMsg?: string
    ): Promise<{ ok: true; data: T } | { ok: false; err: ActionError }> => {
      setLoading(true);
      try {
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          const err: ActionError = {
            code: json.code || 'ERROR',
            error: json.error || 'Thao tác thất bại.',
            details: json.details,
          };
          notify('error', err.error);
          return { ok: false, err };
        }
        await refresh(true);
        if (successMsg) notify('success', successMsg);
        return { ok: true, data: json.data as T };
      } catch (e) {
        const err: ActionError = {
          code: 'NETWORK',
          error: e instanceof Error ? e.message : 'Lỗi kết nối máy chủ.',
        };
        notify('error', err.error);
        return { ok: false, err };
      } finally {
        setLoading(false);
      }
    },
    [notify, refresh]
  );

  // Sync initial props if server re-renders (e.g., after demo role switch)
  useEffect(() => {
    setUser(initialUser);
    setDb(initialDb);
  }, [initialUser, initialDb]);

  return (
    <AppContext.Provider value={{ user, db, dataMode, demoMode, loading, refresh, execute, notify }}>
      {children}
      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg border transition-all ${
              t.kind === 'success'
                ? 'bg-teal-700 text-white border-teal-800'
                : t.kind === 'error'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-slate-800 text-white border-slate-900'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải dùng bên trong AppProvider');
  return ctx;
}
