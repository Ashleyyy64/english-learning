import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 演示账号密码较弱，仅用于本地联调；上线前务必删除或修改（见 DEPLOY.md）
  const password = await bcrypt.hash("123456", 12);

  const teacher = await prisma.user.upsert({
    where: { username: "teacher" },
    update: {},
    create: {
      username: "teacher",
      passwordHash: password,
      name: "林老师",
      role: "TEACHER",
    },
  });

  const alex = await prisma.user.upsert({
    where: { username: "alex" },
    update: {},
    create: {
      username: "alex",
      passwordHash: password,
      name: "Alex Chen",
      role: "STUDENT",
    },
  });

  const mia = await prisma.user.upsert({
    where: { username: "mia" },
    update: {},
    create: {
      username: "mia",
      passwordHash: password,
      name: "Mia Wang",
      role: "STUDENT",
    },
  });

  await prisma.teacherStudent.upsert({
    where: { teacherId_studentId: { teacherId: teacher.id, studentId: alex.id } },
    update: {},
    create: { teacherId: teacher.id, studentId: alex.id },
  });

  await prisma.teacherStudent.upsert({
    where: { teacherId_studentId: { teacherId: teacher.id, studentId: mia.id } },
    update: {},
    create: { teacherId: teacher.id, studentId: mia.id },
  });

  await prisma.invitation.upsert({
    where: { code: "LINGUA01" },
    update: {},
    create: { code: "LINGUA01", teacherId: teacher.id },
  });

  console.log("Seed 完成：");
  console.log("  教师账号：teacher / 123456");
  console.log("  学生账号：alex / 123456、mia / 123456");
  console.log("  预置邀请码：LINGUA01");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
