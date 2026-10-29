/**
 * 防刷限流：内存滑动窗口计数器。
 *
 * - 单进程有效（本项目 PM2 单实例 fork 模式，安全）。
 * - 若未来横向扩容到多实例，需替换为 Redis（`upstash/ratelimit` 等），
 *   接口保持一致即可无缝迁移。
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

// 定期清理过期条目，避免内存无限增长
const MAX_ENTRIES = 100_000;
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  if (store.size > MAX_ENTRIES) {
    // 超过上限时全量清理过期项
    for (const [key, entry] of store) {
      if (entry.windowStart + 60 * 60 * 1000 < now) store.delete(key);
    }
  }
}

// 单次 cleanup 定时器（模块级，避免多次 import 重复创建）
const cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL);
if (cleanupTimer.unref) cleanupTimer.unref();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number; // 距下次可用的毫秒数（0 表示立即可用）
  limit: number;
}

/**
 * 检查并记录一次请求。
 * @param key 限流维度键（如 `login:ip:1.2.3.4`、`code:target:xx@yy.com`）
 * @param limit 窗口内最大次数
 * @param windowMs 窗口时长（毫秒）
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.windowStart + windowMs <= now) {
    // 新窗口
    store.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0, limit };
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfterMs = entry.windowStart + windowMs - now;
    return { ok: false, remaining: 0, retryAfterMs, limit };
  }

  return { ok: true, remaining: limit - entry.count, retryAfterMs: 0, limit };
}

/** 只查询当前计数，不递增（用于返回剩余次数） */
export function peekLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.windowStart + windowMs <= now) {
    return { ok: true, remaining: limit, retryAfterMs: 0, limit };
  }
  if (entry.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: entry.windowStart + windowMs - now, limit };
  }
  return { ok: true, remaining: limit - entry.count, retryAfterMs: 0, limit };
}

/** 测试/管理用：清空限流状态 */
export function resetRateLimit(): void {
  store.clear();
}
