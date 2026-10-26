import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

type ResultItem = { wordId: string; known: boolean };

// 提交学后强化结果：
// - 对（known=true）→ 标记为 MASTERED（已掌握，从词书剔除）
// - 错（known=false）→ 删除进度记录，重新进入学前检测阶段
export async function POST(request: Request) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可进行学后强化" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const bookId: string | undefined = typeof body?.bookId === "string" ? body.bookId : undefined;
  const results: ResultItem[] = Array.isArray(body?.results)
    ? body.results.filter((r: ResultItem) => r && typeof r.wordId === "string")
    : [];

  if (results.length === 0) {
    return NextResponse.json({ error: "请先标记单词" }, { status: 400 });
  }

  const BATCH = 500;
  for (let i = 0; i < results.length; i += BATCH) {
    const chunk = results.slice(i, i + BATCH);
    const ids = chunk.map((r) => r.wordId);
    const knownIds = chunk.filter((r) => r.known).map((r) => r.wordId);
    const unknownIds = chunk.filter((r) => !r.known).map((r) => r.wordId);

    // 会 -> MASTERED（已掌握，从词书剔除），并从错题本移除
    // 不会 -> 删除进度记录，重新进入学前检测
    const operations = [
      prisma.userWordProgress.deleteMany({
        where: { userId: user.id, wordId: { in: ids } },
      }),
      prisma.userWrongWord.deleteMany({
        where: { userId: user.id, wordId: { in: knownIds } },
      }),
    ];
    if (knownIds.length > 0) {
      operations.push(
        prisma.userWordProgress.createMany({
          data: knownIds.map((wordId) => ({
            id: `${user.id}_${wordId}`,
            userId: user.id,
            wordId,
            status: "MASTERED",
          })),
        }),
      );
    }
    await prisma.$transaction(operations);

    // 不会 -> 收录错题（upsert 增加答错次数）
    if (unknownIds.length > 0) {
      await prisma.$transaction(
        unknownIds.map((wordId) =>
          prisma.userWrongWord.upsert({
            where: { userId_wordId: { userId: user.id, wordId } },
            update: {
              wrongCount: { increment: 1 },
              lastWrongAt: new Date(),
              bookId: bookId ?? null,
            },
            create: {
              userId: user.id,
              wordId,
              bookId: bookId ?? null,
              wrongCount: 1,
            },
          }),
        ),
      );

      // 不会 -> 同时收录到抗遗忘（艾宾浩斯遗忘曲线），进入间隔重复复习
      // 若该词已在抗遗忘记录中，答错则重置回阶段 0（当天可再复习）；首次收录则新建。
      await prisma.$transaction(
        unknownIds.map((wordId) =>
          prisma.userMemory.upsert({
            where: { userId_wordId: { userId: user.id, wordId } },
            update: {
              stage: 0,
              nextReviewAt: new Date(),
              lastResult: "WRONG",
            },
            create: {
              userId: user.id,
              wordId,
              stage: 0,
              nextReviewAt: new Date(),
              lastResult: "WRONG",
            },
          }),
        ),
      );
    }
  }

  const correct = results.filter((r) => r.known).length;
  const wrong = results.length - correct;

  return NextResponse.json({
    allCorrect: wrong === 0,
    correct,
    wrong,
    total: results.length,
  });
}
