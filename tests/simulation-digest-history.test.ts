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
    const mockArticles = [
      {
        id: 'test-art-001',
        title: 'Bài báo kiểm thử lọc trùng 1',
        originalTitle: 'Test Article Deduplication 1',
        source: 'PubMed / Europe PMC' as const,
        authors: ['Tác giả Test'],
        pubDate: '2026',
        doi: '10.1000/test001',
        url: 'https://doi.org/10.1000/test001',
        abstract: 'Tóm tắt bài báo kiểm thử 1',
        categories: ['Mô phỏng lâm sàng'],
      },
      {
        id: 'test-art-002',
        title: 'Bài báo kiểm thử mới 2',
        originalTitle: 'Test Article New 2',
        source: 'Simulation in Healthcare' as const,
        authors: ['Tác giả Test 2'],
        pubDate: '2026',
        doi: '10.1000/test002',
        url: 'https://doi.org/10.1000/test002',
        abstract: 'Tóm tắt bài báo kiểm thử 2',
        categories: ['Debriefing'],
      },
    ];
    const confs = getSimulationConferencesTracker();

    // Giả lập ghi nhận bài đầu tiên vào sổ cái
    recordPublishedDigest([mockArticles[0]], confs);

    // Khi lọc danh sách ban đầu, bài đầu tiên phải bị loại bỏ, chỉ còn bài thứ 2
    const filtered = filterUnpublishedArticles(mockArticles);
    expect(filtered.some((a) => a.id === mockArticles[0].id)).toBe(false);
    expect(filtered.some((a) => a.id === mockArticles[1].id)).toBe(true);
    expect(filtered.length).toBe(1);
  });

  it('sổ cái phải theo dõi tổng số đợt gửi và thời gian gửi gần nhất', () => {
    const history = getDigestHistory();
    expect(history.totalDigestsSent).toBeGreaterThanOrEqual(1);
    expect(history.lastSentAt).toBeTruthy();
    expect(history.publishedArticleIds.length).toBeGreaterThan(0);
  });
});
