import { NextResponse } from 'next/server';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { canViewSimClass } from '@/core/permissions';
import { getSnapshot } from '@/lib/repository';
import { generateSimClassEOfficeHtml } from '@/lib/sim-pdf';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let user = await getCurrentUser();
  if (!user && isDemoModeEnabled()) {
    const db = await getSnapshot();
    user = db.Users[0] || null;
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Vui lòng đăng nhập để xuất biểu mẫu.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const simId = url.searchParams.get('sim_id');
  if (!simId) {
    return NextResponse.json({ ok: false, error: 'Thiếu mã lớp mô phỏng (sim_id).' }, { status: 400 });
  }

  const db = await getSnapshot();
  const simClass = db.SimClasses.find((s) => s.sim_id === simId);
  if (!simClass) {
    return NextResponse.json({ ok: false, error: `Không tìm thấy lớp mô phỏng ${simId}.` }, { status: 404 });
  }

  // Quy chuẩn: BM nào chỉ xem được phiếu của BM đó thôi
  if (!canViewSimClass(user, simClass)) {
    return NextResponse.json(
      { ok: false, error: 'Bạn chỉ có quyền xem và xuất biểu mẫu thuộc Bộ môn của mình.' },
      { status: 403 }
    );
  }

  const department = db.Departments.find((d) => d.bo_mon_id === simClass.bo_mon_id);
  const rooms = db.Rooms || [];
  const equipmentList = db.Equipment || [];

  const deptHead = department?.dau_moi_user_id
    ? db.Users.find((u) => u.user_id === department.dau_moi_user_id)?.ho_ten
    : undefined;

  const leaderUser = db.Users.find((u) => u.vai_tro.includes('LANH_DAO'));
  const leaderName = leaderUser ? leaderUser.ho_ten : 'TS.BS. Nguyễn Ngọc Phương Thư';

  const html = generateSimClassEOfficeHtml({
    simClass,
    department,
    rooms,
    equipmentList,
    leaderName,
    deptHeadName: deptHead,
  });

  const download = url.searchParams.get('download') === 'true';
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  if (download) {
    headers.set('Content-Disposition', `attachment; filename="Ho_so_CECICS_${simId}.html"`);
  }

  return new Response(html, { status: 200, headers });
}
