import { NextResponse } from "next/server";
import { clearAuthCookie, getSession } from "@/lib/auth";
import { revokeAllSessions } from "@/lib/session";

/**
 * POST /api/auth/logout-all
 * 安全退出所有设备：吊销当前用户全部会话。
 */
export async function POST() {
  const session = await getSession();
  if (session?.sub) {
    await revokeAllSessions(session.sub);
  }
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
