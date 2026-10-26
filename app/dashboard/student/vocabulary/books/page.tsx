import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getEffectiveUser } from "@/lib/auth";
import { getBookCategories } from "@/lib/books";
import BookPicker from "@/components/book-picker";

export default async function BooksPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  const categories = await getBookCategories();

  if (categories.length === 0) {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">选择词书</div>
            <h1>还没有词书数据</h1>
            <p>请先运行 <code>npm run db:import</code> 导入词书，再回来选择。</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-icon"><BookOpen size={22} /></div>
          <h2>暂无词书</h2>
          <p>词书数据尚未导入数据库。</p>
        </div>
      </>
    );
  }

  return <BookPicker categories={categories} />;
}
