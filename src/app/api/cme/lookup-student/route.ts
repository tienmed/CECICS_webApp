import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/repository';
import { lookupStudentByCccdAndDob } from '@/core/cme';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cccd = searchParams.get('cccd') || '';
    const dob = searchParams.get('dob') || '';

    if (!cccd || cccd.length < 9) {
      return NextResponse.json({ error: 'Vui lòng cung cấp số CCCD hợp lệ.' }, { status: 400 });
    }

    const db = await getSnapshot(false);
    const result = lookupStudentByCccdAndDob(db, cccd, dob);

    return NextResponse.json({
      found: !!result.student,
      student: result.student,
      historyRegistrations: result.historyRegistrations,
    });
  } catch (err: any) {
    console.error('Lỗi API lookup-student:', err);
    return NextResponse.json({ error: err?.message || 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}
