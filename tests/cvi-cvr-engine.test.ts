import { describe, it, expect } from 'vitest';
import {
  calculateStationCviCvr,
  getMinimumAcceptableCvr,
  getSampleCprStationEvaluation,
  LAWSHE_MINIMUM_CVR_TABLE,
} from '../src/core/cvi-cvr-engine';

describe('CVI - CVR Engine (Content Validity Index & Ratio)', () => {
  it('xác định chính xác ngưỡng CVR tối thiểu của Lawshe theo số lượng chuyên gia', () => {
    expect(getMinimumAcceptableCvr(5)).toBe(0.99);
    expect(getMinimumAcceptableCvr(8)).toBe(0.75);
    expect(getMinimumAcceptableCvr(10)).toBe(0.62);
    expect(getMinimumAcceptableCvr(14)).toBe(0.51);
    expect(getMinimumAcceptableCvr(3)).toBe(1.0); // Dưới 5 chuyên gia cần 100%
  });

  it('tính toán chính xác chỉ số I-CVI, CVR và S-CVI/Ave cho trạm hồi sức mẫu', () => {
    const sampleItems = getSampleCprStationEvaluation();
    const report = calculateStationCviCvr({
      stationId: 'ST-CPR-TEST',
      stationName: 'Trạm Hồi sức Tim phổi Nâng cao (ACLS)',
      chuyenKhoa: 'Hồi sức Cấp cứu',
      items: sampleItems,
      chairperson: 'GS. TS. Hội đồng Khảo thí Y khoa',
    });

    expect(report.totalExperts).toBe(8);
    expect(report.totalItems).toBe(8);

    // Mục CPR-01: 8/8 chuyên gia chấm 4 -> I-CVI = 1.0, CVR = 1.0
    const cpr1 = report.itemsResults.find((i) => i.itemId === 'CPR-01');
    expect(cpr1).toBeDefined();
    expect(cpr1?.iCvi).toBe(1.0);
    expect(cpr1?.cvr).toBe(1.0);
    expect(cpr1?.recommendation).toBe('GIỮ NGUYÊN');

    // Mục CPR-07: điểm kém (1-2), không thiết yếu -> I-CVI thấp, CVR < 0 -> LOẠI BỎ
    const cpr7 = report.itemsResults.find((i) => i.itemId === 'CPR-07');
    expect(cpr7).toBeDefined();
    expect(cpr7?.iCvi).toBeLessThan(0.7);
    expect(cpr7?.cvr).toBeLessThan(0);
    expect(cpr7?.recommendation).toBe('LOẠI BỎ');

    // Toàn trạm có mục CPR-07 bị loại bỏ nên isStationValid sẽ cảnh báo cần rà soát
    expect(report.sCviAve).toBeGreaterThan(0.7);
    expect(report.isStationValid).toBe(false); // Do có 1 tiêu chí bị loại bỏ
  });

  it('xác thực thành công khi toàn bộ tiêu chí bảng kiểm đạt độ đồng thuận cao', () => {
    const validItems = getSampleCprStationEvaluation().filter((i) => i.itemId !== 'CPR-07');
    const report = calculateStationCviCvr({
      stationId: 'ST-CPR-PERFECT',
      stationName: 'Trạm Hồi sức Chuẩn hóa Đạt Tiêu chuẩn',
      chuyenKhoa: 'Hồi sức Cấp cứu',
      items: validItems,
    });

    expect(report.sCviAve).toBeGreaterThanOrEqual(0.9);
    expect(report.isStationValid).toBe(true);
    expect(report.itemsResults.every((r) => r.recommendation === 'GIỮ NGUYÊN')).toBe(true);
  });
});
