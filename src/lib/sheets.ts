import { JWT } from 'google-auth-library';
import { columnsOf, fromRow, TABLE_NAMES, type TableName } from '@/core/schema';
import type { DatabaseSnapshot } from '@/core/types';

interface CacheEntry {
  data: DatabaseSnapshot;
  expiresAt: number;
}

let snapshotCache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateSheetsCache() {
  snapshotCache = null;
}

function getJwtClient(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  }
  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

/**
 * Đọc toàn bộ 17 tab bằng 1 lần gọi Sheets API v4 `values:batchGet` + cache 30 giây.
 */
export async function readAllFromSheets(bypassCache = false): Promise<DatabaseSnapshot> {
  if (!bypassCache && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.data;
  }

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) throw new Error('Thiếu biến môi trường GOOGLE_SHEETS_ID');

  const auth = getJwtClient();
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Không lấy được access token từ Service Account');

  const ranges = TABLE_NAMES.map((name) => {
    const colCount = columnsOf(name).length;
    const endCol = String.fromCharCode(64 + Math.min(26, colCount));
    return `ranges=${encodeURIComponent(`${name}!A2:${endCol}`)}`;
  }).join('&');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets API lỗi (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { valueRanges?: { values?: unknown[][] }[] };
  const valueRanges = json.valueRanges || [];
  const snap = {} as Record<TableName, unknown[]>;

  TABLE_NAMES.forEach((name, idx) => {
    const rows = valueRanges[idx]?.values || [];
    snap[name] = rows.filter((r) => r && r.length > 0 && r[0] !== '' && r[0] !== undefined).map((r) => fromRow(name, r));
  });

  const typed = snap as unknown as DatabaseSnapshot;
  snapshotCache = { data: typed, expiresAt: Date.now() + CACHE_TTL_MS };
  return typed;
}
