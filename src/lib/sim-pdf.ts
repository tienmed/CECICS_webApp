import type { SimClassRecord, DepartmentRecord, EquipmentRecord, RoomRecord } from '../core/types';
import { parseSimSessions, resolveSessionRoom, summarizeSimSchedule } from '../core/sim-sessions';
import { formatVnDate, formatVnDateWithDay } from '../core/time';

export interface SimPdfModelItem {
  loai: 'mo_hinh' | 'dung_cu' | 'vat_tu';
  ten: string;
  dvt?: string;
  sl_nhom: number;
  sl_tong: number;
  ghi_chu?: string;
}

export function parseModelItems(jsonString: string): SimPdfModelItem[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        loai: item.loai || 'mo_hinh',
        ten: item.ten || '',
        dvt: item.dvt || (item.loai === 'vat_tu' ? 'Chai/Cái' : 'Máy/Cái'),
        sl_nhom: Number(item.sl_nhom || 1),
        sl_tong: Number(item.sl_tong || item.sl_nhom || 1),
        ghi_chu: item.ghi_chu || '',
      }));
    }
  } catch {}
  return [];
}

export function parseChecklistItems(jsonOrText: string): string[] {
  if (!jsonOrText) return [];
  try {
    const parsed = JSON.parse(jsonOrText);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return jsonOrText.split(',').map((s) => s.trim()).filter(Boolean);
}

export function generateSimClassEOfficeHtml(params: {
  simClass: SimClassRecord;
  department?: DepartmentRecord;
  rooms?: RoomRecord[];
  equipmentList?: EquipmentRecord[];
  leaderName?: string;
  deptHeadName?: string;
}): string {
  const { simClass, department, rooms = [], equipmentList = [], leaderName = 'TS.BS. Nguyễn Ngọc Phương Thư', deptHeadName } = params;

  const items = parseModelItems(simClass.danh_muc_mo_hinh_json);
  const moHinhItems = items.filter((x) => x.loai === 'mo_hinh');
  const dungCuItems = items.filter((x) => x.loai === 'dung_cu');
  const vatTuItems = items.filter((x) => x.loai === 'vat_tu');

  const benhNhanList = parseChecklistItems(simClass.nhu_cau_sp);
  const boiCanhList = parseChecklistItems(simClass.boi_canh_lam_sang);

  const allBenhNhanOptions = [
    'Sơ sinh',
    'Sản phụ',
    'Người lớn',
    'Trẻ em',
    'Nhũ nhi',
    'Huấn luyện kỹ năng từng phần',
  ];

  const allBoiCanhOptions = [
    'Chuyển bệnh cấp cứu',
    'Chăm sóc cấp',
    'Chấn thương',
    'Chăm sóc tích cực',
    'Khác',
  ];

  const roomNames = rooms
    .filter((r) => simClass.room_id.split(',').includes(r.room_id))
    .map((r) => r.ten)
    .join(', ') || simClass.room_id || 'Chưa gán';

  const dateParts = simClass.ngay ? simClass.ngay.split('-') : ['2026', '11', '20'];
  const ngayStr = dateParts[2] || '20';
  const thangStr = dateParts[1] || '11';
  const namStr = dateParts[0] || '2026';

  const deptTitle = department?.ten || simClass.bo_mon_id || 'Bộ môn Chẩn đoán hình ảnh';
  const lecturerTitle = simClass.giang_vien_phu_trach || 'Giảng viên phụ trách';
  const headTitle = deptHeadName || 'Trưởng Bộ môn';
  const ngayVn = `${ngayStr}/${thangStr}/${namStr}`;
  const simSessions = parseSimSessions(simClass);
  const isMulti = simSessions.length > 1;
  const scheduleSummary = summarizeSimSchedule(simSessions);
  const roomMap = new Map(rooms.map((r) => [r.room_id, r.ten]));

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Hồ Sơ Đăng Ký Lớp Mô Phỏng & Dự Trù Dụng Cụ E-Office - ${simClass.sim_id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 13pt;
      line-height: 1.35;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 20px;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px dashed #cccccc;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        border-top: none;
        margin-top: 0;
        padding-top: 0;
      }
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .header-table td {
      vertical-align: top;
      text-align: center;
      padding: 0;
    }
    .sub-line {
      display: inline-block;
      width: 120px;
      border-bottom: 1px solid #000;
      margin-top: 3px;
    }
    .doc-title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 15px 0 5px 0;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 12pt;
      font-style: italic;
      margin-bottom: 15px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    .data-table th, .data-table td {
      border: 1px solid #000;
      padding: 6px 8px;
      font-size: 11pt;
    }
    .data-table th {
      background-color: #f2f2f2;
      text-align: center;
      font-weight: bold;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .sign-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 25px;
    }
    .sign-table td {
      width: 33.33%;
      text-align: center;
      vertical-align: top;
      padding: 0 5px;
    }
    .sign-table-2 td {
      width: 50%;
      text-align: center;
      vertical-align: top;
      padding: 0 5px;
    }
    .sign-space {
      height: 70px;
    }
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 6px 0;
    }
    .checkbox-item {
      display: inline-flex;
      align-items: center;
      margin-right: 15px;
      font-size: 12pt;
    }
    .box {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 1px solid #000;
      margin-right: 6px;
      text-align: center;
      line-height: 14px;
      font-weight: bold;
      font-size: 11pt;
    }
    .toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 8px;
      margin-bottom: 25px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.15);
      z-index: 1000;
    }
    .btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 13px;
    }
    .btn:hover { background: #1d4ed8; }
    .btn-green { background: #059669; }
    .btn-green:hover { background: #047857; }
  </style>
</head>
<body>

  <div class="toolbar no-print">
    <div>
      <strong>📄 HỒ SƠ 3 BIỂU MẪU MÔ PHỎNG & DỰ TRÙ VẬT TƯ (CHUẨN E-OFFICE KÝ SỐ)</strong>
      <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">
        Mã hồ sơ: <strong>${simClass.sim_id}</strong> · Bộ môn: <strong>${deptTitle}</strong> · Trạng thái: <strong>${simClass.trang_thai}</strong>
      </div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn btn-green" onclick="window.print()">🖨️ In ấn / Lưu PDF Ký Số E-Office</button>
      <button class="btn" onclick="window.close()">Đóng cửa sổ</button>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- BIỂU MẪU 1: DỰ TRÙ DỤNG CỤ - VẬT TƯ        -->
  <!-- ========================================== -->
  <div class="form-container">
    <table class="header-table">
      <tr>
        <td style="width: 48%;">
          <strong>TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</strong><br/>
          <strong>TRUNG TÂM MÔ PHỎNG LÂM SÀNG (CECICS)</strong><br/>
          Số: ..... /DTTB-CECICS<br/>
          <span class="sub-line"></span>
        </td>
        <td style="width: 52%;">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
          <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
          <em>TP. Hồ Chí Minh, ngày ${ngayStr} tháng ${thangStr} năm ${namStr}</em><br/>
          <span class="sub-line"></span>
        </td>
      </tr>
    </table>

    <div class="doc-title">BẢNG DỰ TRÙ DỤNG CỤ - VẬT TƯ TRANG BỊ CHO GIẢNG DẠY SINH VIÊN TẠI CECICS</div>
    <div class="doc-subtitle">(Kèm theo Kế hoạch đào tạo mô phỏng lâm sàng năm học 2026 - 2027)</div>

    <table style="width: 100%; margin-bottom: 10px; font-size: 12pt;">
      <tr>
        <td style="width: 60%;"><strong>Đơn vị đề xuất:</strong> ${deptTitle}</td>
        <td style="width: 40%;"><strong>Thời gian thực hành:</strong> ${isMulti ? `${simSessions.length} buổi (${scheduleSummary})` : `${ngayVn} (${simClass.buoi_hoc || 'Sáng'})`}</td>
      </tr>
      <tr>
        <td><strong>Nội dung buổi giảng:</strong> ${simClass.noi_dung}</td>
        <td><strong>Khung giờ:</strong> ${isMulti ? 'Theo kế hoạch từng buổi' : `${simClass.gio_bd} – ${simClass.gio_kt}`}</td>
      </tr>
      <tr>
        <td><strong>Giảng viên phụ trách:</strong> ${lecturerTitle} (SĐT: ${simClass.sdt_lien_he || '...'})</td>
        <td><strong>Đối tượng:</strong> ${simClass.doi_tuong_hoc_vien || 'Sinh viên'} (${simClass.so_hoc_vien} HV)</td>
      </tr>
      <tr>
        <td><strong>Số lượng nhóm thực hành:</strong> ${simClass.so_nhom || 1} nhóm (${simClass.so_hv_moi_nhom || 10} học viên/nhóm)</td>
        <td><strong>Phòng bố trí:</strong> ${roomNames}</td>
      </tr>
    </table>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%;">STT</th>
          <th style="width: 40%;">Tên mô hình, dụng cụ, vật tư trang bị</th>
          <th style="width: 10%;">ĐVT</th>
          <th style="width: 12%;">SL / Nhóm</th>
          <th style="width: 10%;">Số nhóm</th>
          <th style="width: 10%;">Tổng dự trù</th>
          <th style="width: 13%;">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #fafafa;"><td colspan="7" class="font-bold">I. MÔ HÌNH MÔ PHỎNG HUẤN LUYỆN KỸ NĂNG</td></tr>
        ${moHinhItems.length > 0 ? moHinhItems.map((item, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${item.ten}</td>
            <td class="text-center">${item.dvt || 'Mô hình'}</td>
            <td class="text-center">${item.sl_nhom}</td>
            <td class="text-center">${simClass.so_nhom || 1}</td>
            <td class="text-center font-bold">${item.sl_tong}</td>
            <td>${item.ghi_chu || ''}</td>
          </tr>
        `).join('') : `
          <tr><td colspan="7" class="text-center" style="font-style: italic;">(Không có yêu cầu mô hình riêng)</td></tr>
        `}

        <tr style="background: #fafafa;"><td colspan="7" class="font-bold">II. TRANG THIẾT BỊ / MÁY MÓC / DỤNG CỤ</td></tr>
        ${dungCuItems.length > 0 ? dungCuItems.map((item, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${item.ten}</td>
            <td class="text-center">${item.dvt || 'Máy/Bộ'}</td>
            <td class="text-center">${item.sl_nhom}</td>
            <td class="text-center">${simClass.so_nhom || 1}</td>
            <td class="text-center font-bold">${item.sl_tong}</td>
            <td>${item.ghi_chu || ''}</td>
          </tr>
        `).join('') : `
          <tr><td colspan="7" class="text-center" style="font-style: italic;">(Không có thiết bị đặc biệt)</td></tr>
        `}

        <tr style="background: #fafafa;"><td colspan="7" class="font-bold">III. VẬT TƯ TIÊU HAO & HÓA CHẤT / DUNG DỊCH</td></tr>
        ${vatTuItems.length > 0 ? vatTuItems.map((item, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${item.ten}</td>
            <td class="text-center">${item.dvt || 'Cái/Gói'}</td>
            <td class="text-center">${item.sl_nhom}</td>
            <td class="text-center">${simClass.so_nhom || 1}</td>
            <td class="text-center font-bold">${item.sl_tong}</td>
            <td>${item.ghi_chu || ''}</td>
          </tr>
        `).join('') : `
          <tr><td colspan="7" class="text-center" style="font-style: italic;">(Không có vật tư tiêu hao riêng)</td></tr>
        `}
      </tbody>
    </table>

    <table class="sign-table">
      <tr>
        <td>
          <strong>NGƯỜI LẬP BIỂU</strong><br/>
          <em>(Ký, ghi rõ họ tên)</em>
          <div class="sign-space"></div>
          <strong>${lecturerTitle}</strong>
        </td>
        <td>
          <strong>TRƯỞNG BỘ MÔN</strong><br/>
          <em>(Ký, ghi rõ họ tên)</em>
          <div class="sign-space"></div>
          <strong>${headTitle}</strong>
        </td>
        <td>
          <strong>TRƯỞNG TRUNG TÂM CECICS</strong><br/>
          <em>(Ký duyệt trên hệ thống E-Office)</em>
          <div class="sign-space"></div>
          <strong>${leaderName}</strong>
        </td>
      </tr>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- ========================================== -->
  <!-- BIỂU MẪU 2: KẾ HOẠCH SỬ DỤNG MÔ HÌNH       -->
  <!-- ========================================== -->
  <div class="form-container">
    <table class="header-table">
      <tr>
        <td style="width: 48%;">
          <strong>TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</strong><br/>
          <strong>BỘ MÔN: ${deptTitle.toUpperCase()}</strong><br/>
          <span class="sub-line"></span>
        </td>
        <td style="width: 52%;">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
          <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
          <em>TP. Hồ Chí Minh, ngày ${ngayStr} tháng ${thangStr} năm ${namStr}</em><br/>
          <span class="sub-line"></span>
        </td>
      </tr>
    </table>

    <div class="doc-title">KẾ HOẠCH SỬ DỤNG MÔ HÌNH TẠI TRUNG TÂM CECICS</div>
    <div class="doc-subtitle">NĂM HỌC 2026 - 2027</div>

    <div style="margin-bottom: 15px; font-size: 12pt; line-height: 1.6;">
      <div>• <strong>Khoa / Bộ môn:</strong> ${deptTitle}</div>
      <div>• <strong>Khóa đào tạo:</strong> ${simClass.doi_tuong_hoc_vien || 'Sinh viên Y khoa'}</div>
      <div>• <strong>Giảng viên phụ trách:</strong> ${lecturerTitle} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>SĐT liên hệ:</strong> ${simClass.sdt_lien_he || '...'}</div>
      <div>• <strong>Email liên hệ:</strong> ${simClass.email_lien_he || '...'}</div>
      <div>• <strong>Cán bộ / Kỹ thuật viên hỗ trợ từ Bộ môn:</strong> ${simClass.nguoi_ho_tro || 'Theo phân công'}</div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%;">STT</th>
          <th style="width: 17%;">Ngày thực hành</th>
          <th style="width: 13%;">Buổi & Giờ</th>
          <th style="width: 30%;">Nội dung giảng dạy thực hành</th>
          <th style="width: 15%;">Mô hình / Thiết bị</th>
          <th style="width: 10%;">SL HV/nhóm</th>
          <th style="width: 10%;">Phòng xếp</th>
        </tr>
      </thead>
      <tbody>
        ${simSessions.map((buoi) => {
          const sessionRoom = buoi.room_id
            ? (roomMap.get(buoi.room_id) || buoi.room_id)
            : roomNames;
          return `
          <tr>
            <td class="text-center">${buoi.buoi_so}</td>
            <td class="text-center font-semibold">${formatVnDateWithDay(buoi.ngay)}</td>
            <td class="text-center">${buoi.buoi_hoc || 'Sáng'}<br/>(${buoi.gio_bd}–${buoi.gio_kt})</td>
            <td><strong>${buoi.noi_dung_buoi || simClass.noi_dung}</strong>${buoi.trang_thai_buoi && buoi.trang_thai_buoi !== 'Kế hoạch' ? `<br/><em style="color: #b91c1c; font-size: 10pt;">[${buoi.trang_thai_buoi}]</em>` : ''}</td>
            <td>${simClass.thiet_bi_yeu_cau || 'Theo bảng dự trù'}</td>
            <td class="text-center">${simClass.so_hv_moi_nhom || 10} HV</td>
            <td class="text-center font-bold">${sessionRoom}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div style="margin-top: 15px; font-size: 11pt; font-style: italic;">
      * Bộ môn cam kết tuân thủ đúng nội quy phòng thực hành mô phỏng của Trung tâm CECICS và hoàn trả mô hình đúng hiện trạng kỹ thuật sau buổi học.
    </div>

    <table class="sign-table-2" style="margin-top: 35px;">
      <tr>
        <td>
          <strong>GIẢNG VIÊN PHỤ TRÁCH</strong><br/>
          <em>(Ký, ghi rõ họ tên)</em>
          <div class="sign-space"></div>
          <strong>${lecturerTitle}</strong>
        </td>
        <td>
          <strong>TRƯỞNG BỘ MÔN</strong><br/>
          <em>(Ký, đóng dấu hoặc ký số E-Office)</em>
          <div class="sign-space"></div>
          <strong>${headTitle}</strong>
        </td>
      </tr>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- ========================================== -->
  <!-- BIỂU MẪU 3: MẪU YÊU CẦU KHÓA HỌC MÔ PHỎNG  -->
  <!-- ========================================== -->
  <div class="form-container">
    <table class="header-table">
      <tr>
        <td style="width: 48%;">
          <strong>TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH</strong><br/>
          <strong>TRUNG TÂM CECICS</strong><br/>
          <span class="sub-line"></span>
        </td>
        <td style="width: 52%;">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
          <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
          <span class="sub-line"></span>
        </td>
      </tr>
    </table>

    <div class="doc-title">MẪU YÊU CẦU KHÓA HỌC MÔ PHỎNG LÂM SÀNG</div>
    <div class="doc-subtitle">(CLINICAL SIMULATION COURSE REQUEST FORM — CECICS - UPNT)</div>

    <table style="width: 100%; font-size: 11.5pt; margin-bottom: 12px; line-height: 1.5;">
      <tr>
        <td><strong>1. Bộ môn / Đơn vị tổ chức:</strong> ${deptTitle}</td>
      </tr>
      <tr>
        <td><strong>2. Tên khóa học / Bài mô phỏng:</strong> <span style="font-size: 12.5pt; font-weight: bold;">${simClass.noi_dung}</span></td>
      </tr>
      <tr>
        <td><strong>3. Thời gian:</strong> ${isMulti ? `Khóa học gồm ${simSessions.length} buổi (${scheduleSummary})` : `Ngày ${ngayVn} (${simClass.buoi_hoc || 'Sáng'} từ ${simClass.gio_bd} đến ${simClass.gio_kt})`} &nbsp;|&nbsp; <strong>Cơ sở:</strong> ${simClass.campus_id}</td>
      </tr>
      <tr>
        <td><strong>4. Đối tượng học viên:</strong> ${simClass.doi_tuong_hoc_vien || 'Sinh viên'} &nbsp;|&nbsp; <strong>Tổng số học viên:</strong> ${simClass.so_hoc_vien} HV (${simClass.so_nhom || 1} nhóm)</td>
      </tr>
      <tr>
        <td><strong>5. Giảng viên phụ trách chuyên môn:</strong> ${lecturerTitle} (Email: ${simClass.email_lien_he || '...'})</td>
      </tr>
    </table>

    <div style="font-size: 12pt; font-weight: bold; margin-top: 10px;">6. BỆNH NHÂN CHUẨN (STANDARDIZED PATIENT / SIMULATOR):</div>
    <div class="checkbox-group">
      ${allBenhNhanOptions.map((opt) => {
        const checked = benhNhanList.some((x) => x.toLowerCase().includes(opt.toLowerCase()) || opt.toLowerCase().includes(x.toLowerCase()));
        return `<span class="checkbox-item"><span class="box">${checked ? '✓' : ''}</span> ${opt}</span>`;
      }).join('')}
    </div>

    <div style="font-size: 12pt; font-weight: bold; margin-top: 12px;">7. BỐI CẢNH LÂM SÀNG (CLINICAL ENVIRONMENT):</div>
    <div class="checkbox-group">
      ${allBoiCanhOptions.map((opt) => {
        const checked = boiCanhList.some((x) => x.toLowerCase().includes(opt.toLowerCase()) || opt.toLowerCase().includes(x.toLowerCase()));
        return `<span class="checkbox-item"><span class="box">${checked ? '✓' : ''}</span> ${opt}</span>`;
      }).join('')}
    </div>

    <div style="font-size: 12pt; font-weight: bold; margin-top: 12px;">8. MỤC TIÊU ĐÀO TẠO & HÀNH VI LÂM SÀNG:</div>
    <div style="padding-left: 15px; font-size: 11.5pt; margin-top: 4px;">
      ${simClass.muc_tieu_dao_tao ? simClass.muc_tieu_dao_tao.split('\n').map((m) => `<div>• ${m}</div>`).join('') : `
        <div>• 1. Nhận diện các mốc giải phẫu và chỉ số sinh tồn cơ bản trong bệnh cảnh lâm sàng.</div>
        <div>• 2. Áp dụng đúng quy trình thao tác và bảng kiểm kỹ thuật theo hướng dẫn của Bộ môn.</div>
        <div>• 3. Giao tiếp, phối hợp nhóm hiệu quả và xử trí phản ứng bất lợi nếu có.</div>
      `}
    </div>

    <div style="font-size: 12pt; font-weight: bold; margin-top: 12px;">9. KỸ NĂNG MONG ĐỢI THỰC HIỆN (PSYCHOMOTOR SKILLS):</div>
    <div style="padding-left: 15px; font-size: 11.5pt; margin-top: 4px;">
      ${simClass.ky_nang_mong_doi || 'Thực hiện thuần thục kỹ năng thao tác trên mô hình và diễn giải chính xác kết quả thu nhận được.'}
    </div>

    <div style="font-size: 12pt; font-weight: bold; margin-top: 12px;">10. PHÒNG VÀ TRANG THIẾT BỊ YÊU CẦU:</div>
    <div style="padding-left: 15px; font-size: 11.5pt; margin-top: 4px;">
      <div>• <strong>Phòng mô phỏng:</strong> ${roomNames}</div>
      <div>• <strong>Thiết bị & Mô hình:</strong> ${simClass.thiet_bi_yeu_cau || 'Theo bảng dự trù dụng cụ đính kèm'}</div>
    </div>

    <table class="sign-table-2" style="margin-top: 30px;">
      <tr>
        <td>
          <strong>ĐẦU MỐI BỘ MÔN / GIẢNG VIÊN</strong><br/>
          <em>(Ký, ghi rõ họ tên)</em>
          <div class="sign-space"></div>
          <strong>${lecturerTitle}</strong>
        </td>
        <td>
          <strong>DUYỆT CỦA TRUNG TÂM CECICS</strong><br/>
          <em>(Phê duyệt kỹ thuật & phòng trạm)</em>
          <div class="sign-space"></div>
          <strong>${leaderName}</strong>
        </td>
      </tr>
    </table>
  </div>

</body>
</html>`;
}
