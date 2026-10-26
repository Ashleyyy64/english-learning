import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";
import StudentHome from "@/components/student-home";

export default async function StudentOverview() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  const bindings = await prisma.teacherStudent.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    include: { teacher: { select: { id: true, name: true, username: true } } },
  });

  return <StudentHome name={user.name} teachers={bindings.map((b) => b.teacher)} />;
}
