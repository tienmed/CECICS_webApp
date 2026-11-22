import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSnapshot, runAction } from '@/lib/repository';
import { ROLES } from '@/core/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const periodKey = url.searchParams.get('period_key');

  const db = await getSnapshot();
  const locks = (db.VerificationLocks || []).filter((l) =>
    periodKey ? l.period_key === periodKey : true
  );

  return NextResponse.json({ ok: true, locks });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, period_key, entity_type = 'BO_MON', entity_id, reason = '' } = body;

    if (!action || !period_key || !entity_id) {
      return NextResponse.json(
        { ok: false, error: 'Thiếu thông số bắt buộc (action, period_key, entity_id).' },
        { status: 400 }
      );
    }

    const lock_id = `vl_${period_key}_${entity_id}`;
    const nowIso = new Date().toISOString();

    const isAdmin = user.vai_tro.includes(ROLES.ADMIN);
    const isLeader = isAdmin || user.vai_tro.includes(ROLES.LANH_DAO) || user.vai_tro.includes(ROLES.TRUONG_DON_VI);
    const isDeptLiaison =
      isAdmin ||
      (user.vai_tro.includes(ROLES.DAU_MOI_BO_MON) && user.bo_mon_id === entity_id);
    const isSelfLecturer = isAdmin || user.user_id === entity_id;

    if (action === 'lock_layer1') {
      if (entity_type === 'BO_MON' && !isDeptLiaison) {
        return NextResponse.json(
          { ok: false, error: 'Chỉ Đầu mối Bộ môn hoặc Quản trị viên mới có quyền xác nhận Lớp 1.' },
          { status: 403 }
        );
      }
      if (entity_type === 'USER_CECICS' && !isSelfLecturer) {
        return NextResponse.json(
          { ok: false, error: 'Chỉ giảng viên hoặc Quản trị viên mới có quyền xác nhận giờ cá nhân.' },
          { status: 403 }
        );
      }

      const updated = await runAction(
        'updateVerificationLock',
        {
          lock_id,
          period_key,
          entity_type,
          entity_id,
          layer1_locked: true,
          layer1_by: user.ho_ten,
          layer1_at: nowIso,
          unlock_requested: false,
          unlock_reason: '',
        },
        user.email
      );

      return NextResponse.json({ ok: true, lock: updated });
    }

    if (action === 'lock_layer2') {
      if (!isLeader) {
        return NextResponse.json(
          { ok: false, error: 'Chỉ Lãnh đạo hoặc Quản trị viên CECICS mới có quyền duyệt Lớp 2.' },
          { status: 403 }
        );
      }

      const updated = await runAction(
        'updateVerificationLock',
        {
          lock_id,
          period_key,
          entity_type,
          entity_id,
          layer2_locked: true,
          layer2_by: user.ho_ten,
          layer2_at: nowIso,
        },
        user.email
      );

      return NextResponse.json({ ok: true, lock: updated });
    }

    if (action === 'request_unlock') {
      if (entity_type === 'BO_MON' && !isDeptLiaison) {
        return NextResponse.json(
          { ok: false, error: 'Chỉ Đầu mối Bộ môn hoặc Quản trị viên mới có quyền yêu cầu mở khóa.' },
          { status: 403 }
        );
      }
      if (entity_type === 'USER_CECICS' && !isSelfLecturer) {
        return NextResponse.json(
          { ok: false, error: 'Chỉ giảng viên mới có quyền yêu cầu mở khóa cá nhân.' },
          { status: 403 }
        );
      }

      // Bộ môn tự mở khóa lớp 1 của mình trước, gửi thông báo sang trung tâm
      const updated = await runAction(
        'updateVerificationLock',
        {
          lock_id,
          period_key,
          entity_type,
          entity_id,
          layer1_locked: false,
          unlock_requested: true,
          unlock_reason: String(reason || 'Bộ môn yêu cầu cập nhật điều chỉnh giờ học'),
        },
        user.email
      );

      return NextResponse.json({ ok: true, lock: updated });
    }

    if (action === 'unlock_layer2') {
      if (!isLeader) {
        return NextResponse.json(
          { ok: false, error: 'Chỉ Lãnh đạo hoặc Quản trị viên CECICS mới có quyền mở khóa Lớp 2.' },
          { status: 403 }
        );
      }

      // Mở khóa lớp 2 -> Cả 2 lớp đã mở -> hoàn tất mở khóa để cập nhật
      const updated = await runAction(
        'updateVerificationLock',
        {
          lock_id,
          period_key,
          entity_type,
          entity_id,
          layer2_locked: false,
          unlock_requested: false,
          unlock_reason: '',
        },
        user.email
      );

      return NextResponse.json({ ok: true, lock: updated });
    }

    return NextResponse.json(
      { ok: false, error: `Hành động không hỗ trợ: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
