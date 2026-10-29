import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { generateOAuthState, redirectToAuthorize } from "@/lib/oauth";

const OAUTH_STATE_COOKIE = "lingua_oauth_state";

/**
 * GET /api/auth/oauth/:provider
 * 发起第三方登录：生成 state（防 CSRF）→ 跳转到供应商授权页。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const state = generateOAuthState();

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 分钟
  });

  const url = redirectToAuthorize(provider, state);
  if (!url) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("该登录方式暂未配置，请稍后重试")}`, _request.url),
    );
  }

  return NextResponse.redirect(url);
}
