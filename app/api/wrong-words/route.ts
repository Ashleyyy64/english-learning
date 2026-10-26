import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

// 获取当前用户的错题本列表（含单词信息与笔记）
export async function GET() {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可查看错题本" }, { status: 403 });
  }

  const wrongWords = await prisma.userWrongWord.findMany({
    where: { userId: user.id },
    orderBy: { lastWrongAt: "desc" },
    include: {
      word: {
        include: { notes: { where: { userId: user.id } } },
      },
    },
  });

  const items = wrongWords.map((w) => ({
    wordId: w.word.id,
    text: w.word.text,
    phoneticUk: w.word.phoneticUk,
    phoneticUs: w.word.phoneticUs,
    translation: w.word.translation,
    note: w.word.notes[0]?.content ?? null,
    wrongCount: w.wrongCount,
    lastWrongAt: w.lastWrongAt,
  }));

  return NextResponse.json({ items });
}
