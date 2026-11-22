---
name: cecics-auth-cookies
description: Hướng dẫn gỡ lỗi xác thực, xử lý NextAuth v5 (Auth.js beta), cookie session, cơ chế TrustHost, Google OAuth và Demo Login trong dự án CECICS WebApp.
metadata:
  priority: 3
---

# CECICS Authentication & Cookie Debugging Skill

Skill này cung cấp các bước chẩn đoán và khắc phục sự cố xác thực trong hệ thống CECICS WebApp.

## 1. Cấu Trúc Xác Thực 2 Chế Độ
1. **Chế độ Google OAuth (Cloud)**:
   - Sử dụng NextAuth v5 (`@auth/core`, `next-auth@5.0.0-beta.32`).
   - Cookie phiên: `authjs.session-token` (hoặc `__Secure-authjs.session-token` trên HTTPS).
   - Kiểm tra domain: Chỉ cho phép email có đuôi `@pnt.edu.vn` hoặc email ngoài nằm trong bảng `Users` (whitelist).
2. **Chế độ Demo Login (Local / Dev)**:
   - Kích hoạt khi `DEMO_MODE=true` trong `.env.local`.
   - Cookie phiên: `cecics_demo_email=<url_encoded_email>`.
   - Endpoint: `POST /api/demo-login` với payload `{"email": "admin@pnt.edu.vn"}`.

## 2. Các Lỗi Phổ Biến & Cách Khắc Phục
* **Lỗi `UntrustedHost` (500 Error trên `/api/auth/*`)**:
  - Nguyên nhân: Auth.js v5 yêu cầu xác thực host khi chạy sau proxy hoặc cổng tùy biến.
  - Khắc phục: Đảm bảo có `trustHost: true` trong cấu hình `NextAuth({...})` tại `src/lib/auth.ts`.
* **Lỗi `google-auth-library` bundling failure**:
  - Nguyên nhân: Next.js cố gắng bundle các thư viện Node.js nguyên bản.
  - Khắc phục: Đã khai báo `serverExternalPackages: ['google-auth-library']` trong `next.config.mjs`.
* **Lỗi mất phiên đăng nhập khi F5**:
  - Kiểm tra cookie trong trình duyệt:
    - Mở DevTools > Application > Cookies > `http://localhost:3000`.
    - Kiểm tra xem cookie `cecics_demo_email` hoặc `authjs.session-token` có giá trị không.
    - Lưu ý Path phải là `/` và SameSite là `Lax`.
