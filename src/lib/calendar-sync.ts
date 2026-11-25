import nodemailer from 'nodemailer';
import type { SessionRecord, UserRecord } from '@/core/types';
import { formatVnDate } from '@/core/time';
import { moveSentEmailToTrash } from './mailer';

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || 'cecics@pnt.edu.vn';
  const pass = (process.env.SMTP_PASS || 'ytcydmmyaidfsfxq').replace(/\s+/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

function formatIcsDateTime(ymd: string, hm: string): string {
  // ymd: '2026-11-23', hm: '08:00' -> '20261123T080000'
  const cleanDate = ymd.replace(/-/g, '');
  const cleanTime = (hm.replace(/:/g, '') + '00').slice(0, 6);
  return `${cleanDate}T${cleanTime}`;
}

export function generateSessionIcs(session: SessionRecord, options?: {
  lecturerName?: string;
  lecturerEmail?: string;
  personalEmail?: string;
  roomName?: string;
  campusName?: string;
  sequence?: number;
  isCancel?: boolean;
}): string {
  const dtStart = formatIcsDateTime(session.ngay, session.gio_bd);
  const dtEnd = formatIcsDateTime(session.ngay, session.gio_kt);
  const nowIso = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + 'Z';
  const uid = session.calendar_event_id
    ? `${session.calendar_event_id}@pnt.edu.vn`
    : `gcal-${session.session_id}@pnt.edu.vn`;

  const lecturerName = options?.lecturerName || session.giang_vien_id;
  const roomName = options?.roomName || session.room_id || 'Chưa gán phòng (chờ sắp xếp)';
  const campusLabel = options?.campusName || (session.campus_id === 'TN' ? 'Trụ sở chính — Tân Nhựt' : 'Cơ sở Hoà Hưng');
  const sequence = options?.sequence ?? 0;
  const method = options?.isCancel ? 'CANCEL' : 'REQUEST';
  const status = options?.isCancel ? 'CANCELLED' : 'CONFIRMED';

  const badgePrefix = session.loai === 'Coi thi' ? '[Coi thi] ' : session.loai === 'Họp' ? '[Họp CECICS] ' : '[Lịch giảng] ';
  const classLabel = session.lop ? `[${session.lop}] ` : '';
  const summary = `${badgePrefix}${classLabel}${session.bai_giang || session.hoc_phan}`;

  const descriptionLines = [
    `TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)`,
    `Trường Đại học Y khoa Phạm Ngọc Thạch`,
    `--------------------------------------------------`,
    `• Loại buổi: ${session.loai} (${session.he})`,
    `• Học phần: ${session.hoc_phan}`,
    `• Bài giảng / Nội dung: ${session.bai_giang}`,
    `• Đối tượng / Lớp: ${session.lop || 'Chưa phân lớp'}`,
    `• Giảng viên / Chủ trì: ${lecturerName}`,
    `• Cơ sở: ${campusLabel}`,
    `• Phòng học: ${roomName}`,
    `• Thời gian: ${formatVnDate(session.ngay)} (${session.gio_bd} – ${session.gio_kt})`,
    session.ghi_chu ? `• Ghi chú: ${session.ghi_chu}` : '',
    `--------------------------------------------------`,
    `Email tự động từ Hệ thống Vận hành Số hóa CECICS (http://localhost:3000)`,
  ].filter(Boolean);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//CECICS//PNTU Schedule Sync//VI',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowIso}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${descriptionLines.join('\\n')}`,
    `LOCATION:${roomName} · ${campusLabel}`,
    'ORGANIZER;CN="Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch":mailto:cecics@pnt.edu.vn',
  ];

  if (options?.lecturerEmail) {
    icsLines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="${lecturerName}":mailto:${options.lecturerEmail}`
    );
  }
  if (options?.personalEmail && options.personalEmail !== options.lecturerEmail) {
    icsLines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="${lecturerName} (Cá nhân)":mailto:${options.personalEmail}`
    );
  }

  icsLines.push(`STATUS:${status}`);
  icsLines.push(`SEQUENCE:${sequence}`);
  icsLines.push('END:VEVENT');
  icsLines.push('END:VCALENDAR');

  return icsLines.join('\r\n');
}

