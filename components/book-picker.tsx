"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check } from "lucide-react";
import type { BookCategory } from "@/lib/books";

export default function BookPicker({ categories }: { categories: BookCategory[] }) {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [activeGroupId, setActiveGroupId] = useState(
    categories[0]?.groups[0]?.id ?? "",
  );
  const [activePublisherId, setActivePublisherId] = useState(
    categories[0]?.groups[0]?.children?.[0]?.id ?? "",
  );
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const active = categories.find((c) => c.id === activeCategoryId) ?? categories[0];
  const activeGroup =
    active?.groups.find((group) => group.id === activeGroupId) ??
    active?.groups[0];
  const activePublisher =
    activeGroup?.children?.find((group) => group.id === activePublisherId) ??
    activeGroup?.children?.[0];
  const visibleBooks =
    activePublisher?.books ?? activeGroup?.books ?? active?.books ?? [];

  const selectCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    const firstGroup = category?.groups[0];
    setActiveCategoryId(categoryId);
    setActiveGroupId(firstGroup?.id ?? "");
    setActivePublisherId(firstGroup?.children?.[0]?.id ?? "");
  };

  const selectGroup = (groupId: string) => {
    const group = active?.groups.find((item) => item.id === groupId);
    setActiveGroupId(groupId);
    setActivePublisherId(group?.children?.[0]?.id ?? "");
  };

  const selectBook = async (bookId: string) => {
    setSelecting(bookId);
    setError("");
    try {
      const res = await fetch("/api/books/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "选择失败，请重试");
        return;
      }
      router.push("/dashboard/student/vocabulary");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSelecting(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">选择词书</div>
          <h1>选择一本词书</h1>
          <p>选定后下次将默认使用该词书，可随时更换。</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="book-category-tabs">
        {categories.map((c) => (
          <button
            key={c.id}
            className={c.id === activeCategoryId ? "active" : ""}
            onClick={() => selectCategory(c.id)}
          >
            {c.name}
            <small>{c.books.length}</small>
          </button>
        ))}
      </div>

      {active && active.groups.length > 1 && (
        <div className="book-sub-tabs">
          {active.groups.map((group) => (
            <button
              key={group.id}
              className={group.id === activeGroup?.id ? "active" : ""}
              onClick={() => selectGroup(group.id)}
            >
              {group.name}
              <small>{group.books.length}</small>
            </button>
          ))}
        </div>
      )}

      {activeGroup?.children && activeGroup.children.length > 1 && (
        <div className="book-publisher-tabs">
          {activeGroup.children.map((publisher) => (
            <button
              key={publisher.id}
              className={publisher.id === activePublisher?.id ? "active" : ""}
              onClick={() => setActivePublisherId(publisher.id)}
            >
              {publisher.name}
              <small>{publisher.books.length}</small>
            </button>
          ))}
        </div>
      )}

      {active && (
        <section className="book-grid">
          {visibleBooks.map((b) => (
            <button
              key={b.id}
              className="book-card"
              onClick={() => selectBook(b.id)}
              disabled={selecting === b.id}
            >
              <div className="book-card-icon"><BookOpen size={18} /></div>
              <strong>{b.name}</strong>
              <span className="muted">{b.itemNum} 个单词</span>
              {b.publisher && <small>{b.publisher}{b.version ? ` · ${b.version}` : ""}</small>}
              <span className="book-card-cta">
                {selecting === b.id ? "选择中…" : <>选择 <Check size={14} /></>}
              </span>
            </button>
          ))}
        </section>
      )}
    </>
  );
}
