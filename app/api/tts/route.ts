import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// edge-tts 合成英文单词发音（标准美式神经网络音色）
//
// 流程：
// 1. 按单词生成缓存文件名（md5），检查磁盘缓存，命中则直接返回。
// 2. 未命中则调用 scripts/tts.py（edge-tts）合成 mp3 到缓存目录。
// 3. 返回 mp3 音频流。
//
// 缓存目录：项目根 .tts-cache/（首次合成后永久复用，避免重复联网合成）

const CACHE_DIR = path.join(process.cwd(), ".tts-cache");
const PYTHON = process.env.PYTHON_BIN || "python";

// 确保缓存目录存在
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// 单词 -> 缓存文件名（md5 前 16 位，避免文件名特殊字符/长度问题）
function cachePathFor(word: string): string {
  const hash = createHash("md5").update(word.toLowerCase()).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.mp3`);
}

// 调用 Python edge-tts 脚本合成，返回 Promise<boolean>
function synthesize(word: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), "scripts", "tts.py");
    const child = spawn(PYTHON, [script, word, outputPath], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 15000); // 15 秒超时

    child.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        resolve(true);
      } else {
        if (stderr) console.warn(`[tts] 合成失败 "${word}":`, stderr.trim());
        resolve(false);
      }
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = (searchParams.get("word") || "").trim();

  if (!word) {
    return NextResponse.json({ error: "缺少 word 参数" }, { status: 400 });
  }

  // 仅允许合理的单词（字母、连字符、空格、撇号），避免被当作 shell 参数注入
  if (!/^[A-Za-z][A-Za-z' -]{0,63}$/.test(word)) {
    return NextResponse.json({ error: "无效的单词" }, { status: 400 });
  }

  ensureCacheDir();
  const cachePath = cachePathFor(word);

  // 命中缓存：直接返回
  if (fs.existsSync(cachePath)) {
    const data = fs.readFileSync(cachePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // 未命中：合成
  const ok = await synthesize(word, cachePath);
  if (!ok) {
    return NextResponse.json({ error: "语音合成失败" }, { status: 500 });
  }

  const data = fs.readFileSync(cachePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
