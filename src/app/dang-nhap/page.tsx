import { redirect } from 'next/navigation';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { getDataMode, getSnapshot } from '@/lib/repository';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/tong-quan');
  }

  const sp = await searchParams;
  const demoMode = isDemoModeEnabled();
  const hasGoogleOAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  let db = null;
  if (demoMode) {
    try {
      db = await getSnapshot();
    } catch (err) {
      console.warn('[LoginPage] Lỗi nạp snapshot:', err);
    }
  }

  return (
    <LoginClient
      error={sp?.error}
      demoMode={demoMode}
      hasGoogleOAuth={hasGoogleOAuth}
      dataMode={getDataMode()}
      demoUsers={db ? db.Users.filter((u) => u.kich_hoat) : []}
    />
  );
}
