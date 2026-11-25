import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/repository';
import { withLocalLock } from '@/lib/local-store';
import { registerCmeCourseAction } from '@/core/cme';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { course_id, student, payment } = body;

    if (!course_id || !student?.cccd || !student?.ho_ten || !student?.email || !student?.sdt) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (CCCD, Họ tên, Email, SĐT).' },
        { status: 400 }
      );
    }

    const result = await withLocalLock((store) => {
      return registerCmeCourseAction(store, { course_id, student, payment });
    });

    return NextResponse.json({
      success: true,
      student: result.student,
      registration: result.registration,
    });
  } catch (err: any) {
    console.error('Lỗi API register-cme:', err);
    return NextResponse.json({ error: err?.message || 'Lỗi đăng ký khóa học' }, { status: 500 });
  }
}
