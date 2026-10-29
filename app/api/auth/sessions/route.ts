import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revokeSession } from "@/lib/session";

/**
 * GET /api/auth/sessions —— 列出当前用户的活跃会话（登录设备管理）
 * DELETE /api/auth/sessions —— 吊销指定会话（body: { sessionId }）
 */
export async function GET() {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const sessions = await prisma.session.findMany({
    where: { userId: session.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      lastSeenAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      isCurrent: s.id === session.sid,
      userAgent: s.userAgent,
      ip: s.ip,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = String(body?.sessionId ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "缺少会话 ID" }, { status: 400 });
  }

  // 只能吊销自己的会话
  const target = await prisma.session.findFirst({
    where: { id: sessionId, userId: session.sub },
  });
  if (!target) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  await revokeSession(sessionId);
  return NextResponse.json({ ok: true });
}
