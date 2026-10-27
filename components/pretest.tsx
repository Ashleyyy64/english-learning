"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  List,
  NotebookPen,
  Type,
  X,
} from "lucide-react";
import WordMeaning from "@/components/word-meaning";
import { warmupTtsPriority } from "@/components/tts-warmup";
import { useTtsSpeak } from "@/components/use-tts-speak";

type Word = {
  id: string;
  text: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  translation: string | null;
  note: string | null;
  unit: string | null;
};

type Mark = "known" | "unknown";

type ViewMode = "list" | "unit";

type UnitGroup = { name: string; words: Word[] };

type Result = { allCorrect: boolean; correct: number; wrong: number };

const PAGE_SIZE = 30;

export default function Pretest({
  book,
  words,
  totalWordCount,
}: {
  book: { id: string; name: string };
  words: Word[];
  totalWordCount?: number;
}) {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [showMeaning, setShowMeaning] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Word | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [unitIndex, setUnitIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const markedCount = Object.keys(marks).length;

  // 按单元分组：保留词书原始顺序（服务端已按 unit / flag 排序），
  // 单元名仅作为「分段标记」，相邻同单元单词归入同一组。
  const unitGroups: UnitGroup[] = (() => {
    const groups: UnitGroup[] = [];
    let lastUnit: string | null = null;
    for (const w of words) {
      const unit = (w.unit ?? "").trim();
      if (groups.length === 0 || unit !== lastUnit) {
        groups.push({ name: unit || "未分组", words: [] });
        lastUnit = unit;
      }
      groups[groups.length - 1].words.push(w);
    }
    return groups;
  })();

  // 当前展示的单词：完整列表模式展示全部；单元模式仅展示当前单元。
  const visibleWords = viewMode === "list" ? words : unitGroups[unitIndex]?.words ?? [];

  const totalPages = Math.max(1, Math.ceil(visibleWords.length / PAGE_SIZE));
  const pageWords = visibleWords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 预热 TTS 缓存：进入页面 / 翻页 / 切换单元时，后台预加载「当前页 + 下一页」的单词发音，
  // 让用户点击喇叭时即时出声，避免首次点击干等合成。
  useEffect(() => {
    const current = visibleWords
      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      .map((w) => w.text);
    const next = visibleWords
      .slice((page + 1) * PAGE_SIZE, (page + 2) * PAGE_SIZE)
      .map((w) => w.text);
    warmupTtsPriority(current, next, 3);
  }, [page, viewMode, unitIndex, words]);

  const toggleMark = (id: string, value: Mark) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
  };

  const openNote = (w: Word) => {
    setNoteTarget(w);
    setNoteDraft(w.note ?? "");
  };

  const saveNote = async () => {
    if (!noteTarget) return;
    setSavingNote(true);
    try {
      await fetch(`/api/words/${noteTarget.id}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteDraft }),
      });
      // 本地同步笔记内容（不整页刷新）
      words.forEach((w) => {
        if (w.id === noteTarget.id) w.note = noteDraft.trim() || null;
      });
      setNoteTarget(null);
    } catch {
      setError("笔记保存失败，请重试");
    } finally {
      setSavingNote(false);
    }
  };

  const submitMarkedWords = async () => {
    setSubmitting(true);
    setError("");
    try {
      const results = words
        .filter((word) => Boolean(marks[word.id]))
        .map((word) => ({
          wordId: word.id,
          known: marks[word.id] === "known",
        }));

      if (results.length === 0) {
        setError("请先标记要提交的单词");
        return;
      }

      const res = await fetch("/api/pretest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, results }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败，请重试");
        return;
      }
      setResult(data);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <ResultScreen result={result} />;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">学前检测 · {book.name}</div>
          <h1>学前检测</h1>
          <p>逐个标记你会 / 不会的单词，提交后进入单词识记。</p>
        </div>
        <span className="streak">已标记 {markedCount} / {words.length}</span>
      </div>

      {words.length > 0 && (
        <ViewModeBar
          viewMode={viewMode}
          unitGroups={unitGroups}
          unitIndex={unitIndex}
          marks={marks}
          onShowList={() => {
            if (viewMode === "list") return;
            setViewMode("list");
            setPage(0);
          }}
          onSelectUnit={(i) => {
            if (viewMode === "unit" && unitIndex === i) return;
            setViewMode("unit");
            setUnitIndex(i);
            setPage(0);
          }}
        />
      )}

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {words.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BookOpen size={22} /></div>
          {totalWordCount && totalWordCount > 0 ? (
            <>
              <h2>这本词书已经全部背完！</h2>
              <p>所有单词都已掌握，可以更换一本词书继续学习。</p>
            </>
          ) : (
            <>
              <h2>这本词书还没有单词</h2>
              <p>请先运行词书导入脚本，或更换一本词书。</p>
            </>
          )}
        </div>
      ) : (
        <div className="vocab-layout">
          <section className="word-list">
            {pageWords.map((w) => {
              const phonetic = w.phoneticUs ?? w.phoneticUk;
              const hasNote = Boolean(w.note);
              return (
                <WordRow key={w.id} word={w.text} marked={Boolean(marks[w.id])}>
                  <div className="word-row-main">
                    <div className="word-line">
                      <span className="word-text">{w.text}</span>
                      {showPhonetic && phonetic && <span className="word-phonetic">{phonetic}</span>}
                    </div>
                    {showMeaning && w.translation && (
                      <WordMeaning translation={w.translation} />
                    )}
                  </div>
                  <div className="word-row-actions">
                    <button
                      type="button"
                      className={`note-button ${hasNote ? "has-note" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openNote(w);
                      }}
                      aria-label={hasNote ? "编辑笔记" : "记笔记"}
                      title={hasNote ? "编辑笔记" : "记笔记"}
                    >
                      <NotebookPen size={18} />
                    </button>
                    <button
                      type="button"
                      className={`mark-button check ${marks[w.id] === "known" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMark(w.id, "known");
                      }}
                      aria-label="会"
                      title="会"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      className={`mark-button cross ${marks[w.id] === "unknown" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMark(w.id, "unknown");
                      }}
                      aria-label="不会"
                      title="不会"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </WordRow>
              );
            })}
          </section>

          <aside className="side-rail">
            <span className="nav-label">显示</span>
            <button
              type="button"
              className={`rail-button ${showMeaning ? "active" : ""}`}
              onClick={() => setShowMeaning((v) => !v)}
            >
              <BookOpen size={16} /> 释义
            </button>
            <button
              type="button"
              className={`rail-button ${showPhonetic ? "active" : ""}`}
              onClick={() => setShowPhonetic((v) => !v)}
            >
              <Type size={16} /> 音标
            </button>
            <div className="side-rail-divider" />
            <span className="muted rail-count">已标记 {markedCount} 个单词</span>
            <button
              className="primary-button small rail-submit"
              onClick={submitMarkedWords}
              disabled={submitting}
            >
              {submitting ? "提交中…" : <>提交已学单词 <ArrowRight size={15} /></>}
            </button>
          </aside>
        </div>
      )}

      {words.length > 0 && (
        <div className="pretest-footer">
          <div className="pagination">
            <button
              type="button"
              className="outline-button small"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
            >
              上一页
            </button>
            <span className="pagination-info">
              第 {page + 1} / {totalPages} 页
            </span>
            <button
              type="button"
              className="outline-button small"
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
              disabled={page >= totalPages - 1}
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {noteTarget && (
        <div className="note-modal-overlay" onClick={() => setNoteTarget(null)}>
          <div className="note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="note-modal-head">
              <strong>{noteTarget.text}</strong>
              <button type="button" onClick={() => setNoteTarget(null)} aria-label="关闭"><X size={18} /></button>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="为这个单词记一条笔记…"
              autoFocus
            />
            <div className="note-modal-actions">
              <button type="button" className="outline-button" onClick={() => setNoteTarget(null)}>取消</button>
              <button type="button" className="primary-button small" onClick={saveNote} disabled={savingNote}>
                {savingNote ? "保存中…" : "保存笔记"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 展示方式切换：「完整列表」+ 一排单元按钮，点单元直接进入该单元展示；
// 单元徽标实时显示该单元的标记进度（未标显示词数，部分标记显示 已标/总数，全标完成转绿勾）。
function ViewModeBar({
  viewMode,
  unitGroups,
  unitIndex,
  marks,
  onSelectUnit,
  onShowList,
}: {
  viewMode: ViewMode;
  unitGroups: UnitGroup[];
  unitIndex: number;
  marks: Record<string, Mark>;
  onSelectUnit: (index: number) => void;
  onShowList: () => void;
}) {
  // 没有有效单元数据（分组 <= 1，含全部「未分组」）时不渲染单元按钮
  const units = unitGroups.length > 1 ? unitGroups : [];
  return (
    <div className="view-mode-bar" role="tablist" aria-label="展示方式">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "list"}
        className={`view-chip ${viewMode === "list" ? "active" : ""}`}
        onClick={onShowList}
      >
        <List size={14} /> <span className="view-chip-name">完整列表</span>
      </button>
      {units.map((g, i) => {
        const total = g.words.length;
        const marked = g.words.filter((w) => marks[w.id]).length;
        const done = total > 0 && marked === total;
        const active = viewMode === "unit" && unitIndex === i;
        return (
          <button
            key={`${g.name}-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            className={`view-chip ${active ? "active" : ""} ${done ? "done" : ""}`}
            onClick={() => onSelectUnit(i)}
            title={`${g.name} · ${total} 词 · 已标 ${marked}`}
          >
            <span className="view-chip-name">{g.name}</span>
            <small>
              {done ? <Check size={11} /> : marked > 0 ? `${marked}/${total}` : total}
            </small>
          </button>
        );
      })}
    </div>
  );
}

// 可点击的单词卡片：点击整行播放发音，操作按钮点击需阻止冒泡
function WordRow({
  word,
  marked,
  children,
}: {
  word: string;
  marked?: boolean;
  children: React.ReactNode;
}) {
  const { speak } = useTtsSpeak(word);
  return (
    <div
      className={`word-row ${marked ? "marked" : ""}`}
      onClick={speak}
      role="button"
      tabIndex={0}
      aria-label={`朗读 ${word}`}
      title="点击朗读"
    >
      {children}
    </div>
  );
}

function ResultScreen({ result }: { result: Result }) {
  if (result.allCorrect) {
    return (
      <div className="result-screen all-correct">
        <div className="result-icon"><Check size={34} /></div>
        <h2>全部正确！</h2>
        <p>这些单词你都已经掌握，太棒了。</p>
        <div className="result-actions">
          <Link href="/dashboard/student/vocabulary" className="primary-button small">继续学习</Link>
          <Link href="/dashboard/student" className="outline-button">返回主界面</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="result-screen has-errors">
      <div className="result-icon"><BookOpen size={30} /></div>
      <h2>有 {result.wrong} 个单词需要学习</h2>
      <p>已标记正确的单词将被跳过，接下来进入单词识记巩固这些单词。</p>
      <div className="result-stats">
        <span>正确 {result.correct}</span>
        <span>待学习 {result.wrong}</span>
      </div>
      <div className="result-actions">
        <Link href="/dashboard/student/vocabulary/review" className="primary-button small">单词识记 <ArrowRight size={15} /></Link>
        <Link href="/dashboard/student" className="outline-button">返回主界面</Link>
      </div>
    </div>
  );
}
