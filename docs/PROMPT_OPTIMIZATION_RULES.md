# BỘ QUY TẮC TỐI ƯU TOKEN & QUOTA KHI DÙNG QWEN, GEMMA VÀ GRAPHIFY

Tài liệu này chuẩn hóa toàn bộ quy trình: (1) Kết nối API Qwen và Gemma tối ưu quota, (2) Kỹ thuật thiết kế prompt tiết kiệm token, (3) Ứng dụng Graphify xây dựng cấu trúc node code để nạp ngữ cảnh tinh gọn (GraphRAG) thay vì nhồi mã nguồn thô.

---

## 1. MÔ HÌNH PHÂN TẦNG VAI TRÒ 4 LỚP (TIERED ARCHITECTURE)

Để tiết kiệm 80%–90% lượng token tiêu thụ và tránh chạm trần Rate Limit (RPM/TPM) của các API miễn phí, hệ thống áp dụng cơ chế phân tầng nghiêm ngặt:

```
[Mã nguồn Codebase] ──(Tầng 0: AST Parser Cục bộ)──> 0 TOKEN LLM
                                                           │
[Tài liệu & Specs] ──(Tầng 1: Gemma / Google AI Studio)─> Trích xuất Semantic & Gán nhãn Community
                                                           │
[Yêu cầu / Câu hỏi] ─(Tầng 2: Graphify Subgraph Prune)──> Cắt tỉa đồ thị theo Budget (1.000–1.500 tok)
                                                           │
[Prompt Tinh gọn] ──(Tầng 3: Qwen 2.5 Coder / OpenRouter)─> Sinh mã nguồn / Phân tích logic chuyên sâu
```

| Tầng | Thành phần phụ trách | Mô hình / Công cụ | Chi phí Token LLM | Nhiệm vụ chính |
|---|---|---|---|---|
| **Tầng 0** | Trích xuất Cấu trúc Code | Tree-sitter / Graphify AST | **0 token (Hoàn toàn miễn phí)** | Bóc tách functions, classes, interfaces, imports, calls |
| **Tầng 1** | Phân tích Ngữ nghĩa & Docs | Gemma 2 / 3 (Google AI Studio) | **Rất thấp (Free tier lớn)** | Tóm tắt tài liệu markdown, spec, gán nhãn cụm cộng đồng |
| **Tầng 2** | Nén Ngữ cảnh & Cắt tỉa | Graphify Traversal Engine | **0 token (Thuật toán cục bộ)** | BFS/DFS cắt lát Subgraph liên quan theo Token Budget cố định |
| **Tầng 3** | Suy luận Logic & Sinh Code | Qwen 2.5 Coder (OpenRouter/Groq) | **Tối ưu theo đúng Budget** | Nhận Subgraph đã nén để viết code, sửa lỗi, review logic |

---

## 2. QUY TẮC DÙNG API KẾT NỐI GEMMA & QWEN (TỐI ƯU QUOTA)

