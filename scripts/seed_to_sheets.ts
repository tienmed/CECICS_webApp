import { buildMockSeed } from '../src/lib/mock-seed';
import { TABLE_NAMES, toRow, type TableName } from '../src/core/schema';
import { JWT } from 'google-auth-library';

async function seedToSheets() {
  const seed = buildMockSeed();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !key || !sheetId) {
    throw new Error('Thiếu cấu hình Service Account hoặc Sheet ID');
  }

  const auth = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const { token } = await auth.getAccessToken();

  console.log('🔄 Đang đồng bộ dữ liệu mẫu lên Google Sheets:', sheetId);

  const dataPayload = [];
  for (const name of TABLE_NAMES) {
    const list = seed[name] || [];
    if (list.length === 0) continue;

    // Convert records to rows
    const rows = list.map((rec) => toRow(name, rec));
    dataPayload.push({
      range: `${name}!A2`,
      values: rows,
    });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: dataPayload,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lỗi cập nhật Sheets: ${res.status} - ${err}`);
  }

  const result = await res.json();
  console.log('✅ Đã đồng bộ thành công dữ liệu mẫu lên Google Sheets!');
  console.log(`Số ô được cập nhật: ${result.totalUpdatedCells}, số hàng: ${result.totalUpdatedRows}`);
}

seedToSheets().catch(console.error);
