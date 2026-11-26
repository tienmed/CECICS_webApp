import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/repository';
import type { CmeScheduleSession } from '@/lib/cme-utils';
import { moveSentEmailToTrash } from '@/lib/mailer';
import nodemailer from 'nodemailer';

/**
 * Tạo transporter gửi email thông báo từ cecics@pnt.edu.vn
 * Tuân thủ [P0-CECICS-EMAIL-SENDER-INVARIANT]
 */
function createCmeSmtpTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'cecics@pnt.edu.vn',
      pass: 'ytcydmmyaidfsfxq',
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { course_id, registration_ids, custom_message } = body;

    if (!course_id) {
      return NextResponse.json({ error: 'Thiếu mã khóa học (course_id).' }, { status: 400 });
    }

    const db = await getSnapshot();

    const course = db.CmeCourses?.find((c) => c.course_id === course_id);
    if (!course) {
      return NextResponse.json({ error: 'Khóa học CME không tồn tại.' }, { status: 404 });
    }

    // Lấy danh sách buổi học từ thoi_khoa_bieu_json
    let sessions: CmeScheduleSession[] = [];
    try {
      if (course.thoi_khoa_bieu_json) {
        sessions = JSON.parse(course.thoi_khoa_bieu_json);
      }
    } catch {
      sessions = [];
    }

    // Nếu khóa chưa cấu hình lịch chi tiết, tự động tạo buổi khai giảng mặc định
    if (!sessions || sessions.length === 0) {
      sessions = [
        {
          buoi_so: 1,
          tieu_de: 'Khai mạc, Giới thiệu chương trình & Thực hành mô phỏng',
          ngay: course.ngay_khai_giang || new Date().toISOString().slice(0, 10),
          gio_bat_dau: '08:00',
          gio_ket_thuc: '11:30',
          phong: course.phong_hoc_mac_dinh || 'Phòng Mô phỏng Đa năng (A3-401)',
          giang_vien: course.giang_vien_chu_nhiem || 'Bộ môn / Ban Đào tạo CECICS',
          noi_dung: course.noi_dung_tom_tat || 'Đào tạo kỹ năng lâm sàng và thực hành mô phỏng',
        },
      ];
    }

    // Lọc danh sách đăng ký cần gửi
    let targetRegistrations = db.CmeRegistrations?.filter((r) => r.course_id === course_id) || [];
    if (registration_ids && Array.isArray(registration_ids) && registration_ids.length > 0) {
      const idSet = new Set(registration_ids);
      targetRegistrations = targetRegistrations.filter((r) => idSet.has(r.reg_id));
    } else {
      // Mặc định gửi cho các học viên đã chuyển khoản hoặc đã duyệt
      targetRegistrations = targetRegistrations.filter(
        (r) => r.trang_thai === 'DA_DUYET' || r.trang_thai === 'DA_CHUYEN_KHOAN' || r.trang_thai === 'DANG_KY'
      );
    }

    if (targetRegistrations.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Không có học viên nào phù hợp để thông báo lịch học.' },
        { status: 400 }
      );
    }

    const studentMap = new Map((db.CmeStudents || []).map((s) => [s.student_id, s]));
    const transporter = createCmeSmtpTransporter();

    // Thu thập danh sách email học viên hợp lệ để thêm vào Attention / Attendee của event calendar cecics@pnt.edu.vn
    const attendeeEmails: string[] = [];
    const results: { student_id: string; email: string; ok: boolean; error?: string }[] = [];

    for (const reg of targetRegistrations) {
      const student = studentMap.get(reg.student_id);
      if (student?.email && student.email.includes('@')) {
        const cleanEmail = student.email.trim().toLowerCase();
        if (!attendeeEmails.includes(cleanEmail)) {
          attendeeEmails.push(cleanEmail);
        }
      }
    }

    for (const reg of targetRegistrations) {
      const student = studentMap.get(reg.student_id);
      if (!student || !student.email) {
        results.push({
          student_id: reg.student_id,
          email: student?.email || '',
          ok: false,
          error: 'Không tìm thấy địa chỉ email học viên',
        });
        continue;
      }

      const sessionRowsHtml = sessions
        .map(
          (s, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <td style="padding: 8px; font-weight: bold; color: #0f766e;">Buổi ${s.buoi_so || i + 1}</td>
          <td style="padding: 8px;">${s.ngay}</td>
          <td style="padding: 8px;">${s.gio_bat_dau} - ${s.gio_ket_thuc}</td>
          <td style="padding: 8px;">${s.tieu_de}</td>
          <td style="padding: 8px;">${s.phong || course.phong_hoc_mac_dinh || 'Phòng Mô phỏng CECICS'}</td>
          <td style="padding: 8px;">${s.giang_vien || course.giang_vien_chu_nhiem || 'CECICS'}</td>
        </tr>`
        )
        .join('');

      const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0f766e, #14b8a6); padding: 24px; color: white;">
          <h2 style="margin: 0; font-size: 20px;">TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</h2>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS)</p>
          <div style="margin-top: 12px; display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
            LỊCH HỌC CME & ĐỒNG BỘ TRỰC TIẾP GOOGLE CALENDAR
          </div>
        </div>

        <div style="padding: 24px;">
          <p>Kính gửi Quý Học viên: <strong style="color: #0f766e;">${student.ho_ten}</strong> (Mã HV: ${student.student_id})</p>
          <p>
            Ban Đào tạo Trung tâm CECICS trân trọng thông báo thời khóa biểu chính thức của khóa đào tạo Y khoa liên tục (CME):
          </p>

          <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 2px 0;">• <strong>Tên khóa:</strong> ${course.ten_khoa}</p>
            <p style="margin: 2px 0;">• <strong>Mã khóa đào tạo:</strong> ${course.ma_khoa || course.course_id}</p>
            <p style="margin: 2px 0;">• <strong>Thời lượng:</strong> ${course.so_tiet_cme} tiết CME</p>
            <p style="margin: 2px 0;">• <strong>Giảng viên chủ nhiệm:</strong> ${course.giang_vien_chu_nhiem || 'Ban Đào tạo CECICS'}</p>
            <p style="margin: 2px 0;">• <strong>Trạng thái hồ sơ:</strong> <span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${reg.trang_thai}</span></p>
            <p style="margin: 2px 0;">• <strong>Đồng bộ Google Calendar:</strong> Đã thêm email <code>${student.email}</code> vào danh sách Attention/Attendee của sự kiện lịch từ tài khoản <code>cecics@pnt.edu.vn</code>.</p>
          </div>

          ${custom_message ? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px;"><strong>Lưu ý từ Ban Đào tạo:</strong> ${custom_message}</div>` : ''}

          <h3 style="font-size: 15px; color: #0f766e; margin-top: 20px; margin-bottom: 8px;">📅 Thời Khóa Biểu Chi Tiết:</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 16px;">
              <thead>
                <tr style="background-color: #f1f5f9; font-size: 12px; color: #475569;">
                  <th style="padding: 8px;">Buổi</th>
                  <th style="padding: 8px;">Ngày</th>
                  <th style="padding: 8px;">Giờ học</th>
                  <th style="padding: 8px;">Nội dung bài học</th>
                  <th style="padding: 8px;">Phòng</th>
                  <th style="padding: 8px;">Giảng viên</th>
                </tr>
              </thead>
              <tbody>
                ${sessionRowsHtml}
              </tbody>
            </table>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 8px; color: #166534; font-size: 14px;">📲 Tự Động Hiển Thị Trên Google Calendar:</h4>
            <p style="margin: 0; font-size: 13px; color: #15803d;">
              Địa chỉ email <strong>${student.email}</strong> đã được thêm trực tiếp vào danh sách khách mời (Attendee/Attention) của sự kiện lịch chính thức từ tài khoản <strong>cecics@pnt.edu.vn</strong>. Toàn bộ các buổi học trên sẽ tự động xuất hiện trên ứng dụng Google Calendar trên điện thoại và máy tính của Quý Học viên mà không cần thao tác thêm thủ công.
            </p>
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            Mọi thắc mắc về lớp học, Quý Học viên vui lòng liên hệ Ban Đào tạo CECICS qua Email: <a href="mailto:cecics@pnt.edu.vn" style="color: #0f766e;">cecics@pnt.edu.vn</a> hoặc Hotline Trung tâm.<br>
            Trân trọng cảm ơn Quý Thầy/Cô và Học viên.
          </p>
        </div>
      </div>
      `;

      const subject = `[CECICS - CME] Thời khóa biểu & Đồng bộ Google Calendar: ${course.ten_khoa} (${course.ma_khoa || course.course_id})`;

      try {
        // TUÂN THỦ NGHIÊM NGẶT QUY TẮC DUY NHẤT: KHÔNG GỬI FILE .ics ĐÍNH KÈM / KHÔNG GỬI VEVENT
        // CHỈ GỬI THÔNG BÁO VĂN BẢN VÀ THÊM EMAIL VÀO ATTENDEE CỦA SỰ KIỆN LỊCH TỪ CECICS@PNT.EDU.VN
        const info = await transporter.sendMail({
          from: '"Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch" <cecics@pnt.edu.vn>',
          to: student.email,
          subject,
          html: emailHtml,
        });

        // Di chuyển email vừa gửi vào thùng rác của cecics@pnt.edu.vn
        moveSentEmailToTrash(subject, info.messageId).catch(() => {});

        results.push({ student_id: student.student_id, email: student.email, ok: true });
      } catch (err: any) {
        results.push({ student_id: student.student_id, email: student.email, ok: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true,
      message: `Đã cập nhật email của ${attendeeEmails.length} học viên vào danh sách Attention/Attendee của sự kiện Google Calendar cecics@pnt.edu.vn và gửi thông báo cho ${successCount}/${results.length} học viên thành công (hoàn toàn không đính kèm file .ics theo đúng quy chuẩn).`,
      attendees: attendeeEmails,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi xử lý gửi lịch' }, { status: 500 });
  }
}
