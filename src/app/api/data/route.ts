import { NextResponse } from 'next/server';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { getDataMode, getSnapshot } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
  }
  const url = new URL(request.url);
  const fresh = url.searchParams.get('fresh') === '1';

  let sheetsError: string | null = null;
  let db;
  try {
    db = await getSnapshot(fresh);
  } catch (e) {
    sheetsError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    ok: true,
    user,
    dataMode: getDataMode(),
    demoMode: isDemoModeEnabled(),
    sheetsError,
    db,
  });
}
