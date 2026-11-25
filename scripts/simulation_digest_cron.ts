/**
 * CECICS Simulation Weekly Digest Cron Script
 * Chạy ngầm độc lập (Headless) bằng npx tsx scripts/simulation_digest_cron.ts
 * 
 * NGUYÊN TẮC: 100% THỰC TẾ (NO MOCK DATA)
 * 1. Đọc hoạt động thực tế trong tuần từ Google Sheets công vụ CECICS (Lớp mô phỏng thật, lịch giảng thật của giảng viên)
 * 2. Thu thập bài báo / tiêu chuẩn mô phỏng quốc tế (SSH, SESAM, INACSL, Europe PMC/PubMed)
 * 3. Tóm tắt y khoa qua AI Tầng 1 (Local Engine / Fallback) bám sát nội dung ca giảng thực tế
 * 4. Sinh Email HTML bản tin responsive
 * 5. Gửi email từ cecics@pnt.edu.vn tới đúng 18 CBNV chính thức của CECICS
 * 6. Lưu bản sao HTML/JSON vào public/digests/
 */

import fs from 'fs';
import path from 'path';

// Load .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

import { getWeeklySimulationDigestData } from '../src/lib/simulation-crawler';
import { summarizeWeeklySimulationDigest } from '../src/lib/simulation-summarizer';
import { buildSimulationDigestEmailHtml } from '../src/lib/simulation-digest-email';
import { filterUnpublishedArticles, recordPublishedDigest } from '../src/lib/simulation-digest-history';
import { fetchCurrentRealWeekActivity } from '../src/lib/real-simulation-activity';
import { verifySingleLink } from '../src/lib/link-verifier';
import { sendNotificationEmail } from '../src/lib/mailer';

