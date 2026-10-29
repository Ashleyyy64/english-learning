import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findUserByAccount,
  verifyPassword,
  setAuthCookie,
  publicUser,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION_MS,
} from "@/lib/auth";
import { createSession } from "@/lib/session";
import { signToken } from "@/lib/jwt";
import { verifyCode } from "@/lib/verification";
import { rateLimit } from "@/lib/rate-limit";
import {
  parseJsonBody,
  getClientIp,
  getClientUserAgent,
  assertSameOrigin,
} from "@/lib/validation";

/**
 * POST /api/auth/login
 * 支持两种登录方式：
 * - 密码登录：{ account, password, rememberMe? }
 * - 验证码登录：{ account, code, rememberMe? }（账号需绑定邮箱/手机号）
 *
 * 安全：IP + 账号双重限流；连续失败 N 次锁定账号 15 分钟；统一模糊错误防枚举。
 */
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "非法请求来源", code: "CSRF" }, { status: 403 });
  }

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const account = String(body.account ?? "").trim();
  const password = String(body.password ?? "");
  const code = String(body.code ?? "").trim();
  const rememberMe = body.rememberMe === true;
  const ip = getClientIp(request);

  if (!account) return NextResponse.json({ error: "请输入账号、邮箱或手机号" }, { status: 400 });

  // —— 限流（IP 维度 + 账号维度）——
  const ipLimit = rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "尝试次数过多，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
    );
  }
  const accountLimit = rateLimit(`login:account:${account}`, 10, 15 * 60_000);
  if (!accountLimit.ok) {
    return NextResponse.json(
      { error: "尝试次数过多，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(accountLimit.retryAfterMs / 1000)) } },
    );
  }

  const user = await findUserByAccount(account);

  // —— 账号锁定检查（在密码比对前，避免泄露账号是否存在）——
  // 统一模糊错误：无论账号不存在还是密码错误，都返回相同提示。
  if (!user) {
    // 账号不存在：仍执行一次假哈希比对，抹平响应时间差（防时序侧信道枚举）
    await verifyPassword(
      password || "dummy",
      "$2a$12$/CRhGi/f/E9PB53F8OsUdOuJLRT9I8UefrNphqq/IvRDBdBhJr55y",
    ).catch(() => {});
    return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
  }

  // 锁定状态判断
  const isLocked =
    user.status === "LOCKED" && user.lockedUntil && user.lockedUntil.getTime() > Date.now();

  if (isLocked) {
    const mins = Math.max(1, Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 60_000));
    return NextResponse.json(
      { error: `账号已锁定，请 ${mins} 分钟后再试` },
      { status: 423 },
    );
  }

  // —— 校验凭据 ——
  let authenticated = false;

  if (code) {
    // 验证码登录：需要已绑定邮箱/手机号
    if (!user.email && !user.phone) {
      return NextResponse.json(
        { error: "该账号未绑定邮箱/手机号，请使用密码登录" },
        { status: 400 },
      );
    }
    const target = user.email || user.phone!;
    const codeCheck = await verifyCode(target, "LOGIN", code);
    if (!codeCheck.ok) {
      return NextResponse.json({ error: codeCheck.error }, { status: 401 });
    }
    authenticated = true;
  } else {
    // 密码登录
    if (!password) return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    const ok = user.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
    if (ok) {
      authenticated = true;
    } else {
      // 登录失败：累计失败次数，达到阈值锁定
      const failedAttempts = user.failedAttempts + 1;
      const shouldLock = failedAttempts >= LOCKOUT_THRESHOLD;
      await prisma.user.update({
        where: { id: user.id },
        data: shouldLock
          ? {
              failedAttempts,
              lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
              status: "LOCKED",
            }
          : { failedAttempts },
      });

      if (shouldLock) {
        return NextResponse.json(
          { error: `连续失败次数过多，账号已锁定 ${LOCKOUT_DURATION_MS / 60_000} 分钟` },
          { status: 423 },
        );
      }
      return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    }
  }

  if (!authenticated) {
    return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
  }

  // —— 登录成功：重置失败计数与锁定状态 ——
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, status: "ACTIVE", lastLoginAt: new Date() },
  });

  const sessionId = await createSession({
    userId: user.id,
    rememberMe,
    userAgent: getClientUserAgent(request),
    ip,
  });
  const token = await signToken(
    { sub: user.id, role: user.role as "TEACHER" | "STUDENT", sid: sessionId },
    { expiresIn: rememberMe ? "30d" : "7d" },
  );
  await setAuthCookie(token, rememberMe);

  return NextResponse.json({ user: publicUser(user) });
}
