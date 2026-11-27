---
name: cecics-core-workflows
description: >-
  Hướng dẫn và quy chuẩn thực thi 4 luồng nghiệp vụ cốt lõi tại CECICS:
  Hành chính (văn bản, lịch tuần, 3% CME), Kỹ thuật & Vật tư mô phỏng,
  Đào tạo (Lịch giảng, Khóa học CME, Train-the-Trainer), và Nghiên cứu Khoa học (Đề tài, VAME, HNKHCN).
---

# CECICS Core Workflows Runbook & Standard Operating Procedures (SOP)

Hướng dẫn vận hành chuẩn hóa 4 luồng tác vụ chính tại Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS) — ĐH Y khoa Phạm Ngọc Thạch.

---

## 1. Luồng Hành chính (Administration & Office Flow)

### A. Nguyên tắc Giao dịch & Email Công vụ
* **Email gửi đi duy nhất**: `cecics@pnt.edu.vn` (Tên hiển thị: `"Trung tâm CECICS - ĐH Y khoa Phạm Ngọc Thạch"`).
* **Đầu mối đăng ký & tư vấn khóa đào tạo CME**:
  - Phụ trách thường trực: **CN. Nguyễn Như Quỳnh**
  - Điện thoại: `0708.180.889`
  - Email: `quynhnn@pnt.edu.vn` / `cecics@pnt.edu.vn`
* **Lãnh đạo Hành chính phụ trách**: **BS. Nguyễn Minh Luân** (`bsminhluan@pnt.edu.vn`).

### B. Quy trình Lịch tuần & Giao ban định kỳ
1. **Lập & rà soát lịch tuần**: Lập lịch phòng học, ca mô phỏng, lịch trực KTV và lịch họp giao ban.
2. **Phát hành theo chuẩn bảo mật**: Chỉ gửi tự động cho **18 nhân sự chính thức** theo `data/cecics_official_staff.json`. Tuyệt đối không gửi thông tin nội bộ ra các email ngoài CECICS trừ khi có chỉ định đích danh.
3. **Biên bản cuộc họp (Meeting Minutes)**:
   - Thể thức chuẩn 4 phần (Thông tin chung, Nội dung, Kết luận, Action Matrix).
   - Tự động map người phụ trách vào 18 nhân sự và đẩy sang bảng `MeetingTasks`.

### C. Quản lý Tài chính & Quỹ Quản lý Gián tiếp 3% CME
* Phối hợp định kỳ với Phòng Tài chính Kế toán (`taichinh@pnt.edu.vn`) tiếp nhận Phiếu chuyển lập danh sách nhân sự thụ hưởng phí quản lý gián tiếp 3% các lớp đào tạo ngắn hạn, liên tục tổ chức tại CECICS.

---

## 2. Luồng Kỹ thuật & Vật tư Mô phỏng (Technical & Consumables Flow)

### A. Quản lý Không gian & Hạ tầng
* **Khu vực hoạt động**: Lầu 7, 8, 9 (Khu C - Số 1 Dương Quang Trung) và các phòng mô phỏng tại cơ sở Tân Nhựt (Nhà D).
* **Kiểm tra xung đột phòng & thiết bị**:
  - Điều kiện không trùng: `(startA < endB && endA > startB)`.
  - Kiểm tra trạng thái bảo trì (`EquipmentMaintenance`) trước khi duyệt phân phòng cho ca mô phỏng.

### B. Quản lý Vật tư Tiêu hao (Consumables)
1. **Định mức tiêu hao**: Mỗi kịch bản mô phỏng lâm sàng hoặc trạm thi OSCE đi kèm bảng định mức vật tư tiêu hao chuẩn (bơm tiêm, găng tay, kim luồn, catheter, dây truyền, mô hình da giả, thuốc mô phỏng).
2. **Quy trình KTV chuẩn bị**:
   - Trước ca học 30 phút: Xuất kho và set up phòng/mannequin theo đúng kịch bản giảng viên đăng ký.
   - Sau ca học: Thu dọn, vệ sinh thiết bị, kiểm kê vật tư còn lại và cập nhật vào sổ theo dõi vật tư tiêu hao.

---

## 3. Luồng Đào tạo & Khóa học (Undergraduate & CME Training Flow)

