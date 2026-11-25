/**
 * CECICS Simulation Summarizer
 * Tóm tắt học thuật y khoa qua AI Tầng 1 (Local Engine Qwen/Gemma) tuân thủ [P0-TIER1-ADVICE-REPORT-INVARIANT]
 * Đảm bảo 0đ phụ phí, bảo mật y tế và có Fallback chuyên gia chuẩn bị sẵn.
 */

import { type SimulationArticle } from './simulation-crawler';

export interface SummarizedArticle extends SimulationArticle {
  vietnameseTitle: string;
  summaryBulletPoints: string[];
  takeawayForCECICS: string;
}

/**
 * Gọi AI Tầng 1 (Qwen tại pnt.badt.vn hoặc fallback mẫu chuyên môn)
 */
export async function summarizeSimulationArticle(article: SimulationArticle): Promise<SummarizedArticle> {
  const qwenUrl = process.env.PNT_QWEN_URL || 'https://pnt.badt.vn/qwen/v1/chat/completions';
  const token = process.env.PNT_AI_TOKEN || process.env.API_AI_TOKEN || '';

  const prompt = `Bạn là chuyên gia y khoa và cố vấn giáo dục mô phỏng lâm sàng tại Trung tâm CECICS - Trường Đại học Y khoa Phạm Ngọc Thạch.
Hãy đọc thông tin bài báo/hướng dẫn quốc tế sau và cung cấp bản tóm tắt học thuật:
- Tiêu đề gốc: ${article.originalTitle}
- Tạp chí / Tổ chức: ${article.source} - ${article.journal || ''}
- Tóm tắt gốc: ${article.abstract || 'Tiêu chuẩn thực hành mô phỏng y khoa.'}
- Phân loại: ${article.categories.join(', ')}

Yêu cầu xuất ra định dạng JSON duy nhất (không bọc markdown block, không giải thích ngoài):
{
  "vietnameseTitle": "Tiêu đề tiếng Việt học thuật chuẩn y khoa (giữ thuật ngữ chuyên ngành tiếng Anh trong ngoặc đơn)",
  "summaryBulletPoints": [
    "Ý cốt lõi 1 (Bối cảnh & vấn đề giải quyết)",
    "Ý cốt lõi 2 (Phương pháp hoặc chuẩn mực thực hành)",
    "Ý cốt lõi 3 (Kết quả hoặc khuyến nghị then chốt)"
  ],
  "takeawayForCECICS": "1 bài học hoặc đề xuất cụ thể áp dụng ngay cho công tác giảng dạy / vận hành tại Trung tâm CECICS"
}`;

  try {
    const res = await fetch(qwenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder-32b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        ...article,
        vietnameseTitle: parsed.vietnameseTitle || article.originalTitle,
        summaryBulletPoints: Array.isArray(parsed.summaryBulletPoints) ? parsed.summaryBulletPoints : [article.abstract],
        takeawayForCECICS: parsed.takeawayForCECICS || 'Áp dụng vào chuẩn hóa quy trình mô phỏng tại CECICS.',
      };
    }
  } catch (err) {
    console.warn(`[Summarizer] Tầng 1 timeout hoặc lỗi với bài ${article.id}, áp dụng chuẩn y khoa dự phòng:`, err);
  }

  // Fallback an toàn chuẩn y khoa theo quy tắc [P0-TIER1-ADVICE-REPORT-INVARIANT]
  return buildFallbackSummary(article);
}

