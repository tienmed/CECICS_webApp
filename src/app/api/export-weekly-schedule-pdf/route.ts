import { NextResponse } from 'next/server';
import { getCurrentUser, isDemoModeEnabled } from '@/lib/auth';
import { getSnapshot } from '@/lib/repository';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let user = await getCurrentUser();
  if (!user && isDemoModeEnabled()) {
    const db = await getSnapshot();
    user = db.Users[0] || null;
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Vui lòng đăng nhập để xuất bản lịch tuần.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const week = url.searchParams.get('week') || '12';
  const download = url.searchParams.get('download') === 'true';
  const print = url.searchParams.get('print') === 'true';
  const htmlOnly = url.searchParams.get('html') === 'true';

  const schedulesDir = path.join(process.cwd(), 'public', 'schedules');
  
  // Tìm file PDF / HTML phù hợp với số tuần
  let matchedPdf = '';
  let matchedHtml = '';

  if (fs.existsSync(schedulesDir)) {
    const files = fs.readdirSync(schedulesDir);
    const pdfFile = files.find((f) => f.startsWith(`Lich_Tuan_${week}_`) && f.endsWith('.pdf'));
    const htmlFile = files.find((f) => f.startsWith(`Lich_Tuan_${week}_`) && f.endsWith('.html'));

    if (pdfFile) matchedPdf = path.join(schedulesDir, pdfFile);
    if (htmlFile) matchedHtml = path.join(schedulesDir, htmlFile);
  }

  // Nếu người dùng muốn xem bản HTML để xem hoặc bấm nút in trực tiếp
  if (htmlOnly || (print && !matchedPdf)) {
    if (matchedHtml && fs.existsSync(matchedHtml)) {
      let content = fs.readFileSync(matchedHtml, 'utf-8');
      if (print) {
        // Tự động chèn script window.print() nếu gọi qua chế độ in
        content = content.replace('</body>', '<script>window.onload = function() { window.print(); };</script></body>');
      }
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  // Phục vụ file PDF
  if (matchedPdf && fs.existsSync(matchedPdf)) {
    const fileBuffer = fs.readFileSync(matchedPdf);
    const filename = path.basename(matchedPdf);

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');

    if (download) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      // Inline view, mở thẳng trên tab trình duyệt để xem và bấm nút Print của PDF Viewer
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    }

    return new Response(fileBuffer, { status: 200, headers });
  }

  // Nếu chưa có file sẵn, trả về bản HTML mặc định kèm hướng dẫn
  if (matchedHtml && fs.existsSync(matchedHtml)) {
    let content = fs.readFileSync(matchedHtml, 'utf-8');
    if (print) {
      content = content.replace('</body>', '<script>window.onload = function() { window.print(); };</script></body>');
    }
    return new Response(content, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json(
    { ok: false, error: `Chưa có bản PDF cho tuần ${week}. Vui lòng tạo lịch tuần trước.` },
    { status: 404 }
  );
}