### A. Lịch Giảng dạy Đại học & Sau Đại học
* Bảng lịch giảng hiển thị phân nhóm theo tuần (Thứ 2 đến Chủ Nhật), có huy hiệu buổi (`☀️ Sáng`, `🌤️ Chiều`, `🌙 Tối`).
* **Hoán đổi lịch giảng (`/doi-lich`)**:
  - Bắt buộc là hoán đổi **2 chiều đối ứng** (không hỗ trợ dạy thay 1 chiều).
  - Chỉ hiển thị các buổi trong tương lai (`s.ngay > today`).
  - **Ràng buộc nghiêm ngặt**: Chỉ đổi với buổi đối ứng của đồng nghiệp **thuộc cùng 1 lớp** (`session.lop === targetSession.lop`).

### B. Khóa học Đào tạo Liên tục (CME) & Hội thảo Chuyên đề
1. **Phối hợp quản trị**: Thực hiện theo đúng *Quy trình thực hiện lớp CME tại CECICS* phối hợp với **Trung tâm Đào tạo Nhân lực Y tế** (`ttdtnhanlucyte@pnt.edu.vn`).
2. **Đồng bộ Google Calendar**:
   - Tự động thêm học viên và giảng viên trực tiếp vào danh sách **Attendees** của sự kiện Calendar thuộc `cecics@pnt.edu.vn`.
   - Bật cờ `sendInvites: false` / `sendUpdates: 'none'`, cấm gửi tệp đính kèm `.ics` qua email.
3. **Các chương trình chuẩn hóa tiêu biểu**:
   - *Train the Healthcare Simulation Trainer* (BSCKI. Bùi Phan Quỳnh Phương chủ nhiệm - Chuẩn SESAM).
   - Hội thảo chuyên môn mô phỏng (ví dụ: *Corticoid và mặt trái qua mô phỏng lâm sàng*, *Cấp cứu sốc phản vệ và ngừng tuần hoàn in-situ*).

---

## 4. Luồng Nghiên cứu Khoa học & Đổi mới Sáng tạo (Research Flow)

### A. Sổ Cái Theo Dõi Đề Tài NCKH
Quản lý tập trung tại `data/research_projects.json` và phân hệ `/nghien-cuu`:
* `DT-CECICS-2026-VAME`: Báo cáo thẩm định độ giá trị trạm OSCE theo Evidence-Centered Design (ECD) tại Hội nghị VAME X-2026 (Chủ nhiệm: ThS. Nguyễn Thị Mỹ Linh).
* `DT-CECICS-2026-HNKHCN`: Chủ trì Phiên Mô phỏng Lâm sàng tại Hội nghị KHKT Thường niên lần XIX Trường ĐHYK Phạm Ngọc Thạch (Chủ nhiệm: BSCKII. Trịnh Trung Tiến).
* `DT-CECICS-2026-01`: Đánh giá hiệu quả mô hình mô phỏng tại chỗ In-situ Simulation xử trí cấp cứu sốc phản vệ và ngừng tuần hoàn (Chủ nhiệm: BSCKII. Trịnh Trung Tiến).
* `DT-CECICS-2026-02`: Mô hình Người bệnh Chuẩn tích hợp bảng kiểm điện tử trong thi OSCE SV Y4 (Chủ nhiệm: TS. Nguyễn Ngọc Phương Thư).
* `DT-CECICS-2025-01`: Đánh giá sự tự tin và hài lòng sau khóa đào tạo giảng viên lâm sàng Train-the-Trainer (Chủ nhiệm: BSCKI. Bùi Phan Quỳnh Phương).

### B. Sáng kiến Đổi mới Sáng tạo Cấp Trường
* Sáng kiến: *“Xây dựng mô hình tổ chức Hội thảo, Lớp học mô phỏng lâm sàng tại Trung tâm CECICS”*.
* Sáng kiến: *“Chuẩn hóa Người bệnh Chuẩn (Standardized Patient) phục vụ đào tạo và lượng giá OSCE”*.
* Công cụ: *“Bộ công cụ đánh giá độ giá trị nội dung CVI-CVR cho các trạm thi lâm sàng”*.
* Báo cáo tiến độ và nghiệm thu định kỳ gửi về **Phòng Quản lý Nghiên cứu Khoa học và Hợp tác Quốc tế** (`nckh.htqt@pnt.edu.vn`).
