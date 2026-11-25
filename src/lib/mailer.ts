import nodemailer from 'nodemailer';
import tls from 'tls';

export interface SendDepartmentEmailParams {
  to: string;
  departmentName: string;
  periodLabel: string;
  excelBuffer: Buffer;
  filename: string;
  webReviewUrl?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  movedToTrash?: boolean;
}

/**
 * Tạo SMTP Transporter với tài khoản cecics@pnt.edu.vn
 */
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
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Di chuyển email vừa gửi trong [Gmail]/Thư đã gửi vào [Gmail]/Thùng rác qua IMAP
 * Đúng theo chỉ đạo: "sau khi gửi mặc nhiên chuyển email này vào trash"
 */
export async function moveSentEmailToTrash(subject: string, messageId?: string): Promise<boolean> {
  const user = process.env.SMTP_USER || 'cecics@pnt.edu.vn';
  const pass = (process.env.SMTP_PASS || 'ytcydmmyaidfsfxq').replace(/\s+/g, '');

  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host: 'imap.gmail.com',
          port: 993,
          rejectUnauthorized: false,
        },
        () => {
          // Connected
        }
      );

      socket.setEncoding('utf8');
      let step = 0;
      let matchedUid = '';

      const timeout = setTimeout(() => {
        try {
          socket.end();
        } catch {}
        resolve(false);
      }, 10000);

      socket.on('data', (chunk: string) => {
        // Step 0: Initial greeting -> Login
        if (step === 0 && chunk.includes('* OK')) {
          step = 1;
          socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
        }
        // Step 1: Login success -> Select Sent folder
        else if (step === 1 && chunk.includes('a001 OK')) {
          step = 2;
          // Thư mục Thư đã gửi trong Google Workspace PNT: "[Gmail]/Th&AREA4w- g&Hu0-i" hoặc "[Gmail]/Sent Mail"
          socket.write('a002 SELECT "[Gmail]/Th&AREA4w- g&Hu0-i"\r\n');
        } else if (step === 1 && chunk.includes('a001 NO')) {
          clearTimeout(timeout);
          socket.end();
          resolve(false);
        }
        // Step 2: Select sent folder response
        else if (step === 2 && (chunk.includes('a002 OK') || chunk.includes('a002 NO'))) {
          if (chunk.includes('a002 NO')) {
            // Fallback to English name
            step = 3;
            socket.write('a002b SELECT "[Gmail]/Sent Mail"\r\n');
          } else {
            step = 4;
            // Tìm theo tiêu đề hoặc UID mới nhất
            socket.write('a003 UID SEARCH SUBJECT "[AppCECICS]"\r\n');
          }
        } else if (step === 3 && chunk.includes('a002b OK')) {
          step = 4;
          socket.write('a003 UID SEARCH SUBJECT "[AppCECICS]"\r\n');
        }
        // Step 4: Search response -> Parse UID
        else if (step === 4 && chunk.includes('* SEARCH')) {
          const parts = chunk.trim().split(/\s+/);
          const uids = parts.slice(2).filter((x) => /^\d+$/.test(x));
          if (uids.length > 0) {
            matchedUid = uids[uids.length - 1]; // Lấy email mới nhất
          }
          if (chunk.includes('a003 OK')) {
            if (matchedUid) {
              step = 5;
              // Di chuyển sang Thùng rác: "[Gmail]/Th&APk-ng r&AOE-c" hoặc "[Gmail]/Trash"
              socket.write(`a004 UID MOVE ${matchedUid} "[Gmail]/Th&APk-ng r&AOE-c"\r\n`);
            } else {
              step = 6;
              socket.write('a005 LOGOUT\r\n');
            }
          }
        }
        // Step 5: Move response
        else if (step === 5 && (chunk.includes('a004 OK') || chunk.includes('a004 NO'))) {
          if (chunk.includes('a004 NO')) {
            // Fallback move to English Trash
            step = 55;
            socket.write(`a004b UID MOVE ${matchedUid} "[Gmail]/Trash"\r\n`);
          } else {
            step = 6;
            socket.write('a005 LOGOUT\r\n');
          }
        } else if (step === 55 && chunk.includes('a004b')) {
          step = 6;
          socket.write('a005 LOGOUT\r\n');
        }
        // Step 6: Logout complete
        else if (step === 6 && chunk.includes('a005 OK')) {
          clearTimeout(timeout);
          socket.end();
          resolve(true);
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      socket.on('end', () => {
        clearTimeout(timeout);
        resolve(Boolean(matchedUid));
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Gửi email báo cáo đối soát giờ giảng cho Bộ môn kèm file Excel và link web
 */
export async function sendDepartmentReportEmail(
  params: SendDepartmentEmailParams
): Promise<SendEmailResult> {
  const { to, departmentName, periodLabel, excelBuffer, filename, webReviewUrl } = params;

  // Bắt buộc tiền tố [AppCECICS] theo quy định
  const subject = `[AppCECICS] Báo cáo Giờ giảng & Lịch sử dụng phòng CECICS - ${periodLabel} - Bộ môn ${departmentName}`;
  const from =
    process.env.SMTP_FROM || '"Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch" <cecics@pnt.edu.vn>';

  const htmlBody = `
<div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #0f766e; color: #ffffff; padding: 20px; text-align: center;">
    <h3 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px;">TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</h3>
    <h2 style="margin: 8px 0 0 0; font-size: 20px; font-weight: bold;">TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)</h2>
  </div>

  <div style="padding: 24px;">
    <p>Kính gửi: <strong>Quý Thầy/Cô Lãnh đạo & Đầu mối Bộ môn ${departmentName}</strong>,</p>

    <p>Trung tâm CECICS trân trọng gửi bảng tổng hợp số liệu <strong>Giờ giảng dạy thực hành, coi thi mô phỏng và công suất phòng học</strong> trong kỳ <strong>${periodLabel}</strong> của Quý Bộ môn.</p>

    <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 14px 18px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 6px 0; font-weight: bold; color: #0d5c75;">📌 THÔNG TIN ĐỐI SOÁT KỲ ${periodLabel.toUpperCase()}:</p>
      <ul style="margin: 0; padding-left: 20px; color: #334155;">
        <li><strong>Đơn vị:</strong> Bộ môn ${departmentName}</li>
        <li><strong>Kỳ báo cáo:</strong> ${periodLabel}</li>
        <li><strong>File đính kèm:</strong> ${filename} (Gồm 2 Sheet chuẩn Times New Roman theo NĐ 30/2020/NĐ-CP)</li>
        <li><strong>Tình trạng:</strong> Đang chờ Quý Bộ môn kiểm tra và khóa Lớp 1 (Xác nhận số liệu)</li>
      </ul>
    </div>

    <p>Quý Thầy/Cô vui lòng tải file Excel đính kèm hoặc truy cập trực tiếp vào hệ thống điều hành để đối soát chi tiết từng buổi học và bấm nút <strong>"Xác nhận & Khóa số liệu Bộ môn"</strong>:</p>

    ${
      webReviewUrl
        ? `<div style="text-align: center; margin: 25px 0;">
      <a href="${webReviewUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">👉 Truy cập Đối soát Số liệu tại WebApp CECICS</a>
    </div>`
        : ''
    }

    <p style="font-size: 13px; color: #64748b; font-style: italic;">
      * Lưu ý: Quy trình đối soát áp dụng cơ chế <strong>Khóa 2 lớp</strong>. Sau khi Bộ môn bấm xác nhận (Khóa Lớp 1), thông tin sẽ được chuyển sang Ban Giám đốc Trung tâm CECICS để đối sánh và phê duyệt khóa chính thức (Khóa Lớp 2) gửi Phòng Đào tạo & Phòng Kế hoạch Tài chính.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

    <p style="margin: 0; font-size: 13px; color: #475569;">
      <strong>Bộ phận Điều phối Đào tạo Mô phỏng Lâm sàng — CECICS</strong><br />
      Trường Đại học Y khoa Phạm Ngọc Thạch<br />
      📧 Email liên hệ: <a href="mailto:cecics@pnt.edu.vn" style="color: #0f766e;">cecics@pnt.edu.vn</a><br />
      📍 Địa chỉ: Dương Quang Trung, Phường 12, Quận 10, TP. Hồ Chí Minh
    </p>
  </div>
</div>
`;

  try {
    const transporter = createSmtpTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });

    // Sau khi gửi, tự động chuyển email này vào trash theo yêu cầu người dùng
    let movedToTrash = false;
    try {
      movedToTrash = await moveSentEmailToTrash(subject, info.messageId);
    } catch {
      // Ignored
    }

    return {
      ok: true,
      messageId: info.messageId,
      movedToTrash,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg,
    };
  }
}

/**
 * Gửi email thông báo đơn lẻ qua SMTP cecics@pnt.edu.vn
 * Luôn gắn tiền tố [AppCECICS] và chuyển vào Trash sau khi gửi
 */
export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
  keepInSent?: boolean;
}): Promise<SendEmailResult> {
  const { to, subject: rawSubject, htmlBody, attachments, keepInSent = false } = params;
  const subject = rawSubject.startsWith('[AppCECICS]') ? rawSubject : `[AppCECICS] ${rawSubject}`;
  const from =
    process.env.SMTP_FROM || '"Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch" <cecics@pnt.edu.vn>';

  try {
    const transporter = createSmtpTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: htmlBody,
      attachments,
    });

    let movedToTrash = false;
    if (!keepInSent) {
      try {
        movedToTrash = await moveSentEmailToTrash(subject, info.messageId);
      } catch {
        // Ignored
      }
    }

    return {
      ok: true,
      messageId: info.messageId,
      movedToTrash,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg,
    };
  }
}

