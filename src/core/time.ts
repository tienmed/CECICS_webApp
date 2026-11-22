/**
 * Tiện ích ngày giờ thuần (không phụ thuộc múi giờ máy chủ, chuẩn YYYY-MM-DD và HH:mm theo giờ Việt Nam UTC+7).
 */

export function parseTimeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

export function minutesToTime(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Trả về timestamp UTC (ms) ứng với YYYY-MM-DD và HH:mm (tính theo giờ UTC+7 cố định). */
export function toVnDateTimeMs(dateStr: string, timeStr: string): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  const mins = parseTimeToMinutes(timeStr);
  if (!dm || Number.isNaN(mins)) return NaN;
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const d = Number(dm[3]);
  const h = Math.floor(mins / 60);
  const mi = mins % 60;
  return Date.UTC(y, mo, d, h - 7, mi, 0, 0);
}

export function durationHours(gioBd: string, gioKt: string): number {
  const a = parseTimeToMinutes(gioBd);
  const b = parseTimeToMinutes(gioKt);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round(((b - a) / 60) * 100) / 100;
}

export function todayVnYmd(now: Date = new Date()): string {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const y = vn.getUTCFullYear();
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vn.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowVnIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function addDaysYmd(ymd: string, days: number): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!dm) return ymd;
  const ms = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]) + days);
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const a = toVnDateTimeMs(fromYmd, '00:00');
  const b = toVnDateTimeMs(toYmd, '00:00');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Thứ trong tuần của YYYY-MM-DD (0=CN, 1=T2 ... 6=T7) */
export function dayOfWeekYmd(ymd: string): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!dm) return 0;
  return new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]))).getUTCDay();
}

export type PeriodKind = 'month' | 'quarter' | 'year';

export function getPeriodRange(
  kind: PeriodKind,
  year: number,
  index: number // month: 1..12, quarter: 1..4, year: ignored
): { start: string; end: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (kind === 'month') {
    const m = Math.max(1, Math.min(12, index));
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
    return {
      start: `${year}-${pad(m)}-01`,
      end: `${year}-${pad(m)}-${pad(lastDay)}`,
      label: `Tháng ${m}/${year}`,
    };
  }
  if (kind === 'quarter') {
    const q = Math.max(1, Math.min(4, index));
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      start: `${year}-${pad(startMonth)}-01`,
      end: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
      label: `Quý ${q}/${year}`,
    };
  }
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: `Năm ${year}`,
  };
}

export function countWorkingDays(startYmd: string, endYmd: string, workingDaysCsv: string): number {
  const allowed = new Set(
    workingDaysCsv
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n))
  );
  if (allowed.size === 0) return 0;
  let count = 0;
  let cur = startYmd;
  let guard = 0;
  while (cur <= endYmd && guard < 400) {
    if (allowed.has(dayOfWeekYmd(cur))) count++;
    cur = addDaysYmd(cur, 1);
    guard++;
  }
  return count;
}

export function formatVnDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Tên viết tắt thứ trong tuần (T2 đến T7, CN). Thứ 2 là ngày đầu tuần. */
export function dayOfWeekShortVn(ymd: string): string {
  const dow = dayOfWeekYmd(ymd);
  const map = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return map[dow] || '';
}

/** Tên đầy đủ thứ trong tuần tiếng Việt. */
export function dayOfWeekLongVn(ymd: string): string {
  const dow = dayOfWeekYmd(ymd);
  const map = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return map[dow] || '';
}

/** Kiểm tra ngày cuối tuần (Thứ 7 hoặc Chủ Nhật). */
export function isWeekendVn(ymd: string): boolean {
  const dow = dayOfWeekYmd(ymd);
  return dow === 0 || dow === 6; // 0: CN, 6: T7
}

/** Định dạng ngày kèm thứ: "T2 (20/11/2026)" hoặc "Thứ Hai (20/11/2026)". */
export function formatVnDateWithDay(ymd: string, short: boolean = true): string {
  const day = short ? dayOfWeekShortVn(ymd) : dayOfWeekLongVn(ymd);
  return `${day} (${formatVnDate(ymd)})`;
}

/** Định dạng hiển thị giờ và ngày: "hh:mm dd/mm/yyyy" */
export function formatVnDateTime(ymd: string, hhmm?: string): string {
  const dateFormatted = formatVnDate(ymd);
  if (!hhmm) return dateFormatted;
  return `${hhmm} ${dateFormatted}`;
}
