import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setAuthCookie, publicUser } from "@/lib/auth";
import { signToken, normalizeRole } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    }

    const role = normalizeRole(user.role);
    if (!role) {
      return NextResponse.json({ error: "账号角色配置无效" }, { status: 500 });
    }
    const token = await signToken({ sub: user.id, role });
    await setAuthCookie(token);

    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    console.error("[login]", error);
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