export async function sendCalendarEventInvite(params: {
  session: SessionRecord;
  lecturerName: string;
  lecturerEmail?: string;
  personalEmail?: string;
  roomName?: string;
  campusName?: string;
  isCancel?: boolean;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const recipients: string[] = [];
    if (params.lecturerEmail && params.lecturerEmail.includes('@')) {
      recipients.push(params.lecturerEmail);
    }
    if (params.personalEmail && params.personalEmail.includes('@') && !recipients.includes(params.personalEmail)) {
      recipients.push(params.personalEmail);
    }
    // Luôn gửi bản sao đến cecics@pnt.edu.vn để lịch TT CECICS tự động cập nhật
    if (!recipients.includes('cecics@pnt.edu.vn')) {
      recipients.push('cecics@pnt.edu.vn');
    }

    if (recipients.length === 0) {
      return { ok: false, error: 'Không tìm thấy địa chỉ email hợp lệ để gửi lịch.' };
    }

    const icsContent = generateSessionIcs(params.session, {
      lecturerName: params.lecturerName,
      lecturerEmail: params.lecturerEmail,
      personalEmail: params.personalEmail,
      roomName: params.roomName,
      campusName: params.campusName,
      isCancel: params.isCancel,
    });

    const isCancel = !!params.isCancel;
    const actionLabel = isCancel ? 'HỦY LỊCH' : 'LỊCH MỚI / CẬP NHẬT';
    const subject = `[AppCECICS Calendar] ${actionLabel}: ${params.session.bai_giang || params.session.hoc_phan} - ${formatVnDate(params.session.ngay)} (${params.session.gio_bd}–${params.session.gio_kt})`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f766e; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 18px;">TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Trường Đại học Y khoa Phạm Ngọc Thạch</p>
      </div>

      <div style="padding: 24px;">
        <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; background-color: ${isCancel ? '#fee2e2' : '#ccfbf1'}; color: ${isCancel ? '#b91c1c' : '#0f766e'}; margin-bottom: 16px;">
          ${actionLabel} TRÊN GOOGLE CALENDAR
        </div>

        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">
          ${params.session.bai_giang || params.session.hoc_phan}
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">📅 Ngày giảng:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${formatVnDate(params.session.ngay)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">⏰ Khung giờ:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${params.session.gio_bd} – ${params.session.gio_kt}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">🎓 Đối tượng / Lớp:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #0f766e;">${params.session.lop || 'Chưa phân lớp'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">📚 Học phần:</td>
            <td style="padding: 8px 0;">${params.session.hoc_phan}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">👨‍⚕️ Giảng viên:</td>
            <td style="padding: 8px 0; font-weight: bold;">${params.lecturerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">📍 Cơ sở & Phòng:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #d97706;">
              ${params.roomName || params.session.room_id || 'Chờ Hành chính gán phòng'} (${params.campusName || (params.session.campus_id === 'TN' ? 'Trụ sở chính — Tân Nhựt' : 'Cơ sở Hoà Hưng')})
            </td>
          </tr>
          ${params.session.ghi_chu ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">📝 Ghi chú:</td>
            <td style="padding: 8px 0; font-style: italic;">${params.session.ghi_chu}</td>
          </tr>` : ''}
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #334155;">
            💡 <strong>Tự động gán vào Google Calendar:</strong> Email này đính kèm tệp lời mời lịch <code>${params.session.session_id}.ics</code>. Ứng dụng Google Calendar trên điện thoại và máy tính của Thầy/Cô sẽ tự động nhận diện và cập nhật khung giờ giảng này.
          </p>
        </div>

        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Email tự động phát từ Hệ thống Quản trị & Vận hành Số hóa CECICS — ĐH Y khoa Phạm Ngọc Thạch.
        </p>
      </div>
    </div>
    `;

    const transporter = createSmtpTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch" <cecics@pnt.edu.vn>',
      to: recipients.join(', '),
      subject,
      html,
      icalEvent: {
        filename: `${params.session.session_id}.ics`,
        method: isCancel ? 'CANCEL' : 'REQUEST',
        content: icsContent,
      },
    });

    // Sau khi gửi, chuyển email này vào thùng rác của cecics@pnt.edu.vn theo chỉ đạo
    moveSentEmailToTrash(subject, info.messageId).catch(() => {});

    return { ok: true, messageId: info.messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[CalendarSync] Error sending calendar invite:', msg);
    return { ok: false, error: msg };
  }
}
