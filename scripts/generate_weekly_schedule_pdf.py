import os
import json
import csv
import io
import datetime
from typing import Dict, Any, List, Optional
from playwright.sync_api import sync_playwright

# Mẫu chuẩn thực tế Tuần 12 tại CECICS (Từ 23/11/2026 - 29/11/2026) theo đúng văn bản phê duyệt
SAMPLE_WEEK_DATA = [
    {
        "thu": "THỨ 2",
        "ngay": "23/11/2026",
        "buoi": "SÁNG",
        "gio": "7g30 - 11g30",
        "nhom_lop": "Y5, RHM3, YVĐ4",
        "phong": "",
        "noi_dung": "SOI ĐÁY MẮT TRỰC TIẾP",
        "giang_vien": "BM MẮT",
        "chuan_bi": "Chuẩn bị:\n- Mô hình soi đáy mắt mô phỏng có kèm các hình chụp soi đáy mắt",
        "ktv": "THƯ B"
    },
    {
        "thu": "THỨ 2",
        "ngay": "23/11/2026",
        "buoi": "CHIỀU",
        "gio": "13g30 - 16g30",
        "nhom_lop": "SĐH",
        "phong": "Cơ sở Hòa Hưng",
        "noi_dung": "NỘI SOI PHẾ QUẢN ỐNG MỀM",
        "giang_vien": "BM NỘI TỔNG QUÁT",
        "chuan_bi": "Chuẩn bị:\n- Mô hình nội soi phế quản",
        "ktv": "CƯỜNG"
    },
    {
        "thu": "THỨ 3",
        "ngay": "24/11/2026",
        "buoi": "SÁNG",
        "gio": "",
        "nhom_lop": "",
        "phong": "",
        "noi_dung": "NGHỈ LỄ NGÀY VĂN HÓA VIỆT NAM",
        "giang_vien": "",
        "chuan_bi": "",
        "ktv": ""
    },
    {
        "thu": "THỨ 4",
        "ngay": "25/11/2026",
        "buoi": "SÁNG",
        "gio": "7g30 - 11g30",
        "nhom_lop": "Y5, RHM3, YVĐ4",
        "phong": "",
        "noi_dung": "SOI ĐÁY MẮT TRỰC TIẾP",
        "giang_vien": "BM MẮT",
        "chuan_bi": "Chuẩn bị:\n- Mô hình soi đáy mắt mô phỏng có kèm các hình chụp soi đáy mắt",
        "ktv": "THƯ B"
    },
    {
        "thu": "THỨ 4",
        "ngay": "25/11/2026",
        "buoi": "CHIỀU",
        "gio": "13g30 - 16g30",
        "nhom_lop": "SĐH",
        "phong": "Cơ sở Hòa Hưng",
        "noi_dung": "NỘI SOI PHẾ QUẢN ỐNG MỀM",
        "giang_vien": "BM NỘI TỔNG QUÁT",
        "chuan_bi": "Chuẩn bị:\n- Mô hình nội soi phế quản",
        "ktv": "PHÁP"
    },
    {
        "thu": "THỨ 4",
        "ngay": "25/11/2026",
        "buoi": "CHIỀU",
        "gio": "14g00",
        "nhom_lop": "",
        "phong": "Phòng họp lầu 5, khu D cơ sở Tân Nhựt",
        "noi_dung": "HỌP GIAO BAN TRUNG TÂM",
        "giang_vien": "",
        "chuan_bi": "",
        "ktv": ""
    },
    {
        "thu": "THỨ 5",
        "ngay": "26/11/2026",
        "buoi": "CHIỀU",
        "gio": "13g00 - 16g50",
        "nhom_lop": "XNYH2025",
        "phong": "Phòng D910 trụ sở Tân Nhựt",
        "noi_dung": "Vàng da - Viêm gan siêu vi",
        "giang_vien": "ThS. BS. CKII. Bùi Phan Quỳnh Phương",
        "chuan_bi": "",
        "ktv": ""
    },
    {
        "thu": "THỨ 5",
        "ngay": "26/11/2026",
        "buoi": "CHIỀU",
        "gio": "13g30 - 16g30",
        "nhom_lop": "SĐH",
        "phong": "Cơ sở Hòa Hưng",
        "noi_dung": "NỘI SOI PHẾ QUẢN ỐNG MỀM",
        "giang_vien": "BM NỘI TỔNG QUÁT",
        "chuan_bi": "Chuẩn bị:\n- Mô hình nội soi phế quản",
        "ktv": "NHÂN"
    },
    {
        "thu": "THỨ 6",
        "ngay": "27/11/2026",
        "buoi": "CHIỀU",
        "gio": "13g30 - 16g30",
        "nhom_lop": "SĐH",
        "phong": "Cơ sở Hòa Hưng",
        "noi_dung": "NỘI SOI PHẾ QUẢN ỐNG MỀM",
        "giang_vien": "BM NỘI TỔNG QUÁT",
        "chuan_bi": "Chuẩn bị:\n- Mô hình nội soi phế quản",
        "ktv": "TẢI"
    },
    {
        "thu": "THỨ 6",
        "ngay": "27/11/2026",
        "buoi": "CHIỀU",
        "gio": "13g30 - 16g50",
        "nhom_lop": "ThS. ĐD",
        "phong": "P.302 lầu 3, khu A2, cơ sở Hòa Hưng",
        "noi_dung": "Khám mạch máu",
        "giang_vien": "BS. CKII. Trịnh Trung Tiến",
        "chuan_bi": "",
        "ktv": ""
    }
]

