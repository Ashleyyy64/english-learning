import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";
import { isDue, nextReviewAfter } from "@/lib/memory";

// 获取今日待复习的单词列表（含单词信息与笔记）
export async function GET() {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可使用抗遗忘" }, { status: 403 });
  }

  const records = await prisma.userMemory.findMany({
    where: { userId: user.id },
    orderBy: [{ nextReviewAt: "asc" }],
    include: {
      word: {
        include: { notes: { where: { userId: user.id } } },
      },
    },
  });

  // 过滤出今日到期的
  const due = records.filter((r) => isDue(r));

  const words = due.map((r) => ({
    wordId: r.word.id,
    text: r.word.text,
    phoneticUk: r.word.phoneticUk,
    phoneticUs: r.word.phoneticUs,
    translation: r.word.translation,
    note: r.word.notes[0]?.content ?? null,
    stage: r.stage,
  }));

  return NextResponse.json({ words, count: words.length });
}

// 提交一轮复习结果：
// - 对（correct）→ 阶段 +1，下次复习时间按遗忘曲线后移
// - 错（wrong）→ 重置到阶段 0，当天可再复习
type ReviewItem = { wordId: string; correct: boolean };

export async function POST(request: Request) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可使用抗遗忘" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const results: ReviewItem[] = Array.isArray(body?.results)
    ? body.results.filter((r: ReviewItem) => r && typeof r.wordId === "string")
    : [];

  if (results.length === 0) {
    return NextResponse.json({ error: "请先标记单词" }, { status: 400 });
  }

  // 读取当前记忆记录，逐词更新阶段
  const wordIds = results.map((r) => r.wordId);
  const records = await prisma.userMemory.findMany({
    where: { userId: user.id, wordId: { in: wordIds } },
  });
  const recordMap = new Map(records.map((r) => [r.wordId, r]));

  // 记录本次答错的单词，用于同步收录进错题本
  const wrongWordIds: string[] = [];

  for (const item of results) {
    const record = recordMap.get(item.wordId);
    if (!record) continue; // 记录不存在则跳过

    const { stage, nextReviewAt } = nextReviewAfter(record.stage, item.correct);
    await prisma.userMemory.update({
      where: { id: record.id },
      data: {
        stage,
        nextReviewAt,
        lastResult: item.correct ? "CORRECT" : "WRONG",
        reviewCount: { increment: 1 },
      },
    });

    // 抗遗忘复习中答错的单词，同步收录进错题本（累计答错次数）
    if (!item.correct) {
      wrongWordIds.push(item.wordId);
    }
  }

  // 将抗遗忘复习中答错的单词统一归入错题本：
  // 已存在则累计 wrongCount + 更新 lastWrongAt，首次收录则新建。
  if (wrongWordIds.length > 0) {
    await prisma.$transaction(
      wrongWordIds.map((wordId) =>
        prisma.userWrongWord.upsert({
          where: { userId_wordId: { userId: user.id, wordId } },
          update: {
            wrongCount: { increment: 1 },
            lastWrongAt: new Date(),
          },
          create: {
            userId: user.id,
            wordId,
            wrongCount: 1,
          },
        }),
      ),
    );
  }

  const correct = results.filter((r) => r.correct).length;
  const wrong = results.length - correct;

  return NextResponse.json({ correct, wrong, total: results.length });
}
