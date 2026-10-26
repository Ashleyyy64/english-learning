import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

// 保存 / 更新某个单词的笔记（空内容视为删除）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const content = String(body?.content ?? "").trim();

  if (!content) {
    await prisma.userWordNote.deleteMany({ where: { userId: user.id, wordId: id } });
    return NextResponse.json({ note: null });
  }

  const note = await prisma.userWordNote.upsert({
    where: { userId_wordId: { userId: user.id, wordId: id } },
    update: { content },
    create: { userId: user.id, wordId: id, content },
  });

  return NextResponse.json({ note: { content: note.content } });
}
