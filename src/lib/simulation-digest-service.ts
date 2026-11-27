import { getVerifiedSimulationArticles, getSimulationConferencesTracker } from './simulation-crawler';
import { summarizeSimulationArticle } from './simulation-summarizer';
import { buildSimulationDigestEmailHtml } from './simulation-digest-email';

export async function getSimulationDigestDataWithCvi() {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const weekLabel = `Chuyên đề Đặc biệt: Chứng độ Giá trị Nội dung CVI - CVR cho Trạm Mô phỏng & OSCE`;

  const rawArticles = getVerifiedSimulationArticles();
  const conferences = getSimulationConferencesTracker();

  // Đảm bảo bài viết CVI-CVR luôn được đặt làm Spotlight dẫn đầu chuyên đề
  const cviArticle = rawArticles.find((a) => a.id.includes('cvi-cvr')) || rawArticles[0];
  const otherArticles = rawArticles.filter((a) => a.id !== cviArticle.id);
  const orderedArticles = [cviArticle, ...otherArticles];

  // Tóm tắt học thuật y khoa
  const summarized = await Promise.all(orderedArticles.map((art) => summarizeSimulationArticle(art)));

  const emailHtml = buildSimulationDigestEmailHtml({
    issueDate: dateStr,
    weekLabel,
    articles: summarized,
    conferences,
  });

  return {
    issueDate: dateStr,
    weekLabel,
    articles: summarized,
    conferences,
    emailHtml,
  };
}
