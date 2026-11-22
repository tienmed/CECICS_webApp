import { redirect } from 'next/navigation';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { getDataMode, getSnapshot } from '@/lib/repository';
import { AppProvider } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/dang-nhap');
  }

  const db = await getSnapshot();
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
