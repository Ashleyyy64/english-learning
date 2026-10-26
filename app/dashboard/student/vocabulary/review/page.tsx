import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";
import Review from "@/components/review";

export default async function ReviewPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  const userBook = await prisma.userBook.findUnique({
    where: { userId: user.id },
    include: { book: true },
  });
  if (!userBook) redirect("/dashboard/student/vocabulary/books");

  // 单词识记只读「最近一批」学前检测标记为「不会」（UNKNOWN）的单词：
  // 历史累积的旧批次 UNKNOWN 词（batchId 非最新）不应混入本次识记。
  const latest = await prisma.userWordProgress.findFirst({
    where: { userId: user.id, status: "UNKNOWN", batchId: { not: null } },
    orderBy: { batchId: "desc" },
    select: { batchId: true },
  });
  const latestBatchId = latest?.batchId ?? null;

  // 没有任何「带批次」的 UNKNOWN 词（例如全是历史遗留的 null 批次旧词）时，
  // 识记应返回空，而不是把 null 批次的旧词也查出来。
  const relations =
    latestBatchId === null
      ? []
      : await prisma.bookWord.findMany({
          where: {
            bookId: userBook.book.id,
            word: {
              progress: {
                some: { userId: user.id, status: "UNKNOWN", batchId: latestBatchId },
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
  }));

  return <Review book={{ id: userBook.book.id, name: userBook.book.name }} words={words} />;
}
