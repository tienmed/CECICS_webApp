import { describe, it, expect } from 'vitest';
import { getCuratedInternationalSimulationHighlights, getSimulationConferencesTracker } from '../src/lib/simulation-crawler';
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

  it('phải theo dõi hội nghị mô phỏng lâm sàng đã diễn ra và sắp diễn ra', () => {
    const conferences = getSimulationConferencesTracker();
    expect(conferences.length).toBeGreaterThanOrEqual(3);

    const past = conferences.filter((c) => c.timelineType === 'RECENT_PAST');
    const upcoming = conferences.filter((c) => c.timelineType === 'UPCOMING');
    expect(past.length).toBeGreaterThan(0);
    expect(upcoming.length).toBeGreaterThan(0);

    for (const conf of conferences) {
      expect(conf.researchFocusForCECICS).toBeTruthy();
    }
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

  it('phải tạo HTML Email hoàn chỉnh chứa đầy đủ tiêu điểm, hội nghị và thông tin bản quyền CECICS', async () => {
    const articles = getCuratedInternationalSimulationHighlights().slice(0, 2);
    const conferences = getSimulationConferencesTracker();
    const summarized = await summarizeWeeklySimulationDigest(articles);

    const html = buildSimulationDigestEmailHtml({
      issueDate: '28/11/2026',
      weekLabel: 'Chuyên đề Tuần 12',
      articles: summarized,
      conferences: conferences,
    });

    expect(html).toContain('BẢN TIN CHUYÊN TRANG MÔ PHỎNG LÂM SÀNG');
    expect(html).toContain('TRUNG TÂM CECICS');
    expect(html).toContain('TIÊU ĐIỂM HỌC THUẬT TUẦN');
    expect(html).toContain('DIỄN ĐÀN HỘI NGHỊ & ĐỊNH HƯỚNG NGHIÊN CỨU QUỐC TẾ');
    expect(html).toContain('Đơn vị Nghiên cứu CECICS');
    expect(html).toContain('cecics@pnt.edu.vn');
  }, 25000);
});
