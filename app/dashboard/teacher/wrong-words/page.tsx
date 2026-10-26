import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import TeacherWrongWords from "@/components/teacher-wrong-words";

export default async function TeacherWrongWordsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TEACHER") redirect("/dashboard");

  // 获取绑定学生
  const bindings = await prisma.teacherStudent.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, name: true, username: true } },
    },
  });

  const students = bindings.map((b) => b.student);
  const studentIds = students.map((s) => s.id);

  let items: Awaited<ReturnType<typeof loadWrongItems>> = [];
  let words: Awaited<ReturnType<typeof loadWrongWords>> = [];

  if (studentIds.length > 0) {
    [items, words] = await Promise.all([
      loadWrongItems(studentIds, students),
      loadWrongWords(studentIds, students),
    ]);
  }

  const studentSummaries = students.map((s) => ({
    id: s.id,
    name: s.name,
    username: s.username,
    wrongWordCount: items.filter((it) => it.studentId === s.id).length,
  }));

  return (
    <TeacherWrongWords students={studentSummaries} items={items} words={words} />
  );
}

type StudentRef = { id: string; name: string; username: string };

async function loadWrongItems(studentIds: string[], students: StudentRef[]) {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const wrongWords = await prisma.userWrongWord.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { lastWrongAt: "desc" },
    include: {
      word: { select: { id: true, text: true, phoneticUk: true, phoneticUs: true, translation: true } },
    },
  });

  const bookIds = Array.from(new Set(wrongWords.map((w) => w.bookId).filter((id): id is string => Boolean(id))));
  const books = bookIds.length > 0
    ? await prisma.wordBook.findMany({ where: { id: { in: bookIds } }, select: { id: true, name: true } })
    : [];
  const bookNameMap = new Map(books.map((b) => [b.id, b.name]));

  return wrongWords.map((w) => {
    const student = studentMap.get(w.userId);
    return {
      wordId: w.word.id,
      text: w.word.text,
      phoneticUk: w.word.phoneticUk,
      phoneticUs: w.word.phoneticUs,
      translation: w.word.translation,
      bookName: w.bookId ? (bookNameMap.get(w.bookId) ?? null) : null,
      studentId: w.userId,
      studentName: student?.name ?? "未知学生",
      studentUsername: student?.username ?? "",
      wrongCount: w.wrongCount,
      lastWrongAt: w.lastWrongAt.toISOString(),
    };
  });
}

async function loadWrongWords(studentIds: string[], students: StudentRef[]) {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const wrongWords = await prisma.userWrongWord.findMany({
    where: { userId: { in: studentIds } },
    include: {
      word: { select: { id: true, text: true, phoneticUk: true, phoneticUs: true, translation: true } },
    },
  });

  const agg = new Map<string, {
    wordId: string;
    text: string;
    phoneticUk: string | null;
    phoneticUs: string | null;
    translation: string | null;
    wrongStudents: number;
    totalWrongCount: number;
    students: { id: string; name: string; username: string; wrongCount: number; lastWrongAt: string }[];
    lastWrongAt: string;
  }>();

  for (const w of wrongWords) {
    const student = studentMap.get(w.userId);
    const lastWrongAt = w.lastWrongAt.toISOString();
    const existing = agg.get(w.wordId);
    if (existing) {
      existing.wrongStudents += 1;
      existing.totalWrongCount += w.wrongCount;
      existing.students.push({
        id: w.userId,
        name: student?.name ?? "未知学生",
        username: student?.username ?? "",
        wrongCount: w.wrongCount,
        lastWrongAt,
      });
      if (lastWrongAt > existing.lastWrongAt) existing.lastWrongAt = lastWrongAt;
    } else {
      agg.set(w.wordId, {
        wordId: w.word.id,
        text: w.word.text,
        phoneticUk: w.word.phoneticUk,
        phoneticUs: w.word.phoneticUs,
        translation: w.word.translation,
        wrongStudents: 1,
        totalWrongCount: w.wrongCount,
        students: [{
          id: w.userId,
          name: student?.name ?? "未知学生",
          username: student?.username ?? "",
          wrongCount: w.wrongCount,
          lastWrongAt,
        }],
        lastWrongAt,
      });
    }
  }

  return Array.from(agg.values()).sort(
    (a, b) => b.totalWrongCount - a.totalWrongCount || b.lastWrongAt.localeCompare(a.lastWrongAt),
  );
}