### 2.1. Gemma qua Google AI Studio API
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/openai/` (hoặc Gemini SDK native).
- **Model tối ưu**: `gemma-2-9b-it` hoặc `gemma-2-27b-it`.
- **Ưu điểm Quota**: Free tier hào phóng từ Google (RPM cao, không tốn phí bản quyền).
- **Quy tắc sử dụng**:
  - **Không gửi toàn bộ file code**: Chỉ gửi tiêu đề, docstring, danh sách API và tài liệu nghiệp vụ.
  - **Kích hoạt Context Caching** nếu có một System Prompt hoặc Schema dùng lặp lại nhiều lần trên 32k tokens.
  - **Strict Output Format**: Yêu cầu trả về JSON phẳng (không bọc văn bản rườm rà) để giảm số token đầu ra (Output tokens thường đắt và chậm hơn Input tokens).

### 2.2. Qwen 2.5 Coder qua OpenRouter / Groq API
- **Model tối ưu**:
  - `qwen/qwen-2.5-coder-32b-instruct` (Cân bằng xuất sắc giữa trí tuệ lý luận và tốc độ).
  - `qwen/qwen-2.5-coder-7b-instruct` (Siêu nhẹ, tốc độ phản hồi cực nhanh cho tác vụ đơn giản).
- **Quy tắc sử dụng**:
  - **Exponential Backoff**: Khi gặp lỗi HTTP `429 Too Many Requests`, tự động chờ $2^n$ giây thay vì gửi dồn dập.
  - **Temperature = 0.1 – 0.2**: Đảm bảo sinh code chính xác, mang tính tiền định (deterministic), giảm thiểu việc model "nói lan man" gây tốn token đầu ra.
  - **Max Output Tokens Capped**: Luôn cấu hình `max_tokens: 1500–2048` phù hợp với kích thước khối code cần sinh.

---

## 3. CẤU TRÚC NODE CODE TRONG GRAPHIFY (SIGNATURE-LEVEL PRUNING)

Khi xây dựng đồ thị code bằng Graphify, **tuyệt đối không nhồi nguyên thân hàm (code body) vào node đồ thị**. Mỗi node code được chuẩn hóa theo cấu trúc tinh giản sau:

### 3.1. Cấu trúc Schema của một Code Node
```json
{
  "id": "SessionRecord",
  "kind": "type",
  "file": "src/core/types.ts",
  "lines": "L45-L65",
  "signature": "export type SessionRecord = Rec<'Sessions'>;",
  "summary": "Đại diện cho 1 buổi học hoặc ca coi thi trong hệ thống",
  "community": 1
}
```

### 3.2. Cấu trúc Schema của một Edge (Cạnh quan hệ)
Chỉ giữ 5 loại cạnh quan trọng nhất để chống bão hòa đồ thị:
- `calls`: Hàm A gọi Hàm B.
- `imports`: Module A nhập thành phần từ Module B.
- `defines`: File A định nghĩa Type/Class B.
- `implements`: Class A hiện thực Interface B.
- `mutates`: Action A thay đổi dữ liệu của Table B.

### 3.3. Cơ chế "God-Node Pruning" (Cắt tỉa Hub trung tâm)
- Các file như `schema.ts`, `types.ts`, `index.ts` thường kết nối tới hầu hết mọi file trong dự án (Hub/God Nodes).
- **Quy tắc**: Khi nạp đồ thị vào prompt, **chỉ lấy các liên kết cấp 1 (1-hop) có liên quan trực tiếp đến tác vụ hiện tại**, không mở rộng toàn bộ cây của God Node để tránh việc nạp hàng trăm node không cần thiết.

---

## 4. KỸ THUẬT NÉN PROMPT (PROMPT TOKEN OPTIMIZATION)

### 4.1. Dạng biểu diễn Đồ thị siêu nén: Compact Adjacency List
Thay vì xuất JSON dài dòng, biểu diễn đồ thị nén dưới dạng danh sách kề:

```markdown
### Code Graph Context (Budget: 600 tokens)
[Nodes]
- N1: `findRoomConflicts(candidate, sessions, simClasses)` (src/core/conflict.ts:L70) -> Slot[]
- N2: `suggestAvailableRooms(params)` (src/core/suggest.ts:L15) -> RoomSuggestion[]
- N3: `executeAction("assignRoom", payload)` (src/core/mutations.ts:L450) -> ActionResult

[Edges]
- N3 calls N1, N2
- N2 calls N1
```

*So sánh hiệu quả*: Dạng này tiêu tốn **ít hơn 70% số token** so với JSON chuẩn và ít hơn **90%** so với việc dán toàn bộ mã nguồn của 3 file trên.

### 4.2. Mẫu System Prompt chuẩn hóa cho Qwen 2.5 Coder
```markdown
Bạn là lập trình viên cấp cao. Dưới đây là LÁT CẮT ĐỒ THỊ (Code Subgraph) đại diện cho các thành phần liên quan trong codebase.
Quy tắc:
1. Chỉ dựa vào các Interface, Function Signatures và Quan hệ đã cho trong đồ thị.
2. Không sinh mã thừa ngoài phạm vi được yêu cầu.
3. Trả về mã nguồn chính xác, kèm type annotations đầy đủ. Không giải thích dông dài trừ khi được yêu cầu.
```

---

## 5. BẢNG TÍNH TOÁN TIẾT KIỆM TOKEN THỰC TẾ

| Phương pháp | Input Tokens | Output Tokens | Tổng Token | Quota tiêu thụ |
|---|---|---|---|---|
| **Cách truyền thống** (Dán toàn bộ 5-10 file mã nguồn) | 18.000 – 35.000 | 1.500 | ~36.500 | Dễ chạm trần TPM, tốn quota nhanh |
| **Graphify + Gemma/Qwen (Signature Subgraph)** | **1.200 – 2.000** | 800 – 1.200 | **~2.800** | **Giảm 92% token**, chạy mượt mà trên Free Tier |
