#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CECICS Document Converter (Powered by Microsoft MarkItDown)
Chuyển đổi các định dạng tài liệu văn phòng (Word .docx, Excel .xlsx, PDF, CSV, HTML)
sang Markdown sạch phục vụ phân tích RAG / GraphRAG và cấp dữ liệu cho LLM nội bộ (Qwen/Gemma).

Tuân thủ:
- Tối ưu hóa Token theo microsoft-token-economizer & PROMPT_OPTIMIZATION_RULES
- Định dạng UTF-8 chuẩn Tiếng Việt
"""

import os
import sys
import argparse
from typing import Optional

try:
    from markitdown import MarkItDown
except ImportError:
    print("[ERROR] Thư viện markitdown chưa được cài đặt. Chạy lệnh: pip install markitdown", file=sys.stderr)
    sys.exit(1)


def convert_file_to_markdown(file_path: str, output_path: Optional[str] = None) -> str:
    """
    Chuyển đổi một tệp tài liệu sang Markdown.
    Nếu output_path được chỉ định, lưu kết quả vào tệp đó.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Không tìm thấy tệp: {file_path}")

    md = MarkItDown()
    result = md.convert(file_path)
    markdown_content = result.text_content.strip()

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        print(f"[OK] Đã xuất Markdown thành công tại: {output_path}")

    return markdown_content


def batch_convert_directory(input_dir: str, output_dir: str) -> None:
    """
    Quét và chuyển đổi hàng loạt tài liệu trong một thư mục.
    """
    supported_exts = {".docx", ".xlsx", ".pptx", ".pdf", ".html", ".csv", ".json", ".xml"}
    if not os.path.isdir(input_dir):
        raise NotADirectoryError(f"Thư mục không tồn tại: {input_dir}")

    os.makedirs(output_dir, exist_ok=True)
    count = 0

    for root, _, files in os.walk(input_dir):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in supported_exts:
                src_path = os.path.join(root, file)
                rel_path = os.path.relpath(src_path, input_dir)
                dest_path = os.path.join(output_dir, os.path.splitext(rel_path)[0] + ".md")

                try:
                    convert_file_to_markdown(src_path, dest_path)
                    count += 1
                except Exception as e:
                    print(f"[WARN] Lỗi khi chuyển đổi {src_path}: {e}", file=sys.stderr)

    print(f"[DONE] Hoàn tất chuyển đổi {count} tệp tài liệu sang Markdown.")


def main():
    parser = argparse.ArgumentParser(description="CECICS MarkItDown Document Converter")
    parser.add_argument("input", help="Đường dẫn tệp tài liệu hoặc thư mục nguồn")
    parser.add_argument("-o", "--output", help="Đường dẫn tệp .md hoặc thư mục đích xuất Markdown")
    parser.add_argument("--batch", action="store_true", help="Chế độ quét thư mục chuyển đổi hàng loạt")

    args = parser.parse_args()

    if args.batch:
        dest = args.output if args.output else os.path.join(args.input, "markdown_export")
        batch_convert_directory(args.input, dest)
    else:
        if not args.output:
            # In ra màn hình stdout
            text = convert_file_to_markdown(args.input)
            print(text)
        else:
            convert_file_to_markdown(args.input, args.output)


if __name__ == "__main__":
    main()
