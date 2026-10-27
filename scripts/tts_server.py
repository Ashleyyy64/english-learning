#!/usr/bin/env python3
"""常驻 TTS 合成服务（消除每次 spawn 的启动/import 开销）。

与 app/api/tts/route.ts 通过 stdin/stdout 的「行分隔 JSON」协议通信：

  请求（Node -> 服务，一行一条）：
    {"id": "<唯一请求id>", "word": "hello", "cachePath": "/abs/path/xxx.mp3"}

  响应（服务 -> Node，一行一条）：
    {"id": "<回显请求id>", "ok": true,  "path": "/abs/path/xxx.mp3", "size": 1234}
    {"id": "<回显请求id>", "ok": false, "error": "..."}

说明：
  - 合成成功会先把 mp3 写到 cachePath，再回 ok=true（Node 端读缓存文件返回）。
  - 复用 edge_tts.Communicate，省去解释器启动 + import 开销（这是首因延迟的主要来源）。
  - 主循环用同步 stdin.readline() 读行，每行独立 asyncio.run 合成；跨平台（Linux/Windows）都可靠。
  - 遇到未知异常不退出，回 error 继续服务下一个请求。
  - 收到 EOF（父进程关闭 stdin）时优雅退出。

用法：
  python3 tts_server.py
"""

import json
import re
import sys

import edge_tts

VOICE = "en-US-AriaNeural"

# 允许的单词格式，与 route.ts 保持一致的校验（字母/连字符/空格/撇号）
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z' -]{0,63}$")


def synthesize(word: str, output_path: str) -> int:
    """合成并保存到 output_path，返回字节数。"""
    import asyncio

    async def _run():
        communicate = edge_tts.Communicate(word, VOICE)
        await communicate.save(output_path)

    asyncio.run(_run())

    import os
    return os.path.getsize(output_path)


def handle(req: dict) -> dict:
    req_id = req.get("id")
    word = (req.get("word") or "").strip()
    cache_path = req.get("cachePath") or ""

    resp = {"id": req_id}
    if not word or not WORD_RE.match(word):
        resp["ok"] = False
        resp["error"] = "invalid word"
        return resp
    if not cache_path:
        resp["ok"] = False
        resp["error"] = "missing cachePath"
        return resp

    try:
        size = synthesize(word, cache_path)
        resp["ok"] = True
        resp["path"] = cache_path
        resp["size"] = size
    except Exception as e:  # noqa: BLE001
        resp["ok"] = False
        resp["error"] = str(e)
    return resp


def write_line(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = handle(req)
        write_line(resp)
    return 0


if __name__ == "__main__":
    sys.exit(main())
