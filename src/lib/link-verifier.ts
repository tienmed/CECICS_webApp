/**
 * Module kiểm chứng trực tiếp tính khả dụng (Live Verification) của các liên kết:
 * 1. Gửi request HEAD/GET để kiểm tra HTTP Status (200, 301, 302, 307, 308)
 * 2. Hỗ trợ timeout và user-agent chuẩn
 * 3. Bất kỳ link nào không truy cập được (404, DNS error, timeout) sẽ bị LOẠI BỎ NGAY LẬP TỨC
 *    khỏi danh sách hiển thị trên bản tin chuyên trang HTML.
 */

export interface LinkCheckResult {
  url: string;
  isAlive: boolean;
  statusCode?: number;
  finalUrl?: string;
  error?: string;
}

export async function verifySingleLink(url: string, timeoutMs = 6000): Promise<LinkCheckResult> {
  if (!url || !url.startsWith('http')) {
    return { url, isAlive: false, error: 'URL không hợp lệ' };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (CECICS Live Link Checker)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  try {
    // Thử bằng HEAD trước để tiết kiệm băng thông
    let res = await fetch(url, {
      method: 'HEAD',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Một số server từ chối HEAD (405 Method Not Allowed), thử lại bằng GET
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    const isAlive = res.ok || (res.status >= 300 && res.status < 400);
    return {
      url,
      isAlive,
      statusCode: res.status,
      finalUrl: res.url,
      error: isAlive ? undefined : `HTTP Status ${res.status}`,
    };
  } catch (err: any) {
    return {
      url,
      isAlive: false,
      error: err.name === 'TimeoutError' ? 'Quá thời gian phản hồi (Timeout)' : (err.message || 'Lỗi mạng'),
    };
  }
}

/**
 * Kiểm chứng hàng loạt liên kết song song
 */
export async function verifyBatchLinks(urls: string[], timeoutMs = 6000): Promise<Map<string, LinkCheckResult>> {
  const results = new Map<string, LinkCheckResult>();
  const checks = urls.map(async (u) => {
    const res = await verifySingleLink(u, timeoutMs);
    results.set(u, res);
  });
  await Promise.all(checks);
  return results;
}
