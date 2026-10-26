"use client";

import { useMemo, useState } from "react";
import {
  BookX,
  Search,
  Users,
  ListOrdered,
  UserRound,
  Type,
  BookOpen,
} from "lucide-react";
import WordMeaning from "@/components/word-meaning";

type StudentSummary = {
  id: string;
  name: string;
  username: string;
  wrongWordCount: number;
};

type WrongItem = {
  wordId: string;
  text: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  translation: string | null;
  bookName: string | null;
  studentId: string;
  studentName: string;
  studentUsername: string;
  wrongCount: number;
  lastWrongAt: string;
};

type WrongWordAgg = {
  wordId: string;
  text: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  translation: string | null;
  wrongStudents: number;
  totalWrongCount: number;
  students: { id: string; name: string; username: string; wrongCount: number; lastWrongAt: string }[];
  lastWrongAt: string;
};

type View = "student" | "word";

export default function TeacherWrongWords({
  students,
  items,
  words,
}: {
  students: StudentSummary[];
  items: WrongItem[];
  words: WrongWordAgg[];
}) {
  const [view, setView] = useState<View>("student");
  const [query, setQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [wordSort, setWordSort] = useState<"count" | "students" | "recent">("count");

  const q = query.trim().toLowerCase();

  // ===== 学生视角：筛选 + 搜索 =====
  const studentItems = useMemo(() => {
    return items.filter((it) => {
      if (studentFilter !== "all" && it.studentId !== studentFilter) return false;
      if (q && !it.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, studentFilter, q]);

  const studentStats = useMemo(() => {
    const total = studentItems.length;
    const totalWrong = studentItems.reduce((s, it) => s + it.wrongCount, 0);
    return { total, totalWrong };
  }, [studentItems]);

  // ===== 单词视角：筛选 + 搜索 + 排序 =====
  const wordItems = useMemo(() => {
    let list = words.filter((w) => !q || w.text.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (wordSort === "students") return b.wrongStudents - a.wrongStudents;
      if (wordSort === "recent") return b.lastWrongAt.localeCompare(a.lastWrongAt);
      return b.totalWrongCount - a.totalWrongCount;
    });
    return list;
  }, [words, q, wordSort]);

  const selectedStudent = students.find((s) => s.id === studentFilter) ?? null;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">错题本</div>
          <h1>班级错题本</h1>
          <p>汇总所有学生的错题，按学生或单词维度掌握薄弱情况。</p>
        </div>
        <span className="streak">{students.length} 位学生 · {items.length} 条错题</span>
      </div>

      {/* 概览统计 */}
      <section className="tww-stats">
        <div className="tww-stat-card">
          <div className="tww-stat-icon orange"><Users size={18} /></div>
          <div>
            <strong>{students.length}</strong>
            <span>绑定学生</span>
          </div>
        </div>
        <div className="tww-stat-card">
          <div className="tww-stat-icon red"><BookX size={18} /></div>
          <div>
            <strong>{items.length}</strong>
            <span>错题总数</span>
          </div>
        </div>
        <div className="tww-stat-card">
          <div className="tww-stat-icon purple"><ListOrdered size={18} /></div>
          <div>
            <strong>{new Set(items.map((i) => i.wordId)).size}</strong>
            <span>薄弱单词</span>
          </div>
        </div>
        <div className="tww-stat-card">
          <div className="tww-stat-icon teal"><Type size={18} /></div>
          <div>
            <strong>{words.reduce((s, w) => s + w.totalWrongCount, 0)}</strong>
            <span>累计答错次数</span>
          </div>
        </div>
      </section>

      {/* 视图切换 + 筛选栏 */}
      <section className="tww-toolbar panel-card">
        <div className="tww-seg">
          <button
            className={view === "student" ? "active" : ""}
            onClick={() => setView("student")}
          >
            <UserRound size={15} /> 按学生查看
          </button>
          <button
            className={view === "word" ? "active" : ""}
            onClick={() => setView("word")}
          >
            <Type size={15} /> 按单词查看
          </button>
        </div>

        <div className="tww-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "student" ? "搜索单词…" : "搜索单词…"}
          />
        </div>

        {view === "student" ? (
          <select
            className="tww-select"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          >
            <option value="all">全部学生</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="tww-select"
            value={wordSort}
            onChange={(e) => setWordSort(e.target.value as typeof wordSort)}
          >
            <option value="count">按答错次数</option>
            <option value="students">按影响学生数</option>
            <option value="recent">按最近答错</option>
          </select>
        )}
      </section>

      {view === "student" ? (
        <StudentView
          items={studentItems}
          total={studentStats.total}
          totalWrong={studentStats.totalWrong}
          selectedStudent={selectedStudent}
        />
      ) : (
        <WordView items={wordItems} />
      )}
    </>
  );
}

// ===== 按学生视角：错题列表（每条标注归属学生） =====
function StudentView({
  items,
  total,
  totalWrong,
  selectedStudent,
}: {
  items: WrongItem[];
  total: number;
  totalWrong: number;
  selectedStudent: StudentSummary | null;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><BookX size={22} /></div>
        <h2>{selectedStudent ? `${selectedStudent.name} 暂无错题` : "暂无错题"}</h2>
        <p>{selectedStudent ? "该学生目前没有答错的单词。" : "学生们还没有产生错题。"}</p>
      </div>
    );
  }

  return (
    <>
      <div className="tww-subhead">
        <span>{selectedStudent ? `${selectedStudent.name} 的错题` : "全部学生错题"}</span>
        <span className="muted">{total} 条错题 · 累计答错 {totalWrong} 次</span>
      </div>
      <section className="word-list">
        {items.map((it) => {
          const phonetic = it.phoneticUs ?? it.phoneticUk;
          return (
            <div className="word-row" key={`${it.studentId}-${it.wordId}`}>
              <div className="word-row-main">
                <div className="word-line">
                  <span className="word-text">{it.text}</span>
                  {phonetic && <span className="word-phonetic">{phonetic}</span>}
                  <span className="wrong-badge">错 {it.wrongCount} 次</span>
                </div>
                {it.translation && <WordMeaning translation={it.translation} />}
                <div className="tww-meta">
                  <span className="tww-student-chip"><UserRound size={12} /> {it.studentName}</span>
                  {it.bookName && <span className="tww-book-chip"><BookOpen size={12} /> {it.bookName}</span>}
                  <span className="tww-time">{formatDate(it.lastWrongAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

// ===== 按单词视角：单词聚合列表（展示影响学生与累计次数） =====
function WordView({ items }: { items: WrongWordAgg[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Type size={22} /></div>
        <h2>暂无薄弱单词</h2>
        <p>学生们还没有答错的单词。</p>
      </div>
    );
  }

  return (
    <section className="word-list">
      {items.map((w) => {
        const phonetic = w.phoneticUs ?? w.phoneticUk;
        const open = expanded === w.wordId;
        return (
          <div className="tww-word-row" key={w.wordId}>
            <button
              className="tww-word-main"
              onClick={() => setExpanded(open ? null : w.wordId)}
              aria-expanded={open}
            >
              <div className="word-line">
                <span className="word-text">{w.text}</span>
                {phonetic && <span className="word-phonetic">{phonetic}</span>}
                <span className="wrong-badge">累计 {w.totalWrongCount} 次</span>
                <span className="tww-count-chip">{w.wrongStudents} 人</span>
              </div>
              {w.translation && <WordMeaning translation={w.translation} />}
            </button>
            {open && (
              <div className="tww-word-detail">
                {w.students.map((s) => (
                  <div className="tww-detail-row" key={s.id}>
                    <span className="tww-student-chip"><UserRound size={12} /> {s.name}</span>
                    <span className="tww-detail-count">错 {s.wrongCount} 次</span>
                    <span className="tww-time">{formatDate(s.lastWrongAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
