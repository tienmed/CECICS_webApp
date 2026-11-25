import { describe, it, expect } from 'vitest';
import { buildWeeklyScheduleEmailHtml, type WeeklyScheduleItem } from '../src/lib/weekly-schedule-email';

describe('Weekly Schedule Email Builder', () => {
  const sampleItems: WeeklyScheduleItem[] = [
    {
      thu: 'THỨ 2',
      ngay: '23/11/2026',
      buoi: 'SÁNG',
      gio: '7g30 - 11g30',
      nhom_lop: 'Y5, RHM3, YVĐ4',
      phong: 'Phòng thực hành kỹ năng',
      noi_dung: 'SOI ĐÁY MẮT TRỰC TIẾP',
      giang_vien: 'BM MẮT',
      chuan_bi: 'Mô hình soi đáy mắt mô phỏng có kèm các hình chụp soi đáy mắt',
      ktv: 'THƯ B',
    },
    {
      thu: 'THỨ 4',
      ngay: '25/11/2026',
      buoi: 'CHIỀU',
      gio: '14g00',
      nhom_lop: 'Toàn thể nhân sự',
      phong: 'Phòng họp lầu 5',
      noi_dung: 'HỌP GIAO BAN TRUNG TÂM',
      giang_vien: 'LÃNH ĐẠO TRUNG TÂM',
      chuan_bi: 'Báo cáo giao ban',
      ktv: '',
    },
  ];

  it('renders responsive email with both desktop table and mobile cards', () => {
    const html = buildWeeklyScheduleEmailHtml({
      weekNumber: 12,
      startDate: '23/11/2026',
      endDate: '29/11/2026',
      items: sampleItems,
      pdfPrintUrl: '/api/export-weekly-schedule-pdf?week=12&print=true',
      pdfDownloadUrl: '/api/export-weekly-schedule-pdf?week=12&download=true',
    });

    expect(html).toContain('LỊCH HOẠT ĐỘNG TUẦN 12 TẠI CECICS');
    expect(html).toContain('desktop-table');
    expect(html).toContain('mobile-cards');
    expect(html).toContain('SOI ĐÁY MẮT TRỰC TIẾP');
    expect(html).toContain('Mô hình soi đáy mắt mô phỏng');
    expect(html).toContain('THƯ B');
  });

  it('contains direct print button and download button for Secretary / Admin', () => {
    const html = buildWeeklyScheduleEmailHtml({
      weekNumber: 12,
      startDate: '23/11/2026',
      endDate: '29/11/2026',
      items: sampleItems,
      pdfPrintUrl: 'https://cecics.pnt.edu.vn/api/export-weekly-schedule-pdf?week=12&print=true',
      pdfDownloadUrl: 'https://cecics.pnt.edu.vn/api/export-weekly-schedule-pdf?week=12&download=true',
    });

    expect(html).toContain('In Bản Ký Lưu (PDF)');
    expect(html).toContain('https://cecics.pnt.edu.vn/api/export-weekly-schedule-pdf?week=12&print=true');
    expect(html).toContain('Tải File PDF');
    expect(html).toContain('NGƯỜI LẬP BẢNG');
    expect(html).toContain('TRƯỞNG TRUNG TÂM');
  });
});
