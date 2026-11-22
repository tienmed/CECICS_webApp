import ExcelJS from 'exceljs';
import type { DashboardMetrics, LecturerWorkloadRow, RoomUtilizationRow } from '@/core/analytics';

export interface ExcelExportOptions {
  metrics: DashboardMetrics;
  campusName: string;
  departmentName?: string;
  departmentId?: string;
  layer1Lock?: {
    locked: boolean;
    by?: string;
    at?: string;
  };
  layer2Lock?: {
    locked: boolean;
    by?: string;
    at?: string;
  };
}

export async function generateExcelReportBuffer(opts: ExcelExportOptions): Promise<Buffer> {
  const { metrics, campusName, departmentName, departmentId, layer1Lock, layer2Lock } = opts;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Trung tâm CECICS - ĐHYK Phạm Ngọc Thạch';
  workbook.created = new Date();

  const fontName = 'Times New Roman';
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Teal y tế PNT
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: fontName,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // -------------------------------------------------------------
  // SHEET 1: BẢNG KÊ GIỜ GIẢNG DẠY - COI THI
  // -------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Giảng viên & Coi thi', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  });

  // Header hành chính
  sheet1.mergeCells('A1:E1');
  sheet1.getCell('A1').value = 'TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH';
  sheet1.getCell('A1').font = { name: fontName, size: 11, bold: true };

  sheet1.mergeCells('A2:E2');
  sheet1.getCell('A2').value = 'TRUNG TÂM KỸ NĂNG & SÁNG TẠO MÔ PHỎNG LÂM SÀNG (CECICS)';
  sheet1.getCell('A2').font = { name: fontName, size: 10, italic: true };

  sheet1.mergeCells('G1:L1');
  sheet1.getCell('G1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  sheet1.getCell('G1').alignment = { horizontal: 'center' };
  sheet1.getCell('G1').font = { name: fontName, size: 11, bold: true };

  sheet1.mergeCells('G2:L2');
  sheet1.getCell('G2').value = 'Độc lập - Tự do - Hạnh phúc';
  sheet1.getCell('G2').alignment = { horizontal: 'center' };
  sheet1.getCell('G2').font = { name: fontName, size: 10, italic: true };

  // Tiêu đề bảng
  sheet1.mergeCells('A4:L4');
  const deptTitle = departmentName ? ` — BỘ MÔN: ${departmentName.toUpperCase()}` : ' — TOÀN TRƯỜNG';
  sheet1.getCell('A4').value = `BẢNG KÊ THỐNG KÊ GIỜ GIẢNG DẠY & COI THI MÔ PHỎNG${deptTitle}`;
  sheet1.getCell('A4').alignment = { horizontal: 'center' };
  sheet1.getCell('A4').font = { name: fontName, size: 14, bold: true, color: { argb: 'FF0D5C75' } };

  sheet1.mergeCells('A5:L5');
  sheet1.getCell('A5').value = `Kỳ thống kê: ${metrics.period.label} · Cơ sở: ${campusName} · Đơn vị tính: Giờ thực tế`;
  sheet1.getCell('A5').alignment = { horizontal: 'center' };
  sheet1.getCell('A5').font = { name: fontName, size: 10, italic: true };

  // Cột bảng Sheet 1
  const s1Headers = [
    'STT',
    'Mã GV',
    'Họ và tên Giảng viên',
    'Đơn vị / Bộ môn',
    'Số buổi',
    'Giờ giảng dạy (h)',
    'Giờ coi thi (h)',
    'Tổng giờ (h)',
    'Giờ ĐH',
    'Giờ SĐH',
    'Giờ CME',
    'Ghi chú',
  ];

  const s1HeaderRow = sheet1.getRow(7);
  s1Headers.forEach((h, idx) => {
    const cell = s1HeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: idx >= 4 && idx <= 10 ? 'right' : 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  s1HeaderRow.height = 28;

  // Lọc dữ liệu theo Bộ môn nếu có
  let lecturersData = metrics.lecturerWorkload;
  if (departmentId && departmentId !== 'ALL' && departmentId !== 'CECICS') {
    lecturersData = lecturersData.filter(
      (l) => l.bo_mon_id === departmentId || l.sessions.some((s) => s.isCrossDept)
    );
  } else if (departmentId === 'CECICS') {
    lecturersData = lecturersData.filter((l) => l.isCoreStaff);
  }

  let rowIdx = 8;
  lecturersData.forEach((l, index) => {
    const row = sheet1.getRow(rowIdx);
    const notes: string[] = [];
    if (l.isCrossDept) notes.push('Giảng dạy liên bộ môn');
    if (l.sessions.some((s) => s.isMakeUp)) notes.push('Có ca dạy bù');
    if (l.isOverloaded) notes.push('Lệch tải cao');

    row.getCell(1).value = index + 1;
    row.getCell(2).value = l.user_id;
    row.getCell(3).value = l.ho_ten;
    row.getCell(4).value = l.bo_mon_ten || l.don_vi || 'Bộ môn';
    row.getCell(5).value = l.sessionCount;
    row.getCell(6).value = l.teachingHours;
    row.getCell(7).value = l.examHours;
    row.getCell(8).value = l.totalHours;
    row.getCell(9).value = l.hoursDH;
    row.getCell(10).value = l.hoursSDH;
    row.getCell(11).value = l.hoursCME;
    row.getCell(12).value = notes.join(', ') || '—';

    // Format & alignment
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'left' };
    row.getCell(4).alignment = { horizontal: 'left' };
    row.getCell(5).alignment = { horizontal: 'center' };
    for (let c = 6; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = c === 5 ? '#,##0' : '0.0';
    }
    row.getCell(12).alignment = { horizontal: 'left' };

    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.font = { name: fontName, size: 10 };
      cell.border = thinBorder;
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
    row.height = 20;
    rowIdx++;
  });

  // Dòng TỔNG CỘNG dùng công thức Excel =SUM(...)
  const s1TotalRow = sheet1.getRow(rowIdx);
  s1TotalRow.getCell(1).value = '';
  s1TotalRow.getCell(2).value = '';
  s1TotalRow.getCell(3).value = 'TỔNG CỘNG';
  s1TotalRow.getCell(4).value = '';
  s1TotalRow.getCell(5).value = { formula: `SUM(E8:E${rowIdx - 1})` };
  s1TotalRow.getCell(6).value = { formula: `SUM(F8:F${rowIdx - 1})` };
  s1TotalRow.getCell(7).value = { formula: `SUM(G8:G${rowIdx - 1})` };
  s1TotalRow.getCell(8).value = { formula: `SUM(H8:H${rowIdx - 1})` };
  s1TotalRow.getCell(9).value = { formula: `SUM(I8:I${rowIdx - 1})` };
  s1TotalRow.getCell(10).value = { formula: `SUM(J8:J${rowIdx - 1})` };
  s1TotalRow.getCell(11).value = { formula: `SUM(K8:K${rowIdx - 1})` };
  s1TotalRow.getCell(12).value = '';

  for (let c = 1; c <= 12; c++) {
    const cell = s1TotalRow.getCell(c);
    cell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF0D5C75' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0D5C75' } },
      bottom: { style: 'double', color: { argb: 'FF0D5C75' } },
    };
    if (c >= 5 && c <= 11) {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = c === 5 ? '#,##0' : '0.0';
    }
  }
  s1TotalRow.height = 24;

  // Khối 3 Chữ ký
  const sigRowStart = rowIdx + 3;
  sheet1.mergeCells(`A${sigRowStart}:D${sigRowStart}`);
  sheet1.getCell(`A${sigRowStart}`).value = 'NGƯỜI LẬP BẢNG';
  sheet1.getCell(`A${sigRowStart}`).alignment = { horizontal: 'center' };
  sheet1.getCell(`A${sigRowStart}`).font = { name: fontName, size: 11, bold: true };

  sheet1.mergeCells(`E${sigRowStart}:H${sigRowStart}`);
  sheet1.getCell(`E${sigRowStart}`).value = departmentName
    ? `ĐẠI DIỆN BỘ MÔN ${departmentName.toUpperCase()}`
    : 'ĐẠI DIỆN ĐẦU MỐI CÁC BỘ MÔN';
  sheet1.getCell(`E${sigRowStart}`).alignment = { horizontal: 'center' };
  sheet1.getCell(`E${sigRowStart}`).font = { name: fontName, size: 11, bold: true };

  sheet1.mergeCells(`I${sigRowStart}:L${sigRowStart}`);
  sheet1.getCell(`I${sigRowStart}`).value = 'TRƯỞNG TRUNG TÂM CECICS';
  sheet1.getCell(`I${sigRowStart}`).alignment = { horizontal: 'center' };
  sheet1.getCell(`I${sigRowStart}`).font = { name: fontName, size: 11, bold: true };

  // Dấu xác nhận điện tử nếu có
  if (layer1Lock?.locked) {
    sheet1.mergeCells(`E${sigRowStart + 1}:H${sigRowStart + 2}`);
    const l1Cell = sheet1.getCell(`E${sigRowStart + 1}`);
    l1Cell.value = `[ĐÃ XÁC NHẬN ĐIỆN TỬ]\nKý bởi: ${layer1Lock.by || 'Đầu mối Bộ môn'}\nLúc: ${layer1Lock.at?.slice(0, 16) || ''}`;
    l1Cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    l1Cell.font = { name: fontName, size: 9, italic: true, color: { argb: 'FF0F766E' } };
  }

  if (layer2Lock?.locked) {
    sheet1.mergeCells(`I${sigRowStart + 1}:L${sigRowStart + 2}`);
    const l2Cell = sheet1.getCell(`I${sigRowStart + 1}`);
    l2Cell.value = `[ĐÃ DUYỆT & ĐỐI SÁNH CECICS]\nKý bởi: ${layer2Lock.by || 'Lãnh đạo CECICS'}\nLúc: ${layer2Lock.at?.slice(0, 16) || ''}`;
    l2Cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    l2Cell.font = { name: fontName, size: 9, italic: true, color: { argb: 'FF0D5C75' } };
  }

  // Độ rộng cột Sheet 1
  sheet1.getColumn(1).width = 6;
  sheet1.getColumn(2).width = 14;
  sheet1.getColumn(3).width = 28;
  sheet1.getColumn(4).width = 24;
  sheet1.getColumn(5).width = 10;
  sheet1.getColumn(6).width = 16;
  sheet1.getColumn(7).width = 15;
  sheet1.getColumn(8).width = 15;
  sheet1.getColumn(9).width = 11;
  sheet1.getColumn(10).width = 11;
  sheet1.getColumn(11).width = 11;
  sheet1.getColumn(12).width = 26;

  // -------------------------------------------------------------
  // SHEET 2: CÔNG SUẤT VẬN HÀNH PHÒNG MÔ PHỎNG
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Công suất Phòng', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  });

  sheet2.mergeCells('A1:D1');
  sheet2.getCell('A1').value = 'TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH - TRUNG TÂM CECICS';
  sheet2.getCell('A1').font = { name: fontName, size: 11, bold: true };

  sheet2.mergeCells('F1:K1');
  sheet2.getCell('F1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  sheet2.getCell('F1').alignment = { horizontal: 'center' };
  sheet2.getCell('F1').font = { name: fontName, size: 11, bold: true };

  sheet2.mergeCells('A3:K3');
  sheet2.getCell('A3').value = 'BÁO CÁO CÔNG SUẤT VẬN HÀNH PHÒNG MÔ PHỎNG LÂM SÀNG';
  sheet2.getCell('A3').alignment = { horizontal: 'center' };
  sheet2.getCell('A3').font = { name: fontName, size: 14, bold: true, color: { argb: 'FF0D5C75' } };

  sheet2.mergeCells('A4:K4');
  sheet2.getCell('A4').value = `Kỳ: ${metrics.period.label} · Cơ sở: ${campusName} · Định mức chuẩn: 8 giờ/ngày làm việc (Thứ 2 - Thứ 6)`;
  sheet2.getCell('A4').alignment = { horizontal: 'center' };
  sheet2.getCell('A4').font = { name: fontName, size: 10, italic: true };

  const s2Headers = [
    'STT',
    'Mã phòng',
    'Tên phòng học / Lab',
    'Phân loại nhóm CECICS',
    'Cơ sở',
    'Sức chứa',
    'Số buổi sử dụng',
    'Giờ hoạt động (h)',
    'Công suất chuẩn (h)',
    'Tỷ lệ lấp đầy (%)',
    'Đánh giá hiệu suất',
  ];

  const s2HeaderRow = sheet2.getRow(6);
  s2Headers.forEach((h, idx) => {
    const cell = s2HeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: idx >= 5 && idx <= 9 ? 'right' : 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  s2HeaderRow.height = 28;

  let r2Idx = 7;
  metrics.roomUtilization.forEach((r, index) => {
    const row = sheet2.getRow(r2Idx);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = r.room_id;
    row.getCell(3).value = r.ten;
    row.getCell(4).value = r.loai;
    row.getCell(5).value = r.campus_id;
    row.getCell(6).value = r.suc_chua;
    row.getCell(7).value = r.sessionCount;
    row.getCell(8).value = r.bookedHours;
    row.getCell(9).value = r.capacityHours;
    row.getCell(10).value = r.utilizationPct;
    row.getCell(11).value = r.performanceStatus;

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'left' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).alignment = { horizontal: 'right' };
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(10).alignment = { horizontal: 'right' };
    row.getCell(11).alignment = { horizontal: 'center' };

    row.getCell(8).numFmt = '0.0';
    row.getCell(9).numFmt = '0.0';
    row.getCell(10).numFmt = '0.0"%"';

    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.font = { name: fontName, size: 10 };
      cell.border = thinBorder;
      if (r2Idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
    row.height = 20;
    r2Idx++;
  });

  // Dòng TỔNG CỘNG Sheet 2
  const s2TotalRow = sheet2.getRow(r2Idx);
  s2TotalRow.getCell(1).value = '';
  s2TotalRow.getCell(2).value = '';
  s2TotalRow.getCell(3).value = 'TỔNG CỘNG';
  s2TotalRow.getCell(4).value = '';
  s2TotalRow.getCell(5).value = '';
  s2TotalRow.getCell(6).value = '';
  s2TotalRow.getCell(7).value = { formula: `SUM(G7:G${r2Idx - 1})` };
  s2TotalRow.getCell(8).value = { formula: `SUM(H7:H${r2Idx - 1})` };
  s2TotalRow.getCell(9).value = { formula: `SUM(I7:I${r2Idx - 1})` };
  s2TotalRow.getCell(10).value = { formula: `AVERAGE(J7:J${r2Idx - 1})` };
  s2TotalRow.getCell(11).value = '';

  for (let c = 1; c <= 11; c++) {
    const cell = s2TotalRow.getCell(c);
    cell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF0D5C75' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0D5C75' } },
      bottom: { style: 'double', color: { argb: 'FF0D5C75' } },
    };
    if (c >= 7 && c <= 10) {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = c === 10 ? '0.0"%"' : '0.0';
    }
  }
  s2TotalRow.height = 24;

  // 3 Chữ ký Sheet 2
  const s2SigRow = r2Idx + 3;
  sheet2.mergeCells(`A${s2SigRow}:C${s2SigRow}`);
  sheet2.getCell(`A${s2SigRow}`).value = 'KỸ THUẬT VIÊN VẬN HÀNH';
  sheet2.getCell(`A${s2SigRow}`).alignment = { horizontal: 'center' };
  sheet2.getCell(`A${s2SigRow}`).font = { name: fontName, size: 11, bold: true };

  sheet2.mergeCells(`D${s2SigRow}:G${s2SigRow}`);
  sheet2.getCell(`D${s2SigRow}`).value = 'ĐIỀU PHỐI VIÊN CECICS';
  sheet2.getCell(`D${s2SigRow}`).alignment = { horizontal: 'center' };
  sheet2.getCell(`D${s2SigRow}`).font = { name: fontName, size: 11, bold: true };

  sheet2.mergeCells(`H${s2SigRow}:K${s2SigRow}`);
  sheet2.getCell(`H${s2SigRow}`).value = 'TRƯỞNG TRUNG TÂM CECICS';
  sheet2.getCell(`H${s2SigRow}`).alignment = { horizontal: 'center' };
  sheet2.getCell(`H${s2SigRow}`).font = { name: fontName, size: 11, bold: true };

  // Độ rộng cột Sheet 2
  sheet2.getColumn(1).width = 6;
  sheet2.getColumn(2).width = 14;
  sheet2.getColumn(3).width = 24;
  sheet2.getColumn(4).width = 22;
  sheet2.getColumn(5).width = 10;
  sheet2.getColumn(6).width = 11;
  sheet2.getColumn(7).width = 16;
  sheet2.getColumn(8).width = 18;
  sheet2.getColumn(9).width = 18;
  sheet2.getColumn(10).width = 18;
  sheet2.getColumn(11).width = 20;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
