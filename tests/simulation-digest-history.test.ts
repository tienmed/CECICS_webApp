import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getDigestHistory,
  normalizeTitleKey,
  filterUnpublishedArticles,
  recordPublishedDigest,
} from '../src/lib/simulation-digest-history';
import { getVerifiedSimulationArticles, getSimulationConferencesTracker } from '../src/lib/simulation-crawler';

describe('CECICS Simulation Digest History & Deduplication System', () => {
  const testHistoryPath = path.join(process.cwd(), 'data', 'simulation_digest_history.json');

  it('phải chuẩn hóa tiêu đề không phân biệt hoa thường và dấu câu', () => {
    const k1 = normalizeTitleKey('In-Simulation Versus Post-Simulation Debriefing in Medical Training');
    const k2 = normalizeTitleKey('in-simulation versus post-simulation debriefing in medical training...');
    expect(k1).toBe(k2);
  });

  it('phải lọc bỏ các bài báo đã có trong sổ cái lịch sử', () => {
    const articles = getVerifiedSimulationArticles();
    const confs = getSimulationConferencesTracker();

    // Giả lập ghi nhận bài đầu tiên vào sổ cái
    recordPublishedDigest([articles[0]], confs);

    // Khi lọc danh sách ban đầu, bài đầu tiên phải bị loại bỏ
    const filtered = filterUnpublishedArticles(articles);
    expect(filtered.some((a) => a.id === articles[0].id)).toBe(false);
    expect(filtered.length).toBe(articles.length - 1);
  });

  it('sổ cái phải theo dõi tổng số đợt gửi và thời gian gửi gần nhất', () => {
    const history = getDigestHistory();
    expect(history.totalDigestsSent).toBeGreaterThanOrEqual(1);
    expect(history.lastSentAt).toBeTruthy();
    expect(history.publishedArticleIds.length).toBeGreaterThan(0);
  });
});