/**
 * Mẫu Email 1: Đề nghị hoán đổi ngày dạy giữa 2 giảng viên (Bài ai nấy dạy)
 */
export function buildSwapRequestEmailHtml(params: {
  requesterName: string;
  receiverName: string;
  sessionA: { ngay: string; gio: string; hoc_phan: string; bai_giang: string; phong?: string };
  sessionB: { ngay: string; gio: string; hoc_phan: string; bai_giang: string; phong?: string };
  message?: string;
  reviewUrl: string;
}) {
  const { requesterName, receiverName, sessionA, sessionB, message, reviewUrl } = params;
  return `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #0f766e; color: #ffffff; padding: 18px 20px; text-align: center;">
    <h3 style="margin: 0; font-size: 16px;">TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</h3>
    <h2 style="margin: 6px 0 0 0; font-size: 18px;">TRUNG TÂM MÔ PHỎNG LÂM SÀNG (CECICS)</h2>
  </div>
  <div style="padding: 24px;">
    <p>Kính gửi Thầy/Cô <strong>${receiverName}</strong>,</p>
    <p>Thầy/Cô <strong>${requesterName}</strong> đã gửi đề nghị <strong>hoán đổi ngày giảng</strong> với Quý Thầy/Cô (nội dung bài giảng của mỗi người được giữ nguyên 100%):</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #0d5c75;">🔄 CHI TIẾT ĐỀ NGHỊ HOÁN ĐỔI NGÀY:</p>
      <div style="margin-bottom: 12px; padding: 10px; background-color: #ffffff; border-left: 4px solid #0f766e; border-radius: 4px;">
        <span style="font-weight: bold; color: #0f766e;">1. Ca của ${requesterName}:</span><br/>
        • Bài giảng: <strong>${sessionA.bai_giang}</strong> (${sessionA.hoc_phan})<br/>
        • Ngày giờ hiện tại: <strong>${sessionA.ngay}</strong> (${sessionA.gio})<br/>
        • <em>Đề xuất chuyển sang ngày giờ của Quý Thầy/Cô (${sessionB.ngay})</em>
      </div>
      <div style="padding: 10px; background-color: #ffffff; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <span style="font-weight: bold; color: #d97706;">2. Ca của ${receiverName} (Quý Thầy/Cô):</span><br/>
        • Bài giảng: <strong>${sessionB.bai_giang}</strong> (${sessionB.hoc_phan})<br/>
        • Ngày giờ hiện tại: <strong>${sessionB.ngay}</strong> (${sessionB.gio})<br/>
        • <em>Đề xuất chuyển sang ngày giờ của ${requesterName} (${sessionA.ngay})</em>
      </div>
    </div>

    ${message ? `<p style="font-style: italic; color: #475569; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">💬 Lời nhắn: "${message}"</p>` : ''}

    <p>Quý Thầy/Cô vui lòng truy cập hệ thống để bấm <strong>Đồng ý</strong> hoặc <strong>Từ chối</strong> yêu cầu hoán đổi:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${reviewUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">👉 Xem và Phản hồi Đổi lịch tại WebApp CECICS</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #64748b; margin: 0;">Email tự động phát từ Hệ thống Quản trị CECICS. Vui lòng không trả lời trực tiếp email này.</p>
  </div>
</div>
`;
}

