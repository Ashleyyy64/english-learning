import { NextResponse } from "next/server";
import { clearAuthCookie, getSession } from "@/lib/auth";
import { revokeSession } from "@/lib/session";

/**
 * POST /api/auth/logout
 * 安全退出：吊销当前会话（服务端），并清除登录态 Cookie。
 */
export async function POST() {
  const session = await getSession();
  if (session?.sid) {
    await revokeSession(session.sid);
  }
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
