/**
 * CECICS Weekly Schedule - Email Builder & Printable PDF Helper
 * Hỗ trợ:
 * 1. Body Email Responsive hiển thị sắc nét trên cả Mobile (dạng thẻ/card) & Desktop (bảng chuẩn).
 * 2. Nút bấm một chạm "In Bản Lưu Trữ Ký Tên (PDF)" & "Tải File PDF Lịch Tuần" dành cho Thư ký / Hành chính.
 * 3. Hỗ trợ hiển thị trách nhiệm phân công Thiết bị / Mô hình và Kỹ thuật viên / Giảng viên.
 */

export interface WeeklyScheduleItem {
  thu: string;
  ngay?: string;
  buoi: string;
  gio: string;
  nhom_lop: string;
  phong: string;
  noi_dung: string;
  giang_vien: string;
  chuan_bi: string; // Thiết bị, mô hình, dụng cụ phụ trách
  ktv?: string;      // Kỹ thuật viên phụ trách
}

export interface BuildWeeklyEmailParams {
  weekNumber: number;
  startDate: string; // dd/mm/yyyy
  endDate: string;   // dd/mm/yyyy
  items: WeeklyScheduleItem[];
  preparedBy?: string;
  leaderBy?: string;
  pdfDownloadUrl?: string;
  pdfPrintUrl?: string;
  webAppUrl?: string;
}

