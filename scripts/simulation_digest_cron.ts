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
import { getWeeklySimulationDigestArticles } from '../src/lib/simulation-crawler';
import { summarizeWeeklySimulationDigest } from '../src/lib/simulation-summarizer';
import { buildSimulationDigestEmailHtml } from '../src/lib/simulation-digest-email';
import { sendNotificationEmail } from '../src/lib/mailer';
import { getSnapshot } from '../src/lib/repository';

async function run() {
  console.log('=== [CECICS SIMULATION WEEKLY DIGEST] KHỞI ĐỘNG ===');
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const weekLabel = `Chuyên đề Tuần ${Math.ceil(now.getDate() / 7)}`;

  // 1. Thu thập bài báo
  console.log('1. Đang quét các bài báo mô phỏng quốc tế (PubMed, SSH, SESAM, INACSL)...');
  const rawArticles = await getWeeklySimulationDigestArticles();
  console.log(`-> Tìm thấy ${rawArticles.length} bài viết & tiêu chuẩn liên quan.`);

  // 2. Tóm tắt AI Tầng 1
  console.log('2. Đang tóm tắt học thuật & xây dựng khuyến nghị cho CECICS (AI Tầng 1)...');
  const summarizedArticles = await summarizeWeeklySimulationDigest(rawArticles);

  // 3. Render HTML Email
  console.log('3. Đang render HTML Email...');
  const emailHtml = buildSimulationDigestEmailHtml({
    issueDate: dateStr,
    weekLabel: weekLabel,
    articles: summarizedArticles,
  });

  // 4. Lưu bản sao lưu trữ
  const outDir = path.join(process.cwd(), 'public', 'digests');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const previewPath = path.join(outDir, `simulation_digest_${now.toISOString().slice(0, 10)}.html`);
  const latestPath = path.join(outDir, 'latest_simulation_digest.html');
  fs.writeFileSync(previewPath, emailHtml, 'utf-8');
  fs.writeFileSync(latestPath, emailHtml, 'utf-8');
  console.log(`-> Đã lưu bản sao lưu trữ tại: ${previewPath}`);

  // 5. Lấy danh sách email CBNV
  console.log('4. Đang lấy danh sách CBNV CECICS nhận bản tin...');
  let recipients: string[] = [];
  try {
    const db = await getSnapshot();
    recipients = (db.Users || [])
      .map((u) => u.email)
      .filter((e): e is string => Boolean(e && e.includes('@')));
  } catch (err) {
    console.warn('-> Không đọc được DB người dùng, dùng danh sách fallback.');
  }

  // Luôn đảm bảo có cecics@pnt.edu.vn nhận
  if (!recipients.includes('cecics@pnt.edu.vn')) {
    recipients.push('cecics@pnt.edu.vn');
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