/**
 * Mẫu Email 2: Kết quả phản hồi hoán đổi lịch giảng
 */
export function buildSwapResponseEmailHtml(params: {
  requesterName: string;
  responderName: string;
  sessionA: { ngay: string; gio: string; hoc_phan: string; bai_giang: string };
  sessionB: { ngay: string; gio: string; hoc_phan: string; bai_giang: string };
  decision: 'Đồng ý' | 'Từ chối';
  rejectionReason?: string;
  reviewUrl: string;
}) {
  const { requesterName, responderName, sessionA, sessionB, decision, rejectionReason, reviewUrl } = params;
  const isAccepted = decision === 'Đồng ý';
  return `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: ${isAccepted ? '#0f766e' : '#dc2626'}; color: #ffffff; padding: 18px 20px; text-align: center;">
    <h3 style="margin: 0; font-size: 16px;">TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</h3>
    <h2 style="margin: 6px 0 0 0; font-size: 18px;">TRUNG TÂM MÔ PHỎNG LÂM SÀNG (CECICS)</h2>
  </div>
  <div style="padding: 24px;">
    <p>Kính gửi Thầy/Cô <strong>${requesterName}</strong>,</p>
    <p>Thầy/Cô <strong>${responderName}</strong> đã <strong style="color: ${isAccepted ? '#0f766e' : '#dc2626'};">${decision.toUpperCase()}</strong> yêu cầu hoán đổi ngày giảng:</p>

    <div style="background-color: #f8fafc; border-left: 4px solid ${isAccepted ? '#0f766e' : '#dc2626'}; padding: 14px; margin: 18px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 6px 0; font-weight: bold;">Trạng thái: ${decision}</p>
      ${
        isAccepted
          ? `<p style="margin: 0; color: #047857;">
              ✅ <strong>Hoán đổi ngày thành công:</strong><br/>
              • Bài <em>${sessionA.bai_giang}</em> của Thầy/Cô được chuyển sang: <strong>${sessionB.ngay} (${sessionB.gio})</strong><br/>
              • Bài <em>${sessionB.bai_giang}</em> của ${responderName} được chuyển sang: <strong>${sessionA.ngay} (${sessionA.gio})</strong><br/>
              • Hệ thống và lịch cá nhân đã tự động cập nhật.
            </p>`
          : `<p style="margin: 0; color: #b91c1c;">Yêu cầu hoán đổi ngày không được đồng ý. Lịch giảng của Quý Thầy/Cô giữ nguyên ngày ban đầu (${sessionA.ngay}).</p>`
      }
      ${
        !isAccepted && rejectionReason
          ? `<div style="margin-top: 10px; padding: 10px 14px; background-color: #fee2e2; border-left: 3px solid #dc2626; border-radius: 4px;">
              <strong style="color: #991b1b; font-size: 13px;">Lý do từ chối của Thầy/Cô ${responderName}:</strong>
              <div style="color: #7f1d1d; margin-top: 4px; font-style: italic;">“${rejectionReason}”</div>
            </div>`
          : ''
      }
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${reviewUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">👉 Xem Lịch Giảng Cá Nhân tại WebApp CECICS</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #64748b; margin: 0;">Email tự động phát từ Hệ thống Quản trị CECICS.</p>
  </div>
</div>
`;
}

