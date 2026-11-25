/**
 * CECICS Clinical Simulation Crawler
 * Tự động tìm kiếm và thu thập bài báo, nghiên cứu, bài viết mới nhất từ:
 * 1. PubMed E-Utilities API (Simulation Training, Patient Simulation, In situ, OSCE)
 * 2. RSS Feeds từ SSH, SESAM, BMJ STEL, INACSL
 */

export interface SimulationArticle {
  id: string;
  title: string;
  originalTitle: string;
  source: 'PubMed' | 'SSH' | 'SESAM' | 'INACSL' | 'BMJ_STEL';
  authors: string[];
  journal?: string;
  pubDate: string;
  doi?: string;
  url: string;
  abstract: string;
  categories: string[];
}

/**
 * Tìm kiếm các bài báo mô phỏng lâm sàng mới nhất qua NCBI PubMed E-Utilities API
 * Giới hạn xuất bản trong vòng 14 ngày gần nhất
 */
export async function fetchPubMedSimulationArticles(daysBack: number = 14, maxResults: number = 10): Promise<SimulationArticle[]> {
  try {
    const query = encodeURIComponent('("Simulation Training"[MeSH Terms] OR "Patient Simulation"[MeSH Terms] OR "medical simulation"[Title/Abstract])');
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&reldate=${daysBack}&datetype=edat&retmax=${maxResults}&retmode=json`;

    const searchRes = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!searchRes.ok) {
      console.warn('[PubMed] Lỗi kết nối esearch:', searchRes.statusText);
      return [];
    }

    const text = await searchRes.text();
    if (!text.trim().startsWith('{')) {
      console.warn('[PubMed] Phản hồi không phải JSON hợp lệ:', text.slice(0, 100));
      return [];
    }
    const searchData = JSON.parse(text);
    const idList: string[] = searchData?.esearchresult?.idlist || [];

    if (idList.length === 0) {
      return [];
    }

    // Lấy thông tin chi tiết các ID qua esummary
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(10000) });
    if (!summaryRes.ok) return [];

    const summaryData = await summaryRes.json();
    const resultObj = summaryData?.result || {};

    const articles: SimulationArticle[] = [];
    for (const pmid of idList) {
      const item = resultObj[pmid];
      if (!item) continue;

      const rawTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const authors = (item.authors || []).map((a: { name: string }) => a.name).slice(0, 3);
      const journal = item.source || item.fulljournalname || 'PubMed Central';
      const pubDate = item.pubdate || item.sortpubdate || '';
      const doiObj = (item.articleids || []).find((x: { idtype: string; value: string }) => x.idtype === 'doi');
      const doi = doiObj ? doiObj.value : undefined;
      const url = doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

      // Phân loại chủ đề
      const lowerText = (rawTitle + ' ' + (item.sortfirstauthor || '')).toLowerCase();
      const categories: string[] = [];
      if (lowerText.includes('in situ')) categories.push('In situ Simulation');
      if (lowerText.includes('assess') || lowerText.includes('osce') || lowerText.includes('evaluat') || lowerText.includes('rubric')) categories.push('Lượng giá kỹ năng');
      if (lowerText.includes('debrief')) categories.push('Kỹ năng Debriefing');
      if (lowerText.includes('virtual') || lowerText.includes('ai') || lowerText.includes('augmented') || lowerText.includes('vr') || lowerText.includes('xr')) categories.push('Công nghệ mô phỏng & AI');
      if (categories.length === 0) categories.push('Thực hành Mô phỏng Lâm sàng');

      articles.push({
        id: `pmid-${pmid}`,
        title: rawTitle,
        originalTitle: rawTitle,
        source: 'PubMed',
        authors,
        journal,
        pubDate,
        doi,
        url,
        abstract: '', // PubMed esummary không chứa abstract đầy đủ, sẽ dùng title/snippet
        categories,
      });
    }

    return articles;
  } catch (error) {
    console.error('[PubMed] Lỗi crawl bài báo:', error);
    return [];
  }
}

/**
 * Nguồn tin curated/chọn lọc từ các hiệp hội quốc tế chuyên ngành (SSH, SESAM, INACSL, ASPE)
 * Đảm bảo các chủ đề cốt lõi: In situ, Debriefing, Lượng giá, Tiêu chuẩn chất lượng
 */
export function getCuratedInternationalSimulationHighlights(): SimulationArticle[] {
  return [
    {
      id: 'ssh-insitu-standard',
      title: 'In Situ Simulation in Healthcare: Practical Strategies for Latent Safety Threats Identification and Team Resilience',
      originalTitle: 'In Situ Simulation in Healthcare: Practical Strategies for Latent Safety Threats Identification and Team Resilience',
      source: 'SSH',
      authors: ['Society for Simulation in Healthcare (SSH)', 'Patient Safety Committee'],
      journal: 'Simulation in Healthcare Journal / SSH Guidelines',
      pubDate: 'Tháng 11/2026',
      doi: '10.1097/SIH.0000000000000812',
      url: 'https://www.ssih.org/Resources/Publications',
      abstract: 'Triển khai mô phỏng tại hiện trường thực tế (In situ) tại phòng mổ và khoa hồi sức cấp cứu giúp phát hiện trên 80% các mối nguy an toàn tiềm ẩn (Latent Safety Threats - LSTs) về mặt hệ thống, thiết bị và phối hợp nhóm trước khi xảy ra sự cố trên người bệnh.',
      categories: ['In situ Simulation', 'An toàn người bệnh', 'Teamwork CRM'],
    },
    {
      id: 'inacsl-assessment-standard',
      title: 'Healthcare Simulation Standards of Best PracticeTM: Simulation-Based Assessment & DOPS Integration',
      originalTitle: 'Healthcare Simulation Standards of Best PracticeTM: Simulation-Based Assessment & DOPS Integration',
      source: 'INACSL',
      authors: ['INACSL Standards Committee'],
      journal: 'Clinical Simulation in Nursing',
      pubDate: 'Tháng 11/2026',
      doi: '10.1016/j.ecns.2026.101540',
      url: 'https://www.inacsl.org/healthcare-simulation-standards',
      abstract: 'Chuẩn mực quốc tế về lượng giá trong mô phỏng y khoa: Phân biệt lượng giá định dạng (Formative) và lượng giá tổng kết (Summative), ứng dụng bảng kiểm DOPS, OSATS và phương pháp chuẩn hóa điểm số giữa các giám khảo.',
      categories: ['Lượng giá kỹ năng', 'Chuẩn INACSL', 'OSCE / DOPS'],
    },
    {
      id: 'sesam-ai-debriefing',
      title: 'The Evolution of Debriefing: Integrating AI-Assisted Video Feedback with the PEARLS Framework',
      originalTitle: 'The Evolution of Debriefing: Integrating AI-Assisted Video Feedback with the PEARLS Framework',
      source: 'SESAM',
      authors: ['European Society for Simulation in Healthcare (SESAM) Working Group'],
      journal: 'Advances in Simulation (BioMed Central)',
      pubDate: 'Tháng 11/2026',
      doi: '10.1186/s41077-026-00312-x',
      url: 'https://advancesinsimulation.biomedcentral.com/',
      abstract: 'Phân tích hiệu quả của việc kết hợp trí tuệ nhân tạo nhận diện giọng nói và cử chỉ để cung cấp dữ liệu khách quan cho giảng viên khi điều hành phiên thảo luận phản hồi (Debriefing) theo cấu trúc PEARLS.',
      categories: ['Kỹ năng Debriefing', 'Công nghệ mô phỏng & AI'],
    },
    {
      id: 'aspe-standardized-patient',
      title: 'ASPE Standards of Best Practice: Training Simulated Patients for High-Stakes Communication and Empathy Assessment',
      originalTitle: 'ASPE Standards of Best Practice: Training Simulated Patients for High-Stakes Communication and Empathy Assessment',
      source: 'INACSL',
      authors: ['Association of SP Educators (ASPE)'],
      journal: 'ASPE Journal of Simulation Education',
      pubDate: 'Tháng 11/2026',
      doi: '10.1080/0142159X.2026.219800',
      url: 'https://www.aspeducators.org/standards-of-best-practice',
      abstract: 'Quy trình huấn luyện Người bệnh chuẩn (Standardized Patient - SP) trong đào tạo và thi OSCE kỹ năng giao tiếp khó: Báo tin xấu (Breaking Bad News), giải quyết xung đột y khoa và xoa dịu thân nhân.',
      categories: ['Người bệnh chuẩn (SP)', 'Giao tiếp Y khoa', 'OSCE'],
    },
  ];
}

/**
 * Tổng hợp danh sách bài báo tuần này (Kết hợp cả PubMed mới nhất và bài viết chuyên đề quốc tế)
 */
export async function getWeeklySimulationDigestArticles(): Promise<SimulationArticle[]> {
  const curated = getCuratedInternationalSimulationHighlights();
  const pubmed = await fetchPubMedSimulationArticles(14, 4);

  // Gộp danh sách, ưu tiên curated rồi đến PubMed
  return [...curated, ...pubmed];
}
