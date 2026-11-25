import { sendNotificationEmail } from '../src/lib/mailer';
import fs from 'fs';
import path from 'path';

async function main() {
  const htmlPath = path.join(process.cwd(), 'public', 'schedules', 'email_preview_tuan_12.html');
  const pdfPath = path.join(process.cwd(), 'public', 'schedules', 'Lich_Tuan_12_20261123_20261129.pdf');

  if (!fs.existsSync(htmlPath)) {
    throw new Error('Không tìm thấy file preview html: ' + htmlPath);
  }
  if (!fs.existsSync(pdfPath)) {
    throw new Error('Không tìm thấy file pdf: ' + pdfPath);
  }

  const htmlBody = fs.readFileSync(htmlPath, 'utf-8');
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Danh sách người nhận chính thức tại CECICS:
  // 1. cecics@pnt.edu.vn (Hòm thư chung Trung tâm CECICS)
  // 2. thunnp@pnt.edu.vn (TS.BS. Nguyễn Ngọc Phương Thư - Trưởng Trung tâm)
  // 3. bstien@pnt.edu.vn (BS.CKII. Trịnh Trung Tiến - Điều phối / Kỹ thuật)
  const recipients = ['cecics@pnt.edu.vn', 'thunnp@pnt.edu.vn', 'bstien@pnt.edu.vn'];
  const toHeader = recipients.join(', ');

  const subject = 'LỊCH HOẠT ĐỘNG TUẦN 12 TẠI CECICS (23/11/2026 - 29/11/2026) - BẢN KÝ LƯU TRỮ';

  console.log(`Đang gửi email chính thức tới: ${toHeader}...`);

  const result = await sendNotificationEmail({
    to: toHeader,
    subject,
    htmlBody,
    attachments: [
      {
        filename: 'Lich_Tuan_12_20261123_20261129.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
    keepInSent: true, // Giữ trong Sent để Thư ký / Nhân sự tiện theo dõi
  });

  if (result.ok) {
    console.log('✅ GỬI EMAIL THÀNH CÔNG!');
    console.log('Message ID:', result.messageId);
    console.log('Danh sách nhận:', recipients);
  } else {
    console.error('❌ GỬI EMAIL THẤT BẠI:', result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi ngoại lệ:', err);
  process.exit(1);
});
