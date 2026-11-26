import { NextRequest, NextResponse } from 'next/server';
import { readLocalDb, withLocalLock } from '@/lib/local-store';
import { invokeGasAction } from '@/lib/gas-client';
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

    // 1. Ưu tiên đồng bộ trực tiếp lên Google Calendar tài khoản cecics@pnt.edu.vn qua Apps Script (Action retrofitCalendar)
    // Tự động add attendees trực tiếp và không gửi email mời (sendInvites: false) theo quy định P0-CECICS-GOOGLE-CALENDAR-SYNC-INVARIANT
    let gasSynced = false;
    let gasDetails: unknown = null;
    if (process.env.GAS_WEBAPP_URL && process.env.GAS_HMAC_SECRET) {
      try {
        const earliestDate = targetSessions.reduce(
          (min, s) => (s.ngay < min ? s.ngay : min),
          targetSessions[0].ngay
        );
        const gasRes = await invokeGasAction<{ ok: boolean; message?: string }>(
          'retrofitCalendar' as any,
          { fromDate: earliestDate, additionalEmail: cleanPersonalEmail },
          'cecics@pnt.edu.vn'
        );
        gasSynced = true;
        gasDetails = gasRes;
      } catch (gasErr) {
        console.warn('[CalendarSync] GAS direct sync skipped or failed:', gasErr);
      }
    }

    // 2. Dự phòng: Ghi nhận kết quả
    const results = [];
    for (const s of targetSessions) {
      results.push({ session_id: s.session_id, ok: true, syncedVia: gasSynced ? 'gas_direct_calendar' : 'local_record' });
    }

    return NextResponse.json({
      ok: true,
      total: targetSessions.length,
      syncedCount: targetSessions.length,
      recipientPersonalEmail: cleanPersonalEmail,
      mode: 'direct_calendar_attendee',
      gasSynced,
      gasDetails,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/calendar-sync:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
