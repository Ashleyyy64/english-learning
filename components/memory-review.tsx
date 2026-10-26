"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Check, RotateCcw, X } from "lucide-react";
import WordMeaning from "@/components/word-meaning";
import { warmupTts } from "@/components/tts-warmup";
import { useTtsSpeak } from "@/components/use-tts-speak";

type MemoryWord = {
  wordId: string;
  text: string;
  phoneticUk: string | null;
  phoneticUs: string | null;
  translation: string | null;
  note: string | null;
  stage: number;
};

type Mark = "known" | "unknown";

export default function MemoryReview() {
  const [words, setWords] = useState<MemoryWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [round, setRound] = useState(1); // 当前轮次（1 起）
  const [pool, setPool] = useState<MemoryWord[]>([]); // 本轮待复习的词
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<{ correct: number; wrong: number } | null>(null);

  const [showMeaning, setShowMeaning] = useState(true);
  const [showPhonetic, setShowPhonetic] = useState(false);

  // 初始加载今日待复习词
  useEffect(() => {
    fetch("/api/memory/review")
      .then((r) => r.json())
      .then((d) => {
        setWords(d.words ?? []);
        setPool(d.words ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("加载失败，请重试");
        setLoading(false);
      });
  }, []);

  // 预热 TTS
  useEffect(() => {
    if (pool.length > 0) warmupTts(pool.map((w) => w.text), 3);
  }, [pool]);

  const toggleMark = (id: string, value: Mark) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
  };

  const markedCount = useMemo(
    () => pool.filter((w) => Boolean(marks[w.wordId])).length,
    [pool, marks],
  );
  const allMarked = markedCount === pool.length && pool.length > 0;

  // 提交本轮结果
  const submitRound = async () => {
    if (!allMarked) return;
    setSubmitting(true);
    setError("");
    try {
      const results = pool.map((w) => ({
        wordId: w.wordId,
        correct: marks[w.wordId] === "known",
      }));

      const res = await fetch("/api/memory/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败，请重试");
        return;
      }

      // 错词进入下一轮
      const wrongWords = pool.filter((w) => marks[w.wordId] === "unknown");
      if (wrongWords.length > 0) {
        setRound((r) => r + 1);
        setPool(wrongWords);
        setMarks({});
        setSummary({ correct: data.correct, wrong: data.wrong });
      } else {
        setDone(true);
        setSummary({ correct: data.correct, wrong: 0 });
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Brain size={22} /></div>
        <h2>加载中…</h2>
      </div>
    );
  }

  if (error && words.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Brain size={22} /></div>
        <h2>加载失败</h2>
        <p>{error}</p>
        <div className="result-actions">
          <Link href="/dashboard/student/memory" className="primary-button small">返回抗遗忘</Link>
        </div>
      </div>
    );
  }

  // 全部完成
  if (done) {
    return (
      <div className="result-screen all-correct">
        <div className="result-icon"><Check size={34} /></div>
        <h2>复习完成！</h2>
        <p>今日待复习单词已全部通过，共 {summary?.correct ?? 0} 个。</p>
        <div className="result-actions">
          <Link href="/dashboard/student/memory" className="primary-button small">返回抗遗忘</Link>
          <Link href="/dashboard/student" className="outline-button">返回主界面</Link>
        </div>
      </div>
    );
  }

  // 初始无待复习词
  if (words.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Brain size={22} /></div>
        <h2>今天没有需要复习的单词</h2>
        <p>学后检测中答错的单词会自动进入抗遗忘计划。</p>
        <div className="result-actions">
          <Link href="/dashboard/student/memory" className="primary-button small">返回抗遗忘</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">抗遗忘复习</div>
          <h1>抗遗忘复习</h1>
          <p>
            {summary
              ? `上一轮：正确 ${summary.correct} · 错误 ${summary.wrong}，错误单词进入第 ${round} 轮。`
              : "标记每个单词是否记得，全部通过即完成今日复习。"}
          </p>
        </div>
        <span className="streak">
          第 {round} 轮 · 已标记 {markedCount} / {pool.length}
        </span>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="vocab-layout">
        <section className="word-list">
          {pool.map((w) => {
            const phonetic = w.phoneticUs ?? w.phoneticUk;
            return (
              <WordRow key={w.wordId} word={w.text} marked={Boolean(marks[w.wordId])}>
                <div className="word-row-main">
                  <div className="word-line">
                    <span className="word-text">{w.text}</span>
                    {showPhonetic && phonetic && <span className="word-phonetic">{phonetic}</span>}
                  </div>
                  {showMeaning && w.translation && <WordMeaning translation={w.translation} />}
                </div>
                <div className="word-row-actions">
                  <button
                    type="button"
                    className={`mark-button check ${marks[w.wordId] === "known" ? "active" : ""}`}
                    onClick={() => toggleMark(w.wordId, "known")}
                    aria-label="记得"
                    title="记得"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    type="button"
                    className={`mark-button cross ${marks[w.wordId] === "unknown" ? "active" : ""}`}
                    onClick={() => toggleMark(w.wordId, "unknown")}
                    aria-label="忘记"
                    title="忘记"
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
            <Brain size={16} /> 释义
          </button>
          <button
            type="button"
            className={`rail-button ${showPhonetic ? "active" : ""}`}
            onClick={() => setShowPhonetic((v) => !v)}
          >
            <span style={{ fontSize: 12 }}>音标</span>
          </button>
          <div className="side-rail-divider" />
          <span className="muted rail-count">本轮 {pool.length} 词</span>
          <button
            className="primary-button small rail-submit"
            onClick={submitRound}
            disabled={!allMarked || submitting}
          >
            {submitting ? "提交中…" : allMarked ? <>确认本轮 <ArrowRight size={15} /></> : "标记全部单词"}
          </button>
        </aside>
      </div>
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