/**
 * Mẫu Email 3: Phê duyệt / Từ chối Lớp mô phỏng lâm sàng
 */
export function buildSimClassReviewedEmailHtml(params: {
  deptName: string;
  requesterName: string;
  simClass: { sim_id: string; ngay: string; gio_bd: string; gio_kt: string; noi_dung: string; so_hoc_vien: number; campus_id: string };
  assignedRooms: string;
  technicianName: string;
  status: string;
  notes?: string;
  reviewUrl: string;
}) {
  const { deptName, requesterName, simClass, assignedRooms, technicianName, status, notes, reviewUrl } = params;
  const isApproved = status === 'Đã duyệt';
  return `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: ${isApproved ? '#0f766e' : '#dc2626'}; color: #ffffff; padding: 18px 20px; text-align: center;">
    <h3 style="margin: 0; font-size: 16px;">TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</h3>
    <h2 style="margin: 6px 0 0 0; font-size: 18px;">TRUNG TÂM MÔ PHỎNG LÂM SÀNG (CECICS)</h2>
  </div>
  <div style="padding: 24px;">
    <p>Kính gửi Quý Thầy/Cô Đầu mối <strong>Bộ môn ${deptName}</strong>,</p>
    <p>Đơn vị Kỹ thuật CECICS đã hoàn tất rà soát yêu cầu đăng ký lớp mô phỏng mã <strong>${simClass.sim_id}</strong>:</p>

    <div style="background-color: #f8fafc; border-left: 4px solid ${isApproved ? '#0f766e' : '#dc2626'}; padding: 16px; margin: 18px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 15px; color: ${isApproved ? '#0f766e' : '#dc2626'};">
        TRẠNG THÁI: ${status.toUpperCase()}
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #334155;">
        <li><strong>Nội dung:</strong> ${simClass.noi_dung}</li>
        <li><strong>Thời gian:</strong> ${simClass.ngay} (${simClass.gio_bd}–${simClass.gio_kt})</li>
        <li><strong>Cơ sở:</strong> ${simClass.campus_id} · <strong>Số học viên:</strong> ${simClass.so_hoc_vien}</li>
        ${
          isApproved
            ? `<li><strong>Phòng mô phỏng (Đa trạm):</strong> <span style="color: #0f766e; font-weight: bold;">${assignedRooms || 'Đã phân bổ'}</span></li>
               <li><strong>Kỹ thuật viên phụ trách:</strong> <span style="font-weight: bold;">${technicianName || 'Đội Kỹ thuật CECICS'}</span></li>`
            : ''
        }
        ${notes ? `<li><strong>Ghi chú kỹ thuật:</strong> ${notes}</li>` : ''}
      </ul>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${reviewUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">👉 Xem Chi Tiết Lớp Mô Phỏng tại WebApp CECICS</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #64748b; margin: 0;">Email tự động phát từ Hệ thống Quản trị CECICS.</p>
  </div>
</div>
`;
}

