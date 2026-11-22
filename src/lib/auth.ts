import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { cookies } from 'next/headers';
import { evaluateLoginAccess } from '@/core/permissions';
import type { UserRecord } from '@/core/types';
import { getSnapshot } from './repository';

export const DEMO_COOKIE_NAME = 'cecics_demo_email';

export function isDemoModeEnabled(): boolean {
  // Mặc định bật demo ở local khi chưa cấu hình Google OAuth thật
  if (process.env.DEMO_MODE === 'false') return false;
  if (process.env.DEMO_MODE === 'true') return true;
  return !process.env.AUTH_GOOGLE_ID;
}

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
        },
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  pages: {
    signIn: '/dang-nhap',
    error: '/dang-nhap',
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      try {
        const db = await getSnapshot();
        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'pnt.edu.vn';
        const verdict = evaluateLoginAccess(email, db.Users, allowedDomain);
        if (!verdict.allowed) {
          return `/dang-nhap?error=${encodeURIComponent(verdict.reason)}`;
        }
        return true;
      } catch {
        return `/dang-nhap?error=${encodeURIComponent('Không thể kiểm tra danh sách người dùng trên hệ thống.')}`;
      }
    },
    async session({ session }) {
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || 'cecics-dev-fallback-secret-change-in-prod',
});

/**
 * Lấy bản ghi UserRecord hiện tại (từ Google Auth session hoặc Demo cookie khi DEMO_MODE=true).
 */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const db = await getSnapshot();
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'pnt.edu.vn';

  // 1. Ưu tiên session Google Auth thật
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (email) {
      const verdict = evaluateLoginAccess(email, db.Users, allowedDomain);
      if (verdict.allowed) return verdict.user;
    }
  } catch {
    // Bỏ qua nếu chưa cấu hình Google OAuth ở local
  }

  // 2. Dự phòng Demo Mode cho thử nghiệm nội bộ
  if (isDemoModeEnabled()) {
    const cookieStore = await cookies();
    const rawDemoEmail = cookieStore.get(DEMO_COOKIE_NAME)?.value;
    if (rawDemoEmail) {
      let demoEmail = rawDemoEmail;
      try {
        demoEmail = decodeURIComponent(rawDemoEmail);
      } catch {
        // Giữ nguyên nếu không decode được
      }
      const verdict = evaluateLoginAccess(demoEmail, db.Users, allowedDomain);
      if (verdict.allowed) return verdict.user;
    }
  }

  return null;
}
