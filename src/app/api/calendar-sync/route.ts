import { NextRequest, NextResponse } from 'next/server';
import { readLocalDb, withLocalLock } from '@/lib/local-store';
import { sendCalendarEventInvite } from '@/lib/calendar-sync';
import type { SessionRecord, UserRecord } from '@/core/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lecturer_id, personal_email, session_ids } = body as {
      lecturer_id?: string;
      personal_email?: string;
      session_ids?: string[];
    };

    if (!lecturer_id && (!session_ids || session_ids.length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'Vui lòng cung cấp mã giảng viên hoặc danh sách buổi học cần đồng bộ.' },
        { status: 400 }
      );
    }

    const cleanPersonalEmail = (personal_email || '').trim().toLowerCase();
    if (cleanPersonalEmail && !cleanPersonalEmail.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Email cá nhân không đúng định dạng.' },
        { status: 400 }
      );
    }

    const db = readLocalDb();
    const userMap = new Map(db.Users.map((u) => [u.user_id, u]));
    const roomMap = new Map(db.Rooms.map((r) => [r.room_id, r]));
    const campusMap = new Map(db.Campuses.map((c) => [c.campus_id, c]));

    // Nếu có personal_email, cập nhật email_ca_nhan cho giảng viên trong db
    if (cleanPersonalEmail && lecturer_id) {
      await withLocalLock((store) => {
        const u = store.getAll().Users.find((x) => x.user_id === lecturer_id);
        if (u) {
          store.update('Users', lecturer_id, {
            email_ca_nhan: cleanPersonalEmail,
          } as Partial<UserRecord>);
        }
      });
    }

    // Lọc các buổi học cần gửi
    let targetSessions: SessionRecord[] = [];
    if (session_ids && session_ids.length > 0) {
      targetSessions = db.Sessions.filter(
        (s) => session_ids.includes(s.session_id) && s.trang_thai !== 'Đã hủy'
      );
    } else if (lecturer_id) {
      targetSessions = db.Sessions.filter(
        (s) => s.giang_vien_id === lecturer_id && s.trang_thai !== 'Đã hủy'
      );
    }

    if (targetSessions.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Không tìm thấy buổi học nào thỏa điều kiện để đồng bộ.' },
        { status: 404 }
      );
    }

    const results = [];
    for (const s of targetSessions) {
      const gv = userMap.get(s.giang_vien_id);
      const lecturerName = s.giang_vien_id === 'U-CECICS-ALL' ? 'Toàn bộ NV CECICS' : gv?.ho_ten || s.giang_vien_id;
      const primaryEmail = s.giang_vien_id === 'U-CECICS-ALL' ? 'cecics@pnt.edu.vn' : gv?.email;
      const personalEmail = cleanPersonalEmail || (gv as (UserRecord & { email_ca_nhan?: string }))?.email_ca_nhan || '';

      const rids = (s.room_id || '').split(',').map((r) => r.trim()).filter(Boolean);
      const roomName = rids.length > 0
        ? rids.map((id) => roomMap.get(id)?.ten || id).join(', ')
        : 'Chờ Hành chính gán phòng';
      const campusName = campusMap.get(s.campus_id)?.ten || (s.campus_id === 'TN' ? 'Trụ sở chính — Tân Nhựt' : 'Cơ sở Hoà Hưng');

      const res = await sendCalendarEventInvite({
        session: s,
        lecturerName,
        lecturerEmail: primaryEmail,
        personalEmail,
        roomName,
        campusName,
      });

      results.push({ session_id: s.session_id, ...res });
    }

    const successCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true,
      total: targetSessions.length,
      syncedCount: successCount,
      recipientPersonalEmail: cleanPersonalEmail,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/calendar-sync:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