/**
 * Mẫu Email 4: Hành chính nhắc nhở T-7 ngày cho Bộ môn
 */
export function buildSimClassReminderEmailHtml(params: {
  deptName: string;
  lecturerName: string;
  simClass: {
    sim_id: string;
    ngay: string;
    gio_bd: string;
    gio_kt: string;
    noi_dung: string;
    so_hoc_vien: number;
    campus_id: string;
    buoi_hoc?: string;
  };
  assignedRooms: string;
  technicianName: string;
  equipmentSummary: string;
  confirmUrl: string;
  adjustUrl: string;
}) {
  const { deptName, lecturerName, simClass, assignedRooms, technicianName, equipmentSummary, confirmUrl, adjustUrl } = params;
  return `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #0369a1; color: #ffffff; padding: 18px 20px; text-align: center;">
    <h3 style="margin: 0; font-size: 16px;">TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</h3>
    <h2 style="margin: 6px 0 0 0; font-size: 18px;">TRUNG TÂM MÔ PHỎNG LÂM SÀNG (CECICS)</h2>
    <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">THÔNG BÁO NHẮC NHỞ KẾ HOẠCH LỚP MÔ PHỎNG (MỐC T-7 NGÀY)</p>
  </div>
  <div style="padding: 24px;">
    <p>Kính gửi Quý Thầy/Cô <strong>${lecturerName || 'Đầu mối Bộ môn'}</strong> — <strong>Bộ môn ${deptName}</strong>,</p>
    <p>Hệ thống Quản trị CECICS xin nhắc lại kế hoạch lớp học mô phỏng lâm sàng sắp diễn ra theo lịch đăng ký đã được phê duyệt:</p>

    <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; margin: 18px 0; border-radius: 0 6px 6px 0;">
      <h4 style="margin: 0 0 10px 0; color: #0369a1; font-size: 15px;">📋 THÔNG TIN LỚP MÔ PHỎNG [${simClass.sim_id}]</h4>
      <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.8;">
        <li><strong>Nội dung:</strong> <span style="font-weight: bold; color: #0f172a;">${simClass.noi_dung}</span></li>
        <li><strong>Thời gian diễn ra:</strong> <span style="color: #0369a1; font-weight: bold;">${simClass.ngay} (${simClass.gio_bd}–${simClass.gio_kt})</span> · Buổi: ${simClass.buoi_hoc || 'Sáng'}</li>
        <li><strong>Cơ sở đào tạo:</strong> Cơ sở ${simClass.campus_id} · Số học viên: ${simClass.so_hoc_vien} HV</li>
        <li><strong>Phòng thực hành đã xếp:</strong> <span style="color: #047857; font-weight: bold;">${assignedRooms || 'Đã phân bổ'}</span></li>
        <li><strong>Kỹ thuật viên phụ trách:</strong> ${technicianName || 'Đội Kỹ thuật CECICS'}</li>
        ${equipmentSummary ? `<li><strong>Trang thiết bị & Mô hình:</strong> ${equipmentSummary}</li>` : ''}
      </ul>
    </div>

    <p style="margin-top: 16px;">Để Trung tâm CECICS hoàn tất công tác chuẩn bị phòng trạm, vật tư tiêu hao và cài đặt mô hình chính xác nhất, kính đề nghị Quý Thầy/Cô phản hồi xác nhận trước thời gian diễn ra:</p>

    <table style="width: 100%; margin: 24px 0; text-align: center;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding: 6px;">
          <a href="${confirmUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; width: 85%;">
            ✅ Xác Nhận Giữ Nguyên Kế Hoạch
          </a>
        </td>
        <td style="padding: 6px;">
          <a href="${adjustUrl}" style="background-color: #ea580c; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; width: 85%;">
            ✏️ Đề Xuất Điều Chỉnh / Bổ Sung
          </a>
        </td>
      </tr>
    </table>

    <div style="background-color: #fefce8; border: 1px dashed #ca8a04; padding: 12px; border-radius: 6px; font-size: 13px; color: #854d0e;">
      💡 <em>Lưu ý: Nếu Quý Thầy/Cô cần điều chỉnh số lượng học viên, dời khung giờ hoặc bổ sung mô hình, vui lòng bấm nút "Đề Xuất Điều Chỉnh" để Bộ phận Kỹ thuật kiểm tra khả năng đáp ứng phòng ốc kịp thời.</em>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #64748b; margin: 0;">Email thông báo tự động từ Hệ thống Quản trị & Vận hành Số hóa CECICS — ĐH Y khoa Phạm Ngọc Thạch.</p>
  </div>
</div>
`;
}

