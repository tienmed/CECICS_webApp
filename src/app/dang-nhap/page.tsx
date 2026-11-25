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
  const hasGoogleOAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <LoginClient
      error={sp?.error}
      hasGoogleOAuth={hasGoogleOAuth}
      dataMode={getDataMode()}
    />
  );
}
