import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { AUTH_COOKIE, signToken, verifyToken, normalizeRole, type SessionPayload } from "./jwt";
import { isValidSession } from "./session";
import { detectTarget, normalizeEmail, normalizePhone } from "./validation";

// 密码哈希成本因子：10 → 12（更抗暴力破解；旧 hash 仍可正常 verify）
const BCRYPT_COST = 12;

// Cookie 有效期：与会话 TTL 保持一致（记住我 30 天 / 普通 7 天）
const COOKIE_REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;
const COOKIE_DEFAULT_MAX_AGE = 60 * 60 * 24 * 7;

// 登录失败锁定策略
export const LOCKOUT_THRESHOLD = 5; // 连续失败 5 次锁定
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 锁定 15 分钟

// 教师代理学生的 cookie 名（值为被代理学生的 userId）
const IMPERSONATE_COOKIE = "lingua_impersonate";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setAuthCookie(token: string, rememberMe = false): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: rememberMe ? COOKIE_REMEMBER_MAX_AGE : COOKIE_DEFAULT_MAX_AGE,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * 读取会话：校验 JWT 签名 + 服务端会话吊销状态。
 * 返回 null 表示未登录或会话已被吊销/过期。
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  // 服务端会话吊销校验：实现「安全退出」的即时生效
  const valid = await isValidSession(payload.sid);
  return valid ? payload : null;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.sub) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  // 账号被锁定则视为未登录（安全兜底）
  if (user && user.status !== "ACTIVE") return null;
  return user;
}

// 读取教师代理的学生 id（若存在）
export async function getImpersonatedStudentId(): Promise<string | null> {
  const store = await cookies();
  return store.get(IMPERSONATE_COOKIE)?.value ?? null;
}

// 设置教师代理学生
export async function setImpersonateCookie(studentId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, studentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_DEFAULT_MAX_AGE,
  });
}

// 清除教师代理（切回教师本人）
export async function clearImpersonateCookie(): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// 返回「有效操作用户」：
// - 教师若代理了某个绑定学生，则返回该学生（所有学习行为写入学生账户）；
// - 否则返回当前登录用户本人。
export async function getEffectiveUser() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === "TEACHER") {
    const studentId = await getImpersonatedStudentId();
    if (studentId) {
      // 校验该学生确实是当前教师的绑定学生
      const binding = await prisma.teacherStudent.findUnique({
        where: { teacherId_studentId: { teacherId: user.id, studentId } },
      });
      if (binding) {
        return prisma.user.findUnique({ where: { id: studentId } });
      }
    }
  }

  return user;
}

// 去除敏感字段，返回给客户端的安全用户对象
export function publicUser(user: {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: string;
  avatar: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };
}

export function userRole(user: { role: string }): SessionPayload["role"] | null {
  return normalizeRole(user.role);
}

// ===== 账号查找 =====

/** 按登录标识（用户名 / 邮箱 / 手机号）查找用户 */
export async function findUserByAccount(account: string): Promise<User | null> {
  const value = account.trim();
  if (!value) return null;

  // 统一账号查找：用户名优先，其次邮箱/手机号
  const byUsername = await prisma.user.findUnique({ where: { username: value } });
  if (byUsername) return byUsername;

  const type = detectTarget(value);
  if (type === "email") {
    return prisma.user.findUnique({ where: { email: normalizeEmail(value) } });
  }
  if (type === "phone") {
    return prisma.user.findUnique({ where: { phone: normalizePhone(value) } });
  }
  return null;
}

/** 按邮箱/手机号查找用户（用于验证码场景） */
export async function findUserByTarget(target: string): Promise<User | null> {
  const type = detectTarget(target);
  if (type === "email") {
    return prisma.user.findUnique({ where: { email: normalizeEmail(target) } });
  }
  if (type === "phone") {
    return prisma.user.findUnique({ where: { phone: normalizePhone(target) } });
  }
  return null;
}

export function generateInviteCode(length = 8): string {
  // 去掉易混淆字符（0/O、1/I/L）
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}
