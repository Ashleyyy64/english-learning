import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

export default async function VocabularyPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  const userBook = await prisma.userBook.findUnique({
    where: { userId: user.id },
    include: { book: true },
  });
  if (!userBook) redirect("/dashboard/student/vocabulary/books");

  const book = userBook.book;

  // 词书实际收录的单词数（以 bookWord 关系为准，而非 itemNum 元数据，
  // 元数据可能比实际导入的单词数多/少，会导致统计与学前检测页不一致）
  const totalWordCount = await prisma.bookWord.count({
    where: { bookId: book.id },
  });

  // 统计已掌握的单词（学前检测「会」与学后检测「会」都标记为 MASTERED）
  const masteredCount = await prisma.userWordProgress.count({
    where: {
      userId: user.id,
      status: "MASTERED",
      word: { books: { some: { bookId: book.id } } },
    },
  });
  const remaining = Math.max(0, totalWordCount - masteredCount);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">背单词</div>
          <h1>背单词</h1>
          <p>选择词书 → 学前检测 → 单词识记，三步攻克词汇。</p>
        </div>
      </div>

      <section className="panel-card current-book-card">
        <div className="current-book-main">
          <div className="book-card-icon"><BookOpen size={20} /></div>
          <div>
            <strong>{book.name}</strong>
            <span className="muted">当前词书 · 剩余 {remaining} / {totalWordCount} 个单词</span>
          </div>
        </div>
        <div className="current-book-actions">
          <Link href="/dashboard/student/vocabulary/pretest" className="primary-button small">开始学前检测 <ArrowRight size={15} /></Link>
          <Link href="/dashboard/student/vocabulary/books" className="outline-button"><RefreshCw size={14} /> 更换词书</Link>
        </div>
      </section>
    </>
  );
}
