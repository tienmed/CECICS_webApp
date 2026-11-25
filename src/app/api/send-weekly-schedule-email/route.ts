import { NextResponse } from 'next/server';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { getSnapshot } from '@/lib/repository';
import { sendNotificationEmail } from '@/lib/mailer';
import { buildWeeklyScheduleEmailHtml, type WeeklyScheduleItem } from '@/lib/weekly-schedule-email';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let user = await getCurrentUser();
  if (!user && isDemoModeEnabled()) {
    const db = await getSnapshot();
    user = db.Users[0] || null;
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Vui lòng đăng nhập để gửi email lịch tuần.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const weekNumber = Number(body.weekNumber || 12);
    const startDate = String(body.startDate || '23/11/2026');
    const endDate = String(body.endDate || '29/11/2026');
    const recipientEmail = String(body.to || user.email || 'cecics@pnt.edu.vn');
    const items: WeeklyScheduleItem[] = body.items || [];

    // Nếu không truyền items, đọc từ sample tuần 12
    let finalItems = items;
    if (!finalItems || finalItems.length === 0) {
      finalItems = [
        {
          thu: 'THỨ 2',
          ngay: '23/11/2026',
          buoi: 'SÁNG',
          gio: '7g30 - 11g30',
          nhom_lop: 'Y5, RHM3, YVĐ4',
          phong: 'Phòng thực hành kỹ năng',
          noi_dung: 'SOI ĐÁY MẮT TRỰC TIẾP',
          giang_vien: 'BM MẮT',
          chuan_bi: 'Mô hình soi đáy mắt mô phỏng có kèm các hình chụp soi đáy mắt',
          ktv: 'THƯ B',
        },
        {
          thu: 'THỨ 2',
          ngay: '23/11/2026',
          buoi: 'CHIỀU',
          gio: '13g30 - 16g30',
          nhom_lop: 'SĐH',
          phong: 'Cơ sở Hòa Hưng',
          noi_dung: 'NỘI SOI PHẾ QUẢN ỐNG MỀM',
          giang_vien: 'BM NỘI TỔNG QUÁT',
          chuan_bi: 'Mô hình nội soi phế quản ống mềm',
          ktv: 'CƯỜNG',
        },
        {
          thu: 'THỨ 3',
          ngay: '24/11/2026',
          buoi: 'SÁNG',
          gio: '',
          nhom_lop: '',
          phong: '',
          noi_dung: 'NGHỈ LỄ NGÀY VĂN HÓA VIỆT NAM',
          giang_vien: '',
          chuan_bi: '',
          ktv: '',
        },
        {
          thu: 'THỨ 4',
          ngay: '25/11/2026',
          buoi: 'SÁNG',
          gio: '7g30 - 11g30',
          nhom_lop: 'Y5, RHM3, YVĐ4',
          phong: 'Phòng thực hành kỹ năng',
          noi_dung: 'SOI ĐÁY MẮT TRỰC TIẾP',
          giang_vien: 'BM MẮT',
          chuan_bi: 'Mô hình soi đáy mắt mô phỏng có kèm các hình chụp soi đáy mắt',
          ktv: 'THƯ B',
        },
        {
          thu: 'THỨ 4',
          ngay: '25/11/2026',
          buoi: 'CHIỀU',
          gio: '13g30 - 16g30',
          nhom_lop: 'SĐH',
          phong: 'Cơ sở Hòa Hưng',
          noi_dung: 'NỘI SOI PHẾ QUẢN ỐNG MỀM',
          giang_vien: 'BM NỘI TỔNG QUÁT',
          chuan_bi: 'Mô hình nội soi phế quản ống mềm',
          ktv: 'PHÁP',
        },
        {
          thu: 'THỨ 4',
          ngay: '25/11/2026',
          buoi: 'CHIỀU',
          gio: '14g00',
          nhom_lop: 'Toàn thể nhân sự',
          phong: 'Phòng họp lầu 5, khu D cơ sở Tân Nhựt',
          noi_dung: 'HỌP GIAO BAN TRUNG TÂM',
          giang_vien: 'LÃNH ĐẠO TRUNG TÂM',
          chuan_bi: 'Báo cáo hoạt động tuần',
          ktv: '',
        },
        {
          thu: 'THỨ 5',
          ngay: '26/11/2026',
          buoi: 'CHIỀU',
          gio: '13g00 - 16g50',
          nhom_lop: 'XNYH2025',
          phong: 'Phòng D910 trụ sở Tân Nhựt',
          noi_dung: 'Vàng da - Viêm gan siêu vi',
          giang_vien: 'ThS. BS. CKII. Bùi Phan Quỳnh Phương',
          chuan_bi: '',
          ktv: '',
        },
        {
          thu: 'THỨ 5',
          ngay: '26/11/2026',
          buoi: 'CHIỀU',
          gio: '13g30 - 16g30',
          nhom_lop: 'SĐH',
          phong: 'Cơ sở Hòa Hưng',
          noi_dung: 'NỘI SOI PHẾ QUẢN ỐNG MỀM',
          giang_vien: 'BM NỘI TỔNG QUÁT',
          chuan_bi: 'Mô hình nội soi phế quản ống mềm',
          ktv: 'NHÂN',
        },
        {
          thu: 'THỨ 6',
          ngay: '27/11/2026',
          buoi: 'CHIỀU',
          gio: '13g30 - 16g30',
          nhom_lop: 'SĐH',
          phong: 'Cơ sở Hòa Hưng',
          noi_dung: 'NỘI SOI PHẾ QUẢN ỐNG MỀM',
          giang_vien: 'BM NỘI TỔNG QUÁT',
          chuan_bi: 'Mô hình nội soi phế quản ống mềm',
          ktv: 'TẢI',
        },
        {
          thu: 'THỨ 6',
          ngay: '27/11/2026',
          buoi: 'CHIỀU',
          gio: '13g30 - 16g50',
          nhom_lop: 'ThS. ĐD',
          phong: 'P.302 lầu 3, khu A2, cơ sở Hòa Hưng',
          noi_dung: 'Khám mạch máu',
          giang_vien: 'BS. CKII. Trịnh Trung Tiến',
          chuan_bi: '',
          ktv: '',
        },
      ];
    }

    const host = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const pdfPrintUrl = `${host}/api/export-weekly-schedule-pdf?week=${weekNumber}&print=true`;
    const pdfDownloadUrl = `${host}/api/export-weekly-schedule-pdf?week=${weekNumber}&download=true`;

    const htmlBody = buildWeeklyScheduleEmailHtml({
      weekNumber,
      startDate,
      endDate,
      items: finalItems,
      preparedBy: 'Phạm Nguyễn Tường Vân',
      leaderBy: 'TS.BS. Nguyễn Ngọc Phương Thư',
      pdfPrintUrl,
      pdfDownloadUrl,
      webAppUrl: host,
    });

    // Tìm file PDF đính kèm nếu có
    const schedulesDir = path.join(process.cwd(), 'public', 'schedules');
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (fs.existsSync(schedulesDir)) {
      const files = fs.readdirSync(schedulesDir);
      const pdfFile = files.find((f) => f.startsWith(`Lich_Tuan_${weekNumber}_`) && f.endsWith('.pdf'));
      if (pdfFile) {
        const fullPath = path.join(schedulesDir, pdfFile);
        attachments.push({
          filename: pdfFile,
          content: fs.readFileSync(fullPath),
          contentType: 'application/pdf',
        });
      }
    }

    const subject = `Lịch Hoạt Động Tuần ${weekNumber} (${startDate} - ${endDate}) - Bản Ký Lưu Trữ`;

    const sendRes = await sendNotificationEmail({
      to: recipientEmail,
      subject,
      htmlBody,
      attachments,
    });

    return NextResponse.json({
      ok: sendRes.ok,
      messageId: sendRes.messageId,
      error: sendRes.error,
      movedToTrash: sendRes.movedToTrash,
      previewHtml: htmlBody,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Lỗi xử lý gửi email.' }, { status: 500 });
  }
}