def get_week_range(target_date: Optional[datetime.date] = None):
    """Tính ngày Thứ 2 và Chủ nhật của tuần."""
    if target_date is None:
        target_date = datetime.date.today()
    monday = target_date - datetime.timedelta(days=target_date.weekday())
    sunday = monday + datetime.timedelta(days=6)
    return monday, sunday

def get_next_week_range(target_date: Optional[datetime.date] = None):
    """Tính ngày Thứ 2 và Chủ nhật của tuần sau (dành cho tự tạo vào cuối tuần)."""
    if target_date is None:
        target_date = datetime.date.today()
    monday, _ = get_week_range(target_date)
    next_monday = monday + datetime.timedelta(days=7)
    next_sunday = next_monday + datetime.timedelta(days=6)
    return next_monday, next_sunday

def get_academic_week_number(monday: datetime.date, start_academic_date: Optional[datetime.date] = None) -> int:
    """Tính số thứ tự tuần học theo năm học (mặc định khai giảng đầu tháng 9)."""
    if start_academic_date is None:
        year = monday.year
        start_year = year if monday.month >= 9 else year - 1
        start_academic_date = datetime.date(start_year, 8, 31)
        start_academic_date = start_academic_date - datetime.timedelta(days=start_academic_date.weekday())
        
    delta_days = (monday - start_academic_date).days
    week_num = (delta_days // 7) + 1
    return max(1, week_num)

def load_data_from_db(monday: datetime.date, sunday: datetime.date) -> List[Dict[str, Any]]:
    """Đọc dữ liệu lịch thực tế từ db.json trong tuần được chỉ định."""
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".data", "db.json")
    if not os.path.exists(db_path):
        return []
    
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)
        
    sessions = db.get("Sessions", [])
    sim_classes = db.get("SimClasses", [])
    users = {u["user_id"]: u.get("ho_ten", "") for u in db.get("Users", [])}
    rooms = {r["room_id"]: r.get("ten", "") for r in db.get("Rooms", [])}
    
    start_str = monday.strftime("%Y-%m-%d")
    end_str = sunday.strftime("%Y-%m-%d")
    events = []
    day_names = ["THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6", "THỨ 7", "CHỦ NHẬT"]
    
    for s in sessions:
        ngay = s.get("ngay", "")
        if start_str <= ngay <= end_str:
            d = datetime.datetime.strptime(ngay, "%Y-%m-%d").date()
            gio_bd = s.get("gio_bd", "")
            gio_kt = s.get("gio_kt", "")
            buoi = "SÁNG"
            if gio_bd and gio_bd >= "12:00":
                buoi = "CHIỀU"
                
            gio_fmt = f"{gio_bd.replace(':', 'g')} - {gio_kt.replace(':', 'g')}" if (gio_bd and gio_kt) else gio_bd
            gv_id = s.get("giang_vien_id", "")
            gv_ten = users.get(gv_id, gv_id)
            room_id = s.get("room_id", "")
            room_ten = rooms.get(room_id, room_id)
            
            events.append({
                "date_obj": d,
                "thu": day_names[d.weekday()],
                "ngay": d.strftime("%d/%m/%Y"),
                "buoi": buoi,
                "gio": gio_fmt,
                "nhom_lop": s.get("lop", ""),
                "phong": room_ten,
                "noi_dung": s.get("bai_giang", s.get("hoc_phan", "")),
                "giang_vien": gv_ten,
                "chuan_bi": s.get("ghi_chu", ""),
                "ktv": ""
            })
            
    for sc in sim_classes:
        ngay = sc.get("ngay", "")
        if start_str <= ngay <= end_str:
            d = datetime.datetime.strptime(ngay, "%Y-%m-%d").date()
            buoi = sc.get("buoi_hoc", "SÁNG").upper()
            gio_bd = sc.get("gio_bd", "")
            gio_kt = sc.get("gio_kt", "")
            gio_fmt = f"{gio_bd.replace(':', 'g')} - {gio_kt.replace(':', 'g')}" if (gio_bd and gio_kt) else ""
            room_id = sc.get("room_id", "")
            room_ten = rooms.get(room_id, room_id)
            ktv_id = sc.get("ktv_phu_trach", "")
            ktv_ten = users.get(ktv_id, ktv_id)
            
            events.append({
                "date_obj": d,
                "thu": day_names[d.weekday()],
                "ngay": d.strftime("%d/%m/%Y"),
                "buoi": buoi,
                "gio": gio_fmt,
                "nhom_lop": sc.get("doi_tuong_hoc_vien", ""),
                "phong": room_ten,
                "noi_dung": sc.get("noi_dung", ""),
                "giang_vien": sc.get("giang_vien_phu_trach", ""),
                "chuan_bi": sc.get("thiet_bi_yeu_cau", ""),
                "ktv": ktv_ten
            })
            
    events.sort(key=lambda x: (x["date_obj"], 0 if x["buoi"] == "SÁNG" else 1, x["gio"]))
    return events

