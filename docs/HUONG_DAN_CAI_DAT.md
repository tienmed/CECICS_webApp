# Hướng dẫn Cài đặt & Đấu nối Google Sheets + Apps Script (100% Miễn phí)

Hệ thống CECICS Web App có 2 chế độ:
- **`DATA_MODE=local`**: chạy ngay bằng file JSON cục bộ (`.data/db.json`) kèm dữ liệu mẫu để thử nghiệm giao diện và quy trình.
- **`DATA_MODE=sheets`**: kết nối Google Sheets + Google Apps Script + Google Calendar + Gmail bằng tài khoản chuyên dụng của trung tâm.

---

## Bước 1 — Chuẩn bị tài khoản Google của Trung tâm
1. Sử dụng 1 tài khoản Google chuyên dụng (ví dụ `cecics@pnt.edu.vn`).
2. Tạo 1 file **Google Sheets** mới tên `CECICS_Database_MVP`, lưu lại **Spreadsheet ID** (chuỗi giữa `/d/` và `/edit` trên thanh địa chỉ).

## Bước 2 — Triển khai Google Apps Script (Cửa ghi có khóa `LockService`)
1. Trên máy tính, chạy lệnh đóng gói mã Apps Script:
   ```bash
   npm run gas:build
   ```
2. Toàn bộ file cần nạp nằm trong thư mục `apps-script/dist/`:
   - `appsscript.json`
   - `core.bundle.js`
   - `main.js`, `store.js`, `calendar.js`, `mail.js`, `triggers.js`, `setup.js`
3. Mở Google Sheets `CECICS_Database_MVP` → **Tiện ích mở rộng (Extensions) → Apps Script**.
4. Bật hiển thị file manifest (`Cài đặt dự án → Hiển thị tệp kê khai "appsscript.json"`), chép nội dung từng file từ `apps-script/dist/` vào (hoặc dùng `npx clasp push --rootDir apps-script/dist`).
5. Trong **Cài đặt dự án → Thuộc tính tập lệnh (Script Properties)**, thêm các khóa sau:
   - `SPREADSHEET_ID`: ID file Google Sheets ở Bước 1.
   - `HMAC_SECRET`: chuỗi bí mật ngẫu nhiên (tối thiểu 32 ký tự, trùng với `GAS_HMAC_SECRET` trên Vercel).
   - `SYSTEM_ADMIN_EMAIL`: email tài khoản trung tâm (dùng cho trigger chạy nền).
   - `CALENDAR_ID` *(tùy chọn)*: ID lịch riêng của trung tâm (nếu bỏ trống sẽ dùng lịch mặc định của tài khoản trung tâm).
6. Trong Apps Script Editor, chọn hàm `setupCecicsSheets` và bấm **Chạy (Run)** 1 lần để:
   - Tự tạo đủ 17 tab kèm dòng tiêu đề chuẩn.
   - Nạp sẵn 2 cơ sở (`HH`, `TN`) và 9 tham số `Settings`.
   - Cài đặt tự động 2 trigger: đồng bộ RSVP mỗi 15 phút và quét leo thang lúc 07:00 hằng ngày.
7. Bấm **Triển khai (Deploy) → Triển khai mới (New deployment) → Ứng dụng web (Web app)**:
   - Thực thi dưới dạng: **Tôi (`Me`)**.
   - Người có quyền truy cập: **Bất kỳ ai (`Anyone`)** *(an toàn vì mọi request POST đều bắt buộc xác thực chữ ký HMAC-SHA256 kèm mốc thời gian ±5 phút)*.
   - Lưu lại URL kết thúc bằng `/exec` → điền vào `GAS_WEBAPP_URL`.

## Bước 3 — Cấu hình Google Cloud (Đăng nhập OAuth & Đọc Sheets)
Bằng cùng tài khoản Google của trung tâm, truy cập https://console.cloud.google.com/ và tạo 1 Project mới (miễn phí):
1. Bật **Google Sheets API**.
2. **Tạo Service Account** (đọc Sheets nhanh):
   - Vào **IAM & Admin → Service Accounts → Create Service Account**.
   - Tạo Key dạng JSON → lấy `client_email` (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) và `private_key` (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`).
   - Chia sẻ file Google Sheets `CECICS_Database_MVP` cho `client_email` với quyền **Người xem (Viewer)**.
3. **Tạo OAuth Client ID** (đăng nhập):
   - Vào **APIs & Services → OAuth consent screen**: chọn **Internal** (nếu chỉ nội bộ PNT) hoặc **External** (nếu cho phép Gmail ngoài trong danh sách trắng), chỉ dùng 3 scope cơ bản `openid`, `email`, `profile` (không cần Google xét duyệt).
   - Tạo **OAuth 2.0 Client ID** loại Web application:
     - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` và `https://<ten-mien-cua-ban>.vercel.app/api/auth/callback/google`.
   - Lấy `Client ID` (`AUTH_GOOGLE_ID`) và `Client Secret` (`AUTH_GOOGLE_SECRET`).

## Bước 4 — Nạp danh mục ban đầu vào Sheets
Dán trực tiếp danh sách nhân sự, giảng viên, phòng học, bộ môn, thiết bị từ Excel vào các tab `Users`, `Rooms`, `Departments`, `Equipment`.
- Lưu ý tab `Users`: cột `vai_tro` ghi các mã cách nhau bởi dấu phẩy (VD: `TRUONG_DON_VI,DAO_TAO,GIANG_VIEN`); email ngoài trường đặt `la_nguoi_ngoai = TRUE`.

## Bước 5 — Triển khai lên Vercel (hoặc Cloudflare Pages)
1. Đưa mã nguồn lên kho GitHub (Private).
2. Kết nối kho GitHub vào Vercel, cấu hình toàn bộ biến môi trường theo `.env.example` (chuyển `DATA_MODE=sheets` và `DEMO_MODE=false` khi Go-Live).
