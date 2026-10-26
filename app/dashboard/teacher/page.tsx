import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  Clock3,
  Plus,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const cardColors = ["orange", "purple", "teal"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || "L";
}

export default async function TeacherOverview() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TEACHER") redirect("/dashboard");

  const bindings = await prisma.teacherStudent.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    include: { student: { select: { id: true, name: true, username: true } } },
  });
  const students = bindings.map((b) => b.student);

  const now = new Date();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateLabel = `周${weekdays[now.getDay()]} · ${now.getMonth() + 1}月 ${now.getDate()}日`;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1>早上好，{user.name}</h1>
          <p>今天也来看看学生们的学习进展吧。</p>
        </div>
        <button className="outline-button"><Clock3 size={16} /> 本周计划 <ChevronDown size={15} /></button>
      </div>

      <section className="hero-card teacher-hero">
        <div className="hero-copy">
          <div className="eyebrow light-eyebrow"><Sparkles size={14} /> 本周学习概览</div>
          <h2>每一点进步，<br /><em>都值得被看见。</em></h2>
          <p>你目前共绑定 <b>{students.length}</b> 位学生。<br />学习数据将在接入学习记录后展示。</p>
          <Link href="/dashboard/teacher/students" className="light-button">管理学生 <ArrowUpRight size={16} /></Link>
        </div>
        <div className="hero-chart">
          <div className="chart-caption"><span>学生人数</span><strong>{students.length}</strong></div>
          <div className="mini-chart">
            {[42, 60, 49, 75, 64, 91, 70].map((h, i) => (
              <i key={i} className={i === 5 ? "highlight" : ""} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="chart-days"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
        </div>
      </section>

      <div className="section-heading">
        <div><h3>学生概况</h3><p>实时掌握每一位学生的学习状态</p></div>
        <Link href="/dashboard/teacher/students" className="text-button" style={{ textDecoration: "none" }}>管理学生 <ArrowUpRight size={15} /></Link>
      </div>

      <section className="student-grid">
        {students.map((s, i) => (
          <div className="student-card" key={s.id}>
            <div className="student-card-top">
              <div className={`avatar ${cardColors[i % cardColors.length]}`}>{initials(s.name)}</div>
            </div>
            <strong>{s.name}</strong>
            <span className="muted">@{s.username}</span>
            <div className="student-focus"><span className={`focus-dot ${cardColors[i % cardColors.length]}`} /> 已加入你的空间</div>
          </div>
        ))}
        <Link href="/dashboard/teacher/students" className="add-student-card" style={{ textDecoration: "none" }}>
          <span><Plus size={21} /></span>
          <strong>添加学生</strong>
          <small>生成邀请码邀请新学生</small>
        </Link>
      </section>

      <section className="lower-grid">
        <div className="panel-card">
          <div className="card-heading"><div><h3>最近动态</h3><p>学生们刚刚完成的学习</p></div></div>
          <div className="activity-row"><div className="activity-icon"><Sparkles size={17} /></div><div><strong>暂无学习动态</strong><small>接入学习记录后，这里会显示学生的最新学习情况</small></div></div>
        </div>
        <div className="panel-card focus-card">
          <div className="card-heading"><div><h3>邀请学生</h3><p>让更多学生加入你的空间</p></div></div>
          <div className="focus-item">
            <div><strong>生成一个邀请码</strong><span>学生用邀请码即可与你绑定</span></div>
            <Link href="/dashboard/teacher/students" className="small-arrow" style={{ textDecoration: "none" }}><ArrowUpRight size={15} /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
