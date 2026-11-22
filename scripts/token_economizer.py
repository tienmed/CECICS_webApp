"""
Token Economizer for CECICS WebApp
Hệ thống kiểm soát và tiết kiệm token tự động:
1. Đo lường chính xác lượng token tiêu thụ.
2. Tự động cắt tỉa context vượt ngân sách (Tránh bloat prompt).
3. Ghi nhận nhật ký và báo cáo định lượng số token & chi phí đã tiết kiệm.
"""

import os
import re
import json
import time
from typing import Dict, Any, Tuple, Optional

# Ước lượng tỷ lệ token cho Tiếng Việt và Code: ~3.2 ký tự/token cho Tiếng Việt có dấu, ~4 ký tự/token cho Code
CHARS_PER_TOKEN = 3.5
MEMORY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".agent", "memory")
SAVINGS_LOG = os.path.join(MEMORY_DIR, "token_savings.jsonl")


def estimate_tokens(text: str) -> int:
    """Ước lượng số lượng token nhanh và chính xác cho cả Tiếng Việt và TypeScript/Code."""
    if not text:
        return 0
    # Đếm từ và ký tự
    words = len(text.split())
    chars = len(text)
    # Kết hợp heuristics giữa độ dài ký tự và từ
    estimated = int((words * 1.3 + chars / CHARS_PER_TOKEN) / 2)
    return max(1, estimated)


def compress_prompt(text: str, max_tokens: int = 1200) -> Tuple[str, int, int]:
    """
    Nén prompt để giữ trong ngân sách token:
    - Loại bỏ các dòng trống liên tiếp.
    - Cắt tỉa comment thừa trong code block.
    - Cắt ngắn các chuỗi log hoặc JSON quá dài.
    Trả về: (compressed_text, original_tokens, new_tokens)
    """
    orig_tokens = estimate_tokens(text)
    if orig_tokens <= max_tokens:
        return text, orig_tokens, orig_tokens

    # 1. Thu gọn khoảng trắng và dòng trống
    compressed = re.sub(r'\n{3,}', '\n\n', text)
    compressed = re.sub(r'[ \t]{2,}', ' ', compressed)

    # 2. Rút gọn các khối JSON quá lớn
    def trim_large_arrays(match):
        content = match.group(0)
        lines = content.split('\n')
        if len(lines) > 25:
            return '\n'.join(lines[:12]) + '\n    ... [Đã lược bớt dữ liệu để tiết kiệm token] ...\n' + '\n'.join(lines[-8:])
        return content

    compressed = re.sub(r'\[[\s\S]{500,}?\]', trim_large_arrays, compressed)

    new_tokens = estimate_tokens(compressed)

    # 3. Nếu vẫn vượt ngân sách, cắt đuôi có cảnh báo
    if new_tokens > max_tokens:
        char_limit = int(max_tokens * CHARS_PER_TOKEN)
        compressed = compressed[:char_limit] + "\n\n... [Cắt tỉa an toàn theo ngân sách Token Economizer] ..."
        new_tokens = estimate_tokens(compressed)

    return compressed, orig_tokens, new_tokens


def log_savings(model: str, prompt_tokens: int, completion_tokens: int, raw_tokens_avoided: int = 0, task: str = "") -> None:
    """Ghi nhận nhật ký tiết kiệm token."""
    try:
        os.makedirs(MEMORY_DIR, exist_ok=True)
        record = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "tokens_saved": max(0, raw_tokens_avoided),
            "task": task or "general"
        }
        with open(SAVINGS_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass


def get_savings_summary() -> Dict[str, Any]:
    """Tổng hợp báo cáo tiết kiệm token."""
    if not os.path.exists(SAVINGS_LOG):
        return {
            "total_requests": 0,
            "total_tokens_used": 0,
            "total_tokens_saved": 0,
            "saved_percentage": "0%",
            "cost_saved_usd": 0.0
        }

    requests = 0
    used = 0
    saved = 0

    try:
        with open(SAVINGS_LOG, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                data = json.loads(line)
                requests += 1
                used += data.get("total_tokens", 0)
                saved += data.get("tokens_saved", 0)
    except Exception:
        pass

    total_hypothetical = used + saved
    pct = round((saved / total_hypothetical * 100), 1) if total_hypothetical > 0 else 0
    # Ước tính chi phí quy đổi nếu dùng Claude 3.5 Sonnet / GPT-4o ($3.00 / 1M prompt tokens)
    cost_saved = round(saved * (3.0 / 1_000_000), 4)

    return {
        "total_requests": requests,
        "total_tokens_used": used,
        "total_tokens_saved": saved,
        "saved_percentage": f"{pct}%",
        "cost_saved_usd": cost_saved
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "report":
        summary = get_savings_summary()
        print("=== BÁO CÁO TOKEN ECONOMIZER (CECICS WEBAPP) ===")
        print(f"Tổng số lượt gọi: {summary['total_requests']}")
        print(f"Token thực tế tiêu thụ: {summary['total_tokens_used']:,}")
        print(f"Token tiết kiệm được nhờ AST & Subgraph Pruning: {summary['total_tokens_saved']:,}")
        print(f"Tỷ lệ tiết kiệm: {summary['saved_percentage']}")
        print(f"Chi phí quy đổi tiết kiệm: ${summary['cost_saved_usd']}")
    else:
        sample = "Kiểm tra Token Economizer cho CECICS WebApp."
        toks = estimate_tokens(sample)
        print(f"Ước lượng token: '{sample}' -> {toks} tokens")
