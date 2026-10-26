import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { AUTH_COOKIE, signToken, verifyToken, normalizeRole, type SessionPayload } from "./jwt";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

// 教师代理学生的 cookie 名（值为被代理学生的 userId）
const IMPERSONATE_COOKIE = "lingua_impersonate";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.sub) return null;
  return prisma.user.findUnique({ where: { id: session.sub } });
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
    maxAge: COOKIE_MAX_AGE,
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
  name: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function userRole(user: { role: string }): SessionPayload["role"] | null {
  return normalizeRole(user.role);
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
