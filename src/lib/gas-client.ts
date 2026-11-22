import crypto from 'crypto';
import { DomainError, type ActionName } from '@/core/mutations';

export async function invokeGasAction<T = unknown>(
  action: ActionName,
  payload: Record<string, unknown>,
  actorEmail: string
): Promise<T> {
  const url = process.env.GAS_WEBAPP_URL;
  const secret = process.env.GAS_HMAC_SECRET;
  if (!url || !secret) {
    throw new Error('Thiếu GAS_WEBAPP_URL hoặc GAS_HMAC_SECRET để ghi dữ liệu qua Apps Script.');
  }

  const ts = Date.now();
  const canonical = `${action}|${actorEmail}|${ts}|${JSON.stringify(payload || {})}`;
  const sig = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload, actor: actorEmail, ts, sig }),
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Apps Script trả lỗi HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    ok: boolean;
    data?: T;
    code?: string;
    error?: string;
    details?: unknown;
  };
  if (!json.ok) {
    throw new DomainError(json.code || 'GAS_ERROR', json.error || 'Lỗi ghi dữ liệu trên Google Sheets.', json.details);
  }
  return json.data as T;
}
