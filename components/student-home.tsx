"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookA,
  BookOpen,
  GraduationCap,
  KeyRound,
  Link2,
  NotebookPen,
  Play,
  Sparkles,
} from "lucide-react";

type Teacher = { id: string; name: string; username: string };

export default function StudentHome({
  name,
  teachers,
}: {
  name: string;
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const acceptInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "绑定失败，请重试" });
        return;
      }
      setCode("");
      setMessage({ type: "ok", text: `已成功绑定老师：${data.teacher?.name ?? ""}` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">我的学习空间</div>
          <h1>早上好，{name}</h1>
          <p>准备好开始今天的学习了吗？</p>
        </div>
      </div>

      <section className="hero-card student-hero">
        <div className="hero-copy">
          <div className="eyebrow light-eyebrow"><Sparkles size={14} /> 今日学习计划</div>
          <h2>保持节奏，<br /><em>今天也会更好。</em></h2>
          <p>完成 3 个学习任务，预计用时 25 分钟。</p>
          <button className="light-button"><Play size={15} fill="currentColor" /> 开始今日学习</button>
        </div>
        <div className="progress-ring"><div><strong>64</strong><span>%</span><small>本周完成度</small></div></div>
      </section>

      <div className="section-heading">
        <div><h3>我的老师</h3><p>管理与你绑定的教师关系</p></div>
      </div>

      <section className="panel-card teacher-panel">
        {teachers.length > 0 ? (
          teachers.map((t) => (
            <div className="teacher-row" key={t.id}>
              <div className="avatar teal"><GraduationCap size={16} /></div>
              <div><strong>{t.name}</strong><span>@{t.username}</span></div>
              <span className="bound-badge">已绑定</span>
            </div>
          ))
        ) : (
          <div className="teacher-empty">
            <div className="empty-icon"><Link2 size={20} /></div>
            <p>还没有绑定老师，输入老师给你的邀请码即可建立连接。</p>
          </div>
        )}

        <form className="invite-accept" onSubmit={acceptInvite}>
          <div className="input-wrap invite-input">
            <KeyRound size={17} />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="输入邀请码，例如 LINGUA01"
              autoComplete="off"
            />
          </div>
          <button className="primary-button small" type="submit" disabled={loading || !code.trim()}>
            {loading ? "绑定中…" : <>绑定老师 <ArrowRight size={15} /></>}
          </button>
        </form>
        {message && (
          <div className={message.type === "ok" ? "form-success" : "form-error"} style={{ marginTop: 10 }}>
            {message.text}
          </div>
        )}
      </section>

      <div className="section-heading" style={{ marginTop: 32 }}>
        <div><h3>今日任务</h3><p>循序渐进，完成每一个小目标</p></div>
        <span className="streak"><Sparkles size={15} /> 已连续学习 6 天</span>
      </div>

      <section className="task-list">
        <div className="task-row"><div className="task-icon orange"><BookA size={20} /></div><div className="task-main"><strong>词汇 · Unit 12</strong><span>20 个新单词</span></div><div className="task-meta"><span>约 12 分钟</span></div><button className="task-start">开始 <ArrowRight size={15} /></button></div>
        <div className="task-row"><div className="task-icon purple"><NotebookPen size={20} /></div><div className="task-main"><strong>语法 · 现在完成时</strong><span>掌握语法规则与用法</span></div><div className="task-meta"><span>约 8 分钟</span></div><button className="task-start">开始 <ArrowRight size={15} /></button></div>
        <div className="task-row"><div className="task-icon teal"><BookOpen size={20} /></div><div className="task-main"><strong>阅读 · 城市里的自然</strong><span>B1 难度 · 约 560 词</span></div><div className="task-meta"><span>约 15 分钟</span></div><button className="task-start">开始 <ArrowRight size={15} /></button></div>
      </section>
    </>
  );
}
