/**
 * CECICS Content Validity Index (CVI) & Content Validity Ratio (CVR) Engine
 * Chuẩn hóa giá trị nội dung cho các trạm đánh giá mô phỏng lâm sàng & bảng kiểm OSCE.
 * 
 * Tài liệu & Tiêu chuẩn y học giáo dục áp dụng:
 * 1. Lawshe, C. H. (1975). A quantitative approach to content validity. Personnel Psychology, 28(4), 563-575.
 * 2. Wilson, F. R., Pan, W., & Schumsky, D. A. (2012). Recalculation of the critical values for Lawshe’s content validity ratio. Measurement and Evaluation in Counseling and Development, 45(3), 197-210.
 * 3. Lynn, M. R. (1986). Determination and quantification of content validity. Nursing Research, 35(6), 382-385.
 * 4. Polit, D. F., & Beck, C. T. (2006). The content validity index: are you sure you know what's being reported? Research in Nursing & Health, 29(5), 489-497.
 */

// Bảng ngưỡng giá trị CVR tới hạn của Lawshe (1975) & Wilson (2012) tại mức ý nghĩa alpha = 0.05 (one-tailed)
export const LAWSHE_MINIMUM_CVR_TABLE: Record<number, number> = {
  5: 0.99,
  6: 0.99,
  7: 0.99,
  8: 0.75,
  9: 0.78,
  10: 0.62,
  11: 0.59,
  12: 0.56,
  13: 0.54,
  14: 0.51,
  15: 0.49,
  20: 0.42,
  25: 0.37,
  30: 0.33,
  35: 0.31,
  40: 0.29,
};

/**
 * Lấy ngưỡng CVR tối thiểu dựa trên số lượng chuyên gia y khoa trong hội đồng thẩm định
 */
export function getMinimumAcceptableCvr(numExperts: number): number {
  if (numExperts < 5) return 1.0; // Với hội đồng < 5 chuyên gia, cần 100% đồng thuận
  if (LAWSHE_MINIMUM_CVR_TABLE[numExperts] !== undefined) {
    return LAWSHE_MINIMUM_CVR_TABLE[numExperts];
  }
  // Tìm bậc gần nhất thấp hơn nếu không có trong bảng chuẩn
  const keys = Object.keys(LAWSHE_MINIMUM_CVR_TABLE)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (numExperts >= keys[i]) {
      return LAWSHE_MINIMUM_CVR_TABLE[keys[i]];
    }
  }
  return 0.29;
}

/**
 * Thang đo Likert 4 mức độ đánh giá mức độ tương thích nội dung (Relevance Rating)
 * 1 = Không liên quan / Không phù hợp
 * 2 = Cần chỉnh sửa nhiều để phù hợp
 * 3 = Phù hợp nhưng cần chỉnh sửa nhỏ
 * 4 = Rất phù hợp / Thiết yếu
 */
export type LikertRelevanceScore = 1 | 2 | 3 | 4;

export interface CviItemEvaluation {
  itemId: string;
  itemDescription: string;
  expertScores: LikertRelevanceScore[]; // Điểm của từng chuyên gia từ 1 đến 4
  // Điểm đánh giá CVR (True nếu chuyên gia đánh giá là 'Essential / Thiết yếu')
  expertEssentialVotes?: boolean[];
}

export interface CviItemResult {
  itemId: string;
  itemDescription: string;
  totalExperts: number;
  agreeExpertsCount: number; // Số chuyên gia cho điểm 3 hoặc 4
  iCvi: number; // Item-level CVI (n_agree / N)
  cvr: number; // Content Validity Ratio Lawshe: (n_essential - N/2) / (N/2)
  minAcceptableCvr: number;
  isICviAcceptable: boolean; // True nếu I-CVI đạt ngưỡng khuyến nghị (>= 0.78 với N>=6 hoặc 1.0 với N<6)
  isCvrAcceptable: boolean; // True nếu CVR >= ngưỡng Lawshe
  recommendation: 'GIỮ NGUYÊN' | 'CHỈNH SỬA BỔ SUNG' | 'LOẠI BỎ';
  note: string;
}

