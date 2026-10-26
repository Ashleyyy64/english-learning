import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 学生通过邀请码接受绑定
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "仅学生可接受邀请" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const code = String(body?.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "请输入邀请码" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({ where: { code } });
    if (!invitation || invitation.status !== "ACTIVE") {
      return NextResponse.json({ error: "邀请码无效或已失效" }, { status: 400 });
    }
    if (invitation.teacherId === user.id) {
      return NextResponse.json({ error: "不能绑定自己的邀请" }, { status: 400 });
    }

    // 幂等建立绑定关系
    await prisma.teacherStudent.upsert({
      where: {
        teacherId_studentId: { teacherId: invitation.teacherId, studentId: user.id },
      },
      update: {},
      create: { teacherId: invitation.teacherId, studentId: user.id },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", studentId: user.id, acceptedAt: new Date() },
    });

    const teacher = await prisma.user.findUnique({
      where: { id: invitation.teacherId },
      select: { id: true, name: true, username: true },
    });

    return NextResponse.json({ teacher });
  } catch (error) {
    console.error("[accept invitation]", error);
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
