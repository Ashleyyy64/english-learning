import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE = "lingua_token";

export interface SessionPayload {
  sub: string; // 用户 id
  role: "TEACHER" | "STUDENT";
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

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { sub: payload.sub ?? "", role: (payload.role as SessionPayload["role"]) ?? "STUDENT" };
  } catch {
    return null;
  }
}
