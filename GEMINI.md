# CECICS WebApp - Hướng Dẫn & Quy Chuẩn Dự Án

Hệ thống Vận hành Số hóa Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS) — Trường Đại học Y khoa Phạm Ngọc Thạch.

## 1. Công Nghệ & Kiến Trúc
- **Framework**: Next.js 15 (App Router), React 19, TypeScript 5.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`).
- **Thư viện UI chính**: FullCalendar v6 (Lịch giảng/mô phỏng), Recharts v3 (Thống kê giờ giảng), Lucide React.
- **Xác thực**: Auth.js v5 (`next-auth@beta`) + Google OAuth (`@pnt.edu.vn`) + Chế độ Demo (`DEMO_MODE=true`).
- **Dữ liệu**: Hỗ trợ 2 chế độ (`DATA_MODE=local` dùng JSON SQLite, `DATA_MODE=sheets` dùng Google Sheets API + Apps Script).

## 2. Quy Tắc Phân Quyền & Nghiệp Vụ Y Khoa
- **Vai trò Admin**: Chỉ người có vai trò `ADMIN` mới có quyền quản trị danh mục dùng chung (Phòng học, Giảng viên, Bộ môn, Khóa học, Thiết bị mô phỏng) tại phân hệ `/quan-tri`.
- **Vai trò Điều Phối**: Có quyền gán phòng, giải quyết xung đột lịch, phân ca mô phỏng.
- **Tránh trùng lặp / Xung đột phòng**: Luôn kiểm tra giao thoa khoảng thời gian `(startA < endB && endA > startB)` và trạng thái bảo trì của phòng/thiết bị trước khi phê duyệt.

## 3. Quy Tắc Tối Ưu Hóa Prompt & Kết Nối AI (Qwen & Gemma)
- **Tối ưu Token**: Đọc và tuân thủ tuyệt đối [docs/PROMPT_OPTIMIZATION_RULES.md](file:///e:/CECICS_webApp/docs/PROMPT_OPTIMIZATION_RULES.md).
- **Trích xuất Subgraph**: Sử dụng `python scripts/graphify_rag.py subgraph` để trích xuất Adjacency List với ngân sách token <= 1200 tokens trước khi đưa vào LLM.
- **Điều phối Model**:
  - Dùng **Gemma 4** (`scripts/llm_client.py --model gemma`) cho phân tích ngữ nghĩa, tóm tắt specs, gán nhãn community.
  - Dùng **Qwen 2.5** (`scripts/llm_client.py --model qwen`) cho sinh mã TypeScript/React, debug AST nodes.

## 4. Skills Dự Án Tích Hợp
- [`.agent/skills/graphify-rag/SKILL.md`](file:///e:/CECICS_webApp/.agent/skills/graphify-rag/SKILL.md): Token budget, AST extraction, Qwen/Gemma routing.
- [`.agent/skills/microsoft-token-economizer/SKILL.md`](file:///e:/CECICS_webApp/.agent/skills/microsoft-token-economizer/SKILL.md): Microsoft Research TokenEconomizer (Micro-skills, Tool Pruning, Loop Guard).
- [`.agent/skills/nextjs-react-guidance/SKILL.md`](file:///e:/CECICS_webApp/.agent/skills/nextjs-react-guidance/SKILL.md): React 19 & Next.js 15 App Router best practices, loại bỏ hydration mismatch.
- [`.agent/skills/cecics-auth-cookies/SKILL.md`](file:///e:/CECICS_webApp/.agent/skills/cecics-auth-cookies/SKILL.md): Auth.js v5 cookie debugging, Google OAuth & Demo Login.

## 5. Quy Chuẩn Vận Hành Nghiệp Vụ Lâm Sàng Nâng Cao
- **Chỉ Sử Dụng Duy Nhất Email `cecics@pnt.edu.vn` để Gửi Thư ([P0-CECICS-EMAIL-SENDER-INVARIANT])**:
  - Toàn bộ các luồng gửi email tự động (Lịch tuần, Lịch mời Google Calendar `.ics / VEVENT`, Báo cáo đối soát giờ giảng bộ môn, Cảnh báo lớp mô phỏng, Thông báo hệ thống) **BẮT BUỘC CHỈ SỬ DỤNG DUY NHẤT** email công vụ của Trung tâm: **`cecics@pnt.edu.vn`** (Tên hiển thị: `"Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch"`).
  - Tuyệt đối **KHÔNG ĐƯỢC** sử dụng bất kỳ email nào khác (kể cả email nghiệp vụ phòng khám `nghiepvupk@pnt.edu.vn` hay email cá nhân) làm địa chỉ gửi (Sender / From) của hệ thống CECICS.
- **Đồng bộ Google Calendar cá nhân**: Luôn ưu tiên mặc định lấy chính địa chỉ email công vụ của giảng viên (`@pnt.edu.vn` thuộc Google Workspace) để gửi lời mời `.ics / VEVENT`, tự động gán vào ứng dụng Google Calendar trên điện thoại/máy tính của giảng viên.
- **Minh bạch khi Từ chối yêu cầu**: Mọi hành động từ chối (hoán đổi lịch, từ chối lớp mô phỏng) bắt buộc cung cấp trường `ly_do_tu_choi`, hiển thị rõ trong lịch sử và trích dẫn nguyên văn trong email thông báo. Cung cấp các nút gợi ý lý do lâm sàng thường gặp (*Trùng lịch mổ, Trực cấp cứu, Đi công tác*).
- **Chuẩn hóa Văn bản Ký số E-Office**: Biểu mẫu đề xuất mở lớp mô phỏng và dự trù dụng cụ - vật tư phải hỗ trợ xuất PDF theo đúng thể thức văn bản hành chính (Quốc hiệu, Tiêu ngữ, bảng biểu kẻ lưới, chữ ký Trưởng Bộ môn và Trưởng Trung tâm CECICS) để liên thông ký số trên hệ thống E-Office của Trường.
- **Định dạng Ngày Giờ & Chuẩn Tuần Lễ**: Luôn sử dụng định dạng ngày `dd/mm/yyyy`, giờ `hh:mm` (24h). Thứ 2 (`T2`) là ngày đầu tuần, Thứ 7 (`T7`) và Chủ Nhật (`CN`) là ngày cuối tuần trên toàn bộ giao diện, biểu mẫu, lịch biểu và báo cáo xuất bản.

## 6. Quy Tắc Vận Hành Kho Mã & Kế Hoạch Lập Trình ([P0-WORKFLOW-COMMIT-VERSION-GRAPHIFY])
- **Sau mỗi task luôn Commit**: Mọi tác vụ hoàn thành (tính năng, cải tiến, vá lỗi, cập nhật tài liệu) sau khi vượt qua kiểm tra (`npx vitest run`) bắt buộc phải lập tức thực hiện `git add` và `git commit` với thông điệp rõ ràng theo chuẩn Conventional Commits. Tuyệt đối không để dồn ứ các thay đổi qua nhiều task mà không commit.
- **Chỉ Push Git khi lên Version mới hoặc có yêu cầu thủ công**:
  - **CHỈ ĐƯỢC PUSH (`git push`)**: (1) Khi lên phiên bản mới (`package.json` nâng version do có tính năng mới), hoặc (2) Khi người dùng yêu cầu rõ ràng bằng lệnh thủ công (ví dụ: *"push git"*, *"đẩy mã nguồn lên github"*).
  - **Khi chỉ Sửa Lỗi (Bug Fix), Refactor, Tinh chỉnh nhỏ**: **CHỈ commit cục bộ (`git commit`)**, tuyệt đối **KHÔNG** tự ý `git push` lên remote.
- **Chỉ lên Version khi có Tính Năng Mới**: Chỉ được phép nâng version (`version` trong `package.json` theo Semantic Versioning) khi bổ sung tính năng mới (Minor/Feature release). Khi sửa lỗi nhỏ (bug fix), refactor, dọn dẹp mã nguồn hoặc cập nhật cấu hình, giữ nguyên version hiện tại.
- **Luôn dựa vào Graphify khi Code, Fix Bug hay Lên Plan**: Bắt buộc sử dụng cấu trúc đồ thị tri thức mã nguồn `graphify` (`graphify-out/GRAPH_REPORT.md`, `graph.json` hoặc lệnh `python scripts/graphify_rag.py subgraph`) để:
  1. *Lên Plan*: Nhận diện trước các God Nodes bị ảnh hưởng (`executeAction`, `todayVnYmd`, `useApp`, `canPerform`...) và ranh giới các Community liên quan.
  2. *Code & Fix Bug*: Tra cứu luồng phụ thuộc giữa các node để sửa đúng nguyên nhân gốc, tránh phá vỡ giao thoa giữa các module.
- **Tài Liệu Nghiệp Vụ (`README.md`)**: File `README.md` tại thư mục gốc chỉ dành riêng để mô tả rõ ràng các module của ứng dụng và mối liên kết luồng nghiệp vụ giữa các node; tuyệt đối không mô tả kỹ thuật, không nhắc cấu trúc code, framework hay đường dẫn file trong `README.md`.


