import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withLocalLock } from '@/lib/local-store';
import { importLegacyCmeData } from '@/core/cme';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email || 'admin@pnt.edu.vn';

    const body = await req.json();
    const { courses, students, registrations, assessments } = body;

    const result = await withLocalLock((store) => {
      return importLegacyCmeData(
        store,
        { courses, students, registrations, assessments },
        userEmail
      );
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('Lỗi API import-legacy-cme:', err);
    return NextResponse.json({ error: err?.message || 'Lỗi import dữ liệu CME cũ' }, { status: 500 });
  }
}