export function buildWeeklyScheduleEmailHtml(params: BuildWeeklyEmailParams): string {
  const {
    weekNumber,
    startDate,
    endDate,
    items,
    preparedBy = 'Phạm Nguyễn Tường Vân',
    leaderBy = 'TS.BS. Nguyễn Ngọc Phương Thư',
    pdfDownloadUrl = '/api/export-weekly-schedule-pdf?download=true',
    pdfPrintUrl = '/api/export-weekly-schedule-pdf?print=true',
    webAppUrl = process.env.NEXTAUTH_URL || 'https://cecics.pnt.edu.vn',
  } = params;

  // Tính số lượng ca, lớp có thiết bị
  const totalSlots = items.length;
  const slotsWithEquip = items.filter((x) => x.chuan_bi && x.chuan_bi.trim() && x.chuan_bi !== '-').length;

  // Render các dòng cho Desktop Table
  const tableRowsDesktop = items.map((it, idx) => {
    const isHoliday = it.noi_dung.includes('NGHỈ LỄ');
    const isMeeting = it.noi_dung.includes('HỌP GIAO BAN') || it.noi_dung.includes('Họp');
    const bgColor = isHoliday ? '#fef2f2' : isMeeting ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const textColor = isHoliday ? '#b91c1c' : '#1e293b';

    return `
      <tr style="background-color: ${bgColor}; color: ${textColor}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; font-weight: bold; text-align: center; font-size: 13px; border-right: 1px solid #e2e8f0;">
          ${it.thu}<br/><span style="font-size: 11px; font-weight: normal; color: #64748b;">${it.ngay || ''}</span>
        </td>
        <td style="padding: 10px 8px; text-align: center; font-size: 12px; font-weight: 600; border-right: 1px solid #e2e8f0;">
          ${it.buoi}
        </td>
        <td style="padding: 10px 8px; text-align: center; font-size: 12px; font-family: monospace; white-space: nowrap; border-right: 1px solid #e2e8f0;">
          ${it.gio || '-'}
        </td>
        <td style="padding: 10px 8px; font-size: 13px; font-weight: 500; border-right: 1px solid #e2e8f0;">
          ${it.nhom_lop || '-'}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; border-right: 1px solid #e2e8f0;">
          ${it.phong || '<span style="color: #94a3b8; font-style: italic;">Chưa gán</span>'}
        </td>
        <td style="padding: 10px 8px; font-size: 13px; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0;">
          ${it.noi_dung}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; border-right: 1px solid #e2e8f0;">
          ${it.giang_vien || '-'}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; background-color: #f1f5f9; border-right: 1px solid #e2e8f0; color: #334155;">
          ${it.chuan_bi ? it.chuan_bi.replace(/\n/g, '<br/>') : '<span style="color: #94a3b8;">Không yêu cầu</span>'}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; font-weight: bold; text-align: center; color: #1e40af;">
          ${it.ktv || '-'}
        </td>
      </tr>
    `;
  }).join('');

  // Render các thẻ Card cho Mobile View
  const cardsMobile = items.map((it) => {
    const isHoliday = it.noi_dung.includes('NGHỈ LỄ');
    const isMeeting = it.noi_dung.includes('HỌP GIAO BAN') || it.noi_dung.includes('Họp');
    const headerBg = isHoliday ? '#fee2e2' : isMeeting ? '#dcfce7' : '#e0f2fe';
    const headerColor = isHoliday ? '#991b1b' : isMeeting ? '#166534' : '#0369a1';

    return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background-color: ${headerBg}; color: ${headerColor}; padding: 8px 12px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between;">
          <span>📅 ${it.thu} ${it.ngay ? `(${it.ngay})` : ''} - ${it.buoi}</span>
          <span style="font-family: monospace;">⏰ ${it.gio || 'Linh hoạt'}</span>
        </div>
        <div style="padding: 12px; font-size: 13px; color: #334155; line-height: 1.5;">
          <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 6px;">
            ${it.noi_dung}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Lớp/Nhóm:</strong> ${it.nhom_lop || '-'}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Phòng học:</strong> <span style="color: #047857; font-weight: 600;">${it.phong || 'Chưa gán phòng'}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Giảng viên / Chủ trì:</strong> ${it.giang_vien || '-'}
          </div>
          ${it.chuan_bi ? `
            <div style="background-color: #f8fafc; border-left: 3px solid #0284c7; padding: 6px 10px; margin-top: 8px; border-radius: 0 4px 4px 0; font-size: 12px;">
              <strong>Trang thiết bị & Vật tư mô phỏng:</strong><br/>
              ${it.chuan_bi.replace(/\n/g, '<br/>')}
            </div>
          ` : ''}
          ${it.ktv ? `
            <div style="margin-top: 6px; font-size: 12px; color: #1e40af; font-weight: 600;">
              🛠️ KTV phụ trách: ${it.ktv}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lịch Hoạt Động Tuần ${weekNumber} - Trung Tâm CECICS</title>
  <style>
    @media only screen and (max-width: 640px) {
      .desktop-table { display: none !important; }
      .mobile-cards { display: block !important; }
      .action-buttons td { display: block !important; width: 100% !important; padding: 4px 0 !important; }
      .container { padding: 12px !important; }
    }
    @media only screen and (min-width: 641px) {
      .desktop-table { display: table !important; }
      .mobile-cards { display: none !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 980px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    
    <!-- Banner Header -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%); color: #ffffff; padding: 24px 20px; text-align: center;">
      <div style="font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; opacity: 0.9; margin-bottom: 4px;">
        TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH
      </div>
      <div style="font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; opacity: 0.85;">
        TRUNG TÂM MÔ PHỎNG & SÁNG TẠO LÂM SÀNG (CECICS)
      </div>
      <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
        LỊCH HOẠT ĐỘNG TUẦN ${weekNumber} TẠI CECICS
      </h1>
      <div style="font-size: 14px; font-style: italic; opacity: 0.95;">
        (Từ ngày ${startDate} đến ngày ${endDate})
      </div>
    </div>

    <div class="container" style="padding: 24px;">

      <!-- Thanh Thao Tác Dành Cho Thư Ký / Hành Chính & Lãnh Đạo -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 14px; font-weight: bold; color: #0f172a;">
              📌 Thống Kê Vận Hành Tuần:
            </div>
            <div style="font-size: 13px; color: #475569; margin-top: 2px;">
              Tổng cộng <strong>${totalSlots}</strong> buổi hoạt động · <strong>${slotsWithEquip}</strong> phiên có điều phối trang thiết bị mô phỏng.
            </div>
          </div>
          
          <!-- Các nút hành động chính -->
          <table class="action-buttons" cellpadding="0" cellspacing="0" style="margin: 0;">
            <tr>
              <td style="padding-right: 8px;">
                <a href="${pdfPrintUrl}" target="_blank" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 10px 18px; border-radius: 6px; box-shadow: 0 2px 4px rgba(30,58,138,0.25);">
                  🖨️ In Bản Ký Lưu (PDF)
                </a>
              </td>
              <td style="padding-right: 8px;">
                <a href="${pdfDownloadUrl}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 10px 16px; border-radius: 6px;">
                  ⬇️ Tải File PDF
                </a>
              </td>
              <td>
                <a href="${webAppUrl}/lich-giang" target="_blank" style="display: inline-block; background-color: #ffffff; border: 1px solid #cbd5e1; color: #334155; text-decoration: none; font-size: 13px; font-weight: 600; padding: 9px 14px; border-radius: 6px;">
                  🌐 Xem Trên App
                </a>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="margin-top: 10px; font-size: 12px; color: #64748b; font-style: italic;">
          * Ghi chú cho Hành chính / Thư ký: Bấm nút <strong>"In Bản Ký Lưu (PDF)"</strong> để mở trực tiếp hộp thoại in ấn khổ ngang A4 có sẵn định dạng thể thức văn bản ký tên trình Lãnh đạo.
        </div>
      </div>

      <!-- DESKTOP VIEW: Bảng Lịch Hoạt Động Đầy Đủ -->
      <table class="desktop-table" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #cbd5e1; font-size: 13px;" cellpadding="0" cellspacing="0">
        <thead>
          <tr style="background-color: #f1f5f9; color: #1e293b; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 10%;">THỨ</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 6%;">BUỔI</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 10%;">GIỜ</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 13%;">NHÓM - LỚP</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 14%;">PHÒNG</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 18%;">NỘI DUNG</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 13%;">GIẢNG VIÊN</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; width: 11%;">CHUẨN BỊ THIẾT BỊ</th>
            <th style="padding: 10px 6px; border-bottom: 2px solid #cbd5e1; width: 5%;">KTV</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsDesktop}
        </tbody>
      </table>

      <!-- MOBILE VIEW: Hiển thị Thẻ Dọc Responsive -->
      <div class="mobile-cards">
        ${cardsMobile}
      </div>

      <!-- Phần Ký Tên Trách Nhiệm -->
      <div style="margin-top: 30px; padding-top: 16px; border-top: 2px dashed #e2e8f0;">
        <table style="width: 100%; border: none;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              <div style="font-weight: bold; text-transform: uppercase; font-size: 13px; color: #334155;">
                NGƯỜI LẬP BẢNG
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">(Thư ký Hành chính)</div>
              <div style="font-weight: bold; font-size: 14px; color: #0f172a; margin-top: 50px;">
                ${preparedBy}
              </div>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              <div style="font-weight: bold; text-transform: uppercase; font-size: 13px; color: #334155;">
                TRƯỞNG TRUNG TÂM
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">(Phê duyệt & Ký lưu)</div>
              <div style="font-weight: bold; font-size: 14px; color: #0f172a; margin-top: 50px;">
                ${leaderBy}
              </div>
            </td>
          </tr>
        </table>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; font-size: 12px; color: #64748b; text-align: center;">
      Email gửi tự động từ <strong>Hệ thống Quản trị & Vận hành Số hóa CECICS</strong> — Trường Đại học Y khoa Phạm Ngọc Thạch.<br/>
      Nếu cần điều chỉnh khẩn cấp lịch giảng hoặc trang thiết bị mô phỏng, vui lòng liên hệ bộ phận Điều phối qua Hotline/Zalo nội bộ.
    </div>

  </div>
</body>
</html>
  `;
}
