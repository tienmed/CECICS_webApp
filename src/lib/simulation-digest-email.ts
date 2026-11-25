/**
 * CECICS Clinical Simulation Digest - Fluid Hybrid Responsive HTML Email Template
 * Thiết kế tối ưu hiển thị 100% trên đa nền tảng:
 * - Mobile: Android (Gmail app, Samsung Mail), iOS (Apple Mail, Gmail app)
 * - Tablet: iPadOS, Android Tablets
 * - Desktop: Gmail Web, Outlook, Apple Mail (mọi độ phân giải màn hình)
 * 
 * Áp dụng kỹ thuật:
 * 1. Fluid Hybrid Table Layout (max-width + width 100% + min-width fallback)
 * 2. Media queries @media only screen and (max-width: 620px)
 * 3. Chống co font tự động trên iOS (-webkit-text-size-adjust: 100%)
 * 4. Nút bấm một chạm dễ bấm ngón tay trên điện thoại (touch-friendly min-height 44px)
 * 5. Bảng màu tương phản cao, dịu mắt chuẩn y khoa
 */

import { type SummarizedArticle } from './simulation-summarizer';
import { type SimulationConference } from './simulation-crawler';

export interface SimulationDigestEmailParams {
  issueDate: string; // dd/mm/yyyy
  weekLabel: string; // Tuần XX - Tháng MM/YYYY
  articles: SummarizedArticle[];
  conferences?: SimulationConference[];
  webAppUrl?: string;
}

