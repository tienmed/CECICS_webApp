import { redirect } from 'next/navigation';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { getDataMode, getSnapshot } from '@/lib/repository';
import { readLocalDb } from '@/lib/local-store';
import { AppProvider } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';
import type { DatabaseSnapshot } from '@/core/types';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/dang-nhap');
  }

  let db: DatabaseSnapshot;
  try {
    db = await getSnapshot();
  } catch (err) {
    console.warn('[AuthenticatedLayout] Lỗi nạp snapshot:', err);
    db = readLocalDb();
  }
  return (
    <AppProvider
      initialUser={user}
      initialDb={db}
      initialDataMode={getDataMode()}
      initialDemoMode={isDemoModeEnabled()}
    >
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
