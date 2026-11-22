import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSnapshot, runAction } from '@/lib/repository';
import { computeDashboardMetrics } from '@/core/analytics';
import type { PeriodKind } from '@/core/time';
import { generateExcelReportBuffer } from '@/lib/excel-export';
import { sendDepartmentReportEmail } from '@/lib/mailer';
import { ROLES } from '@/core/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
  }

  const isCoordinator =
    user.vai_tro.includes(ROLES.ADMIN) ||
    user.vai_tro.includes(ROLES.LANH_DAO) ||
    user.vai_tro.includes(ROLES.TRUONG_DON_VI) ||
    user.vai_tro.includes(ROLES.HANH_CHINH) ||
    user.vai_tro.includes(ROLES.DAO_TAO);

  if (!isCoordinator) {
    return NextResponse.json(
      { ok: false, error: 'Chỉ Quản trị viên hoặc Điều phối viên CECICS mới có quyền gửi báo cáo hàng loạt.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const departmentIds: string[] = body.department_ids || [];
    const periodKind = (body.periodKind || 'month') as PeriodKind;
    const year = Number(body.year || new Date().getFullYear());
    const periodIndex = Number(body.periodIndex || new Date().getMonth() + 1);
    const campus = body.campus || 'ALL';

    if (!departmentIds.length) {
      return NextResponse.json(
        { ok: false, error: 'Vui lòng chọn ít nhất một Bộ môn để gửi báo cáo.' },
        { status: 400 }
      );
    }

    const db = await getSnapshot();
    const metrics = computeDashboardMetrics(db, {
      periodKind,
      year,
      periodIndex,
      campusId: campus,
      now: new Date(),
    });

    const campusRecord = db.Campuses.find((c) => c.campus_id === campus);
    const campusName = campusRecord ? campusRecord.ten : 'Cả 2 cơ sở (Hòa Hưng & Tân Nhật)';
    const periodKey = `${year}-${String(periodIndex).padStart(2, '0')}`;

    const hostHeader = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${hostHeader}`;
    const webReviewUrl = `${baseUrl}/thong-ke-gio?kind=${periodKind}&year=${year}&index=${periodIndex}&campus=${campus}`;

    const results: { department_id: string; department_name: string; email: string; success: boolean; error?: string }[] = [];
    let sentCount = 0;

    for (const deptId of departmentIds) {
      const dept = db.Departments.find((d) => d.bo_mon_id === deptId);
      const departmentName = dept ? dept.ten : deptId;

      // Tìm email Đầu mối Bộ môn
      let recipientEmail = '';
      if (dept?.dau_moi_user_id) {
        const liaison = db.Users.find((u) => u.user_id === dept.dau_moi_user_id);
        if (liaison?.email) recipientEmail = liaison.email;
      }

      // Nếu chưa có email đầu mối, tìm bất kỳ giảng viên thuộc bộ môn đó hoặc fallback
      if (!recipientEmail) {
        const anyLec = db.Users.find((u) => u.bo_mon_id === deptId && u.email);
        if (anyLec?.email) recipientEmail = anyLec.email;
        else recipientEmail = 'cecics@pnt.edu.vn'; // Fallback an toàn về hòm thư trung tâm
      }

      const lock = db.VerificationLocks?.find(
        (l) => l.period_key === periodKey && l.entity_id === deptId
      );

      const excelBuffer = await generateExcelReportBuffer({
        metrics,
        campusName,
        departmentName,
        departmentId: deptId,
        layer1Lock: lock
          ? { locked: lock.layer1_locked, by: lock.layer1_by, at: lock.layer1_at }
          : undefined,
        layer2Lock: lock
          ? { locked: lock.layer2_locked, by: lock.layer2_by, at: lock.layer2_at }
          : undefined,
      });

      const filename = `CECICS_BaoCao_${deptId}_${periodKind}_${year}_${periodIndex}.xlsx`;

      const sendResult = await sendDepartmentReportEmail({
        to: recipientEmail,
        departmentName,
        periodLabel: metrics.period.label,
        excelBuffer,
        filename,
        webReviewUrl: `${webReviewUrl}&departmentId=${deptId}`,
      });

      if (sendResult.ok) {
        sentCount++;
        // Cập nhật email_sent_at vào VerificationLocks
        const lockId = `vl_${periodKey}_${deptId}`;
        try {
          await runAction(
            'updateVerificationLock',
            {
              lock_id: lockId,
              period_key: periodKey,
              entity_type: 'BO_MON',
              entity_id: deptId,
              email_sent_at: new Date().toISOString(),
            },
            user.email
          );
        } catch {
          // Ignored
        }

        results.push({
          department_id: deptId,
          department_name: departmentName,
          email: recipientEmail,
          success: true,
        });
      } else {
        results.push({
          department_id: deptId,
          department_name: departmentName,
          email: recipientEmail,
          success: false,
          error: sendResult.error,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      totalRequested: departmentIds.length,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