export function buildSimulationDigestEmailHtml(params: SimulationDigestEmailParams): string {
  const {
    issueDate,
    weekLabel,
    articles,
    conferences = [],
    webAppUrl = process.env.NEXTAUTH_URL || 'https://cecics.pnt.edu.vn',
  } = params;

  const spotlight = articles[0];
  const regularArticles = articles.slice(1);

  // Render các bài báo nghiên cứu dạng Fluid Cards
  const regularCardsHtml = regularArticles.map((art) => {
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
        <li style="margin-bottom: 8px; color: #334155; line-height: 1.6; font-size: 14px;">
          ${b}
        </li>`
      )
      .join('');

    return `
      <!-- ARTICLE CARD -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <tr>
          <td style="padding: 18px 20px;">
            
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
              <tr>
                <td align="left" style="vertical-align: middle;">
                  <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.3px;">
                    ${art.categories[0] || 'Mô phỏng y khoa'}
                  </span>
                </td>
                <td align="right" style="vertical-align: middle; font-size: 12px; color: #64748b; font-weight: 500;">
                  ${art.source} &bull; ${art.pubDate}
                </td>
              </tr>
            </table>

            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.45;">
              ${art.vietnameseTitle}
            </h3>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b; font-style: italic; line-height: 1.4;">
              ${art.originalTitle}
            </p>

            <ul style="margin: 0 0 14px 0; padding-left: 20px;">
              ${bulletsHtml}
            </ul>

            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 14px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px;">
              <tr>
                <td style="padding: 10px 14px;">
                  <strong style="font-size: 12px; color: #1e3a8a; display: block; margin-bottom: 3px;">
                    💡 Đề xuất ứng dụng cho CECICS:
                  </strong>
                  <span style="font-size: 13px; color: #1e293b; line-height: 1.5;">
                    ${art.takeawayForCECICS}
                  </span>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="right">
                  <a href="${art.url}" target="_blank" style="display: inline-block; font-size: 13px; color: #2563eb; font-weight: 600; text-decoration: none; padding: 6px 0;">
                    Xem bài báo gốc (DOI/PubMed) &rarr;
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    `;
  }).join('');

  // Render Hội nghị
  const pastConferences = conferences.filter((c) => c.timelineType === 'RECENT_PAST');
  const upcomingConferences = conferences.filter((c) => c.timelineType === 'UPCOMING');

  const pastConferencesHtml = pastConferences.map((conf) => {
    const proceedingsHtml = (conf.keyProceedings || []).map((p) => `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px; background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px;">
        <tr>
          <td style="padding: 12px;">
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">
              📌 ${p.title}
            </div>
            <div style="font-size: 11px; color: #64748b; font-style: italic; margin-bottom: 6px;">
              Tác giả / Báo cáo viên: ${p.speakerOrAuthor}
            </div>
            <div style="font-size: 13px; color: #334155; line-height: 1.5;">
              ${p.summary}
            </div>
          </td>
        </tr>
      </table>
    `).join('');

    return `
      <!-- PAST CONFERENCE CARD -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 16px;">
            
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 8px;">
              <tr>
                <td align="left" style="vertical-align: middle;">
                  <span style="background-color: #16a34a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 10px; text-transform: uppercase;">
                    ĐÃ BÁO CÁO / VỪA BẾ MẠC
                  </span>
                </td>
                <td align="right" style="vertical-align: middle; font-size: 11px; color: #15803d; font-weight: 600;">
                  ${conf.dates}
                </td>
              </tr>
            </table>

            <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #14532d; line-height: 1.4;">
              ${conf.name}
            </h4>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #334155; line-height: 1.5;">
              ${conf.themeOrHighlights}
            </p>

            ${proceedingsHtml}

            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 12px; background-color: #ffffff; border-left: 4px solid #16a34a; border-radius: 4px;">
              <tr>
                <td style="padding: 10px 12px;">
                  <strong style="font-size: 11px; color: #14532d; display: block; margin-bottom: 2px;">
                    🎯 Chuyển giao Đơn vị Nghiên cứu CECICS:
                  </strong>
                  <span style="font-size: 12px; color: #1e293b; line-height: 1.45;">
                    ${conf.researchFocusForCECICS}
                  </span>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
              <tr>
                <td align="right">
                  <a href="${conf.website}" target="_blank" style="font-size: 12px; color: #15803d; font-weight: 600; text-decoration: none;">
                    Kỷ yếu & Tài liệu Hội nghị &rarr;
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    `;
  }).join('');

  const upcomingConferencesHtml = upcomingConferences.map((conf) => `
    <!-- UPCOMING CONFERENCE CARD -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 16px;">
          
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 8px;">
            <tr>
              <td align="left" style="vertical-align: middle;">
                <span style="background-color: #ca8a04; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 10px; text-transform: uppercase;">
                  SẮP DIỄN RA (CALL FOR ABSTRACTS)
                </span>
              </td>
              <td align="right" style="vertical-align: middle; font-size: 11px; color: #854d0e; font-weight: 600;">
                ${conf.dates}
              </td>
            </tr>
          </table>

          <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #713f12; line-height: 1.4;">
            ${conf.name}
          </h4>
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #451a03; line-height: 1.5;">
            ${conf.themeOrHighlights}
          </p>
          ${
            conf.callForPapersDeadline
              ? `
          <div style="font-size: 12px; color: #b45309; font-weight: 700; margin-bottom: 10px;">
            ⏰ ${conf.callForPapersDeadline}
          </div>
          `
              : ''
          }

          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-left: 4px solid #eab308; border-radius: 4px;">
            <tr>
              <td style="padding: 10px 12px;">
                <strong style="font-size: 11px; color: #854d0e; display: block; margin-bottom: 2px;">
                  💡 Đề xuất định hướng nộp đề tài cho CECICS:
                </strong>
                <span style="font-size: 12px; color: #1e293b; line-height: 1.45;">
                  ${conf.researchFocusForCECICS}
                </span>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
            <tr>
              <td align="right">
                <a href="${conf.website}" target="_blank" style="font-size: 12px; color: #a16207; font-weight: 600; text-decoration: none;">
                  Cổng thông tin & Nộp bài &rarr;
                </a>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  `).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Bản Tin Chuyên Trang Mô Phỏng Lâm Sàng CECICS</title>
  <style type="text/css">
    /* CLIENT SPECIFIC RESETS */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; background-color: #f1f5f9; }

    /* MOBILE & TABLET MEDIA QUERIES */
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .mobile-padding {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .header-title {
        font-size: 19px !important;
        line-height: 1.35 !important;
      }
      .header-subtitle {
        font-size: 12px !important;
      }
      .spotlight-title {
        font-size: 16px !important;
      }
      .stack-column {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  
  <!-- PREHEADER TRONG HỘP THƯ PREVIEW -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Cập nhật chuyên trang mô phỏng lâm sàng CECICS tuần này: Tiêu điểm thảo luận phản hồi Stop-and-Fix, mô phỏng tại chỗ và diễn đàn hội nghị quốc tế...
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        
        <!-- MAIN CONTAINER (Max 680px) -->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 28px 24px; text-align: center; color: #ffffff;" class="mobile-padding">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; color: #93c5fd; margin-bottom: 6px;">
                TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH &bull; TRUNG TÂM CECICS
              </div>
              <h1 class="header-title" style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                BẢN TIN CHUYÊN TRANG MÔ PHỎNG LÂM SÀNG
              </h1>
              <div class="header-subtitle" style="font-size: 13px; color: #cbd5e1; font-weight: 500;">
                Clinical Simulation Weekly Digest &bull; ${weekLabel} (${issueDate})
              </div>
            </td>
          </tr>

          <!-- LỜI MỞ ĐẦU -->
          <tr>
            <td style="padding: 18px 24px; background-color: #eff6ff; border-bottom: 1px solid #dbeafe;" class="mobile-padding">
              <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.6;">
                <strong>Kính gửi: Toàn thể Cán bộ - Giảng viên & Nhân viên Trung tâm CECICS,</strong><br/>
                Nhằm liên tục cập nhật những bước tiến học thuật mới nhất trên thế giới trong lĩnh vực Đào tạo Mô phỏng Lâm sàng, lượng giá kỹ năng y khoa, mô phỏng tại hiện trường thực tế <em>(In-situ Simulation)</em>, cùng các diễn đàn khoa học quốc tế, Trung tâm trân trọng gửi tới Thầy/Cô và Anh/Chị bản tin chuyên ngành tuần này.
              </p>
            </td>
          </tr>

          <!-- NỘI DUNG CHÍNH -->
          <tr>
            <td style="padding: 24px;" class="mobile-padding">

              ${
                spotlight
                  ? `
              <!-- SPOTLIGHT OF THE WEEK -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f8fafc; border: 2px solid #3b82f6; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;" class="mobile-padding">
                    
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
                      <tr>
                        <td align="left" style="vertical-align: middle;">
                          <span style="background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ⭐ TIÊU ĐIỂM HỌC THUẬT TUẦN
                          </span>
                        </td>
                        <td align="right" style="vertical-align: middle; font-size: 12px; font-weight: 600; color: #2563eb;">
                          ${spotlight.source} &bull; ${spotlight.pubDate}
                        </td>
                      </tr>
                    </table>

                    <h2 class="spotlight-title" style="margin: 0 0 8px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.45;">
                      ${spotlight.vietnameseTitle}
                    </h2>
                    <div style="font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 14px; line-height: 1.4;">
                      ${spotlight.originalTitle}
                    </div>

                    <ul style="margin: 0 0 16px 0; padding-left: 20px;">
                      ${spotlight.summaryBulletPoints
                        .map(
                          (b) => `
                        <li style="margin-bottom: 8px; color: #334155; line-height: 1.6; font-size: 14px;">
                          ${b}
                        </li>`
                        )
                        .join('')}
                    </ul>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; background-color: #eff6ff; border-left: 4px solid #1d4ed8; border-radius: 4px;">
                      <tr>
                        <td style="padding: 12px 14px;">
                          <strong style="font-size: 13px; color: #1e3a8a; display: block; margin-bottom: 3px;">
                            🎯 Khuyến nghị ứng dụng cho CECICS:
                          </strong>
                          <span style="font-size: 13px; color: #1e293b; line-height: 1.5;">
                            ${spotlight.takeawayForCECICS}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="right">
                          <a href="${spotlight.url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 6px;">
                            Đọc toàn văn nghiên cứu (DOI) &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
              `
                  : ''
              }

              <!-- CHUYÊN MỤC HỘI NGHỊ MÔ PHỎNG QUỐC TẾ & KỶ YẾU NGHIÊN CỨU -->
              <h3 style="margin: 24px 0 14px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                🏛️ DIỄN ĐÀN HỘI NGHỊ & ĐỊNH HƯỚNG NGHIÊN CỨU QUỐC TẾ
              </h3>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Theo dõi các báo cáo nổi bật vừa diễn ra và cơ hội kết nối/nộp bài báo khoa học cho <strong>Đơn vị Nghiên cứu & Giảng viên CECICS</strong>:
              </p>

              ${pastConferencesHtml}
              ${upcomingConferencesHtml}

              <!-- DANH MỤC NGHIÊN CỨU & XU HƯỚNG MỚI -->
              <h3 style="margin: 28px 0 16px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                📚 NGHIÊN CỨU & TIÊU CHUẨN THỰC HÀNH MỚI NHẤT
              </h3>

              ${regularCardsHtml}

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 24px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;" class="mobile-padding">
              <p style="margin: 0 0 6px 0; font-weight: 700; color: #334155; font-size: 13px;">
                TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)
              </p>
              <p style="margin: 0 0 8px 0; color: #64748b;">
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
</html>`;
}
