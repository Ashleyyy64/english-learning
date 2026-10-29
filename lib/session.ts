import { prisma } from "./prisma";

/**
 * 登录会话管理（服务端会话表）。
 *
 * 作用：
 * - 「记住登录态」：记住我 → 30 天；普通 → 7 天。
 * - 「安全退出」：登出时吊销当前会话；「退出所有设备」吊销全部会话。
 *   即使 cookie 被盗，服务端吊销后立即失效（比纯 JWT 无状态方案更安全）。
 */

export const SESSION_REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
export const SESSION_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

/** 创建会话，返回会话 id */
export async function createSession(input: {
  userId: string;
  rememberMe: boolean;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<string> {
  const ttl = input.rememberMe ? SESSION_REMEMBER_TTL_MS : SESSION_DEFAULT_TTL_MS;
  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
      expiresAt: new Date(Date.now() + ttl),
    },
  });
  return session.id;
}

/** 校验会话是否有效（存在、未吊销、未过期），并节流更新 lastSeenAt */
export async function isValidSession(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return false;
  if (session.revokedAt) return false;
  if (session.expiresAt.getTime() <= Date.now()) return false;

  // 节流更新活跃时间（5 分钟内不重复写库）
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});
  }
  return true;
}

/** 吊销单个会话（安全退出当前设备） */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => {});
}

/** 吊销某用户全部会话（安全退出所有设备） */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** 清理过期会话（可定时任务调用，此处提供函数供手动触发） */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}
