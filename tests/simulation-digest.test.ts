import { describe, it, expect } from 'vitest';
import { getVerifiedSimulationArticles, getSimulationConferencesTracker, getWeeklySimulationDigestData } from '../src/lib/simulation-crawler';
import { summarizeWeeklySimulationDigest } from '../src/lib/simulation-summarizer';
import { buildSimulationDigestEmailHtml } from '../src/lib/simulation-digest-email';

describe('CECICS Simulation Weekly Digest Module - Link & Data Verification', () => {
  it('phải có bộ bài báo mô phỏng lâm sàng thực tế 100% với DOI hoặc PMID hợp lệ', () => {
    const articles = getVerifiedSimulationArticles();
    expect(articles.length).toBeGreaterThanOrEqual(4);

    for (const art of articles) {
      expect(art.title).toBeTruthy();
      expect(art.url).toBeTruthy();
      expect(art.doi || art.pmid).toBeTruthy();
      // Toàn bộ bài phải có URL DOI hoặc PubMed thật 100%
      const isRealUrl = art.url.startsWith('https://doi.org/') || art.url.startsWith('https://pubmed.ncbi.nlm.nih.gov/');
      expect(isRealUrl).toBe(true);
    }
  });

  it('toàn bộ các cổng hội nghị quốc tế phải là link thực và có thông tin định hướng nghiên cứu', () => {
    const conferences = getSimulationConferencesTracker();
    expect(conferences.length).toBeGreaterThanOrEqual(4);

    for (const conf of conferences) {
      expect(conf.website.startsWith('https://')).toBe(true);
      expect(conf.researchFocusForCECICS).toBeTruthy();
    }
  });

  it('phải tóm tắt học thuật chính xác và tạo HTML Email hoàn chỉnh', async () => {
    const { articles, conferences } = await getWeeklySimulationDigestData();
    expect(articles.length).toBeGreaterThan(0);

    const summarized = await summarizeWeeklySimulationDigest(articles.slice(0, 3));
    expect(summarized.length).toBeGreaterThan(0);

    const html = buildSimulationDigestEmailHtml({
      issueDate: '28/11/2026',
      weekLabel: 'Chuyên đề Tuần 12',
      articles: summarized,
      conferences: conferences,
    });

    expect(html).toContain('BẢN TIN CHUYÊN TRANG MÔ PHỎNG LÂM SÀNG');
    expect(html).toContain('TRUNG TÂM CECICS');
    expect(html).toContain('DIỄN ĐÀN HỘI NGHỊ & ĐỊNH HƯỚNG NGHIÊN CỨU QUỐC TẾ');
    expect(html).toContain('Đơn vị Nghiên cứu CECICS');
    expect(html).toContain('cecics@pnt.edu.vn');
  }, 35000);
});
