"use client";

// TTS 音频缓存预热工具
//
// 在页面加载后后台批量请求 /api/tts 预热磁盘缓存，让用户点击时即时出声。
// 特性：
// - 限流并发（默认 3 个同时请求），避免同时 spawn 过多 Python 进程压垮后端
// - 静默失败（预热失败不影响主流程，点击时仍会走正常 TTS 请求）
// - 去重（同一单词只预热一次）
// - 优先级队列：warmupTtsPriority 传入的「当前词」置顶立即预热，相邻词随后

const inflight = new Set<string>(); // 正在预热的单词（跨组件去重）
let warmupQueue: string[] = [];
let warming = false;

async function warmOne(word: string): Promise<void> {
  if (inflight.has(word)) return;
  inflight.add(word);
  try {
    // 用 fetch 触发 TTS 合成；响应体不读，只要触达即可让后端缓存
    const res = await fetch(`/api/tts?word=${encodeURIComponent(word)}`);
    if (!res.ok) return;
    // 消费掉响应，确保连接正常关闭
    await res.arrayBuffer().catch(() => undefined);
  } catch {
    // 预热失败静默忽略
  } finally {
    inflight.delete(word);
  }
}

// 并发限流执行队列
async function runQueue(concurrency: number): Promise<void> {
  if (warming) return;
  warming = true;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (warmupQueue.length > 0) {
          const word = warmupQueue.shift();
          if (word) await warmOne(word);
        }
      })(),
    );
  }
  await Promise.all(workers);
  warming = false;
}

// 清洗 + 去重（保留传入顺序）
function sanitize(words: string[]): string[] {
  return words
    .map((w) => (w || "").trim())
    .filter(Boolean)
    .filter((w) => /^[A-Za-z][A-Za-z' -]{0,63}$/.test(w));
}

// 预热一批单词（去重后加入队列并开始后台处理）
export function warmupTts(words: string[], concurrency = 3): void {
  const target = sanitize(words);

  // 去重：跳过已在队列或正在预热的
  const fresh = target.filter((w) => !inflight.has(w) && !warmupQueue.includes(w));
  if (fresh.length === 0) return;

  warmupQueue.push(...fresh);
  void runQueue(concurrency);
}

// 优先级预热：priorityWords 置顶立即预热，restWords 随后排队
// 用于「当前词 + 相邻词」场景，保证用户最可能点击的词最先命中缓存
export function warmupTtsPriority(
  priorityWords: string[],
  restWords: string[],
  concurrency = 3,
): void {
  const priority = sanitize(priorityWords).filter(
    (w) => !inflight.has(w) && !warmupQueue.includes(w),
  );
  const rest = sanitize(restWords).filter(
    (w) =>
      !inflight.has(w) &&
      !warmupQueue.includes(w) &&
      !priority.includes(w),
  );

  if (priority.length === 0 && rest.length === 0) return;

  // 置顶：优先词插到队列最前面，随后是其余词
  warmupQueue = [...priority, ...rest, ...warmupQueue];
  void runQueue(concurrency);
}