export interface StationValidationReport {
  stationId: string;
  stationName: string;
  chuyenKhoa: string;
  totalExperts: number;
  totalItems: number;
  itemsResults: CviItemResult[];
  sCviAve: number; // Scale-level CVI (Average): Trung bình cộng I-CVI toàn trạm
  sCviUa: number; // Scale-level CVI (Universal Agreement): Tỷ lệ item đạt 100% chuyên gia tán thành
  averageCvr: number;
  isStationValid: boolean; // True nếu S-CVI/Ave >= 0.90 và các tiêu chí trọng yếu đạt chuẩn
  congratulationSummary: string;
  auditDate: string; // dd/mm/yyyy
  chairperson: string; // Chủ tịch Hội đồng thẩm định
}

/**
 * Tính toán chỉ số I-CVI, CVR cho từng mục và tổng hợp S-CVI/Ave, S-CVI/UA cho toàn trạm mô phỏng
 */
export function calculateStationCviCvr(params: {
  stationId: string;
  stationName: string;
  chuyenKhoa: string;
  items: CviItemEvaluation[];
  chairperson?: string;
}): StationValidationReport {
  const { stationId, stationName, chuyenKhoa, items, chairperson = 'Hội đồng Khoa học & Đào tạo CECICS' } = params;

  if (items.length === 0) {
    throw new Error('Trạm mô phỏng cần ít nhất 1 tiêu chí đánh giá để thẩm định CVI-CVR');
  }

  const totalExperts = items[0].expertScores.length;
  if (totalExperts === 0) {
    throw new Error('Cần có ít nhất 1 chuyên gia tham gia hội đồng thẩm định.');
  }

  const minAcceptableCvr = getMinimumAcceptableCvr(totalExperts);
  const minAcceptableICvi = totalExperts >= 6 ? 0.78 : 1.0;

  let totalICviSum = 0;
  let universalAgreementItemsCount = 0;
  let totalCvrSum = 0;

  const itemsResults: CviItemResult[] = items.map((item) => {
    const scores = item.expertScores;
    // Số chuyên gia cho điểm 3 hoặc 4 (Phù hợp hoặc Rất phù hợp)
    const agreeCount = scores.filter((s) => s === 3 || s === 4).length;
    const iCvi = Number((agreeCount / totalExperts).toFixed(3));

    // Số chuyên gia đánh giá Thiết yếu (Essential)
    // Nếu không truyền mảng expertEssentialVotes thì mặc định điểm 4 (hoặc 3, 4) được tính là Essential
    const essentialVotesCount = item.expertEssentialVotes
      ? item.expertEssentialVotes.filter(Boolean).length
      : scores.filter((s) => s === 4).length;

    // Công thức Lawshe: CVR = (n_e - N/2) / (N/2) = (2 * n_e / N) - 1
    const cvr = Number(((essentialVotesCount - totalExperts / 2) / (totalExperts / 2)).toFixed(3));

    const isICviAcceptable = iCvi >= minAcceptableICvi;
    const isCvrAcceptable = cvr >= minAcceptableCvr;

    totalICviSum += iCvi;
    totalCvrSum += cvr;
    if (agreeCount === totalExperts) {
      universalAgreementItemsCount += 1;
    }

    let recommendation: 'GIỮ NGUYÊN' | 'CHỈNH SỬA BỔ SUNG' | 'LOẠI BỎ' = 'GIỮ NGUYÊN';
    let note = 'Tiêu chí đạt độ giá trị nội dung cao, đồng thuận chuyên gia tốt.';

    if (iCvi < 0.70 || cvr < 0) {
      recommendation = 'LOẠI BỎ';
      note = 'Độ giá trị nội dung thấp, phần lớn chuyên gia cho rằng không thiết yếu hoặc không liên quan.';
    } else if (!isICviAcceptable || !isCvrAcceptable) {
      recommendation = 'CHỈNH SỬA BỔ SUNG';
      note = 'Cần diễn đạt lại tiêu chí hoặc chuẩn hóa thang đo theo góp ý của Hội đồng để nâng cao tính tương thích.';
    }

    return {
      itemId: item.itemId,
      itemDescription: item.itemDescription,
      totalExperts,
      agreeExpertsCount: agreeCount,
      iCvi,
      cvr,
      minAcceptableCvr,
      isICviAcceptable,
      isCvrAcceptable,
      recommendation,
      note,
    };
  });

  const sCviAve = Number((totalICviSum / items.length).toFixed(3));
  const sCviUa = Number((universalAgreementItemsCount / items.length).toFixed(3));
  const averageCvr = Number((totalCvrSum / items.length).toFixed(3));

  // Chuẩn quốc tế (Polit & Beck 2006): Bảng kiểm đạt chuẩn khi S-CVI/Ave >= 0.90
  const isStationValid = sCviAve >= 0.90 && itemsResults.filter((r) => r.recommendation === 'LOẠI BỎ').length === 0;

  const now = new Date();
  const auditDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let congratulationSummary = '';
  if (isStationValid) {
    congratulationSummary = `Trạm "${stationName}" đạt xuất sắc chỉ số giá trị nội dung cấp độ thang đo S-CVI/Ave = ${sCviAve} (ngưỡng chuẩn >= 0.90) và CVR trung bình = ${averageCvr}. Bảng kiểm đủ điều kiện ban hành phục vụ các kỳ thi OSCE và đào tạo mô phỏng lâm sàng.`;
  } else {
    congratulationSummary = `Trạm "${stationName}" có chỉ số S-CVI/Ave = ${sCviAve} (chưa đạt ngưỡng tối ưu 0.90) hoặc có tiêu chí chưa đạt độ đồng thuận. Hội đồng đề nghị rà soát và chỉnh sửa các tiêu chí được cảnh báo trước khi đưa vào kỳ thi chính thức.`;
  }

  return {
    stationId,
    stationName,
    chuyenKhoa,
    totalExperts,
    totalItems: items.length,
    itemsResults,
    sCviAve,
    sCviUa,
    averageCvr,
    isStationValid,
    congratulationSummary,
    auditDate,
    chairperson,
  };
}

