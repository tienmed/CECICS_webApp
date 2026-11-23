import { executeAction, type ActionName } from '@/core/mutations';
import type { DatabaseSnapshot, SwapRequestRecord, UserRecord } from '@/core/types';
import { readLocalDb, withLocalLock } from './local-store';
import { invalidateSheetsCache, readAllFromSheets } from './sheets';
import { invokeGasAction } from './gas-client';
import { sendCalendarEventInvite } from './calendar-sync';
import { buildSwapRequestEmailHtml, buildSwapResponseEmailHtml, sendNotificationEmail } from './mailer';
import { formatVnDate } from '@/core/time';

export function getDataMode(): 'sheets' | 'local' {
  if (process.env.DATA_MODE === 'sheets' && process.env.GOOGLE_SHEETS_ID) {
    return 'sheets';
  }
  return 'local';
}

export async function getSnapshot(bypassCache = false): Promise<DatabaseSnapshot> {
  if (getDataMode() === 'sheets') {
    try {
      return await readAllFromSheets(bypassCache);
    } catch (err) {
      console.error('[getSnapshot] Lỗi kết nối Google Sheets API, tự động dự phòng sang Local Store:', err);
      return readLocalDb();
    }
  }
  return readLocalDb();
}

export async function runAction<T = unknown>(
  action: ActionName,
  payload: Record<string, unknown>,
  actorEmail: string
): Promise<T> {
  if (getDataMode() === 'sheets') {
    const res = await invokeGasAction<T>(action, payload, actorEmail);
    invalidateSheetsCache();
    return res;
  }
  const result = await withLocalLock((store) => executeAction(store, action, payload, actorEmail));

  // Tự động kích hoạt thông báo và đồng bộ lịch qua email SMTP cecics@pnt.edu.vn
  try {
    const db = readLocalDb();

    // 1. Đồng bộ sang Google Calendar
    if (result.effects?.calendarSync && result.effects.calendarSync.length > 0) {
      const userMap = new Map(db.Users.map((u) => [u.user_id, u]));
      for (const item of result.effects.calendarSync) {
        const gv = userMap.get(item.session.giang_vien_id);
        const lecturerName = gv?.ho_ten || item.session.giang_vien_id;
        const personalEmail = (gv as (UserRecord & { email_ca_nhan?: string }))?.email_ca_nhan;
        sendCalendarEventInvite({
          session: item.session,
          lecturerName,
          lecturerEmail: item.lecturerEmail || gv?.email,
          personalEmail,
          roomName: item.roomName,
          isCancel: item.op === 'delete',
        }).catch((err) => console.error('[CalendarSync effect error]:', err));
      }
    }

    // 2. Gửi email thông báo khi tạo yêu cầu hoán đổi lịch
    if (action === 'createSwapRequest') {
      const swap = result.data as SwapRequestRecord;
      const requester = db.Users.find((u) => u.user_id === swap.tu_gv);
      const recipient = db.Users.find((u) => u.user_id === swap.den_gv);
      const sessionA = db.Sessions.find((s) => s.session_id === swap.session_id);
      const sessionB = swap.target_session_id
        ? db.Sessions.find((s) => s.session_id === swap.target_session_id)
        : undefined;

      if (recipient?.email && sessionA) {
        const html = buildSwapRequestEmailHtml({
          requesterName: requester?.ho_ten || swap.tu_gv,
          receiverName: recipient.ho_ten,
          sessionA: {
            ngay: formatVnDate(sessionA.ngay),
            gio: `${sessionA.gio_bd}–${sessionA.gio_kt}`,
            hoc_phan: sessionA.hoc_phan,
            bai_giang: sessionA.bai_giang,
          },
          sessionB: sessionB
            ? {
                ngay: formatVnDate(sessionB.ngay),
                gio: `${sessionB.gio_bd}–${sessionB.gio_kt}`,
                hoc_phan: sessionB.hoc_phan,
                bai_giang: sessionB.bai_giang,
              }
            : { ngay: 'N/A', gio: 'N/A', hoc_phan: 'Dạy thay', bai_giang: 'Không đổi đối ứng' },
          message: swap.loi_nhan,
          reviewUrl: 'http://localhost:3000/doi-lich',
        });

        sendNotificationEmail({
          to: recipient.email,
          subject: `[AppCECICS] Yêu cầu hoán đổi lịch giảng từ ${requester?.ho_ten || 'Đồng nghiệp'} (${swap.swap_id})`,
          htmlBody: html,
          keepInSent: false,
        }).catch((err) => console.error('[Swap Email error]:', err));
      }
    }

    // 3. Gửi email thông báo khi phản hồi yêu cầu hoán đổi lịch
    if (action === 'respondSwapRequest') {
      const swap = result.data as SwapRequestRecord;
      const requester = db.Users.find((u) => u.user_id === swap.tu_gv);
      const responder = db.Users.find((u) => u.user_id === swap.den_gv);
      const sessionA = db.Sessions.find((s) => s.session_id === swap.session_id);
      const sessionB = swap.target_session_id
        ? db.Sessions.find((s) => s.session_id === swap.target_session_id)
        : undefined;

      if (requester?.email && sessionA && (swap.trang_thai === 'Đồng ý' || swap.trang_thai === 'Từ chối')) {
        const html = buildSwapResponseEmailHtml({
          requesterName: requester.ho_ten,
          responderName: responder?.ho_ten || swap.den_gv,
          sessionA: {
            ngay: formatVnDate(sessionA.ngay),
            gio: `${sessionA.gio_bd}–${sessionA.gio_kt}`,
            hoc_phan: sessionA.hoc_phan,
            bai_giang: sessionA.bai_giang,
          },
          sessionB: sessionB
            ? {
                ngay: formatVnDate(sessionB.ngay),
                gio: `${sessionB.gio_bd}–${sessionB.gio_kt}`,
                hoc_phan: sessionB.hoc_phan,
                bai_giang: sessionB.bai_giang,
              }
            : { ngay: '', gio: '', hoc_phan: '', bai_giang: '' },
          decision: swap.trang_thai as 'Đồng ý' | 'Từ chối',
          rejectionReason: swap.ly_do_tu_choi,
          reviewUrl: 'http://localhost:3000/doi-lich',
        });

        sendNotificationEmail({
          to: requester.email,
          subject: `[AppCECICS] ${responder?.ho_ten || 'Đồng nghiệp'} đã ${swap.trang_thai.toLowerCase()} yêu cầu hoán đổi lịch (${swap.swap_id})`,
          htmlBody: html,
          keepInSent: false,
        }).catch((err) => console.error('[Swap Response Email error]:', err));
      }
    }
  } catch (err) {
    console.error('[runAction side-effects error]:', err);
  }

  return result.data as T;
}
