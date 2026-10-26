import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  setImpersonateCookie,
  clearImpersonateCookie,
} from "@/lib/auth";

// 教师切换学生视角（代理操作）：
// - body { studentId } → 设置代理，切到指定学生
// - body { studentId: null } → 清除代理，切回教师本人
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "仅教师可切换学生视角" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const studentId: string | null =
    typeof body?.studentId === "string" && body.studentId ? body.studentId : null;

  // 清除代理，切回教师本人
  if (!studentId) {
    await clearImpersonateCookie();
    return NextResponse.json({ impersonating: false });
  }

  // 校验该学生确实是当前教师的绑定学生
  const binding = await prisma.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId: user.id, studentId } },
    include: { student: { select: { id: true, name: true, username: true } } },
  });
  if (!binding) {
    return NextResponse.json({ error: "该学生未与你绑定" }, { status: 403 });
  }

  await setImpersonateCookie(studentId);
  return NextResponse.json({
    impersonating: true,
    student: {
      id: binding.student.id,
      name: binding.student.name,
      username: binding.student.username,
    },
  });
}