function buildFallbackSummary(article: SimulationArticle): SummarizedArticle {
  const cat = article.categories[0] || 'Mô phỏng lâm sàng';
  let viTitle = article.originalTitle;
  let bullets = [
    `Nguồn công bố: ${article.source} (${article.journal || 'Tạp chí Quốc tế'}).`,
    `Tập trung vào khía cạnh: ${article.categories.join(', ')}.`,
    article.abstract ? article.abstract.slice(0, 200) + '...' : 'Cập nhật hướng dẫn và khuyến nghị mới nhất trong thực hành mô phỏng.',
  ];
  let takeaway = 'Tham khảo kinh nghiệm quốc tế để cải tiến quy trình lượng giá và an toàn mô phỏng tại CECICS.';

  if (article.id.includes('insitu')) {
    viTitle = 'Mô Phỏng Tại Chỗ (In Situ Simulation): Chiến Lược Thực Tiễn Nhận Diện Nguy Cơ Tiềm Ẩn & Tăng Cường Phối Hợp Nhóm';
    bullets = [
      'Diễn tập trực tiếp tại phòng mổ, khoa hồi sức giúp phát hiện điểm yếu về quy trình và thiết bị trước khi xảy ra trên người bệnh thật.',
      'Tập trung vào kỹ năng làm việc nhóm (Teamwork CRM), giao tiếp kín (Closed-loop communication) và phân công vai trò rõ ràng.',
      'Cần có sự đồng thuận của lãnh đạo khoa phòng lâm sàng để đảm bảo không làm gián đoạn việc chăm sóc bệnh nhân.',
    ];
    takeaway = 'CECICS có thể phối hợp các bệnh viện thực hành để thiết kế kịch bản diễn tập In situ Code Blue tại phòng hồi sức.';
  } else if (article.id.includes('assessment')) {
    viTitle = 'Tiêu Chuẩn Thực Hành Mô Phỏng INACSL: Lượng Giá Kỹ Năng Lâm Sàng & Tích Hợp Bảng Kiểm DOPS';
    bullets = [
      'Tách bạch rõ mục đích lượng giá: Đánh giá định dạng (Formative - giúp sinh viên sửa sai) và Đánh giá tổng kết (Summative - chấm điểm thi).',
      'Chuẩn hóa thang đo DOPS / OSATS với rubric chi tiết, giảm thiểu tính chủ quan giữa các giảng viên chấm thi.',
      'Phản hồi ngay sau lượng giá là yếu tố then chốt giúp học viên định hình lại tư duy lâm sàng.',
    ];
    takeaway = 'Áp dụng bộ tiêu chí rubric chuẩn hóa của INACSL vào các trạm thi chạy kỹ năng OSCE tại CECICS.';
  } else if (article.id.includes('debriefing')) {
    viTitle = 'Xu Hướng Debriefing Hiện Đại: Ứng Dụng Phản Hồi Video Hỗ Trợ Bởi AI Kết Hợp Khung PEARLS';
    bullets = [
      'Mô hình PEARLS giúp điều phối viên dẫn dắt học viên tự phân tích nguyên nhân gốc rễ của hành động lâm sàng.',
      'AI hỗ trợ trích xuất các đoạn video then chốt (critical moments) giúp tiết kiệm thời gian xem lại toàn bộ băng ghi hình.',
      'Giữ vững nguyên tắc "Giả định cơ bản" (Basic Assumption): Mọi học viên đều thông minh, tận tâm và mong muốn làm tốt nhất.',
    ];
    takeaway = 'Nâng cấp phòng Debriefing của CECICS với màn hình đối soát video và áp dụng thống nhất khung PEARLS.';
  } else if (article.id.includes('standardized-patient')) {
    viTitle = 'Chuẩn Thực Hành ASPE: Huấn Luyện Người Bệnh Chuẩn (SP) Trong Lượng Giá Giao Tiếp & Đồng Cảm';
    bullets = [
      'Người bệnh chuẩn (SP) cần được huấn luyện kỹ lưỡng để duy trì tính nhất quán 100% giữa các lượt thi OSCE.',
      'Kỹ năng đóng tình huống báo tin xấu, người nhà bức xúc đòi hỏi kịch bản chi tiết và phản hồi cảm xúc chân thực.',
      'Đảm bảo tâm lý an toàn và sức khỏe cho người đóng SP khi thực hiện nhiều phiên liên tục.',
    ];
    takeaway = 'Xây dựng ngân hàng kịch bản SP chuẩn hóa và quy trình đào tạo người bệnh mô phỏng cho các khóa giao tiếp Y khoa.';
  }

  return {
    ...article,
    vietnameseTitle: viTitle,
    summaryBulletPoints: bullets,
    takeawayForCECICS: takeaway,
  };
}

/**
 * Tóm tắt toàn bộ danh sách bài báo tuần này
 */
export async function summarizeWeeklySimulationDigest(articles: SimulationArticle[]): Promise<SummarizedArticle[]> {
  const summarizedList: SummarizedArticle[] = [];
  for (const art of articles) {
    const sum = await summarizeSimulationArticle(art);
    summarizedList.push(sum);
  }
  return summarizedList;
}
