---
name: graphify-rag
description: Quy trình tối ưu hóa Token và GraphRAG cho dự án CECICS WebApp. Sử dụng AST phân tích cấu trúc, trích xuất đồ thị quan hệ (Adjacency List) với ngân sách token nghiêm ngặt, sau đó điều phối giữa Gemma 4 (ngữ nghĩa) và Qwen 2.5 Coder (sinh mã/debug).
metadata:
  priority: 1
  tools:
    - scripts/graphify_rag.py
    - scripts/llm_client.py
    - docs/PROMPT_OPTIMIZATION_RULES.md
---

# Graphify RAG & Token Optimization Skill

Skill này hướng dẫn quy trình tạo prompt tối ưu token, khai thác cấu trúc đồ thị code và điều phối kết nối AI cụm PNT / Cloud trong dự án CECICS WebApp.

## 1. Nguyên Tắc 4 Tầng Tối Ưu

1. **Tầng 1 - AST Static Analysis (0 Token, 0đ)**:
   - Dùng TypeScript Compiler API / AST parser để đọc import/export, interface, types.
   - Tuyệt đối không gọi LLM để làm việc của parser tĩnh.
2. **Tầng 2 - Gemma 4 Semantic Extraction (~1.0s, PNT Node)**:
   - Dùng khi cần tóm tắt specs, docstrings, changelog, gán nhãn cụm (Community labels).
3. **Tầng 3 - Subgraph Pruning & Budget Traversal**:
   - Dùng `python scripts/graphify_rag.py subgraph --entry <path> --budget 1000`.
   - Giới hạn BFS 1-2 hop quanh node mục tiêu. Cắt bỏ God Nodes (`src/core/types.ts`, `lucide-react`).
4. **Tầng 4 - Qwen 2.5 Coder Synthesis (~2.3s, PNT Node)**:
   - Đưa cây Adjacency List nhỏ gọn vào Qwen 2.5 để sinh code chính xác, tránh hoàn toàn hallucination.

## 2. Lệnh CLI Thường Dùng

```powershell
# 1. Trích xuất cây quan hệ node theo ngân sách token (BFS)
python scripts/graphify_rag.py subgraph --entry "src/lib/permissions.ts" --budget 800

# 2. Sinh prompt mẫu đã tối ưu cho Qwen Coder
python scripts/graphify_rag.py query --node "src/lib/auth.ts" --question "Cách bổ sung role mới"

# 3. Gọi trực tiếp Qwen 2.5 sinh code
python scripts/llm_client.py --model qwen --prompt "Viết hàm helper..." --max-tokens 300

# 4. Gọi trực tiếp Gemma 4 tóm tắt nghiệp vụ
python scripts/llm_client.py --model gemma --prompt "Tóm tắt logic..." --max-tokens 200

# 5. Cập nhật Đồ thị Tri thức Codebase (Offline AST, 0 Token)
$env:GRAPHIFY_BACKEND="none"; graphify . --update; graphify cluster-only .
```
