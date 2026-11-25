import { describe, it, expect } from 'vitest';
import { getCuratedInternationalSimulationHighlights } from '../src/lib/simulation-crawler';
import { summarizeWeeklySimulationDigest } from '../src/lib/simulation-summarizer';
import { buildSimulationDigestEmailHtml } from '../src/lib/simulation-digest-email';

describe('CECICS Simulation Weekly Digest Module', () => {
  it('phải trích xuất danh sách bài viết & tiêu chuẩn mô phỏng quốc tế', () => {
    const articles = getCuratedInternationalSimulationHighlights();
    expect(articles.length).toBeGreaterThanOrEqual(4);
    
    // Kiểm tra các chủ đề cốt lõi
    const allCategories = articles.flatMap((a) => a.categories);
    expect(allCategories).toContain('In situ Simulation');
    expect(allCategories).toContain('Lượng giá kỹ năng');
    expect(allCategories).toContain('Kỹ năng Debriefing');
    expect(allCategories).toContain('Người bệnh chuẩn (SP)');
  });

  it('phải tóm tắt học thuật và sinh khuyến nghị cụ thể cho CECICS', async () => {
    const articles = getCuratedInternationalSimulationHighlights().slice(0, 2);
    const summarized = await summarizeWeeklySimulationDigest(articles);

    expect(summarized.length).toBe(2);
    for (const item of summarized) {
      expect(item.vietnameseTitle).toBeTruthy();
      expect(item.summaryBulletPoints.length).toBeGreaterThan(0);
      expect(item.takeawayForCECICS).toBeTruthy();
      expect(item.takeawayForCECICS.toLowerCase()).toContain('cecics');
    }
  }, 25000);

  it('phải tạo HTML Email hoàn chỉnh chứa đầy đủ tiêu điểm và thông tin bản quyền CECICS', async () => {
    const articles = getCuratedInternationalSimulationHighlights().slice(0, 2);
    const summarized = await summarizeWeeklySimulationDigest(articles);

    const html = buildSimulationDigestEmailHtml({
      issueDate: '28/11/2026',
      weekLabel: 'Chuyên đề Tuần 12',
      articles: summarized,
    });

    expect(html).toContain('BẢN TIN CHUYÊN TRANG MÔ PHỎNG LÂM SÀNG');
    expect(html).toContain('TRUNG TÂM CECICS');
    expect(html).toContain('TIÊU ĐIỂM HỌC THUẬT TUẦN');
    expect(html).toContain('cecics@pnt.edu.vn');
    expect(html).toContain('Khuyến nghị ứng dụng cho CECICS');
  }, 25000);
});
