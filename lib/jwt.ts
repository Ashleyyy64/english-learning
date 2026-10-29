import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE = "lingua_token";

export interface SessionPayload {
  sub: string; // 用户 id
  role: "TEACHER" | "STUDENT";
  sid: string; // 会话 id（对应 Session 表，用于服务端吊销校验）
}

export function normalizeRole(role: string): SessionPayload["role"] | null {
  if (role === "TEACHER" || role === "STUDENT") return role;
  return null;
}

function getSecret() {
  // 生产环境必须通过环境变量注入强随机密钥；本地开发使用默认值兜底
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "lingua-dev-secret-change-me-in-production",
  );
}

export interface SignTokenOptions {
  sid: string;
  /** 过期时长，如 "7d" / "30d" / "15m" */
  expiresIn?: string;
}

export async function signToken(
  payload: Omit<SessionPayload, "sid"> & { sid: string },
  opts?: { expiresIn?: string },
): Promise<string> {
  return new SignJWT({ role: payload.role, sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(opts?.expiresIn ?? "7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = payload.sub ?? "";
    const sid = (payload.sid as string) ?? "";
    if (!sub || !sid) return null;
    return {
      sub,
      role: (payload.role as SessionPayload["role"]) ?? "STUDENT",
      sid,
    };
  } catch {
    return null;
  }
}
