import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

type ResultItem = { wordId: string; known: boolean };

// 提交学前检测结果：会 -> MASTERED（已掌握，从词书永久剔除），不会 -> UNKNOWN（进入单词识记）
export async function POST(request: Request) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可进行学前检测" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const bookId: string | undefined = typeof body?.bookId === "string" ? body.bookId : undefined;
  const results: ResultItem[] = Array.isArray(body?.results)
    ? body.results.filter((r: ResultItem) => r && typeof r.wordId === "string")
    : [];

  if (!bookId) {
    return NextResponse.json({ error: "缺少词书信息" }, { status: 400 });
  }
  if (results.length === 0) {
    return NextResponse.json({ error: "请先标记单词" }, { status: 400 });
  }

  // 校验提交的单词确实属于该词书
  const validRelations = await prisma.bookWord.findMany({
    where: { bookId, wordId: { in: results.map((r) => r.wordId) } },
    select: { wordId: true },
  });
  const validWordIds = new Set(validRelations.map((r) => r.wordId));
  const validResults = results.filter((r) => validWordIds.has(r.wordId));

  if (validResults.length === 0) {
    return NextResponse.json({ error: "提交的单词不属于当前词书" }, { status: 400 });
  }

  // 只更新本次提交的单词：先删除这些单词的旧记录，再写入本次结果。
  // 未提交的单词保持原状态不变，避免误删之前已掌握（MASTERED）的单词。
  const submittedIds = validResults.map((r) => r.wordId);

  // 本次学前检测生成一个新的学习批次：所有「不会」词共享同一 batchId，
  // 供识记/学后强化「只读最近一批」使用（避免历史累积的 UNKNOWN 词混入）。
  const batchId = new Date().getTime().toString();

  const BATCH = 500;
  for (let i = 0; i < submittedIds.length; i += BATCH) {
    const chunk = submittedIds.slice(i, i + BATCH);
    await prisma.userWordProgress.deleteMany({
      where: { userId: user.id, wordId: { in: chunk } },
    });
  }

  // 分批写入本次结果：会 -> MASTERED（无需批次），不会 -> UNKNOWN（带本次批次）
  for (let i = 0; i < validResults.length; i += BATCH) {
    const chunk = validResults.slice(i, i + BATCH);
    await prisma.userWordProgress.createMany({
      data: chunk.map((r) => ({
        id: `${user.id}_${r.wordId}`,
        userId: user.id,
        wordId: r.wordId,
        status: r.known ? "MASTERED" : "UNKNOWN",
        batchId: r.known ? null : batchId,
      })),
    });
  }

  // 抗遗忘同步：凡标记为「不会」进入单词识记（UNKNOWN）的单词，
  // 立即自动纳入抗遗忘复习列表（艾宾浩斯遗忘曲线），保证识记与抗遗忘完整同步、无一遗漏。
  // 若该词已在抗遗忘池中则保持不变（保留既有复习进度），首次进入则新建 stage 0 记录。
  const toRemember = validResults.filter((r) => !r.known).map((r) => r.wordId);
  for (let i = 0; i < toRemember.length; i += BATCH) {
    const chunk = toRemember.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((wordId) =>
        prisma.userMemory.upsert({
          where: { userId_wordId: { userId: user.id, wordId } },
          update: {}, // 已在池中：保留既有 stage 与复习进度，不重置
          create: {
            userId: user.id,
            wordId,
            stage: 0,
            nextReviewAt: new Date(),
            lastResult: null,
          },
        }),
      ),
    );
  }

  const correct = validResults.filter((r) => r.known).length;
  const wrong = validResults.length - correct;

  return NextResponse.json({
    allCorrect: wrong === 0,
    correct,
    wrong,
    total: validResults.length,
  });
}
