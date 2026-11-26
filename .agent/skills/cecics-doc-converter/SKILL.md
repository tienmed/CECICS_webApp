---
name: cecics-doc-converter
description: Hướng dẫn sử dụng và vận hành Microsoft MarkItDown trong dự án CECICS WebApp để chuẩn hóa các tài liệu Word (.docx), Excel (.xlsx), PDF, trạm thi OSCE và đề cương giảng dạy sang Markdown phục vụ nạp RAG / Graphify.
---

# CECICS Document Converter (Microsoft MarkItDown)

Micro-skill hướng dẫn tích hợp và vận hành công cụ chuyển đổi tài liệu **Microsoft MarkItDown** trong hệ sinh thái CECICS WebApp.

## 1. Mục Đích & Vai Trò
- **Làm sạch dữ liệu đầu vào:** Chuyển đổi các tệp văn phòng từ các Bộ môn lâm sàng gửi về Trung tâm CECICS (`.docx`, `.xlsx`, `.pdf`) sang định dạng Markdown chuẩn.
- **Tiết kiệm Token & Tối ưu hóa Context:** Định dạng Markdown bảng biểu (`| header |`) và đề mục giúp giảm 30-50% số lượng token so với việc để LLM đọc văn bản thô hoặc dump thô cấu trúc XML/JSON.
- **Đầu vào chuẩn cho Graphify / RAG:** Cung cấp nguồn văn bản chuẩn mực để `graphify_rag.py` trích xuất thực thể y khoa (Entities) và đồ thị quan hệ mô phỏng lâm sàng.

## 2. Cách Thực Thi
Sử dụng trình thông dịch Python hệ thống để gọi script điều phối:

### Chuyển đổi tệp đơn lẻ:
```powershell
$p = (Get-ItemProperty "HKCU:\Software\Python\PythonCore\*\InstallPath").ExecutablePath
& $p scripts/doc_converter.py "duong/dan/tai_lieu.docx" -o "docs/tai_lieu.md"
```

### Chuyển đổi hàng loạt trong thư mục:
```powershell
$p = (Get-ItemProperty "HKCU:\Software\Python\PythonCore\*\InstallPath").ExecutablePath
& $p scripts/doc_converter.py "data/incoming_docs" -o "data/markdown_docs" --batch
```

## 3. Quy Tắc Bảo Mật & Y Khoa
- **Dữ liệu thật 100% ([P0-CECICS-ZERO-MOCK-INVARIANT]):** Chỉ dùng để chuyển đổi tài liệu kịch bản và kế hoạch thật của Trung tâm, không tạo văn bản giả lập.
- **Bảo mật Y tế nội bộ:** Dữ liệu Markdown sau khi chuyển đổi chỉ cấp cho các mô hình Local Tầng 1 (Qwen/Gemma) phục vụ phân tích nội bộ.
