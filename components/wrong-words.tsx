"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  BookX,
  NotebookPen,
  Trash2,
  Type,
  X,
} from "lucide-react";
import WordMeaning from "@/components/word-meaning";
import { warmupTts } from "@/components/tts-warmup";
import { useTtsSpeak } from "@/components/use-tts-speak";

type WrongItem = {
  wordId: string;
  text: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  translation: string | null;
  note: string | null;
  wrongCount: number;
  lastWrongAt: string;
};

export default function WrongWords({ items }: { items: WrongItem[] }) {
  const [list, setList] = useState<WrongItem[]>(items);
  const [showMeaning, setShowMeaning] = useState(true);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [noteTarget, setNoteTarget] = useState<WrongItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");

  // 预热 TTS 缓存：进入错题本页面时，后台预加载所有错题单词的发音
  useEffect(() => {
    warmupTts(list.map((w) => w.text), 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNote = (w: WrongItem) => {
    setNoteTarget(w);
    setNoteDraft(w.note ?? "");
  };

  const saveNote = async () => {
    if (!noteTarget) return;
    setSavingNote(true);
    try {
      await fetch(`/api/words/${noteTarget.wordId}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteDraft }),
      });
      setList((prev) =>
        prev.map((w) =>
          w.wordId === noteTarget.wordId
            ? { ...w, note: noteDraft.trim() || null }
            : w,
        ),
      );
      setNoteTarget(null);
    } catch {
      setError("笔记保存失败，请重试");
    } finally {
      setSavingNote(false);
    }
  };

  const removeItem = async (w: WrongItem) => {
    setRemoving(w.wordId);
    setError("");
    try {
      const res = await fetch(`/api/wrong-words/${w.wordId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("移除失败，请重试");
        return;
      }
      setList((prev) => prev.filter((x) => x.wordId !== w.wordId));
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">错题本</div>
          <h1>错题本</h1>
          <p>自动收录学后检测与抗遗忘复习中答错的单词，集中复习巩固。</p>
        </div>
        <span className="streak">共 {list.length} 个错题</span>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BookX size={22} /></div>
          <h2>错题本是空的</h2>
          <p>学后检测或抗遗忘复习中答错的单词会自动收录到这里。</p>
          <div className="result-actions">
            <Link href="/dashboard/student/vocabulary" className="primary-button small">去背单词</Link>
          </div>
        </div>
      ) : (
        <div className="vocab-layout">
          <section className="word-list">
            {list.map((w) => {
              const phonetic = w.phoneticUs ?? w.phoneticUk;
              const hasNote = Boolean(w.note);
              return (
                <WordRow key={w.wordId} word={w.text}>
                  <div className="word-row-main">
                    <div className="word-line">
                      <span className="word-text">{w.text}</span>
                      {showPhonetic && phonetic && <span className="word-phonetic">{phonetic}</span>}
                      <span className="wrong-badge">错 {w.wrongCount} 次</span>
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
                      className="mark-button cross"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(w);
                      }}
                      disabled={removing === w.wordId}
                      aria-label="移除错题"
                      title="移除错题"
                    >
                      <Trash2 size={18} />
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
          </aside>
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
