/**
 * Quản lý khóa học mô phỏng CHUỖI NHIỀU BUỔI (lịch định kỳ).
 * Quy chuẩn: ngày dd/mm/yyyy, giờ hh:mm (24h), T2 là đầu tuần, T7 & CN là cuối tuần.
 * Lưu trữ nội bộ: ngày YYYY-MM-DD, giờ HH:mm.
 */
import type { SimClassRecord } from './types';
import { addDaysYmd, dayOfWeekYmd, formatVnDateWithDay, parseTimeToMinutes } from './time';

export type SimBuoiHoc = 'Sáng' | 'Chiều' | 'Cả ngày';
export type SimSessionStatus = 'Kế hoạch' | 'Đã hoàn thành' | 'Đã điều chỉnh' | 'Hủy';

export interface SimSessionItem {
  buoi_so: number;
  ngay: string; // YYYY-MM-DD
  buoi_hoc: SimBuoiHoc | string;
  gio_bd: string; // HH:mm
  gio_kt: string; // HH:mm
  room_id?: string; // Phòng riêng của buổi (rỗng = dùng phòng chung của khóa)
  ktv_phu_trach?: string; // KTV riêng của buổi (rỗng = dùng KTV chung của khóa)
  noi_dung_buoi?: string;
  trang_thai_buoi?: SimSessionStatus | string;
  ghi_chu?: string;
}

/** Thứ tự hiển thị chuẩn tuần lễ: T2 → CN (giá trị theo getUTCDay: 1..6, 0). */
export const WEEKDAY_OPTIONS: { value: number; label: string; weekend: boolean }[] = [
  { value: 1, label: 'T2', weekend: false },
  { value: 2, label: 'T3', weekend: false },
  { value: 3, label: 'T4', weekend: false },
  { value: 4, label: 'T5', weekend: false },
  { value: 5, label: 'T6', weekend: false },
  { value: 6, label: 'T7', weekend: true },
  { value: 0, label: 'CN', weekend: true },
];

export const MAX_SIM_SESSIONS = 60;

/** Giờ mặc định theo buổi học. */
export function defaultTimesForBuoi(buoi: string): { gio_bd: string; gio_kt: string } {
  if (buoi === 'Chiều') return { gio_bd: '13:30', gio_kt: '16:30' };
  if (buoi === 'Cả ngày') return { gio_bd: '08:00', gio_kt: '16:30' };
  return { gio_bd: '08:00', gio_kt: '11:30' };
}

/** Sắp xếp theo ngày + giờ và đánh số lại Buổi 1..n. */
export function normalizeSimSessions(items: SimSessionItem[]): SimSessionItem[] {
  return [...items]
    .filter((x) => x && x.ngay)
    .sort((a, b) => `${a.ngay}${a.gio_bd}`.localeCompare(`${b.ngay}${b.gio_bd}`))
    .map((x, i) => ({ ...x, buoi_so: i + 1 }));
}

/**
 * Đọc danh sách buổi của một lớp. Tương thích ngược: lớp cũ (1 buổi) chưa có
 * `danh_sach_buoi_json` sẽ được suy ra từ ngay/gio_bd/gio_kt.
 */
export function parseSimSessions(
  sc: Pick<SimClassRecord, 'ngay' | 'gio_bd' | 'gio_kt' | 'buoi_hoc'> & {
    danh_sach_buoi_json?: string;
    room_id?: string;
    ktv_phu_trach?: string;
  }
): SimSessionItem[] {
  const raw = String(sc.danh_sach_buoi_json || '').trim();
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        return normalizeSimSessions(
          arr.map((x: Record<string, unknown>) => ({
            buoi_so: Number(x.buoi_so || 0),
            ngay: String(x.ngay || ''),
            buoi_hoc: String(x.buoi_hoc || 'Sáng'),
            gio_bd: String(x.gio_bd || ''),
            gio_kt: String(x.gio_kt || ''),
            room_id: x.room_id ? String(x.room_id) : '',
            ktv_phu_trach: x.ktv_phu_trach ? String(x.ktv_phu_trach) : '',
            noi_dung_buoi: x.noi_dung_buoi ? String(x.noi_dung_buoi) : '',
            trang_thai_buoi: String(x.trang_thai_buoi || 'Kế hoạch'),
            ghi_chu: x.ghi_chu ? String(x.ghi_chu) : '',
          }))
        );
      }
    } catch {
      /* fallback bên dưới */
    }
  }
  if (!sc.ngay) return [];
  return [
    {
      buoi_so: 1,
      ngay: sc.ngay,
      buoi_hoc: sc.buoi_hoc || 'Sáng',
      gio_bd: sc.gio_bd,
      gio_kt: sc.gio_kt,
      room_id: '',
      ktv_phu_trach: '',
      trang_thai_buoi: 'Kế hoạch',
    },
  ];
}

