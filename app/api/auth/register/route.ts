import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setAuthCookie, publicUser } from "@/lib/auth";
import { signToken, normalizeRole } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim();
    const role: "TEACHER" | "STUDENT" = body?.role === "STUDENT" ? "STUDENT" : "TEACHER";

    if (username.length < 3) {
      return NextResponse.json({ error: "账号至少需要 3 个字符" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少需要 6 位" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "请填写姓名或昵称" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ error: "该账号已被注册，请换一个" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { username, passwordHash: await hashPassword(password), name, role },
    });

    const normalizedRole = normalizeRole(user.role);
    if (!normalizedRole) {
      return NextResponse.json({ error: "账号角色配置无效" }, { status: 500 });
    }
    const token = await signToken({ sub: user.id, role: normalizedRole });
    await setAuthCookie(token);

    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