/**
 * Mẫu dữ liệu thẩm định CVI-CVR chuẩn y khoa cho Trạm Hồi sức Tim phổi Cấp cứu (CPR/ACLS) tại CECICS
 */
export function getSampleCprStationEvaluation(): CviItemEvaluation[] {
  return [
    {
      itemId: 'CPR-01',
      itemDescription: 'Đánh giá an toàn hiện trường, kiểm tra tri giác nạn nhân và bắt mạch cảnh trong 5 - 10 giây',
      expertScores: [4, 4, 4, 4, 4, 4, 4, 4], // 8 chuyên gia đồng thuận tuyệt đối
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
    {
      itemId: 'CPR-02',
      itemDescription: 'Kích hoạt hệ thống cấp cứu báo động đỏ nội viện, yêu cầu mang máy khử rung tim (AED/Defibrillator)',
      expertScores: [4, 4, 4, 4, 3, 4, 4, 4],
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
    {
      itemId: 'CPR-03',
      itemDescription: 'Ép tim đúng vị trí (1/2 dưới xương ức), độ sâu 5 - 6 cm, tần số 100 - 120 lần/phút, để ngực nở hoàn toàn',
      expertScores: [4, 4, 4, 4, 4, 4, 4, 4],
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
    {
      itemId: 'CPR-04',
      itemDescription: 'Khai thông đường thở (ngửa đầu - nâng cằm) và bóp bóng Ambu gắn oxy lưu lượng cao theo tỷ lệ 30:2',
      expertScores: [4, 3, 4, 4, 4, 4, 4, 3],
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
    {
      itemId: 'CPR-05',
      itemDescription: 'Nhận diện nhịp tim trên monitor máy sốc (Rung thất VF / Nhịp nhanh thất vô mạch pVT) và thực hiện sốc điện an toàn',
      expertScores: [4, 4, 4, 4, 4, 4, 4, 4],
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
    {
      itemId: 'CPR-06',
      itemDescription: 'Thiết lập đường truyền tĩnh mạch ngoại biên và chỉ định dùng Adrenaline 1mg mỗi 3 - 5 phút đúng phác đồ',
      expertScores: [4, 4, 3, 4, 4, 4, 3, 4],
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
    {
      itemId: 'CPR-07',
      itemDescription: 'Thực hiện xét nghiệm khí máu động mạch ngay trong 2 phút đầu ép tim',
      expertScores: [2, 1, 2, 2, 3, 2, 1, 2], // Mục không thiết yếu / gây gián đoạn ép tim
      expertEssentialVotes: [false, false, false, false, false, false, false, false],
    },
    {
      itemId: 'CPR-08',
      itemDescription: 'Giao tiếp phân vai rõ ràng cho các thành viên trong kíp cấp cứu theo nguyên tắc CRM (Crisis Resource Management)',
      expertScores: [4, 4, 4, 3, 4, 4, 4, 4],
      expertEssentialVotes: [true, true, true, true, true, true, true, true],
    },
  ];
}
