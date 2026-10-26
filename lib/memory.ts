// 艾宾浩斯遗忘曲线 / 间隔重复调度

// 各阶段对应的复习间隔（天）。stage 表示「已通过」的阶段序号。
// 阶段 0 = 刚收录（当天就要首次复习，间隔 0 天）
// 通过阶段 0 后进入阶段 1，间隔 1 天；阶段 2 间隔 2 天；阶段 3 间隔 4 天；
// 阶段 4 间隔 7 天；阶段 5 间隔 15 天；阶段 6 间隔 30 天（此后视为长期记住）。
export const MEMORY_INTERVALS = [0, 1, 2, 4, 7, 15, 30] as const;

// 最大阶段数（通过全部阶段后视为已长期记住）
export const MAX_STAGE = MEMORY_INTERVALS.length - 1; // 6

// 根据当前阶段计算下次复习时间
// - 答对：阶段 +1，下次复习时间 = 现在 + 新阶段对应的间隔天数
// - 答错：重置到阶段 0，下次复习时间 = 现在 + 0 天（当天继续复习）
export function nextReviewAfter(stage: number, correct: boolean): { stage: number; nextReviewAt: Date } {
  if (!correct) {
    // 答错：重置回阶段 0，立刻（当天）可再次复习
    return { stage: 0, nextReviewAt: new Date() };
  }
  const nextStage = Math.min(stage + 1, MAX_STAGE);
  const interval = MEMORY_INTERVALS[nextStage] ?? 0;
  const next = new Date();
  next.setDate(next.getDate() + interval);
  // 归零时分秒，便于按「天」比较
  next.setHours(0, 0, 0, 0);
  return { stage: nextStage, nextReviewAt: next };
}

// 判断某个记忆记录今天是否到期需要复习（nextReviewAt <= 今天结束）
export function isDue(record: { nextReviewAt: Date }): boolean {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return record.nextReviewAt.getTime() <= endOfToday.getTime();
}

// 计算未来 N 天每天需要复习的词数（用于主页展示曲线）
// 返回 [{ date, count }]，date 为当天零点。
export function dailyReviewCounts(
  memories: { nextReviewAt: Date }[],
  days: number,
): { date: Date; count: number }[] {
  const result: { date: Date; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const dayStart = day.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const count = memories.filter(
      (m) => m.nextReviewAt.getTime() >= dayStart && m.nextReviewAt.getTime() <= dayEnd,
    ).length;
    result.push({ date: day, count });
  }
  return result;
}
