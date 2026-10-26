import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 教师查看自己绑定的学生列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "仅教师可查看学生" }, { status: 403 });
  }

  const bindings = await prisma.teacherStudent.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, username: true, name: true, createdAt: true } },
    },
  });

  return NextResponse.json({ students: bindings.map((b) => b.student) });
}
