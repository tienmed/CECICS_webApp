import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { evaluateLoginAccess } from '@/core/permissions';
import { DEMO_COOKIE_NAME, isDemoModeEnabled } from '@/lib/auth';
import { getSnapshot } from '@/lib/repository';

export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ ok: false, error: 'Chế độ thử nghiệm đã tắt.' }, { status: 403 });
  }
  let body: { email?: string } = {};
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Dữ liệu JSON không hợp lệ.' }, { status: 400 });
  }
  const email = String(body.email || '').trim().toLowerCase();
  const db = await getSnapshot();
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'pnt.edu.vn';
  const verdict = evaluateLoginAccess(email, db.Users, allowedDomain);
  if (!verdict.allowed) {
    return NextResponse.json({ ok: false, error: verdict.reason }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE_NAME, verdict.user.email, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true, user: verdict.user });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
