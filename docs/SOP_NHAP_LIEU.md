# Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP

## 1. Đơn vị Đào tạo (Lịch giảng)
1. Vào mục **Lịch giảng & Coi thi → + Thêm buổi**.
2. Điền học phần, bài giảng, thời gian, cơ sở, giảng viên. Có thể chọn **Lặp lại hằng tuần** (tối đa 16 tuần) hoặc dùng nút **Nhân bản** trên bảng để nhập nhanh lịch cả học kỳ.
3. Hệ thống tự chặn nếu giảng viên bị trùng giờ ở bất kỳ cơ sở nào và gợi ý khung giờ trống gần nhất.
4. Sau khi lưu, lịch mời tự động gửi đến Google Calendar của giảng viên.

## 2. Đơn vị Hành chính (Gán phòng & Coi thi)
1. Hàng ngày kiểm tra mục **Gán phòng** để xếp phòng cho các buổi trong 7 ngày tới.
2. Hệ thống chỉ liệt kê phòng trống cùng cơ sở. Buổi còn ≤ 2 ngày chưa có phòng sẽ báo đỏ và tự động leo thang Ban Lãnh đạo.
3. Nhập lịch **Coi thi** tại mục **Lịch giảng & Coi thi** (chọn Loại buổi = `Coi thi`).
4. Cuối Tháng/Quý/Năm, vào **Thống kê giờ giảng** để xem tổng giờ giảng dạy/coi thi và bấm **Xuất Excel (CSV)**.

## 3. Giảng viên (Kể cả giảng viên thỉnh giảng có email trong Whitelist)
1. Xem lịch cá nhân tại **Lịch giảng & Coi thi** (tick `Chỉ lịch của tôi`) hoặc trực tiếp trên Google Calendar.
2. Khi cần đổi lịch: vào **Hoán đổi lịch → + Gửi yêu cầu đổi lịch**, chọn đồng nghiệp không trùng lịch.
3. Khi đồng nghiệp bấm **Đồng ý nhận**, hệ thống tự cập nhật phân công và lịch Calendar mà không cần chờ duyệt.

## 4. Đầu mối Bộ môn & Đơn vị Kỹ thuật (Lớp Mô phỏng & Thiết bị)
1. Đầu mối Bộ môn đăng ký lớp tại **Lớp mô phỏng → + Đăng ký lớp mô phỏng** trước tối thiểu 14 ngày. Nếu trễ hạn, lớp chuyển trạng thái **Cần xét đặc biệt**.
2. Trưởng Đơn vị Kỹ thuật xem xét và chấp thuận các lớp đăng ký trễ.
3. KTV vào **Rà soát & Gán thiết bị**, chọn phòng mô phỏng và thiết bị sẵn sàng → chuyển trạng thái **Đã duyệt**.
4. Khi thiết bị hỏng đột xuất: KTV vào **Thiết bị & Sự cố → Báo sự cố**. Hệ thống tự quét lớp tương lai bị ảnh hưởng. Nếu **Không kịp sửa**, Đầu mối Bộ môn nhận email và chọn phương án (*Đổi mô hình / Giảm bài / Dời lịch*) ngay trên app.

## 5. Ban Lãnh đạo (Trưởng & Phó Trung tâm)
1. Theo dõi công suất phòng, tiến độ mục tiêu, cảnh báo lệch tải giảng viên tại **Tổng quan**.
2. Vào **Cảnh báo và chỉ đạo từ Ban Lãnh đạo** để xử lý các cảnh báo tự động bằng hình thức **Chỉ đạo / Phê duyệt / Trả lại**. Ý kiến được gửi thẳng đến Trưởng đơn vị phụ trách.