/** Các buổi còn hiệu lực (không bị hủy). */
export function activeSimSessions(sc: Parameters<typeof parseSimSessions>[0]): SimSessionItem[] {
  return parseSimSessions(sc).filter((s) => s.trang_thai_buoi !== 'Hủy');
}

/** Phòng thực tế của một buổi: phòng riêng (nếu có) hoặc phòng chung của khóa. */
export function resolveSessionRoom(sc: { room_id?: string }, item: SimSessionItem): string {
  return String(item.room_id || sc.room_id || '');
}

export function resolveSessionKtv(sc: { ktv_phu_trach?: string }, item: SimSessionItem): string {
  return String(item.ktv_phu_trach || sc.ktv_phu_trach || '');
}

/**
 * Sinh danh sách buổi lặp theo các thứ trong tuần trong khoảng [tu_ngay, den_ngay].
 * weekdays dùng giá trị getUTCDay (0=CN, 1=T2 ... 6=T7).
 */
export function generateRecurringSessions(params: {
  tu_ngay: string;
  den_ngay: string;
  weekdays: number[];
  buoi_hoc: string;
  gio_bd: string;
  gio_kt: string;
  max?: number;
}): SimSessionItem[] {
  const { tu_ngay, den_ngay, weekdays, buoi_hoc, gio_bd, gio_kt } = params;
  const max = params.max ?? MAX_SIM_SESSIONS;
  const allowed = new Set(weekdays);
  const out: SimSessionItem[] = [];
  if (!tu_ngay || !den_ngay || allowed.size === 0 || den_ngay < tu_ngay) return out;
  let cur = tu_ngay;
  let guard = 0;
  while (cur <= den_ngay && guard < 400 && out.length < max) {
    if (allowed.has(dayOfWeekYmd(cur))) {
      out.push({
        buoi_so: out.length + 1,
        ngay: cur,
        buoi_hoc,
        gio_bd,
        gio_kt,
        room_id: '',
        ktv_phu_trach: '',
        trang_thai_buoi: 'Kế hoạch',
      });
    }
    cur = addDaysYmd(cur, 1);
    guard++;
  }
  return out;
}

/** Kiểm tra hợp lệ danh sách buổi, trả về thông báo lỗi đầu tiên (hoặc null). */
export function validateSimSessions(items: SimSessionItem[]): string | null {
  if (items.length === 0) return 'Khóa học phải có ít nhất 1 buổi.';
  if (items.length > MAX_SIM_SESSIONS) return `Tối đa ${MAX_SIM_SESSIONS} buổi trong một hồ sơ.`;
  const seen = new Set<string>();
  for (const it of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.ngay)) return `Buổi ${it.buoi_so}: ngày không hợp lệ.`;
    const a = parseTimeToMinutes(it.gio_bd);
    const b = parseTimeToMinutes(it.gio_kt);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
      return `Buổi ${it.buoi_so} (${formatVnDateWithDay(it.ngay)}): giờ kết thúc phải sau giờ bắt đầu (hh:mm).`;
    }
    const key = `${it.ngay}_${it.gio_bd}`;
    if (seen.has(key)) return `Buổi ${it.buoi_so} (${formatVnDateWithDay(it.ngay)} ${it.gio_bd}) bị trùng lặp.`;
    seen.add(key);
  }
  return null;
}

/**
 * Công thức Bảng dự trù (Mẫu 1):
 *  - Mô hình / Dụng cụ (dùng lại): SL/nhóm × Số nhóm
 *  - Vật tư tiêu hao: SL/nhóm × Số nhóm × Số buổi
 */
export function computeItemTotal(
  item: { loai: string; sl_nhom?: number },
  so_nhom: number,
  so_buoi: number
): number {
  const base = Math.max(1, Number(item.sl_nhom) || 1) * Math.max(1, Number(so_nhom) || 1);
  return item.loai === 'vat_tu' ? base * Math.max(1, Number(so_buoi) || 1) : base;
}

/** Nhãn sự kiện lịch: "[Mô phỏng] <Tên khóa> - Buổi X/N" */
export function simSessionLabel(noi_dung: string, buoi_so: number, total: number): string {
  return total > 1 ? `[Mô phỏng] ${noi_dung} - Buổi ${buoi_so}/${total}` : `[Mô phỏng] ${noi_dung}`;
}

/** Tóm tắt khoảng thời gian khóa học: "T2 (01/12/2026) → T4 (17/12/2026) · 6 buổi" */
export function summarizeSimSchedule(items: SimSessionItem[]): string {
  if (items.length === 0) return '';
  const first = items[0];
  const last = items[items.length - 1];
  if (items.length === 1) return `${formatVnDateWithDay(first.ngay)} (${first.gio_bd}–${first.gio_kt})`;
  return `${formatVnDateWithDay(first.ngay)} → ${formatVnDateWithDay(last.ngay)} · ${items.length} buổi`;
}
