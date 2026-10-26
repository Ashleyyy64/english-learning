import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

// 移除错题：按 wordId 从错题本删除（用户已掌握该单词）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ wordId: string }> },
) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可操作错题本" }, { status: 403 });
  }

  const { wordId } = await params;

  const result = await prisma.userWrongWord.deleteMany({
    where: { userId: user.id, wordId },
  });

  return NextResponse.json({ removed: result.count });
}
