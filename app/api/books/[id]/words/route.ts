import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

// 获取某本词书的全部单词（含当前用户的笔记与学习状态）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const book = await prisma.wordBook.findUnique({
    where: { id },
    select: { id: true, name: true, itemNum: true },
  });
  if (!book) return NextResponse.json({ error: "词书不存在" }, { status: 404 });

  const relations = await prisma.bookWord.findMany({
    where: { bookId: id },
    orderBy: [{ unit: "asc" }, { flag: "asc" }],
    include: {
      word: {
        include: {
          notes: { where: { userId: user.id } },
          progress: { where: { userId: user.id } },
        },
      },
    },
  });

  const words = relations.map((r) => ({
    id: r.word.id,
    text: r.word.text,
    phoneticUk: r.word.phoneticUk,
    phoneticUs: r.word.phoneticUs,
    translation: r.word.translation,
    unit: r.unit,
    note: r.word.notes[0]?.content ?? null,
    status: r.word.progress[0]?.status ?? null,
  }));

  return NextResponse.json({ book, words });
}
