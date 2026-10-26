import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 学生查看绑定自己的教师列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可查看教师" }, { status: 403 });
  }

  const bindings = await prisma.teacherStudent.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { id: true, username: true, name: true, createdAt: true } },
    },
  });

  return NextResponse.json({ teachers: bindings.map((b) => b.teacher) });
}
