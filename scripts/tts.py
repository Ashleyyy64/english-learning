#!/usr/bin/env python3
"""edge-tts 合成脚本：把英文单词合成为 mp3，输出到指定路径。

用法：
  python tts.py <word> <output.mp3>

返回码 0 表示成功，非 0 表示失败。
使用微软神经网络音色 en-US-AriaNeural，标准美式发音。
"""
import sys
import asyncio

import edge_tts

VOICE = "en-US-AriaNeural"


async def synthesize(word: str, output_path: str) -> None:
    communicate = edge_tts.Communicate(word, VOICE)
    await communicate.save(output_path)


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: tts.py <word> <output.mp3>", file=sys.stderr)
        return 2

    word = sys.argv[1].strip()
    output_path = sys.argv[2].strip()
    if not word:
        return 2

    try:
        asyncio.run(synthesize(word, output_path))
        return 0
    except Exception as e:  # noqa: BLE001
        print(f"tts error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
