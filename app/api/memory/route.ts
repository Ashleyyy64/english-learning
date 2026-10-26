import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";
import { dailyReviewCounts, isDue } from "@/lib/memory";

// 抗遗忘主页数据：今日待复习词数 + 未来 30 天每日复习词数（艾宾浩斯曲线）
export async function GET() {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可使用抗遗忘" }, { status: 403 });
  }

  const memories = await prisma.userMemory.findMany({
    where: { userId: user.id },
    select: { nextReviewAt: true, stage: true },
  });

  // 今日待复习词数
  const todayDue = memories.filter(isDue).length;

  // 未来 30 天每日复习词数（曲线）
  const daily = dailyReviewCounts(memories, 30);

  return NextResponse.json({
    total: memories.length, // 抗遗忘池中的总词数
    todayDue,
    daily: daily.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      count: d.count,
    })),
  });
}
