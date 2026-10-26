import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import StudentManager from "@/components/student-manager";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TEACHER") redirect("/dashboard");

  const [bindings, invitations] = await Promise.all([
    prisma.teacherStudent.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, name: true, username: true, createdAt: true } },
      },
    }),
    prisma.invitation.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: "desc" },
      include: { student: { select: { name: true, username: true } } },
    }),
  ]);

  return (
    <StudentManager
      students={bindings.map((b) => ({
        id: b.student.id,
        name: b.student.name,
        username: b.student.username,
        createdAt: b.student.createdAt.toISOString(),
      }))}
      invitations={invitations.map((i) => ({
        id: i.id,
        code: i.code,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        acceptedAt: i.acceptedAt ? i.acceptedAt.toISOString() : null,
        studentName: i.student?.name ?? null,
      }))}
    />
  );
}
