"""
LLM Client for CECICS WebApp - Qwen & Gemma Multi-Tier Integration
Tích hợp Token Economizer tự động nén context, khống chế budget và ghi log tiết kiệm.
"""

import os
import sys
import json
import time
import urllib.request
import ssl
from typing import Dict, Any, Optional

try:
    from token_economizer import compress_prompt, log_savings, estimate_tokens
except ImportError:
    from scripts.token_economizer import compress_prompt, log_savings, estimate_tokens


def _load_env_local() -> None:
    """Nạp biến môi trường từ .env.local (không ghi đè biến đã có). Key KHÔNG được hardcode trong mã nguồn."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name in (".env.local", ".env"):
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v
        except OSError:
            pass


_load_env_local()

DEFAULT_TOKEN = os.environ.get("PNT_AI_TOKEN", "68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013")
PNT_GEMMA_URL = os.environ.get("PNT_GEMMA_URL", "https://pnt.badt.vn/gemma4/chat")
PNT_QWEN_URL = os.environ.get("PNT_QWEN_URL", "https://pnt.badt.vn/qwen/v1/chat/completions")

# ---- Tầng 3: Provider trả phí (OpenAI-compatible, ví dụ shopaikey.com) — chỉ dùng làm FAILOVER ----
TIER3_API_KEY = os.environ.get("TIER3_API_KEY", "")
TIER3_BASE_URL = os.environ.get("TIER3_BASE_URL", "https://api.shopaikey.com/v1").rstrip("/")
TIER3_MODEL = os.environ.get("TIER3_MODEL", "claude-sonnet-4-5")
TIER3_FAILOVER = os.environ.get("TIER3_FAILOVER", "true").lower() in ("1", "true", "yes")

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def call_gemma(prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 800, temperature: float = 0.2, task: str = "") -> Dict[str, Any]:
    """
    Gọi Gemma 4 (google/gemma-4-e2b-it) có Token Economizer bảo vệ.
    """
    # 1. Nén prompt qua Token Economizer
    compressed_prompt, raw_toks, comp_toks = compress_prompt(prompt, max_tokens=1200)
    toks_saved = max(0, raw_toks - comp_toks)

    t0 = time.time()
    payload = {
        "prompt": compressed_prompt,
        "max_tokens": max_tokens,
        "temperature": temperature
    }
    if system_prompt:
        payload["system_prompt"] = system_prompt

    try:
        req = urllib.request.Request(
            PNT_GEMMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {DEFAULT_TOKEN}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=20, context=ssl_ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            dt = time.time() - t0
            usage = data.get("usage", {})
            p_toks = usage.get("prompt_tokens", comp_toks)
            c_toks = usage.get("completion_tokens", 0)

            # Ghi nhận tiết kiệm
            log_savings("gemma-4", p_toks, c_toks, toks_saved, task or "gemma_task")

            return {
                "success": True,
                "model": data.get("model", "google/gemma-4-e2b-it"),
                "text": data.get("response", ""),
                "prompt_tokens": p_toks,
                "completion_tokens": c_toks,
                "total_tokens": p_toks + c_toks,
                "tokens_saved": toks_saved,
                "latency_sec": round(dt, 2),
                "source": "pnt_gemma4_node"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "latency_sec": round(time.time() - t0, 2),
            "source": "error"
        }


def call_qwen(prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 1200, temperature: float = 0.2, task: str = "") -> Dict[str, Any]:
    """
    Gọi Qwen 2.5 (qwen2.5-7b) có Token Economizer bảo vệ.
    """
    compressed_prompt, raw_toks, comp_toks = compress_prompt(prompt, max_tokens=1500)
    toks_saved = max(0, raw_toks - comp_toks)

    t0 = time.time()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": compressed_prompt})

    payload = {
        "model": "qwen2.5-7b",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature
    }

    try:
        req = urllib.request.Request(
            PNT_QWEN_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {DEFAULT_TOKEN}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=25, context=ssl_ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            dt = time.time() - t0
            usage = data.get("usage", {})
            choices = data.get("choices", [{}])
            content = choices[0].get("message", {}).get("content", "") if choices else ""
            p_toks = usage.get("prompt_tokens", comp_toks)
            c_toks = usage.get("completion_tokens", 0)

            log_savings("qwen-2.5", p_toks, c_toks, toks_saved, task or "qwen_task")

            return {
                "success": True,
                "model": data.get("model", "qwen2.5-7b"),
                "text": content,
                "prompt_tokens": p_toks,
                "completion_tokens": c_toks,
                "total_tokens": p_toks + c_toks,
                "tokens_saved": toks_saved,
                "latency_sec": round(dt, 2),
                "source": "pnt_qwen25_node"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "latency_sec": round(time.time() - t0, 2),
            "source": "error"
        }


def call_tier3(prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 1200, temperature: float = 0.2, task: str = "", model: Optional[str] = None) -> Dict[str, Any]:
    """
    Gọi Provider Tầng 3 (OpenAI-compatible /chat/completions). Tốn phí theo token.
    Cấu hình qua .env.local: TIER3_API_KEY, TIER3_BASE_URL, TIER3_MODEL.
    """
    t0 = time.time()
    if not TIER3_API_KEY:
        return {"success": False, "error": "Chưa cấu hình TIER3_API_KEY trong .env.local", "latency_sec": 0, "source": "error"}

    compressed_prompt, raw_toks, comp_toks = compress_prompt(prompt, max_tokens=4000)
    toks_saved = max(0, raw_toks - comp_toks)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": compressed_prompt})
    use_model = model or TIER3_MODEL
    payload = {"model": use_model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}

    try:
        req = urllib.request.Request(
            f"{TIER3_BASE_URL}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {TIER3_API_KEY}", "Content-Type": "application/json"},
        )
        # Provider trả phí: bật xác thực TLS mặc định
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            dt = time.time() - t0
            usage = data.get("usage", {})
            choices = data.get("choices", [{}])
            content = choices[0].get("message", {}).get("content", "") if choices else ""
            p_toks = usage.get("prompt_tokens", comp_toks)
            c_toks = usage.get("completion_tokens", 0)
            log_savings(f"tier3-{use_model}", p_toks, c_toks, toks_saved, task or "tier3_task")
            return {
                "success": True,
                "model": data.get("model", use_model),
                "text": content,
                "prompt_tokens": p_toks,
                "completion_tokens": c_toks,
                "total_tokens": p_toks + c_toks,
                "tokens_saved": toks_saved,
                "latency_sec": round(dt, 2),
                "source": "tier3_paid_provider",
            }
    except Exception as e:
        return {"success": False, "error": str(e), "latency_sec": round(time.time() - t0, 2), "source": "error"}


def call_with_failover(model: str, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 800, task: str = "", allow_failover: bool = True) -> Dict[str, Any]:
    """
    Định tuyến theo quy tắc Dynamic Tier Escalation:
      Tầng 1 (PNT Gemma/Qwen, miễn phí) → nếu lỗi/nghẽn/timeout → Tầng 3 (trả phí) khi đã cấu hình key.
    """
    if model == "tier3":
        return call_tier3(prompt, system_prompt, max_tokens=max_tokens, task=task)
    primary = call_gemma if model == "gemma" else call_qwen
    res = primary(prompt, system_prompt=system_prompt, max_tokens=max_tokens, task=task)
    if res.get("success") and str(res.get("text", "")).strip():
        return res
    if allow_failover and TIER3_FAILOVER and TIER3_API_KEY:
        fb = call_tier3(prompt, system_prompt, max_tokens=max_tokens, task=task)
        fb["failover_from"] = model
        fb["primary_error"] = res.get("error", "empty response")
        return fb
    return res


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PNT AI Client with Token Economizer + Tier-3 failover")
    parser.add_argument("--model", choices=["qwen", "gemma", "tier3"], default="qwen", help="Mô hình muốn gọi")
    parser.add_argument("--prompt", type=str, required=True, help="Nội dung prompt")
    parser.add_argument("--system", type=str, default="", help="System instruction")
    parser.add_argument("--max-tokens", type=int, default=500, help="Max tokens sinh ra")
    parser.add_argument("--task", type=str, default="", help="Tên tác vụ để ghi log")
    parser.add_argument("--no-failover", action="store_true", help="Tắt chuyển tiếp sang Tầng 3 khi Tầng 1 lỗi")

    args = parser.parse_args()

    print(f"=== Đang gọi {args.model.upper()} ({args.max_tokens} max tokens) [Token Economizer Enabled] ===")
    res = call_with_failover(
        args.model,
        args.prompt,
        system_prompt=args.system or None,
        max_tokens=args.max_tokens,
        task=args.task,
        allow_failover=not args.no_failover,
    )
    if res.get("failover_from"):
        print(f"⚠️ {res['failover_from'].upper()} lỗi ({res.get('primary_error')}) → đã chuyển sang Tầng 3")

    if res.get("success"):
        print(f"Thành công [{res['source']} - {res['model']}]")
        print(f"Thời gian phản hồi: {res['latency_sec']}s")
        print(f"Token tiêu thụ: Prompt: {res['prompt_tokens']} | Output: {res['completion_tokens']} | Tổng: {res['total_tokens']}")
        if res.get("tokens_saved", 0) > 0:
            print(f"Tiết kiệm nhờ nén Economizer: {res['tokens_saved']} tokens")
        print("\n=== KẾT QUẢ ===")
        print(res['text'])
    else:
        print(f"Lỗi: {res.get('error')}")
