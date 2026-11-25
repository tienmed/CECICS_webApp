/**
 * CECICS Simulation Digest History & Deduplication Ledger
 * Quản lý sổ cái lịch sử các bài báo và hội nghị đã từng phát hành
 * Đảm bảo 100% không bao giờ gửi trùng tin cũ giữa các tuần
 */

import fs from 'fs';
import path from 'path';
import { type SimulationArticle, type SimulationConference } from './simulation-crawler';

export interface DigestHistoryRecord {
  totalDigestsSent: number;
  lastSentAt: string;
  publishedArticleIds: string[]; // Danh sách ID, DOI hoặc PMID đã gửi
  publishedArticleKeys: string[]; // Chuỗi hash tiêu đề chuẩn hóa
  publishedConferenceIds: string[]; // Danh sách ID hội nghị đã đưa tin
}

const HISTORY_FILE = path.join(process.cwd(), 'data', 'simulation_digest_history.json');

/**
 * Đọc sổ cái lịch sử tin đã phát hành
 */
export function getDigestHistory(): DigestHistoryRecord {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[History] Chưa đọc được tệp lịch sử, khởi tạo mới:', err);
  }

  return {
    totalDigestsSent: 0,
    lastSentAt: '',
    publishedArticleIds: [],
    publishedArticleKeys: [],
    publishedConferenceIds: [],
  };
}

/**
 * Chuẩn hóa tiêu đề để so khớp tương đồng (bỏ dấu cách thừa, dấu câu, chữ thường)
 */
export function normalizeTitleKey(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Lọc sạch các bài báo đã từng xuất hiện trong quá khứ
 */
export function filterUnpublishedArticles(articles: SimulationArticle[]): SimulationArticle[] {
  const history = getDigestHistory();
  const idSet = new Set(history.publishedArticleIds.map((x) => x.toLowerCase()));
  const keySet = new Set(history.publishedArticleKeys);

  return articles.filter((art) => {
    // 1. Kiểm tra ID
    if (art.id && idSet.has(art.id.toLowerCase())) return false;
    // 2. Kiểm tra DOI
    if (art.doi && idSet.has(art.doi.toLowerCase())) return false;
    // 3. Kiểm tra PMID
    if (art.pmid && idSet.has(art.pmid.toLowerCase())) return false;
    // 4. Kiểm tra Chuỗi chuẩn hóa tiêu đề
    const key = normalizeTitleKey(art.originalTitle || art.title);
    if (keySet.has(key)) return false;

    return true;
  });
}

/**
 * Cập nhật sổ cái lịch sử sau khi phát hành thành công bản tin tuần
 */
export function recordPublishedDigest(
  articles: SimulationArticle[],
  conferences: SimulationConference[]
): void {
  const history = getDigestHistory();

  const newArticleIds = new Set(history.publishedArticleIds);
  const newArticleKeys = new Set(history.publishedArticleKeys);
  const newConfIds = new Set(history.publishedConferenceIds);

  for (const art of articles) {
    if (art.id) newArticleIds.add(art.id.toLowerCase());
    if (art.doi) newArticleIds.add(art.doi.toLowerCase());
    if (art.pmid) newArticleIds.add(art.pmid.toLowerCase());
    const key = normalizeTitleKey(art.originalTitle || art.title);
    if (key) newArticleKeys.add(key);
  }

  for (const conf of conferences) {
    if (conf.id) newConfIds.add(conf.id.toLowerCase());
  }

  const updatedHistory: DigestHistoryRecord = {
    totalDigestsSent: history.totalDigestsSent + 1,
    lastSentAt: new Date().toISOString(),
    publishedArticleIds: Array.from(newArticleIds),
    publishedArticleKeys: Array.from(newArticleKeys),
    publishedConferenceIds: Array.from(newConfIds),
  };

  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2), 'utf8');
  console.log(`[History] Đã ghi nhận ${articles.length} bài báo mới vào sổ cái chống trùng lặp.`);
}
