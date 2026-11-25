import { NextResponse } from 'next/server';
import { computeDashboardMetrics } from '@/core/analytics';
import type { PeriodKind } from '@/core/time';
import { getCurrentUser } from '@/lib/auth';
import { generateExcelReportBuffer } from '@/lib/excel-export';
import { getSnapshot } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  // Cho phép mọi người dùng đã đăng nhập vào đối soát và xuất file (theo yêu cầu người dùng)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Vui lòng đăng nhập để xuất báo cáo.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = (url.searchParams.get('kind') || 'month') as PeriodKind;
  const now = new Date();
  const year = Number(url.searchParams.get('year') || now.getFullYear());
  const index = Number(url.searchParams.get('index') || now.getMonth() + 1);
  const campus = url.searchParams.get('campus') || 'ALL';
  const departmentId = url.searchParams.get('departmentId') || 'ALL';

  const db = await getSnapshot();
  const metrics = computeDashboardMetrics(db, {
    periodKind: kind,
    year,
    periodIndex: index,
    campusId: campus,
    now,
  });

  const campusRecord = db.Campuses.find((c) => c.campus_id === campus);
  const campusName = campusRecord ? campusRecord.ten : 'Cả 2 cơ sở (Hòa Hưng & Tân Nhựt)';

  const deptRecord = db.Departments.find((d) => d.bo_mon_id === departmentId);
  const departmentName =
    departmentId === 'CECICS'
      ? 'Trung tâm CECICS'
      : deptRecord
        ? deptRecord.ten
        : departmentId !== 'ALL'
          ? departmentId
          : undefined;

  // Lấy trạng thái khóa 2 lớp từ DB nếu có
  const periodKey = `${year}-${String(index).padStart(2, '0')}`;
  const lock = db.VerificationLocks?.find(
    (l) => l.period_key === periodKey && l.entity_id === departmentId
  );

  const excelBuffer = await generateExcelReportBuffer({
    metrics,
    campusName,
    departmentName,
    departmentId,
    layer1Lock: lock
      ? { locked: lock.layer1_locked, by: lock.layer1_by, at: lock.layer1_at }
      : undefined,
    layer2Lock: lock
      ? { locked: lock.layer2_locked, by: lock.layer2_by, at: lock.layer2_at }
      : undefined,
  });

  const deptSuffix = departmentId && departmentId !== 'ALL' ? `_${departmentId}` : '';
  const filename = `CECICS_BaoCao_ThongKe_${kind}_${year}_${index}_${campus}${deptSuffix}.xlsx`;

  return new NextResponse(new Uint8Array(excelBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
