import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 教师查看班级内所有学生错题本的聚合接口（只读）。
// 数据天然实时同步：学生答错即写入其本人账户的 UserWrongWord，无需额外同步表，
// 教师通过 TeacherStudent 绑定关系跨学生聚合查询，所见即学生当前最新错题。
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "仅教师可查看学生错题" }, { status: 403 });
  }

  // 1. 获取当前教师绑定的所有学生
  const bindings = await prisma.teacherStudent.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, name: true, username: true } },
    },
  });

  const students = bindings.map((b) => b.student);
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return NextResponse.json({ students: [], words: [] });
  }

  // 2. 聚合这些学生的全部错题（含单词信息）
  const wrongWords = await prisma.userWrongWord.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { lastWrongAt: "desc" },
    include: {
      word: { select: { id: true, text: true, phoneticUk: true, phoneticUs: true, translation: true } },
    },
  });

  // 错题来源词书 id -> 书名映射（bookId 为标量，需单独查询 WordBook）
  const bookIds = Array.from(new Set(wrongWords.map((w) => w.bookId).filter((id): id is string => Boolean(id))));
  const books = bookIds.length > 0
    ? await prisma.wordBook.findMany({ where: { id: { in: bookIds } }, select: { id: true, name: true } })
    : [];
  const bookNameMap = new Map(books.map((b) => [b.id, b.name]));

  // 学生 id -> 学生对象映射，用于在错题项上标注归属学生
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // 单词视角聚合：同一单词可能被多名学生答错，按单词合并、统计答错学生数与累计答错次数
  const wordAgg = new Map<
    string,
    {
      wordId: string;
      text: string;
      phoneticUk: string | null;
      phoneticUs: string | null;
      translation: string | null;
      wrongStudents: number; // 答错该单词的学生人数
      totalWrongCount: number; // 累计答错次数
      students: { id: string; name: string; username: string; wrongCount: number; lastWrongAt: string }[];
      lastWrongAt: string;
    }
  >();

  const items = wrongWords.map((w) => {
    const student = studentMap.get(w.userId);
    const lastWrongAt = w.lastWrongAt.toISOString();

    // 维护单词维度聚合
    const existing = wordAgg.get(w.wordId);
    if (existing) {
      existing.wrongStudents += 1;
      existing.totalWrongCount += w.wrongCount;
      existing.students.push({
        id: student?.id ?? w.userId,
        name: student?.name ?? "未知学生",
        username: student?.username ?? "",
        wrongCount: w.wrongCount,
        lastWrongAt,
      });
      if (lastWrongAt > existing.lastWrongAt) existing.lastWrongAt = lastWrongAt;
    } else {
      wordAgg.set(w.wordId, {
        wordId: w.word.id,
        text: w.word.text,
        phoneticUk: w.word.phoneticUk,
        phoneticUs: w.word.phoneticUs,
        translation: w.word.translation,
        wrongStudents: 1,
        totalWrongCount: w.wrongCount,
        students: [
          {
            id: student?.id ?? w.userId,
            name: student?.name ?? "未知学生",
            username: student?.username ?? "",
            wrongCount: w.wrongCount,
            lastWrongAt,
          },
        ],
        lastWrongAt,
      });
    }

    // 学生视角条目
    return {
      wordId: w.word.id,
      text: w.word.text,
      phoneticUk: w.word.phoneticUk,
      phoneticUs: w.word.phoneticUs,
      translation: w.word.translation,
      bookName: w.bookId ? (bookNameMap.get(w.bookId) ?? null) : null,
      studentId: student?.id ?? w.userId,
      studentName: student?.name ?? "未知学生",
      studentUsername: student?.username ?? "",
      wrongCount: w.wrongCount,
      lastWrongAt,
    };
  });

  const words = Array.from(wordAgg.values()).sort((a, b) =>
    b.totalWrongCount - a.totalWrongCount || b.lastWrongAt.localeCompare(a.lastWrongAt),
  );

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      username: s.username,
      wrongWordCount: wrongWords.filter((w) => w.userId === s.id).length,
    })),
    items,
    words,
  });
}
