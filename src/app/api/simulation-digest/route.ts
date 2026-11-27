import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSimulationDigestDataWithCvi } from '@/lib/simulation-digest-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format'); // 'json' hoặc 'html'

    const digestData = await getSimulationDigestDataWithCvi();

    if (format === 'html') {
      return new NextResponse(digestData.emailHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: digestData,
    });
  } catch (err: any) {
    console.error('Lỗi khi lấy dữ liệu chuyên trang mô phỏng:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
