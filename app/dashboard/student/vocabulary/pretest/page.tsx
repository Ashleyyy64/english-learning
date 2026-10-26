import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";
import Pretest from "@/components/pretest";

export default async function PretestPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  const userBook = await prisma.userBook.findUnique({
    where: { userId: user.id },
    include: { book: true },
  });
  if (!userBook) redirect("/dashboard/student/vocabulary/books");

  // 词书实际收录单词总数（bookWord 关系为准，与词汇主页一致）
  const totalWordCount = await prisma.bookWord.count({
    where: { bookId: userBook.book.id },
  });

  // 已掌握（MASTERED）的单词从本次学习中剔除，不再展示
  const relations = await prisma.bookWord.findMany({
    where: {
      bookId: userBook.book.id,
      word: {
        progress: {
          none: { userId: user.id, status: "MASTERED" },
        },
      },
    },
    orderBy: [{ unit: "asc" }, { flag: "asc" }],
    include: {
      word: { include: { notes: { where: { userId: user.id } } } },
    },
  });

  const words = relations.map((r) => ({
    id: r.word.id,
    text: r.word.text,
    phoneticUk: r.word.phoneticUk,
    phoneticUs: r.word.phoneticUs,
    translation: r.word.translation,
    note: r.word.notes[0]?.content ?? null,
    unit: r.unit,
  }));

  return (
    <Pretest
      book={{ id: userBook.book.id, name: userBook.book.name }}
      words={words}
      totalWordCount={totalWordCount}
    />
  );
}
