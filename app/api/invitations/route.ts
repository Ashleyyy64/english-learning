import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCode, getCurrentUser } from "@/lib/auth";

// 教师查看自己发出的邀请码列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "仅教师可查看邀请" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, username: true, name: true } },
    },
  });

  return NextResponse.json({ invitations });
}

// 教师生成一个新的邀请码
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "仅教师可创建邀请" }, { status: 403 });
  }

  const code = generateInviteCode();
  const invitation = await prisma.invitation.create({
    data: { code, teacherId: user.id },
  });

  return NextResponse.json({ invitation }, { status: 201 });
}
