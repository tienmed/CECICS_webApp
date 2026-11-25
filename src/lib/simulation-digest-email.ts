/**
 * CECICS Clinical Simulation Digest - HTML Email Template
 * Thiết kế giao diện bản tin chuyên ngành Mô phỏng Lâm sàng chuẩn y khoa
 * Tương thích Mobile, Máy tính bảng và Ứng dụng Desktop Mail
 */

import { type SummarizedArticle } from './simulation-summarizer';

export interface SimulationDigestEmailParams {
  issueDate: string; // dd/mm/yyyy
  weekLabel: string; // Tuần XX - Tháng MM/YYYY
  articles: SummarizedArticle[];
  webAppUrl?: string;
}

export function buildSimulationDigestEmailHtml(params: SimulationDigestEmailParams): string {
  const {
    issueDate,
    weekLabel,
    articles,
    webAppUrl = process.env.NEXTAUTH_URL || 'https://cecics.pnt.edu.vn',
  } = params;

  // Tách bài Spotlight (bài đầu tiên) và các bài nghiên cứu chuyên đề tiếp theo
  const spotlight = articles[0];
  const regularArticles = articles.slice(1);

  const regularCardsHtml = regularArticles.map((art, idx) => {
    const badgeColor = art.categories.some((c) => c.includes('In situ'))
      ? '#0284c7'
      : art.categories.some((c) => c.includes('Lượng giá'))
      ? '#059669'
      : art.categories.some((c) => c.includes('Debriefing'))
      ? '#7c3aed'
      : '#d97706';

    const bulletsHtml = art.summaryBulletPoints
      .map(
        (b) => `
        <li style="margin-bottom: 6px; color: #334155; line-height: 1.5; font-size: 13px;">
          ${b}
        </li>`
      )
      .join('');

    return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; text-transform: uppercase;">
            ${art.categories[0] || 'Mô phỏng y khoa'}
          </span>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">
            ${art.source} &bull; ${art.pubDate}
          </span>
        </div>

        <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.4;">
          ${art.vietnameseTitle}
        </h3>
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; font-style: italic;">
          ${art.originalTitle}
        </p>

        <ul style="margin: 0 0 12px 0; padding-left: 20px;">
          ${bulletsHtml}
        </ul>

        <div style="background-color: #f8fafc; border-left: 3px solid #2563eb; padding: 10px 12px; border-radius: 4px; margin-bottom: 12px;">
          <strong style="font-size: 12px; color: #1e3a8a; display: block; margin-bottom: 2px;">
            💡 Đề xuất ứng dụng cho CECICS:
          </strong>
          <span style="font-size: 12px; color: #1e293b; line-height: 1.4;">
            ${art.takeawayForCECICS}
          </span>
        </div>

        <div style="text-align: right;">
          <a href="${art.url}" target="_blank" style="font-size: 12px; color: #2563eb; font-weight: 600; text-decoration: none;">
            Xem tài liệu gốc &rarr;
          </a>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chuyên Trang Mô Phỏng Lâm Sàng CECICS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; color: #93c5fd; margin-bottom: 6px;">
                TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH &bull; TRUNG TÂM CECICS
              </div>
              <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                BẢN TIN CHUYÊN TRANG MÔ PHỎNG LÂM SÀNG
              </h1>
              <div style="font-size: 13px; color: #cbd5e1; font-weight: 500;">
                Clinical Simulation Weekly Digest &bull; ${weekLabel} (${issueDate})
              </div>
            </td>
          </tr>

          <!-- LỜI MỞ ĐẦU -->
          <tr>
            <td style="padding: 20px 24px; background-color: #eff6ff; border-bottom: 1px solid #dbeafe;">
              <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.6;">
                <strong>Kính gửi: Toàn thể Cán bộ - Giảng viên & Nhân viên Trung tâm CECICS,</strong><br/>
                Nhằm liên tục cập nhật những bước tiến học thuật mới nhất trên thế giới trong lĩnh vực Đào tạo Mô phỏng Lâm sàng, lượng giá kỹ năng y khoa, kỹ thuật Debriefing và mô phỏng <em>In situ</em>, Trung tâm trân trọng gửi tới Thầy/Cô và Anh/Chị bản tin chuyên ngành tuần này.
              </p>
            </td>
          </tr>

          <!-- NỘI DUNG CHÍNH -->
          <tr>
            <td style="padding: 24px;">

              ${
                spotlight
                  ? `
              <!-- SPOTLIGHT OF THE WEEK -->
              <div style="background-color: #f8fafc; border: 2px solid #3b82f6; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <span style="background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ⭐ TIÊU ĐIỂM HỌC THUẬT TUẦN
                  </span>
                  <span style="font-size: 12px; font-weight: 600; color: #2563eb;">
                    ${spotlight.source} &bull; ${spotlight.pubDate}
                  </span>
                </div>

                <h2 style="margin: 0 0 8px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.4;">
                  ${spotlight.vietnameseTitle}
                </h2>
                <div style="font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 12px;">
                  ${spotlight.originalTitle}
                </div>

                <ul style="margin: 0 0 16px 0; padding-left: 20px;">
                  ${spotlight.summaryBulletPoints
                    .map(
                      (b) => `
                    <li style="margin-bottom: 6px; color: #334155; line-height: 1.5; font-size: 13px;">
                      ${b}
                    </li>`
                    )
                    .join('')}
                </ul>

                <div style="background-color: #eff6ff; border-left: 4px solid #1d4ed8; padding: 12px; border-radius: 4px; margin-bottom: 14px;">
                  <strong style="font-size: 13px; color: #1e3a8a; display: block; margin-bottom: 4px;">
                    🎯 Khuyến nghị ứng dụng cho CECICS:
                  </strong>
                  <span style="font-size: 13px; color: #1e293b; line-height: 1.5;">
                    ${spotlight.takeawayForCECICS}
                  </span>
                </div>

                <div style="text-align: right;">
                  <a href="${spotlight.url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px;">
                    Đọc toàn văn nghiên cứu &rarr;
                  </a>
                </div>
              </div>
              `
                  : ''
              }

              <!-- DANH MỤC NGHIÊN CỨU & XU HƯỚNG MỚI -->
              <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                📚 NGHIÊN CỨU & TIÊU CHUẨN THỰC HÀNH MỚI NHẤT
              </h3>

              ${regularCardsHtml}

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #334155;">
                TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)
              </p>
              <p style="margin: 0 0 8px 0;">
                Trường Đại học Y khoa Phạm Ngọc Thạch &bull; Số 2 Dương Quang Trung, P.12, Q.10, TP.HCM
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Email phát hành tự động từ: <a href="mailto:cecics@pnt.edu.vn" style="color: #2563eb; text-decoration: none;">cecics@pnt.edu.vn</a> &bull; Phát hành định kỳ sáng Thứ 7 hàng tuần (8:00 AM).
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