/**
 * Mẫu Email 5: Báo động Kỹ thuật & Hành chính khi Bộ môn yêu cầu điều chỉnh
 */
export function buildSimClassAdjustmentAlertEmailHtml(params: {
  simId: string;
  deptName: string;
  lecturerName: string;
  simContent: string;
  simDate: string;
  adjustmentNote: string;
  reviewUrl: string;
}) {
  const { simId, deptName, lecturerName, simContent, simDate, adjustmentNote, reviewUrl } = params;
  return `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #dc2626; color: #ffffff; padding: 16px 20px; text-align: center;">
    <h3 style="margin: 0; font-size: 15px;">TRUNG TÂM MÔ PHỎNG LÂM SÀNG CECICS</h3>
    <h2 style="margin: 6px 0 0 0; font-size: 18px;">⚠️ CẢNH BÁO: BỘ MÔN YÊU CẦU ĐIỀU CHỈNH KẾ HOẠCH</h2>
  </div>
  <div style="padding: 24px;">
    <p>Kính gửi <strong>Bộ phận Kỹ thuật & Bộ phận Hành chính CECICS</strong>,</p>
    <p>Thầy/Cô <strong>${lecturerName}</strong> đại diện <strong>Bộ môn ${deptName}</strong> vừa gửi phản hồi yêu cầu điều chỉnh cho lớp mô phỏng sắp diễn ra:</p>

    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 18px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #991b1b;">MÃ LỚP: ${simId} · ${simContent}</p>
      <p style="margin: 0 0 8px 0; color: #475569;"><strong>Thời gian dự kiến:</strong> ${simDate}</p>
      <div style="background-color: #ffffff; border: 1px solid #fecaca; padding: 12px; border-radius: 4px; color: #7f1d1d;">
        <strong>Nội dung yêu cầu điều chỉnh:</strong><br/>
        “${adjustmentNote || 'Bộ môn đề xuất điều chỉnh kế hoạch, vui lòng liên hệ rà soát lại.'}”
      </div>
    </div>

    <p style="color: #b91c1c; font-weight: bold;">Hành động khẩn yêu cầu:</p>
    <ul style="color: #334155;">
      <li><strong>Bộ phận Kỹ thuật:</strong> Kiểm tra lại tình trạng sẵn sàng của phòng trạm và mô hình xem có đáp ứng được yêu cầu mới không.</li>
      <li><strong>Bộ phận Hành chính:</strong> Liên hệ Thầy/Cô ${lecturerName} để thống nhất phương án điều chỉnh.</li>
    </ul>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${reviewUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">👉 Xem & Rà Soát Lớp Trên WebApp</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #64748b; margin: 0;">Email tự động phát từ Hệ thống Quản trị CECICS.</p>
  </div>
</div>
`;
}

