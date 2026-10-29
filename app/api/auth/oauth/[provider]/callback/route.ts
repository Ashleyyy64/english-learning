import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangeOAuthCode } from "@/lib/oauth";
import { setAuthCookie } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { signToken } from "@/lib/jwt";

const OAUTH_STATE_COOKIE = "lingua_oauth_state";

/**
 * GET /api/auth/oauth/:provider/callback
 * OAuth 回调：校验 state → 换 token → 查/建账号 → 登录并跳转工作台。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  // 用完即删
  store.delete(OAUTH_STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("已取消授权，请重试")}`, request.url),
    );
  }
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("登录校验失败，请重试")}`, request.url),
    );
  }

  const result = await exchangeOAuthCode(provider, code);
  if (!result) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("第三方登录失败，请稍后重试")}`, request.url),
    );
  }

  const { profile } = result;
  const providerName = result.provider;

  // 1. 查找已有绑定
  let account = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: providerName,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  // 2. 不存在则创建新账号（自动生成唯一 username）
  if (!account) {
    const base = `${providerName}_${profile.providerAccountId.slice(0, 12)}`;
    let username = base;
    let attempt = 0;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${base}${attempt++}`;
    }

    const user = await prisma.user.create({
      data: {
        username,
        name: profile.nickname.slice(0, 50) || "新用户",
        role: "STUDENT",
        avatar: profile.avatar,
        passwordHash: null, // 第三方用户无密码，可后续绑定
      },
    });

    account = await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: providerName,
        providerAccountId: profile.providerAccountId,
        accessToken: encryptSecret(profile.accessToken),
        refreshToken: profile.refreshToken ? encryptSecret(profile.refreshToken) : null,
        expiresAt: profile.expiresAt,
      },
      include: { user: true },
    });
  } else {
    // 更新令牌
    await prisma.oAuthAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptSecret(profile.accessToken),
        refreshToken: profile.refreshToken ? encryptSecret(profile.refreshToken) : null,
        expiresAt: profile.expiresAt,
      },
    });
    await prisma.user.update({
      where: { id: account.userId },
      data: { avatar: account.user.avatar ?? profile.avatar, lastLoginAt: new Date() },
    });
  }

  const user = account.user;
  // 锁定账号禁止第三方登录
  if (user.status !== "ACTIVE") {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("账号已被锁定，请联系管理员")}`, request.url),
    );
  }

  // 3. 建立会话并登录
  const sessionId = await createSession({
    userId: user.id,
    rememberMe: true,
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
  });
  const token = await signToken(
    { sub: user.id, role: user.role as "TEACHER" | "STUDENT", sid: sessionId },
    { expiresIn: "30d" },
  );
  await setAuthCookie(token, true);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
