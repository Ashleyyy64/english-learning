import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/jwt";

// 需要登录才能访问的前缀
const PROTECTED_PREFIXES = ["/dashboard"];

// 已登录用户不应再访问的页面
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtected) {
    const session = token ? await verifyToken(token) : null;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (isAuthPage && token) {
    const session = await verifyToken(token);
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // 仅对受保护页面和登录/注册/找回密码页生效，避免干扰 API 与静态资源
  matcher: ["/dashboard/:path*", "/login", "/register", "/forgot-password"],
};