async function run() {
  console.log('=== [CECICS SIMULATION WEEKLY DIGEST] KHỞI ĐỘNG (100% DỮ LIỆU THẬT) ===');
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const weekLabel = `Chuyên đề Tuần ${Math.ceil(now.getDate() / 7)} - Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

  // 1. Lấy hoạt động thực tế trong tuần từ Google Sheets CECICS
  console.log('1. Đang đồng bộ lịch hoạt động mô phỏng thực tế từ Google Sheets công vụ CECICS...');
  let realActivity;
  try {
    realActivity = await fetchCurrentRealWeekActivity(now);
    console.log(`-> Đã tải: ${realActivity.activeSimClasses.length} lớp mô phỏng thực tế, ${realActivity.activeSessions.length} buổi giảng lâm sàng.`);
  } catch (err: any) {
    console.warn('-> Cảnh báo: Lỗi kết nối Google Sheets, kiểm tra kết nối mạng/credentials:', err.message);
  }

  // 2. Thu thập bài báo & thông tin hội nghị thực tế từ Europe PMC / Hội nghị quốc tế
  console.log('2. Đang quét bài báo (PubMed, Europe PMC) & Hội nghị mô phỏng quốc tế...');
  const { articles: rawArticles, conferences } = await getWeeklySimulationDigestData();
  console.log(`-> Tìm thấy ${rawArticles.length} bài viết học thuật.`);

  // 2b. Lọc chống trùng lặp tin cũ
  const freshArticles = filterUnpublishedArticles(rawArticles);
  console.log(`-> Sau khi đối soát sổ cái lịch sử: ${freshArticles.length} bài báo MỚI 100%.`);
  const finalArticles = freshArticles.length > 0 ? freshArticles : rawArticles.slice(0, 4);

  // 3. Tóm tắt AI Tầng 1
  console.log('3. Đang tóm tắt học thuật & xây dựng khuyến nghị cho CECICS (AI Tầng 1)...');
  const summarizedArticles = await summarizeWeeklySimulationDigest(finalArticles);

  // 3b. CỔNG KIỂM CHỨNG LIÊN KẾT 100% THỰC TẾ (Live Link Verification Gate)
  console.log('3b. Đang chạy kiểm chứng trực tiếp (Live Ping) 100% link bài báo gốc và link hội nghị...');
  const verifiedArticles = [];
  for (const art of summarizedArticles) {
    const check = await verifySingleLink(art.url, 7000);
    if (check.isAlive) {
      console.log(`  [Link hợp lệ 200/Redirect] ${art.id}: ${art.url}`);
      verifiedArticles.push(art);
    } else {
      console.warn(`  [LOẠI BỎ LINK LỖI/CHẾT] ${art.id}: ${art.url} (${check.error})`);
    }
  }

  const verifiedConferences = [];
  for (const conf of conferences) {
    const check = await verifySingleLink(conf.website, 7000);
    if (check.isAlive) {
      verifiedConferences.push(conf);
    } else {
      console.warn(`  [LOẠI BỎ HỘI NGHỊ LINK LỖI] ${conf.id}: ${conf.website} (${check.error})`);
    }
  }
  console.log(`-> Sau kiểm chứng: ${verifiedArticles.length}/${summarizedArticles.length} bài báo và ${verifiedConferences.length}/${conferences.length} hội nghị đạt chuẩn 100% link thật.`);

  // Nếu trong tuần có lớp mô phỏng thực tế đang diễn ra, cập nhật bài Spotlight gắn liền với lớp thật
  if (realActivity && realActivity.activeSimClasses.length > 0 && verifiedArticles.length > 0) {
    const realClass = realActivity.activeSimClasses[0];
    console.log(`-> Ánh xạ bài học Spotlight bám sát lớp thực tế: "${realClass.noi_dung}" (${realClass.giang_vien_phu_trach})`);
    verifiedArticles[0].takeawayForCECICS = `Ứng dụng trực tiếp cho buổi thực hành "${realClass.noi_dung}" của ${realClass.doi_tuong_hoc_vien} (Giảng viên phụ trách: ${realClass.giang_vien_phu_trach}) đang triển khai tại CECICS. Thiết bị thực tế sử dụng: ${realClass.thiet_bi_yeu_cau}.`;
  }

  // 4. Render HTML Email
  console.log('4. Đang render HTML Email...');
  const emailHtml = buildSimulationDigestEmailHtml({
    issueDate: dateStr,
    weekLabel: weekLabel,
    articles: verifiedArticles,
    conferences: verifiedConferences,
  });

  // 5. Lưu bản sao lưu trữ
  const outDir = path.join(process.cwd(), 'public', 'digests');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const previewPath = path.join(outDir, `simulation_digest_${now.toISOString().slice(0, 10)}.html`);
  const latestPath = path.join(outDir, 'latest_simulation_digest.html');
  fs.writeFileSync(previewPath, emailHtml, 'utf-8');
  fs.writeFileSync(latestPath, emailHtml, 'utf-8');
  console.log(`-> Đã lưu bản sao lưu trữ tại: ${previewPath}`);

  // 6. Lấy danh sách email CBNV CECICS chính thức (Quy tắc [P0-CECICS-OFFICIAL-STAFF-INVARIANT])
  console.log('5. Đang lấy danh sách 18 nhân sự chính thức của Trung tâm CECICS...');
  let recipients: string[] = [];
  try {
    const staffFilePath = path.join(process.cwd(), 'data', 'cecics_official_staff.json');
    if (fs.existsSync(staffFilePath)) {
      const staffList = JSON.parse(fs.readFileSync(staffFilePath, 'utf8'));
      recipients = staffList.map((s: { email: string }) => s.email.trim().toLowerCase());
    }
  } catch (err) {
    console.error('-> Lỗi đọc danh sách nhân sự CECICS:', err);
  }

  recipients = Array.from(new Set(recipients));
  console.log(`-> Danh sách nhận (${recipients.length} địa chỉ):`, recipients.join(', '));

  // Kiểm tra cờ --dry-run
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('=== [CHẾ ĐỘ XEM TRƯỚC --dry-run] HOÀN TẤT (Không gửi email thực) ===');
    return;
  }

  // 7. Gửi email từ cecics@pnt.edu.vn
  if (recipients.length === 0) {
    console.warn('-> Không có người nhận, dừng gửi email.');
    return;
  }

  console.log(`6. Đang phát hành bản tin tới ${recipients.length} CBNV Trung tâm CECICS từ email cecics@pnt.edu.vn...`);
  try {
    await sendNotificationEmail({
      to: recipients.join(', '),
      subject: `[CECICS SIMULATION DIGEST] Điểm tin Mô phỏng Y khoa Quốc tế - ${weekLabel}`,
      html: emailHtml,
    });
    console.log('-> Đã gửi thành công chuyên trang tuần!');

    // 8. Cập nhật sổ cái lịch sử
    recordPublishedDigest(finalArticles, conferences);
    console.log('-> Đã cập nhật sổ cái lịch sử (Deduplication Ledger).');
  } catch (err: any) {
    console.error('-> Lỗi khi gửi email:', err.message);
  }

  console.log('=== [CECICS SIMULATION WEEKLY DIGEST] HOÀN TẤT ===');
}

run().catch(console.error);