def generate_weekly_schedule_html(
    week_number: int,
    monday: datetime.date,
    sunday: datetime.date,
    items: List[Dict[str, Any]],
    prepared_by: str = "Phạm Nguyễn Tường Vân",
    leader_by: str = "Nguyễn Ngọc Phương Thư"
) -> str:
    """Sinh HTML biểu mẫu Lịch tuần CECICS chuẩn tỷ lệ A4 khổ ngang (Landscape)."""
    
    day_vn_map = ["THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6", "THỨ 7", "CHỦ NHẬT"]
    grouped_by_day = {}
    day_keys = []
    
    has_weekend = any(it.get("thu") in ["THỨ 7", "CHỦ NHẬT"] for it in items)
    max_days = 7 if has_weekend else 5
    
    for i in range(max_days):
        cur_day = monday + datetime.timedelta(days=i)
        d_name = day_vn_map[cur_day.weekday()]
        d_str = cur_day.strftime("%d/%m/%Y")
        key = f"{d_name}\n({d_str})"
        grouped_by_day[key] = []
        day_keys.append(key)
        
    for item in items:
        thu = item.get("thu", "")
        matched_key = None
        for k in day_keys:
            if thu in k:
                matched_key = k
                break
        if matched_key:
            grouped_by_day[matched_key].append(item)
        else:
            k = thu
            if k not in grouped_by_day:
                grouped_by_day[k] = []
                day_keys.append(k)
            grouped_by_day[k].append(item)

    table_rows = []
    for k in day_keys:
        day_items = grouped_by_day[k]
        thu_display = k.replace("\n", "<br>")
        if not day_items:
            table_rows.append(f"""
            <tr>
              <td class="col-thu font-bold text-center bg-gray-50">{thu_display}</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center italic text-gray-400">Không có lịch</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
            </tr>
            """)
        else:
            rowspan = len(day_items)
            for idx, it in enumerate(day_items):
                is_first = (idx == 0)
                thu_cell = f'<td class="col-thu font-bold text-center bg-gray-50" rowspan="{rowspan}">{thu_display}</td>' if is_first else ''
                
                gio = it.get("gio", "")
                buoi = it.get("buoi", "")
                nhom_lop = it.get("nhom_lop", "")
                phong = it.get("phong", "")
                noi_dung = it.get("noi_dung", "")
                giang_vien = it.get("giang_vien", "")
                chuan_bi = it.get("chuan_bi", "").replace("\n", "<br>")
                ktv = it.get("ktv", "")
                
                row_class = ""
                if "NGHỈ LỄ" in noi_dung:
                    row_class = "holiday-row"
                elif "HỌP GIAO BAN" in noi_dung:
                    row_class = "meeting-row"
                    
                table_rows.append(f"""
                <tr class="{row_class}">
                  {thu_cell}
                  <td class="text-center font-medium">{buoi}</td>
                  <td class="text-center font-mono whitespace-nowrap">{gio}</td>
                  <td class="font-medium">{nhom_lop}</td>
                  <td>{phong}</td>
                  <td class="font-bold text-sky-950">{noi_dung}</td>
                  <td>{giang_vien}</td>
                  <td class="text-xs">{chuan_bi}</td>
                  <td class="text-center font-semibold text-blue-900">{ktv}</td>
                </tr>
                """)

    tu_ngay_str = monday.strftime("%d/%m/%Y")
    den_ngay_str = sunday.strftime("%d/%m/%Y")

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>LỊCH HOẠT ĐỘNG TUẦN {week_number} TẠI CECICS ({tu_ngay_str} - {den_ngay_str})</title>
  <style>
    @page {{
      size: A4 landscape;
      margin: 5mm 6mm 5mm 6mm;
    }}
    * {{
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    body {{
      font-family: 'Times New Roman', Times, serif;
      font-size: 9pt;
      line-height: 1.15;
      color: #111827;
      background-color: #fff;
      margin: 0;
      padding: 0;
    }}
    .header {{
      text-align: center;
      margin-bottom: 8px;
    }}
    .header h1 {{
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0 0 2px 0;
      color: #1e3a8a;
      letter-spacing: 0.5px;
    }}
    .header .subtitle {{
      font-size: 8.5pt;
      font-style: italic;
      color: #374151;
      margin: 0;
    }}
    table.schedule-table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }}
    table.schedule-table th, table.schedule-table td {{
      border: 1px solid #374151;
      padding: 2.5px 4px;
      vertical-align: middle;
      font-size: 8.5pt;
    }}
    table.schedule-table th {{
      background-color: #f3f4f6;
      color: #111827;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      font-size: 8.5pt;
    }}
    .col-thu {{
      width: 9%;
      line-height: 1.2;
    }}
    .holiday-row td {{
      background-color: #fef2f2 !important;
      color: #b91c1c !important;
      font-weight: bold;
    }}
    .meeting-row td {{
      background-color: #f0fdf4 !important;
    }}
    .signature-section {{
      margin-top: 6px;
      width: 100%;
      page-break-inside: avoid;
    }}
    .sig-table {{
      width: 100%;
      border-collapse: collapse;
      border: none;
    }}
    .sig-table td {{
      border: none;
      vertical-align: top;
      text-align: center;
      width: 50%;
    }}
    .sig-title {{
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9pt;
      color: #1f2937;
    }}
    .sig-name {{
      font-weight: bold;
      font-size: 8.5pt;
      color: #111827;
      margin-top: 26px;
    }}
    .text-center {{ text-align: center; }}
    .font-bold {{ font-weight: bold; }}
    .font-semibold {{ font-weight: 600; }}
    .font-medium {{ font-weight: 500; }}
    .italic {{ font-style: italic; }}
    .text-xs {{ font-size: 8pt; }}
    .text-gray-400 {{ color: #9ca3af; }}
    .text-sky-950 {{ color: #082f49; }}
    .text-blue-900 {{ color: #1e3a8a; }}
    .bg-gray-50 {{ background-color: #f9fafb; }}
    .whitespace-nowrap {{ white-space: nowrap; }}
  </style>
</head>
<body>

  <div class="header">
    <h1>LỊCH HOẠT ĐỘNG TUẦN {week_number} TẠI CECICS</h1>
    <div class="subtitle">(Từ ngày {tu_ngay_str} - {den_ngay_str})</div>
  </div>

  <table class="schedule-table">
    <thead>
      <tr>
        <th style="width: 9%;">THỨ</th>
        <th style="width: 6%;">BUỔI</th>
        <th style="width: 10%;">GIỜ</th>
        <th style="width: 12%;">NHÓM-LỚP</th>
        <th style="width: 16%;">PHÒNG</th>
        <th style="width: 19%;">NỘI DUNG</th>
        <th style="width: 14%;">GIẢNG VIÊN</th>
        <th style="width: 9%;">CHUẨN BỊ</th>
        <th style="width: 5%;">KTV</th>
      </tr>
    </thead>
    <tbody>
      {''.join(table_rows)}
    </tbody>
  </table>

  <div class="signature-section">
    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-title">NGƯỜI LẬP BẢNG</div>
          <div class="sig-name">{prepared_by}</div>
        </td>
        <td>
          <div class="sig-title">TRƯỞNG TRUNG TÂM</div>
          <div class="sig-name">{leader_by}</div>
        </td>
      </tr>
    </table>
  </div>

</body>
</html>
"""
    return html

def convert_html_to_pdf_playwright(html_content: str, output_pdf_path: str) -> bool:
    """Render PDF qua Playwright Chromium Engine, đảm bảo chất lượng sắc nét 100% chuẩn in."""
    temp_html = output_pdf_path.replace(".pdf", ".temp.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            url = "file:///" + os.path.abspath(temp_html).replace("\\", "/")
            page.goto(url)
            page.pdf(
                path=output_pdf_path,
                format="A4",
                landscape=True,
                print_background=True,
                margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"}
            )
            browser.close()
        return os.path.exists(output_pdf_path) and os.path.getsize(output_pdf_path) > 0
    finally:
        if os.path.exists(temp_html):
            try:
                os.remove(temp_html)
            except Exception:
                pass

def export_weekly_schedule(
    week_number: int = 12,
    target_date: Optional[datetime.date] = None,
    output_dir: str = "public/schedules",
    source_mode: str = "sample"  # 'sample', 'db', hoặc 'auto'
) -> Dict[str, Any]:
    """Xuất file lịch tuần HTML và PDF."""
    os.makedirs(output_dir, exist_ok=True)
    monday, sunday = get_week_range(target_date)
    
    if source_mode == "sample":
        items = SAMPLE_WEEK_DATA
    elif source_mode == "db":
        items = load_data_from_db(monday, sunday)
    else:  # auto
        items = load_data_from_db(monday, sunday)
        if not items:
            items = SAMPLE_WEEK_DATA
            
    html = generate_weekly_schedule_html(week_number, monday, sunday, items)
    
    filename_base = f"Lich_Tuan_{week_number}_{monday.strftime('%Y%m%d')}_{sunday.strftime('%Y%m%d')}"
    html_path = os.path.join(output_dir, f"{filename_base}.html")
    pdf_path = os.path.join(output_dir, f"{filename_base}.pdf")
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
        
    convert_html_to_pdf_playwright(html, pdf_path)
    
    return {
        "html_path": html_path,
        "pdf_path": pdf_path,
        "filename": f"{filename_base}.pdf",
        "week": week_number,
        "from": monday.strftime("%d/%m/%Y"),
        "to": sunday.strftime("%d/%m/%Y"),
        "item_count": len(items)
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Tạo lịch tuần tự động dưới dạng PDF cho CECICS")
    parser.add_argument("--week", type=int, default=12, help="Số thứ tự tuần (mặc định: 12)")
    parser.add_argument("--date", type=str, default="2026-11-25", help="Ngày đại diện tuần (YYYY-MM-DD)")
    parser.add_argument("--mode", type=str, default="sample", choices=["sample", "db", "auto"], help="Nguồn dữ liệu: sample (mẫu chuẩn tuần này), db (từ csdl), auto")
    parser.add_argument("--next-week", action="store_true", help="Tự động tạo trước cho tuần kế tiếp (dành cho tự động chạy vào cuối tuần)")
    parser.add_argument("--outdir", type=str, default="public/schedules", help="Thư mục xuất file")
    
    args = parser.parse_args()
    
    base_date = datetime.datetime.strptime(args.date, "%Y-%m-%d").date()
    if args.next_week:
        monday, sunday = get_next_week_range(base_date)
        week_num = args.week + 1
    else:
        monday, sunday = get_week_range(base_date)
        week_num = args.week
        
    res = export_weekly_schedule(
        week_number=week_num,
        target_date=monday,
        output_dir=args.outdir,
        source_mode=args.mode
    )
    print(f"Xuất bản thành công Lịch Tuần {res['week']} ({res['from']} - {res['to']}):")
    print(f"-> File PDF: {res['pdf_path']}")
    print(f"-> File HTML: {res['html_path']}")
