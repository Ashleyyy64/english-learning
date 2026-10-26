import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";

// 获取当前用户选择的词书
export async function GET() {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userBook = await prisma.userBook.findUnique({
    where: { userId: user.id },
    include: { book: true },
  });

  return NextResponse.json({ book: userBook?.book ?? null });
}

// 选择 / 更换词书
export async function POST(request: Request) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const bookId = String(body?.bookId ?? "").trim();
  if (!bookId) return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });

  const book = await prisma.wordBook.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "词书不存在" }, { status: 404 });

  await prisma.userBook.upsert({
    where: { userId: user.id },
    update: { bookId },
    create: { userId: user.id, bookId },
  });

  return NextResponse.json({ book: { id: book.id, name: book.name, itemNum: book.itemNum } });
}
