"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ListChecks,
  NotebookPen,
  RotateCcw,
  Shuffle,
  Type,
  X,
  Zap,
} from "lucide-react";
import WordMeaning from "@/components/word-meaning";
import { warmupTts, warmupTtsPriority } from "@/components/tts-warmup";
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

const GROUP_SIZE = 5;

export default function Review({
  book,
  words,
}: {
  book: { id: string; name: string };
  words: Word[];
}) {
  const router = useRouter();

  const [showMeaning, setShowMeaning] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Word | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState("");
  const [groupIndex, setGroupIndex] = useState(0);

  // 强化学习状态机
  const [mode, setMode] = useState<"review" | "reinforce" | "select">("review");
  const [stage, setStage] = useState<"phase1" | "phase2" | "done">("phase1");
  const [phase1Left, setPhase1Left] = useState<string[]>([]); // 第一阶段剩余未点对的词 id
  const [phase2Pool, setPhase2Pool] = useState<string[]>([]); // 第二阶段需要打对错的词 id
  const [phase2Marks, setPhase2Marks] = useState<Record<string, Mark>>({});
  const [wrongResult, setWrongResult] = useState<{ ids: string[]; count: number } | null>(null);

  // 本次练习的词集与来源：group = 当前组的强化学习，mixed = 混组练习（所选组合集，随机打乱）
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [practiceSource, setPracticeSource] = useState<"group" | "mixed">("group");
  // 组选择界面：已勾选的组下标
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

  const totalGroups = Math.max(1, Math.ceil(words.length / GROUP_SIZE));
  const groupWords = words.slice(
    groupIndex * GROUP_SIZE,
    (groupIndex + 1) * GROUP_SIZE,
  );
  const isLastGroup = groupIndex >= totalGroups - 1;

  // 关键修复：`words` 是服务端 props，每进入一轮全新的单词识记都会生成新的数组引用。
  // 一旦 `words` 变化，所有「派生自 words 的本地状态」都必须重置，
  // 否则混组练习/强化学习会复用上一轮识记的旧词集（practiceWords 快照、selectedGroups 旧下标、groupIndex 等）。
  useEffect(() => {
    setMode("review");
    setStage("phase1");
    setPhase1Left([]);
    setPhase2Pool([]);
    setPhase2Marks({});
    setWrongResult(null);
    setPracticeWords([]);
    setPracticeSource("group");
    setSelectedGroups([]);
    setGroupIndex(0);
  }, [words]);

  // 预热 TTS 缓存：
  // - 识记主界面：当前组 + 下一组
  // - 组选择界面：勾选即预热，确认时发音已就绪
  // - 练习界面：本次练习词集
  useEffect(() => {
    if (mode === "select") {
      const texts = selectedGroups.flatMap((gi) =>
        words.slice(gi * GROUP_SIZE, (gi + 1) * GROUP_SIZE).map((w) => w.text),
      );
      if (texts.length > 0) warmupTts(texts, 3);
      return;
    }
    if (mode === "reinforce") {
      warmupTts(practiceWords.map((w) => w.text), 3);
      return;
    }
    const current = words
      .slice(groupIndex * GROUP_SIZE, (groupIndex + 1) * GROUP_SIZE)
      .map((w) => w.text);
    const next = words
      .slice((groupIndex + 1) * GROUP_SIZE, (groupIndex + 2) * GROUP_SIZE)
      .map((w) => w.text);
    warmupTtsPriority(current, next, 3);
  }, [mode, groupIndex, words, practiceWords, selectedGroups]);

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

  // ===== 强化学习 / 混组练习 =====

  // 启动一次练习：group 来源不打乱（单组强化学习），mixed 来源随机打乱
  const startPractice = (list: Word[], source: "group" | "mixed") => {
    const practice = source === "mixed" ? shuffleWords(list) : list;
    setPracticeWords(practice);
    setPracticeSource(source);
    setMode("reinforce");
    setStage("phase1");
    setPhase1Left(practice.map((w) => w.id));
    setPhase2Pool([]);
    setPhase2Marks({});
    setWrongResult(null);
  };

  const startReinforce = () => startPractice(groupWords, "group");

  // ===== 混组练习：组选择 =====

  const openGroupSelect = () => {
    setMode("select");
  };

  const exitSelect = () => {
    setMode("review");
  };

  const toggleGroup = (index: number) => {
    setSelectedGroups((prev) =>
      prev.includes(index)
        ? prev.filter((x) => x !== index)
        : [...prev, index].sort((a, b) => a - b),
    );
  };

  const selectAllGroups = () => {
    setSelectedGroups(Array.from({ length: totalGroups }, (_, i) => i));
  };

  const confirmMixed = () => {
    if (selectedGroups.length === 0) return;
    const list = selectedGroups.flatMap((gi) =>
      words.slice(gi * GROUP_SIZE, (gi + 1) * GROUP_SIZE),
    );
    startPractice(list, "mixed");
  };

  // 从练习完成页退出，回到单词识记
  const exitPractice = () => {
    setMode("review");
    setStage("phase1");
    setPhase1Left([]);
    setPhase2Pool([]);
    setPhase2Marks({});
    setWrongResult(null);
  };

  // 第一阶段：点对号，该词消失
  const phase1Confirm = (id: string) => {
    const next = phase1Left.filter((x) => x !== id);
    setPhase1Left(next);
    if (next.length === 0) {
      setStage("phase2");
      setPhase2Pool(practiceWords.map((w) => w.id));
      setPhase2Marks({});
      setWrongResult(null);
    }
  };

  // 第二阶段：打对错（点击后该词立即消失；全部判断完自动确认，与第一阶段一致）
  const phase2Mark = (id: string, value: Mark) => {
    const nextMarks = { ...phase2Marks, [id]: value };
    const remaining = phase2Pool.filter((x) => x !== id);
    setPhase2Marks(nextMarks);
    setPhase2Pool(remaining);
    if (remaining.length === 0) {
      const wrongIds = practiceWords
        .filter((w) => nextMarks[w.id] === "unknown")
        .map((w) => w.id);
      if (wrongIds.length === 0) {
        setWrongResult(null);
        setStage("done");
      } else {
        setWrongResult({ ids: wrongIds, count: wrongIds.length });
      }
    }
  };

  // 再练一次：只练错误词，重新进入第二阶段
  const retryPhase2 = () => {
    if (!wrongResult) return;
    setPhase2Pool(wrongResult.ids);
    setPhase2Marks({});
    setWrongResult(null);
  };

  // 学下一组（或全部结束进入学后检测）
  const goNextGroup = () => {
    if (isLastGroup) {
      router.push("/dashboard/student/vocabulary/reinforce");
      return;
    }
    setGroupIndex((current) => Math.min(totalGroups - 1, current + 1));
    setMode("review");
    setStage("phase1");
    setPhase1Left([]);
    setPhase2Pool([]);
    setPhase2Marks({});
    setWrongResult(null);
  };

  // 重新练习这组（重新强化学习）
  const redoGroup = () => {
    startReinforce();
  };

  // ===== 强化学习界面 =====

  // 显示切换侧栏：点击展示 / 再点击取消，默认均不展示
  const displayRail = (
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
  );

  if (mode === "reinforce") {
    const isMixed = practiceSource === "mixed";
    const phase1Words = practiceWords.filter((w) => phase1Left.includes(w.id));
    const phase2Words = practiceWords.filter((w) => phase2Pool.includes(w.id));

    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {isMixed ? "混组练习" : "强化学习"} · {book.name}
            </div>
            <h1>{isMixed ? "混组练习" : "强化学习"}</h1>
            <p>
              {isMixed
                ? `共 ${practiceWords.length} 词 · 随机打乱顺序`
                : `第 ${groupIndex + 1} 组 · 共 ${groupWords.length} 词`}
              {stage === "phase1" && " · 第一步：点对号表示已记住"}
              {stage === "phase2" && " · 第二步：判断是否掌握"}
            </p>
          </div>
          <span className="streak">
            {stage === "phase1" && `剩余 ${phase1Left.length} 词`}
            {stage === "phase2" && `剩余 ${phase2Pool.length} 词`}
            {stage === "done" && (isMixed ? "练习完成" : "本组完成")}
          </span>
        </div>

        {stage === "phase1" && (
          <>
            <div className="vocab-layout">
              <section className="word-list">
                {phase1Words.map((w) => {
                  const phonetic = w.phoneticUs ?? w.phoneticUk;
                  return (
                    <WordRow key={w.id} word={w.text}>
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
                          className="mark-button check"
                          onClick={(e) => {
                            e.stopPropagation();
                            phase1Confirm(w.id);
                          }}
                          aria-label="会"
                          title="会"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </WordRow>
                  );
                })}
                {phase1Words.length === 0 && (
                  <div className="empty-inline">本组单词已全部记住</div>
                )}
              </section>
              {displayRail}
            </div>
            <div className="pretest-footer">
              <span className="muted">点击对号，表示当前这轮已经记住这个单词</span>
            </div>
          </>
        )}

        {stage === "phase2" && (
          <>
            <div className="vocab-layout">
              <section className="word-list">
                {phase2Words.map((w) => {
                  const phonetic = w.phoneticUs ?? w.phoneticUk;
                  return (
                    <WordRow key={w.id} word={w.text} marked={Boolean(phase2Marks[w.id])}>
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
                          className={`mark-button check ${phase2Marks[w.id] === "known" ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            phase2Mark(w.id, "known");
                          }}
                          aria-label="会"
                          title="会"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          className={`mark-button cross ${phase2Marks[w.id] === "unknown" ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            phase2Mark(w.id, "unknown");
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
              {displayRail}
            </div>

            {wrongResult ? (
              <div className="reinforce-retry">
                <div className="reinforce-retry-text">
                  共错 <b>{wrongResult.count}</b> 个单词，继续巩固后再练一次。
                </div>
                <button type="button" className="primary-button" onClick={retryPhase2}>
                  <RotateCcw size={15} /> 共错 {wrongResult.count} 个单词，再练一次
                </button>
              </div>
            ) : (
              <div className="pretest-footer">
                <span className="muted">点击「会 / 不会」，判断该单词是否掌握</span>
              </div>
            )}
          </>
        )}

        {stage === "done" && (
          <div className="result-screen all-correct">
            <div className="result-icon"><Check size={34} /></div>
            <h2>{practiceSource === "mixed" ? "练习完成！" : "本组全部掌握！"}</h2>
            <p>
              {practiceSource === "mixed"
                ? "接下来重新练习这些词，还是换一批组？"
                : "接下来学下一组，还是重新练习这一组？"}
            </p>
            <div className="result-actions">
              {practiceSource === "mixed" ? (
                <>
                  <button
                    type="button"
                    className="primary-button small"
                    onClick={() => startPractice(practiceWords, "mixed")}
                  >
                    <RotateCcw size={14} /> 重新练习这些词
                  </button>
                  <button type="button" className="outline-button" onClick={openGroupSelect}>
                    <Shuffle size={14} /> 换一批组
                  </button>
                  <button type="button" className="outline-button" onClick={exitPractice}>
                    返回单词识记
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="primary-button small" onClick={goNextGroup}>
                    {isLastGroup ? "进入学后检测" : "学下一组"} <ArrowRight size={15} />
                  </button>
                  <button type="button" className="outline-button" onClick={redoGroup}>
                    <RotateCcw size={14} /> 重新练习这组
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ===== 混组练习：组选择界面 =====

  if (mode === "select") {
    const selectedWordCount = selectedGroups.reduce(
      (sum, gi) => sum + words.slice(gi * GROUP_SIZE, (gi + 1) * GROUP_SIZE).length,
      0,
    );
    const allSelected = selectedGroups.length === totalGroups;

    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">混组练习 · {book.name}</div>
            <h1>混组练习</h1>
            <p>勾选一个或多个组，把它们的单词合在一起随机练习。</p>
          </div>
          <span className="streak">共 {totalGroups} 组</span>
        </div>

        <div className="vocab-layout">
          <section className="group-list">
            {Array.from({ length: totalGroups }, (_, gi) => {
              const gw = words.slice(gi * GROUP_SIZE, (gi + 1) * GROUP_SIZE);
              const selected = selectedGroups.includes(gi);
              return (
                <div
                  key={gi}
                  className={`group-row ${selected ? "selected" : ""}`}
                  onClick={() => toggleGroup(gi)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`选择第 ${gi + 1} 组（${gw.length} 词）`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleGroup(gi);
                    }
                  }}
                >
                  <span className="group-check"><Check size={13} strokeWidth={3} /></span>
                  <div className="group-info">
                    <span className="group-name">第 {gi + 1} 组</span>
                    <div className="group-preview">
                      {gw.map((w) => (
                        <span key={w.id}>{w.text}</span>
                      ))}
                    </div>
                  </div>
                  <span className="group-count">{gw.length} 词</span>
                </div>
              );
            })}
          </section>

          <aside className="side-rail">
            <span className="nav-label">已选</span>
            <span className="rail-selected">
              {selectedGroups.length === 0
                ? "未选择"
                : `${selectedGroups.length} 组 · ${selectedWordCount} 词`}
            </span>
            <span className="rail-hint">
              {selectedGroups.length === 0
                ? "请在左侧勾选至少一个组"
                : selectedGroups.length === 1
                  ? "仅选一组时，练习内容与该组强化学习相同"
                  : "所选组的单词将随机打乱混合练习"}
            </span>
            <div className="side-rail-divider" />
            <button
              type="button"
              className={`rail-button ${allSelected ? "active" : ""}`}
              onClick={allSelected ? () => setSelectedGroups([]) : selectAllGroups}
            >
              <ListChecks size={16} /> {allSelected ? "清除全选" : "全选所有组"}
            </button>
            <div className="side-rail-divider" />
            <button
              className="primary-button small rail-submit"
              onClick={confirmMixed}
              disabled={selectedGroups.length === 0}
            >
              {selectedGroups.length === 0
                ? "请先选择组"
                : <>开始混组练习 <ArrowRight size={15} /></>}
            </button>
            <button className="outline-button small rail-submit" onClick={exitSelect}>
              返回识记
            </button>
          </aside>
        </div>
      </>
    );
  }

  // ===== 单词识记主界面 =====

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">单词识记 · {book.name}</div>
          <h1>单词识记</h1>
          <p>五个一组集中识记，每组可进入强化学习巩固。</p>
        </div>
        <span className="streak">
          第 {groupIndex + 1} / {totalGroups} 组 · 共 {words.length} 词
        </span>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {words.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BookOpen size={22} /></div>
          <h2>没有需要识记的单词</h2>
          <p>你已经掌握全部单词，或尚未进行学前检测。</p>
          <div className="result-actions">
            <Link href="/dashboard/student/vocabulary" className="primary-button small">返回背单词</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="vocab-layout">
            <section className="word-list">
              {groupWords.map((w) => {
                const phonetic = w.phoneticUs ?? w.phoneticUk;
                const hasNote = Boolean(w.note);
                return (
                  <WordRow key={w.id} word={w.text}>
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

          <div className="pretest-footer review-pager-footer">
            <span className="muted">
              第 {groupIndex + 1} / {totalGroups} 组
            </span>
            <div className="review-pager">
              <button
                type="button"
                className="outline-button"
                onClick={() => setGroupIndex((current) => Math.max(0, current - 1))}
                disabled={groupIndex === 0}
                aria-label="上一组"
                title={groupIndex === 0 ? "已经是第一组" : "上一组"}
              >
                <ArrowLeft size={16} /> 上一组
              </button>
              {isLastGroup ? (
                <Link
                  href="/dashboard/student/vocabulary/reinforce"
                  className="primary-button"
                >
                  进入学后检测 <ArrowRight size={16} />
                </Link>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    setGroupIndex((current) => Math.min(totalGroups - 1, current + 1))
                  }
                >
                  下一组 <ArrowRight size={16} />
                </button>
              )}
            </div>
            <div className="review-actions">
              <button type="button" className="outline-button" onClick={openGroupSelect}>
                <Shuffle size={15} /> 混组练习
              </button>
              <button type="button" className="outline-button" onClick={startReinforce}>
                <Zap size={15} /> 强化学习
              </button>
            </div>
          </div>
        </>
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

// 混组练习：随机打乱单词顺序（Fisher-Yates，返回新数组）
function shuffleWords<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
