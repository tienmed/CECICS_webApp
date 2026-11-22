import { describe, expect, it } from 'vitest';
import {
  INITIAL_COMPLETED_CANDIDATES,
  INITIAL_HH_STATIONS,
  INITIAL_HOLDING_QUEUE,
  INITIAL_OSCE_EXAMS,
  INITIAL_TN_STATIONS,
  rotateOsceCircuit,
} from '../src/core/osce-data';

describe('OSCE Circuit & Visual Floor Plan Logic', () => {
  it('khởi tạo đúng cấu hình kỳ thi OSCE tại 2 cơ sở CECICS', () => {
    expect(INITIAL_OSCE_EXAMS.length).toBeGreaterThanOrEqual(2);
    const hhExam = INITIAL_OSCE_EXAMS.find((e) => e.campus_id === 'HH');
    const tnExam = INITIAL_OSCE_EXAMS.find((e) => e.campus_id === 'TN');

    expect(hhExam).toBeDefined();
    expect(hhExam?.so_tram).toBe(8);
    expect(hhExam?.thoi_gian_tram_phut).toBe(7);

    expect(tnExam).toBeDefined();
    expect(tnExam?.so_tram).toBe(12);
    expect(tnExam?.thoi_gian_tram_phut).toBe(6);
  });

  it('danh sách trạm Hòa Hưng có đủ 8 trạm với đầy đủ giám khảo và bảng kiểm', () => {
    expect(INITIAL_HH_STATIONS.length).toBe(8);
    for (const station of INITIAL_HH_STATIONS) {
      expect(station.station_number).toBeGreaterThanOrEqual(1);
      expect(station.station_number).toBeLessThanOrEqual(8);
      expect(station.room_id).toBeTruthy();
      expect(station.examiner_name).toBeTruthy();
      expect(station.checklist.length).toBeGreaterThan(0);
      const totalScore = station.checklist.reduce((sum, item) => sum + item.diem_toi_da, 0);
      expect(totalScore).toBeCloseTo(10.0, 1); // Thang điểm 10 chuẩn Y khoa
    }
  });

  it('danh sách trạm Tân Nhật có đủ 12 trạm chuẩn quốc tế', () => {
    expect(INITIAL_TN_STATIONS.length).toBe(12);
    const restStation = INITIAL_TN_STATIONS.find((s) => s.type === 'REST');
    expect(restStation).toBeDefined();
    expect(restStation?.station_number).toBe(12);
  });

  it('luân chuyển thí sinh chuẩn xác theo luồng 1 chiều của mạch OSCE', () => {
    const initialStation1Cand = INITIAL_HH_STATIONS[0].current_candidate;
    const initialStation8Cand = INITIAL_HH_STATIONS[7].current_candidate;
    const initialNextInQueue = INITIAL_HOLDING_QUEUE[0];

    const result = rotateOsceCircuit(
      INITIAL_HH_STATIONS,
      INITIAL_HOLDING_QUEUE,
      INITIAL_COMPLETED_CANDIDATES,
      '09:15'
    );

    // 1. Thí sinh trạm 8 đã hoàn thành vòng thi và được chuyển vào phòng cách ly sau thi
    expect(result.completed.length).toBe(INITIAL_COMPLETED_CANDIDATES.length + 1);
    expect(result.completed[0].ma_sv).toBe(initialStation8Cand?.ma_sv);
    expect(result.completed[0].hoan_thanh_luc).toBe('09:15');

    // 2. Thí sinh Trạm 1 cũ chuyển sang Trạm 2
    expect(result.stations[1].current_candidate?.ma_sv).toBe(initialStation1Cand?.ma_sv);

    // 3. Thí sinh đầu hàng chờ bước vào Trạm 1
    expect(result.stations[0].current_candidate?.ma_sv).toBe(initialNextInQueue.ma_sv);
    expect(result.queue.length).toBe(INITIAL_HOLDING_QUEUE.length - 1);
  });

  it('xử lý an toàn khi hàng chờ thí sinh trống', () => {
    const emptyQueue: typeof INITIAL_HOLDING_QUEUE = [];
    const result = rotateOsceCircuit(
      INITIAL_HH_STATIONS,
      emptyQueue,
      INITIAL_COMPLETED_CANDIDATES,
      '09:30'
    );

    // Trạm 1 nhận null và trạng thái là READY
    expect(result.stations[0].current_candidate).toBeNull();
    expect(result.stations[0].status).toBe('READY');
  });
});
