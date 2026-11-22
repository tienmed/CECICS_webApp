import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CECICS — Hệ thống Vận hành Số hóa',
  description: 'Trung tâm Kỹ năng và Sáng tạo Mô phỏng Lâm sàng (CECICS) — Lịch giảng, Phân phòng, Lớp mô phỏng & Thiết bị',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
