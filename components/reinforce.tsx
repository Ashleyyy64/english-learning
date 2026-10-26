"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  NotebookPen,
  Type,
  X,
} from "lucide-react";
import WordMeaning from "@/components/word-meaning";
import { warmupTts } from "@/components/tts-warmup";
import { useTtsSpeak } from "@/components/use-tts-speak";

type Word = {
  id: string;
  text: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  translation: string | null;
  note: string | null;
};

type Mark = "known" | "unknown";

type Result = { allCorrect: boolean; correct: number; wrong: number };

const PAGE_SIZE = 30;

export default function Reinforce({
  book,
  words,
}: {
  book: { id: string; name: string };
  words: Word[];
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
  const [result, setResult] = useState<Result | null>(null);

  const markedCount = Object.keys(marks).length;
  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const pageWords = words.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 预热 TTS 缓存：进入页面 / 翻页时，后台预加载「当前页 + 下一页」的单词发音
  useEffect(() => {
    const current = words
      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      .map((w) => w.text);
    const next = words
      .slice((page + 1) * PAGE_SIZE, (page + 2) * PAGE_SIZE)
      .map((w) => w.text);
    warmupTts([...current, ...next], 3);
  }, [page, words]);

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

  const submit = async () => {
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

      const res = await fetch("/api/review/submit", {
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

  if (result) return <ReinforceResult result={result} />;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">学后强化 · {book.name}</div>
          <h1>学后强化</h1>
          <p>对刚识记的单词做一次检测，全部通过即结束本次学习。</p>
        </div>
        <span className="streak">已标记 {markedCount} / {words.length}</span>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {words.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Check size={22} /></div>
          <h2>没有需要强化的单词</h2>
          <p>识记部分的单词都已完成，可以返回背单词主页。</p>
          <div className="result-actions">
            <Link href="/dashboard/student/vocabulary" className="primary-button small">返回背单词</Link>
          </div>
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
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "提交中…" : <>提交检测结果 <ArrowRight size={15} /></>}
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

function ReinforceResult({ result }: { result: Result }) {
  if (result.allCorrect) {
    return (
      <div className="result-screen all-correct">
        <div className="result-icon"><Check size={34} /></div>
        <h2>全部掌握！</h2>
        <p>本次学习的单词已全部通过，学习结束。</p>
        <div className="result-actions">
          <Link href="/dashboard/student/vocabulary" className="primary-button small">返回背单词</Link>
          <Link href="/dashboard/student" className="outline-button">返回主界面</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="result-screen has-errors">
      <div className="result-icon"><BookOpen size={30} /></div>
      <h2>还有 {result.wrong} 个单词未掌握</h2>
      <p>这些单词将重新进入学前检测，重新检测后再进入单词识记。</p>
      <div className="result-stats">
        <span>正确 {result.correct}</span>
        <span>待重学 {result.wrong}</span>
      </div>
      <div className="result-actions">
        <Link href="/dashboard/student/vocabulary/pretest" className="primary-button small">重新学前检测 <ArrowRight size={15} /></Link>
        <Link href="/dashboard/student" className="outline-button">返回主界面</Link>
      </div>
    </div>
  );
}
