/**
 * CECICS Simulation Weekly Digest Cron Script
 * Chạy ngầm độc lập (Headless) bằng npx tsx scripts/simulation_digest_cron.ts
 * Tác vụ:
 * 1. Thu thập bài báo / tiêu chuẩn mô phỏng quốc tế (SSH, SESAM, INACSL, PubMed)
 * 2. Tóm tắt y khoa qua AI Tầng 1 (Local Engine / Fallback)
 * 3. Sinh Email HTML bản tin
 * 4. Gửi email từ cecics@pnt.edu.vn tới danh sách CBNV CECICS
 * 5. Lưu bản sao HTML/JSON vào public/digests/ và data/digests/
 */

import fs from 'fs';
import path from 'path';
import { getWeeklySimulationDigestData } from '../src/lib/simulation-crawler';
import { summarizeWeeklySimulationDigest } from '../src/lib/simulation-summarizer';
import { buildSimulationDigestEmailHtml } from '../src/lib/simulation-digest-email';
import { sendNotificationEmail } from '../src/lib/mailer';
import { getSnapshot } from '../src/lib/repository';

async function run() {
  console.log('=== [CECICS SIMULATION WEEKLY DIGEST] KHỞI ĐỘNG ===');
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const weekLabel = `Chuyên đề Tuần ${Math.ceil(now.getDate() / 7)}`;

  // 1. Thu thập bài báo & thông tin hội nghị
  console.log('1. Đang quét bài báo (PubMed, SSH, SESAM) & Hội nghị mô phỏng quốc tế...');
  const { articles: rawArticles, conferences } = await getWeeklySimulationDigestData();
  console.log(`-> Tìm thấy ${rawArticles.length} bài viết học thuật & ${conferences.length} sự kiện/báo cáo hội nghị.`);

  // 2. Tóm tắt AI Tầng 1
  console.log('2. Đang tóm tắt học thuật & xây dựng khuyến nghị cho CECICS (AI Tầng 1)...');
  const summarizedArticles = await summarizeWeeklySimulationDigest(rawArticles);

  // 3. Render HTML Email
  console.log('3. Đang render HTML Email...');
  const emailHtml = buildSimulationDigestEmailHtml({
    issueDate: dateStr,
    weekLabel: weekLabel,
    articles: summarizedArticles,
    conferences: conferences,
  });

  // 4. Lưu bản sao lưu trữ
  const outDir = path.join(process.cwd(), 'public', 'digests');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const previewPath = path.join(outDir, `simulation_digest_${now.toISOString().slice(0, 10)}.html`);
  const latestPath = path.join(outDir, 'latest_simulation_digest.html');
  fs.writeFileSync(previewPath, emailHtml, 'utf-8');
  fs.writeFileSync(latestPath, emailHtml, 'utf-8');
  console.log(`-> Đã lưu bản sao lưu trữ tại: ${previewPath}`);

  // 5. Lấy danh sách email CBNV CECICS chính thức (Quy tắc [P0-CECICS-OFFICIAL-STAFF-INVARIANT])
  console.log('4. Đang lấy danh sách 18 nhân sự chính thức của Trung tâm CECICS...');
  let recipients: string[] = [];
  try {
    const staffFilePath = path.join(process.cwd(), 'data', 'cecics_official_staff.json');
    if (fs.existsSync(staffFilePath)) {
      const staffList = JSON.parse(fs.readFileSync(staffFilePath, 'utf8'));
      recipients = staffList.map((s: { email: string }) => s.email.trim().toLowerCase());
    } else {
      console.warn('-> Không tìm thấy data/cecics_official_staff.json, fallback danh sách cứng.');
      recipients = [
        'nguyenngocphuongthu@pnt.edu.vn',
        'bsquynhphuong@pnt.edu.vn',
        'linhntm@pnt.edu.vn',
        'bstien@pnt.edu.vn',
        'bichctn@pnt.edu.vn',
        'bsminhluan@pnt.edu.vn',
        'thuyntt.ttmpls@pnt.edu.vn',
        'chinhctk.ttmpls@pnt.edu.vn',
        'vanpnt@pnt.edu.vn',
        'quynhnn@pnt.edu.vn',
        'trinhtt@pnt.edu.vn',
        'taict@pnt.edu.vn',
        'huu_nhan@pnt.edu.vn',
        'trangntk@pnt.edu.vn',
        'cuongnt.ttmpls@pnt.edu.vn',
        'anhntl@pnt.edu.vn',
        'phapmtt@pnt.edu.vn',
        'thuttt@pnt.edu.vn',
      ];
    }
  } catch (err) {
    console.error('-> Lỗi đọc danh sách nhân sự CECICS:', err);
  }

  // Lọc trùng
  recipients = Array.from(new Set(recipients));
  console.log(`-> Danh sách nhận (${recipients.length} địa chỉ):`, recipients.join(', '));

  // Kiểm tra cờ --dry-run (chỉ tạo preview, không thực gửi)
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('=== [CHẾ ĐỘ XEM TRƯỚC --dry-run] HOÀN TẤT (Không gửi email thực) ===');
    return;
  }

  // 6. Gửi email
  console.log('5. Đang gửi email qua tài khoản công vụ cecics@pnt.edu.vn...');
  const subject = `[CECICS Simulation Digest] Chuyên Trang Mô Phỏng Lâm Sàng - ${weekLabel} (${dateStr})`;

  for (const recipient of recipients) {
    try {
      const res = await sendNotificationEmail({
        to: recipient,
        subject: subject,
        htmlContent: emailHtml,
      });
      if (res.ok) {
        console.log(`-> Gửi thành công tới: ${recipient} (MessageID: ${res.messageId || 'OK'})`);
      } else {
        console.warn(`-> Thất bại gửi tới: ${recipient} - ${res.error}`);
      }
    } catch (e) {
      console.error(`-> Lỗi gửi mail tới ${recipient}:`, e);
    }
  }

  console.log('=== [CECICS SIMULATION WEEKLY DIGEST] HOÀN TẤT THÀNH CÔNG ===');
}

run().catch((err) => {
  console.error('[FATAL] Lỗi cron bản tin mô phỏng:', err);
  process.exit(1);
});
