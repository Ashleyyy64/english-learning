import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth";
import { getBookCategories } from "@/lib/books";

// 词书分类树：顶级为分类（小学/中学/高中/考研/考博/出国），子级为词书
export async function GET() {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const categories = await getBookCategories();
  return NextResponse.json({ categories });
}
