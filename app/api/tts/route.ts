import { NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// edge-tts 合成英文单词发音（标准美式神经网络音色）
//
// 流程：
// 1. 按单词生成缓存文件名（md5），检查磁盘缓存，命中则直接返回。
// 2. 未命中则交给「常驻 Python 合成服务」（scripts/tts_server.py）合成，
//    复用 edge-tts 连接，避免每次 spawn 起新进程的启动/import 开销。
// 3. 返回 mp3 音频流。
//
// 缓存目录：项目根 .tts-cache/（首次合成后永久复用，避免重复联网合成）

const CACHE_DIR = path.join(process.cwd(), ".tts-cache");
const PYTHON = process.env.PYTHON_BIN || "python";
const TTS_SERVER_SCRIPT = path.join(process.cwd(), "scripts", "tts_server.py");

// 单个合成请求的超时（毫秒）。首次仍需联网，给足余量；命中进程后通常远快于此。
const SYNTHESIS_TIMEOUT_MS = 15000;

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

// ---------------------------------------------------------------------------
// 常驻 Python 合成服务：模块级单例，进程按需启动、崩溃自动重建
// ---------------------------------------------------------------------------

type PendingRequest = {
  id: number;
  word: string;
  cachePath: string;
  resolve: (r: { ok: boolean; path?: string; error?: string }) => void;
};

let serverProc: ChildProcess | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();
let lineBuf = "";

function ensureServer() {
  if (serverProc && !serverProc.killed) return serverProc;

  const child = spawn(PYTHON, [TTS_SERVER_SCRIPT], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  serverProc = child;
  lineBuf = "";

  child.stdout.on("data", (chunk: Buffer) => {
    lineBuf += chunk.toString("utf8");
    let idx: number;
    while ((idx = lineBuf.indexOf("\n")) >= 0) {
      const line = lineBuf.slice(0, idx).trim();
      lineBuf = lineBuf.slice(idx + 1);
      if (!line) continue;
      handleServerLine(line);
    }
  });

  child.stderr.on("data", (d: Buffer) => {
    // 仅记录，不影响请求处理
    console.warn("[tts-server]", d.toString().trim());
  });

  child.on("error", () => {
    failAllPending("tts server spawn error");
    serverProc = null;
  });

  child.on("close", () => {
    failAllPending("tts server exited");
    serverProc = null;
  });

  return child;
}

function handleServerLine(line: string) {
  let msg: { id?: number; ok?: boolean; path?: string; error?: string };
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const req = pending.get(msg.id as number);
  if (!req) return;
  pending.delete(msg.id as number);
  req.resolve({
    ok: Boolean(msg.ok),
    path: msg.path,
    error: msg.error,
  });
}

function failAllPending(error: string) {
  for (const req of pending.values()) {
    req.resolve({ ok: false, error });
  }
  pending.clear();
}

// 向常驻服务发起一次合成请求；失败（进程退出/超时/error）返回 { ok: false }
function synthesize(word: string, cachePath: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = ensureServer();
    const id = nextId++;

    let settled = false;
    const settle = (r: { ok: boolean; path?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pending.delete(id);
      resolve(r);
    };

    // 真正的响应回调：命中时 settle
    pending.set(id, { id, word, cachePath, resolve: settle });

    const timer = setTimeout(() => {
      settle({ ok: false, error: "synthesis timeout" });
    }, SYNTHESIS_TIMEOUT_MS);

    const line = JSON.stringify({ id, word, cachePath });
    try {
      child.stdin!.write(line + "\n");
    } catch (e) {
      settle({ ok: false, error: "stdin write failed" });
    }
  });
}

// 优雅关闭常驻服务（进程退出时调用，避免僵尸进程）
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

  // 未命中：交给常驻服务合成
  const result = await synthesize(word, cachePath);
  if (!result.ok || !fs.existsSync(cachePath)) {
    console.warn(`[tts] 合成失败 "${word}":`, result.error || "no output");
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
