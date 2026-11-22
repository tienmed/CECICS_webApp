---
name: microsoft-token-economizer
description: Quản lý và vận hành Microsoft TokenEconomizer (Microsoft Research & UC Berkeley) trong CECICS WebApp. Giảm 18-31% chi phí token thông qua Micro-skills (ghi nhớ quirks kho mã), Tool Pruning (cắt tỉa tool schema không dùng) và Loop Guard (chặn vòng lặp lỗi).
metadata:
  priority: 1
  repo: https://github.com/microsoft/TokenEconomizer
  host: antigravity
---

# Microsoft TokenEconomizer Integration Guide

TokenEconomizer là hệ thống kiểm soát chi phí token theo cơ chế "Black-box Controller" do **Microsoft Research** và **UC Berkeley** đồng phát triển.

## 1. Ba Trụ Cột Tối Ưu Cốt Lõi

1. **Micro-skills (EnvFacts)**:
   - Tự động ghi nhớ các đặc thù của repository (lệnh build `npm run dev`, lệnh test `npm run test`, đường dẫn file config, biến môi trường `.env.local`).
   - Bơm các gợi ý súc tích vào đầu phiên làm việc tiếp theo, ngăn chặn agent quét file lặp đi lặp lại.
2. **Tool Pruning (Cắt tỉa Tool Schemas)**:
   - Theo dõi các MCP tools / system tools không được gọi trong dự án và loại bỏ định nghĩa schema của chúng khỏi context window để chống phình token.
3. **Loop Guard (Chặn Vòng Lặp Lỗi)**:
   - Phát hiện các lượt agent thử đi thử lại cùng một lỗi shell hoặc build thất bại, can thiệp kịp thời để chuyển hướng giải quyết.

## 2. Các Lệnh CLI Quản Trị Thường Dùng

```powershell
# 1. Kiểm tra trạng thái TokenEconomizer của dự án CECICS WebApp
C:\Users\bstie\.gemini\config\plugins\tokeneconomizer\scripts\te.cmd --host antigravity status

# 2. Kiểm tra sức khỏe hệ thống (Doctor diagnostics)
C:\Users\bstie\.gemini\config\plugins\tokeneconomizer\scripts\te.cmd --host antigravity doctor

# 3. Cấu hình chế độ Micro-skills (Bật ghi nhớ facts)
C:\Users\bstie\.gemini\config\plugins\tokeneconomizer\scripts\te.cmd --host antigravity config set microskills=envfacts

# 4. Xem giải thích và thống kê token tiết kiệm được
C:\Users\bstie\.gemini\config\plugins\tokeneconomizer\scripts\te.cmd --host antigravity explain
```
