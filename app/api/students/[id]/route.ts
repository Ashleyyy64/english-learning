import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 教师解绑某个学生
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "仅教师可解绑学生" }, { status: 403 });
  }

  const { id } = await params;

  const result = await prisma.teacherStudent.deleteMany({
    where: { teacherId: user.id, studentId: id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "未找到该绑定关系" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
